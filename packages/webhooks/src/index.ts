import crypto from "node:crypto";
import { FoundryError } from "@backendfoundry/core";

export const WEBHOOK_SIGNATURE_HEADER = "x-foundry-signature";

export interface WebhookSignOptions {
  timestampSeconds?: number;
  scheme?: string;
}

export interface WebhookVerifyOptions {
  payload: string | Buffer;
  signatureHeader: string;
  secret: string | readonly string[];
  toleranceSeconds?: number;
  nowSeconds?: number;
  scheme?: string;
}

export interface WebhookVerificationResult {
  valid: boolean;
  reason?: "valid" | "missing_header" | "malformed_header" | "timestamp_expired" | "signature_mismatch";
  timestampSeconds?: number;
  matchedSecretIndex?: number;
}

export class WebhookVerificationError extends FoundryError {
  public readonly reason: string;
  constructor(reason: string, message: string) {
    super({
      code: "WEBHOOK_VERIFICATION_FAILED",
      message,
      statusCode: 401,
      category: "auth_error",
      expose: true,
      details: { reason }
    });
    this.reason = reason;
  }
}

function validateSecret(secret: string): void {
  if (typeof secret !== "string" || secret.trim().length < 8) {
    throw new FoundryError({
      code: "INVALID_WEBHOOK_SECRET",
      message: "Webhook signing secret must be a string of at least 8 characters",
      statusCode: 500,
      expose: false
    });
  }
}

export function computeWebhookHmac(payload: string | Buffer, timestampSeconds: number, secret: string): string {
  validateSecret(secret);
  const bodyString = typeof payload === "string" ? payload : payload.toString("utf8");
  const signedContent = `${timestampSeconds}.${bodyString}`;
  return crypto.createHmac("sha256", secret).update(signedContent, "utf8").digest("hex");
}

export function signWebhookPayload(
  payload: string | Buffer | Record<string, unknown>,
  secret: string,
  options: WebhookSignOptions = {}
): { signatureHeader: string; timestampSeconds: number; signature: string; rawBody: string } {
  validateSecret(secret);
  const timestampSeconds = options.timestampSeconds ?? Math.floor(Date.now() / 1000);
  const scheme = options.scheme ?? "v1";
  const rawBody =
    typeof payload === "string"
      ? payload
      : Buffer.isBuffer(payload)
      ? payload.toString("utf8")
      : JSON.stringify(payload);
  const signature = computeWebhookHmac(rawBody, timestampSeconds, secret);
  return {
    signatureHeader: `t=${timestampSeconds},${scheme}=${signature}`,
    timestampSeconds,
    signature,
    rawBody
  };
}

function constantTimeHexEqual(expectedHex: string, candidateHex: string): boolean {
  if (expectedHex.length !== candidateHex.length) return false;
  try {
    const a = Buffer.from(expectedHex, "hex");
    const b = Buffer.from(candidateHex, "hex");
    if (a.length === 0 || a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function verifyWebhookSignature(options: WebhookVerifyOptions): WebhookVerificationResult {
  const secrets = Array.isArray(options.secret) ? options.secret : [options.secret as string];
  if (secrets.length === 0) {
    throw new FoundryError({
      code: "INVALID_WEBHOOK_SECRET",
      message: "At least one webhook secret must be configured",
      statusCode: 500
    });
  }
  for (const s of secrets) validateSecret(s);

  if (!options.signatureHeader || typeof options.signatureHeader !== "string") {
    return { valid: false, reason: "missing_header" };
  }

  const scheme = options.scheme ?? "v1";
  const parts = options.signatureHeader.split(",").map((p) => p.trim());
  let timestampSeconds: number | undefined;
  const candidateSignatures: string[] = [];

  for (const part of parts) {
    const [k, v] = part.split("=");
    if (!k || !v) continue;
    if (k === "t") {
      const parsed = Number(v);
      if (Number.isInteger(parsed) && parsed > 0) {
        timestampSeconds = parsed;
      }
    } else if (k === scheme) {
      candidateSignatures.push(v);
    }
  }

  if (timestampSeconds === undefined || candidateSignatures.length === 0) {
    return { valid: false, reason: "malformed_header" };
  }

  const toleranceSeconds = options.toleranceSeconds ?? 300;
  const nowSeconds = options.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (toleranceSeconds > 0 && Math.abs(nowSeconds - timestampSeconds) > toleranceSeconds) {
    return { valid: false, reason: "timestamp_expired", timestampSeconds };
  }

  for (let sIdx = 0; sIdx < secrets.length; sIdx++) {
    const expectedSig = computeWebhookHmac(options.payload, timestampSeconds, secrets[sIdx]!);
    for (const candidate of candidateSignatures) {
      if (constantTimeHexEqual(expectedSig, candidate)) {
        return {
          valid: true,
          reason: "valid",
          timestampSeconds,
          matchedSecretIndex: sIdx
        };
      }
    }
  }

  return { valid: false, reason: "signature_mismatch", timestampSeconds };
}

export function verifyWebhookOrThrow(options: WebhookVerifyOptions): WebhookVerificationResult {
  const result = verifyWebhookSignature(options);
  if (!result.valid) {
    throw new WebhookVerificationError(
      result.reason ?? "invalid",
      `Webhook signature verification failed: ${result.reason ?? "invalid"}`
    );
  }
  return result;
}

export class MemoryWebhookDeduplicator {
  private readonly seen = new Map<string, number>();

  public checkAndRecord(eventId: string, ttlMs = 86_400_000, nowMs = Date.now()): { duplicate: boolean } {
    const existingExpiry = this.seen.get(eventId);
    if (existingExpiry !== undefined && nowMs < existingExpiry) {
      return { duplicate: true };
    }
    this.seen.set(eventId, nowMs + ttlMs);
    return { duplicate: false };
  }
}
