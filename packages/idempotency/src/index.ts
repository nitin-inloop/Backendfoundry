import crypto from "node:crypto";
import { FoundryError, normalizeHeaders } from "@backendfoundry/core";
import { ConflictError, BadRequestError } from "@backendfoundry/errors";

export const IDEMPOTENCY_HEADER = "idempotency-key";

export interface StoredIdempotencyRecord<T = unknown> {
  key: string;
  fingerprint: string;
  status: "in_progress" | "completed";
  statusCode?: number;
  headers?: Record<string, string>;
  body?: T;
  createdAtMs: number;
  expiresAtMs: number;
}

export interface IdempotencyStore {
  acquire(record: StoredIdempotencyRecord, nowMs?: number): Promise<{ acquired: true } | { acquired: false; existing: StoredIdempotencyRecord }>;
  complete(key: string, update: { statusCode: number; headers?: Record<string, string>; body: unknown; ttlMs: number }, nowMs?: number): Promise<void>;
  release(key: string): Promise<void>;
  get(key: string, nowMs?: number): Promise<StoredIdempotencyRecord | null>;
}

/**
 * Process-local atomic idempotency store.
 * For multi-instance deployments, use a Redis store with SET NX PX semantics.
 */
export class MemoryIdempotencyStore implements IdempotencyStore {
  private readonly records = new Map<string, StoredIdempotencyRecord>();

  public async acquire(
    record: StoredIdempotencyRecord,
    nowMs = Date.now()
  ): Promise<{ acquired: true } | { acquired: false; existing: StoredIdempotencyRecord }> {
    const current = this.records.get(record.key);
    if (current && nowMs < current.expiresAtMs) {
      return { acquired: false, existing: current };
    }
    this.records.set(record.key, { ...record });
    return { acquired: true };
  }

  public async complete(
    key: string,
    update: { statusCode: number; headers?: Record<string, string>; body: unknown; ttlMs: number },
    nowMs = Date.now()
  ): Promise<void> {
    const existing = this.records.get(key);
    if (!existing) return;
    this.records.set(key, {
      ...existing,
      status: "completed",
      statusCode: update.statusCode,
      headers: update.headers ?? {},
      body: update.body,
      expiresAtMs: nowMs + update.ttlMs
    });
  }

  public async release(key: string): Promise<void> {
    this.records.delete(key);
  }

  public async get(key: string, nowMs = Date.now()): Promise<StoredIdempotencyRecord | null> {
    const rec = this.records.get(key);
    if (!rec) return null;
    if (nowMs >= rec.expiresAtMs) {
      this.records.delete(key);
      return null;
    }
    return rec;
  }
}

function canonicalizeValue(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map(canonicalizeValue).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  const sortedKeys = Object.keys(obj).sort();
  const entries = sortedKeys.map((k) => `${JSON.stringify(k)}:${canonicalizeValue(obj[k])}`);
  return `{${entries.join(",")}}`;
}

export function computeRequestFingerprint(input: {
  method?: string;
  path?: string;
  body?: unknown;
  scope?: string;
}): string {
  const canonical = [
    (input.scope ?? "default").toLowerCase(),
    (input.method ?? "POST").toUpperCase(),
    input.path ?? "/",
    canonicalizeValue(input.body ?? null)
  ].join("|");
  return crypto.createHash("sha256").update(canonical).digest("hex");
}

export function extractIdempotencyKey(
  headers: Record<string, string | string[] | undefined> | undefined,
  headerName = IDEMPOTENCY_HEADER
): string | null {
  const normalized = normalizeHeaders(headers);
  const raw = normalized[headerName.toLowerCase()] ?? normalized["x-idempotency-key"];
  if (!raw) return null;
  const trimmed = raw.trim();
  if (trimmed.length < 4 || trimmed.length > 255) {
    throw new BadRequestError("Idempotency-Key header must be between 4 and 255 characters", undefined, "INVALID_IDEMPOTENCY_KEY");
  }
  return trimmed;
}

export class IdempotencyPayloadMismatchError extends FoundryError {
  constructor(key: string) {
    super({
      code: "IDEMPOTENCY_FINGERPRINT_MISMATCH",
      message: `Idempotency key '${key}' was already used with a different request payload`,
      statusCode: 422,
      category: "conflict",
      expose: true,
      details: { idempotencyKey: key }
    });
  }
}

export class IdempotencyInProgressError extends ConflictError {
  constructor(key: string) {
    super(
      `A request with Idempotency-Key '${key}' is currently in progress`,
      { idempotencyKey: key },
      "IDEMPOTENCY_IN_PROGRESS"
    );
  }
}

export interface IdempotencyConfig {
  store?: IdempotencyStore;
  ttlMs?: number;
  lockTimeoutMs?: number;
  required?: boolean;
  headerName?: string;
  now?: () => number;
}

export interface IdempotencyExecutionResult<T> {
  replayed: boolean;
  statusCode: number;
  headers: Record<string, string>;
  body: T;
  key: string;
  fingerprint: string;
}

export function createIdempotencyGuard(config: IdempotencyConfig = {}) {
  const store = config.store ?? new MemoryIdempotencyStore();
  const ttlMs = config.ttlMs ?? 86_400_000; // 24h default
  const lockTimeoutMs = config.lockTimeoutMs ?? 30_000;
  const nowFn = config.now ?? (() => Date.now());

  async function execute<T>(
    request: {
      key: string;
      method?: string;
      path?: string;
      body?: unknown;
      scope?: string;
    },
    handler: () => Promise<{ statusCode?: number; headers?: Record<string, string>; body: T }>
  ): Promise<IdempotencyExecutionResult<T>> {
    const key = request.key.trim();
    if (!key) {
      throw new BadRequestError("Idempotency key cannot be empty", undefined, "INVALID_IDEMPOTENCY_KEY");
    }

    const fingerprint = computeRequestFingerprint(request);
    const now = nowFn();

    const lockAttempt = await store.acquire(
      {
        key,
        fingerprint,
        status: "in_progress",
        createdAtMs: now,
        expiresAtMs: now + lockTimeoutMs
      },
      now
    );

    if (!lockAttempt.acquired) {
      const existing = lockAttempt.existing;
      if (existing.fingerprint !== fingerprint) {
        throw new IdempotencyPayloadMismatchError(key);
      }
      if (existing.status === "in_progress") {
        throw new IdempotencyInProgressError(key);
      }
      return {
        replayed: true,
        statusCode: existing.statusCode ?? 200,
        headers: {
          ...(existing.headers ?? {}),
          "X-Idempotency-Key": key,
          "X-Idempotency-Replayed": "true"
        },
        body: existing.body as T,
        key,
        fingerprint
      };
    }

    try {
      const outcome = await handler();
      const statusCode = outcome.statusCode ?? 200;
      const headers = {
        ...(outcome.headers ?? {}),
        "X-Idempotency-Key": key,
        "X-Idempotency-Replayed": "false"
      };
      await store.complete(
        key,
        {
          statusCode,
          headers: outcome.headers,
          body: outcome.body,
          ttlMs
        },
        nowFn()
      );
      return {
        replayed: false,
        statusCode,
        headers,
        body: outcome.body,
        key,
        fingerprint
      };
    } catch (err) {
      // Release lock on failure so client can retry safely
      await store.release(key);
      throw err;
    }
  }

  return {
    execute,
    extractKey: (headers: Record<string, string | string[] | undefined> | undefined) =>
      extractIdempotencyKey(headers, config.headerName),
    computeRequestFingerprint
  };
}
