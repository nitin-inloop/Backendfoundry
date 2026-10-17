/**
 * Server-side playground scenarios. Every scenario executes the real
 * @backendfoundry/* package code (the same dist/ output published to npm).
 * Time-based components (rate-limit, retry, circuit-breaker, cache) run on an
 * injected virtual clock so results are deterministic and instant.
 *
 * Imported only from app/api/playground/** route handlers (Node.js runtime).
 */
import {
  extractOrGenerateRequestId,
  FoundryError,
  isValidRequestId,
  paginated,
  parseEnvBoolean,
  parseEnvEnum,
  parseEnvInt,
  parseEnvString
} from "@backendfoundry/core";
import { v, validateBody, ValidationError } from "@backendfoundry/validation";
import { createRateLimiter, type RateLimitDecision } from "@backendfoundry/rate-limit";
import { createRetry, RetryExhaustedError, type JitterStrategy } from "@backendfoundry/retry";
import { createCircuitBreaker, CircuitOpenError, type CircuitStateChangeEvent } from "@backendfoundry/circuit-breaker";
import { createCache } from "@backendfoundry/cache";
import { createIdempotencyGuard } from "@backendfoundry/idempotency";
import { MemoryWebhookDeduplicator, signWebhookPayload, verifyWebhookSignature } from "@backendfoundry/webhooks";
import { createHealthRegistry } from "@backendfoundry/health";
import {
  BadRequestError,
  ConflictError,
  DependencyFailedError,
  ForbiddenError,
  GatewayTimeoutError,
  NotFoundError,
  RateLimitExceededError,
  toSafeErrorResponse,
  UnauthorizedError
} from "@backendfoundry/errors";
import { createLogger, MemoryLogTransport, runWithRequestContext } from "@backendfoundry/logger";
import {
  createAiClient,
  MockAiProvider,
  type AiGenerateRequest,
  type AiGenerateResponse,
  type AiProviderAdapter
} from "@backendfoundry/ai";
import { getPackageBySlug, type PlaygroundDef, type PlaygroundInputDef } from "../registry";
import type { ScenarioResult, SummaryItem, TimelineEvent } from "./types";

export class PlaygroundInputError extends Error {
  public readonly field?: string;
  constructor(message: string, field?: string) {
    super(message);
    this.name = "PlaygroundInputError";
    this.field = field;
  }
}

export class UnknownScenarioError extends Error {}

type Inputs = Record<string, string | number | boolean>;

const MAX_JSON_CHARS = 20_000;
const MAX_TOKENS = 200;

/** Merge user input with registry defaults and coerce to the declared types (with bounds). */
export function coerceInputs(def: PlaygroundDef, raw: Record<string, unknown>): Inputs {
  const out: Inputs = {};
  for (const input of def.inputs) {
    const value = raw[input.key];
    out[input.key] = coerceOne(input, value === undefined || value === null || value === "" ? input.default : value);
  }
  return out;
}

function coerceOne(input: PlaygroundInputDef, value: unknown): string | number | boolean {
  switch (input.type) {
    case "number": {
      const n = typeof value === "number" ? value : Number(String(value).trim());
      if (!Number.isFinite(n)) throw new PlaygroundInputError(`"${input.label}" must be a number`, input.key);
      let clamped = n;
      if (input.min !== undefined) clamped = Math.max(input.min, clamped);
      if (input.max !== undefined) clamped = Math.min(input.max, clamped);
      return clamped;
    }
    case "boolean":
      if (typeof value === "boolean") return value;
      return ["true", "1", "on", "yes"].includes(String(value).toLowerCase());
    case "select": {
      const s = String(value);
      if (input.options && !input.options.includes(s)) {
        throw new PlaygroundInputError(`"${input.label}" must be one of: ${input.options.join(", ")}`, input.key);
      }
      return s;
    }
    default: {
      const s = typeof value === "string" ? value : JSON.stringify(value);
      if (s.length > MAX_JSON_CHARS) throw new PlaygroundInputError(`"${input.label}" is too large`, input.key);
      return s;
    }
  }
}

function parseJson<T = unknown>(text: string, field: string): T {
  try {
    return JSON.parse(text) as T;
  } catch (err) {
    throw new PlaygroundInputError(`Invalid JSON in "${field}": ${err instanceof Error ? err.message : String(err)}`, field);
  }
}

function tokens(text: string): string[] {
  const list = text.split(/[\s,]+/).map((t) => t.trim()).filter(Boolean);
  if (list.length > MAX_TOKENS) throw new PlaygroundInputError(`Sequence is limited to ${MAX_TOKENS} steps`, "sequence");
  return list;
}

function parseWait(token: string): number | null {
  const m = /^wait:(\d+)(ms|s)?$/i.exec(token);
  if (!m) return null;
  const n = Number(m[1]);
  return Math.min(86_400_000, m[2]?.toLowerCase() === "s" ? n * 1000 : n);
}

const str = (v: unknown) => String(v);
const num = (v: unknown) => Number(v);
const bool = (v: unknown) => v === true;

function errorJson(err: unknown): unknown {
  if (err instanceof FoundryError) return err.toJSON(true);
  if (err instanceof Error) return { name: err.name, message: err.message };
  return { thrown: err };
}

interface ScenarioPartial {
  summary: SummaryItem[];
  timeline: TimelineEvent[];
  output: unknown;
  logs?: string[];
  code: string;
  simulatedClock?: boolean;
}

type Runner = (inputs: Inputs) => Promise<ScenarioPartial>;

// ---------------------------------------------------------------------------
// core
// ---------------------------------------------------------------------------
const runCore: Runner = async (i) => {
  const incoming = str(i.incomingRequestId);
  const prefix = str(i.prefix);
  const accepted = isValidRequestId(incoming);
  const requestId = extractOrGenerateRequestId(incoming ? { "x-request-id": incoming } : {}, { prefix });
  const timeline: TimelineEvent[] = [
    {
      label: accepted ? "Incoming x-request-id accepted" : incoming ? "Incoming x-request-id rejected" : "No incoming x-request-id",
      detail: accepted ? `Trusted upstream ID: ${incoming}` : `Generated a fresh ID with prefix "${prefix}" -> ${requestId}`,
      status: accepted ? "ok" : incoming ? "warn" : "info"
    }
  ];

  const page = Math.floor(num(i.page));
  const pageSize = Math.floor(num(i.pageSize));
  const totalItems = Math.floor(num(i.totalItems));
  const start = (page - 1) * pageSize;
  const items = Array.from({ length: Math.max(0, Math.min(pageSize, totalItems - start, 100)) }, (_, k) => ({
    id: `item_${start + k + 1}`
  }));
  const envelope = paginated(items, { page, pageSize, totalItems }, { requestId });
  timeline.push({
    label: `paginated() -> page ${envelope.meta.pagination?.page}/${envelope.meta.pagination?.totalPages}`,
    detail: `${items.length} item(s), hasNextPage=${envelope.meta.pagination?.hasNextPage}`,
    status: "ok"
  });

  const envRaw = parseJson<Record<string, unknown>>(str(i.env), "env");
  if (!envRaw || typeof envRaw !== "object" || Array.isArray(envRaw)) throw new PlaygroundInputError("env must be a JSON object", "env");
  const env: Record<string, string | undefined> = Object.fromEntries(Object.entries(envRaw).map(([k, val]) => [k, val == null ? undefined : String(val)]));
  const parsers: Array<[string, string, () => unknown]> = [
    ["PORT", "parseEnvInt(min 1024, max 65535)", () => parseEnvInt("PORT", env, { min: 1024, max: 65535 })],
    ["DEBUG", "parseEnvBoolean()", () => parseEnvBoolean("DEBUG", env)],
    ["NODE_ENV", "parseEnvEnum(development|staging|production)", () => parseEnvEnum("NODE_ENV", ["development", "staging", "production"] as const, env)],
    ["DATABASE_URL", "parseEnvString(minLength 12)", () => parseEnvString("DATABASE_URL", env, { minLength: 12, secret: true })]
  ];
  const envResults: Record<string, unknown> = {};
  let envFailures = 0;
  for (const [key, label, fn] of parsers) {
    try {
      const value = fn();
      envResults[key] = { ok: true, value };
      timeline.push({ label: `${key} ✓`, detail: `${label} -> ${JSON.stringify(value)}`, status: "ok" });
    } catch (err) {
      envFailures++;
      const fe = err as FoundryError;
      envResults[key] = { ok: false, serverLog: fe.message, clientSees: fe.toJSON() };
      timeline.push({ label: `${key} ✗ ${fe.code}`, detail: `${fe.message} (raw value never echoed)`, status: "error" });
    }
  }

  return {
    summary: [
      { label: "Request ID", value: requestId, tone: accepted ? "good" : "neutral" },
      { label: "Incoming ID trusted", value: accepted, tone: accepted ? "good" : "warn" },
      { label: "Total pages", value: envelope.meta.pagination?.totalPages ?? 1 },
      { label: "Env errors", value: envFailures, tone: envFailures ? "bad" : "good" }
    ],
    timeline,
    output: { envelope, env: envResults },
    code: `import { extractOrGenerateRequestId, paginated, parseEnvInt } from "@backendfoundry/core";

const requestId = extractOrGenerateRequestId(req.headers, { prefix: ${JSON.stringify(prefix)} });
const body = paginated(items, { page: ${page}, pageSize: ${pageSize}, totalItems: ${totalItems} }, { requestId });
const port = parseEnvInt("PORT", process.env, { min: 1024, max: 65535 });`
  };
};

// ---------------------------------------------------------------------------
// validation
// ---------------------------------------------------------------------------
const runValidation: Runner = async (i) => {
  const body = parseJson(str(i.body), "body");
  const strict = bool(i.strict);
  const base = v.object({
    email: v.string().trim().email(),
    password: v.string().min(12),
    age: v.number().int().min(18),
    plan: v.enum(["free", "pro", "team"] as const),
    tags: v.array(v.string().min(2)).max(3).optional()
  });
  const schema = strict ? base.strict() : base;
  const requestId = "req_playground_validation";
  try {
    const data = validateBody(schema, body, requestId);
    return {
      summary: [
        { label: "Result", value: "valid", tone: "good" },
        { label: "Issues", value: 0, tone: "good" }
      ],
      timeline: [{ label: "validateBody() passed", detail: "Typed, trimmed data returned to the handler", status: "ok" }],
      output: { status: 200, data },
      code: schemaCode(strict)
    };
  } catch (err) {
    if (!(err instanceof ValidationError)) throw err;
    return {
      summary: [
        { label: "Result", value: "invalid", tone: "bad" },
        { label: "HTTP status", value: err.statusCode, tone: "bad" },
        { label: "Issues", value: err.issues.length, tone: "bad" }
      ],
      timeline: err.issues.map((issue) => ({
        label: `${issue.path} · ${issue.code}`,
        detail: issue.message,
        status: "error" as const
      })),
      output: { status: err.statusCode, body: err.toJSON() },
      code: schemaCode(strict)
    };
  }
};

function schemaCode(strict: boolean) {
  return `import { v, validateBody } from "@backendfoundry/validation";

const SignupSchema = v.object({
  email: v.string().trim().email(),
  password: v.string().min(12),
  age: v.number().int().min(18),
  plan: v.enum(["free", "pro", "team"]),
  tags: v.array(v.string().min(2)).max(3).optional()
})${strict ? ".strict()" : ""};

const input = validateBody(SignupSchema, req.body); // throws ValidationError (400)`;
}

// ---------------------------------------------------------------------------
// rate-limit
// ---------------------------------------------------------------------------
const runRateLimit: Runner = async (i) => {
  const limit = Math.floor(num(i.limit));
  const windowMs = Math.floor(num(i.windowMs));
  const requests = Math.floor(num(i.requests));
  const intervalMs = Math.floor(num(i.intervalMs));
  const algorithm = str(i.algorithm) as "sliding-window" | "fixed-window";
  const t0 = 1_700_000_000_000;
  let now = t0;
  const limiter = createRateLimiter({ limit, windowMs, algorithm, now: () => now });
  const decisions: RateLimitDecision[] = [];
  const timeline: TimelineEvent[] = [];
  for (let n = 1; n <= requests; n++) {
    const d = await limiter.check({ key: "client:203.0.113.7" });
    decisions.push(d);
    timeline.push({
      at: `t+${now - t0}ms`,
      label: `#${n} ${d.allowed ? "200 allowed" : "429 blocked"}`,
      detail: d.allowed
        ? `remaining ${d.remaining}/${d.limit}`
        : `Retry-After ${d.retryAfterSeconds}s · window resets in ${Math.max(0, d.resetAtMs - now)}ms`,
      status: d.allowed ? "ok" : "error"
    });
    now += intervalMs;
  }
  const allowed = decisions.filter((d) => d.allowed).length;
  const last = decisions[decisions.length - 1];
  return {
    simulatedClock: true,
    summary: [
      { label: "Allowed", value: allowed, tone: "good" },
      { label: "Blocked (429)", value: requests - allowed, tone: requests - allowed ? "bad" : "good" },
      { label: "Algorithm", value: algorithm },
      { label: "Burst duration", value: `${(requests - 1) * intervalMs}ms` }
    ],
    timeline,
    output: { lastDecisionHeaders: last?.headers, lastDecision: last },
    code: `import { createRateLimiter } from "@backendfoundry/rate-limit";

const limiter = createRateLimiter({ limit: ${limit}, windowMs: ${windowMs}, algorithm: "${algorithm}" });

const decision = await limiter.check({ key: \`client:\${ip}\` });
for (const [k, v] of Object.entries(decision.headers)) res.setHeader(k, v);
if (!decision.allowed) return res.status(429).end();`
  };
};

// ---------------------------------------------------------------------------
// retry
// ---------------------------------------------------------------------------
const runRetry: Runner = async (i) => {
  const failuresBeforeSuccess = Math.floor(num(i.failuresBeforeSuccess));
  const maxAttempts = Math.floor(num(i.maxAttempts));
  const initialDelayMs = num(i.initialDelayMs);
  const backoffFactor = num(i.backoffFactor);
  const maxDelayMs = num(i.maxDelayMs);
  const jitter = str(i.jitter) as JitterStrategy;
  const status = Number(i.errorStatus);
  let clock = 0;
  const timeline: TimelineEvent[] = [];
  const code = `import { createRetry } from "@backendfoundry/retry";

const retry = createRetry({
  maxAttempts: ${maxAttempts},
  initialDelayMs: ${initialDelayMs},
  maxDelayMs: ${maxDelayMs},
  backoffFactor: ${backoffFactor},
  jitter: "${jitter}"
});

const report = await retry.executeWithMetadata(async (attempt, signal) => callInventoryApi({ signal }));`;

  let retry: ReturnType<typeof createRetry>;
  try {
    retry = createRetry({
      maxAttempts,
      initialDelayMs,
      maxDelayMs,
      backoffFactor,
      jitter,
      sleep: async (ms: number) => {
        clock += ms;
      },
      onRetry: (m) => {
        timeline.push({ at: `t+${Math.round(clock)}ms`, label: `backoff ${m.delayMs}ms`, detail: `before attempt ${m.attempt + 1}`, status: "info", magnitude: m.delayMs });
      }
    });
  } catch (err) {
    return {
      summary: [{ label: "Config", value: "invalid", tone: "bad" }],
      timeline: [{ label: "createRetry() rejected the configuration", detail: (err as Error).message, status: "error" }],
      output: errorJson(err),
      code
    };
  }

  let calls = 0;
  try {
    const report = await retry.executeWithMetadata(async (attempt) => {
      calls++;
      if (calls <= failuresBeforeSuccess) {
        const err =
          status === 400
            ? new BadRequestError("Upstream rejected the request (400)")
            : new FoundryError({ code: `UPSTREAM_${status}`, message: `Upstream responded with HTTP ${status}`, statusCode: status });
        timeline.push({ at: `t+${Math.round(clock)}ms`, label: `attempt ${attempt} failed`, detail: err.message, status: "error" });
        throw err;
      }
      timeline.push({ at: `t+${Math.round(clock)}ms`, label: `attempt ${attempt} succeeded`, detail: "HTTP 200", status: "ok" });
      return { sku: "sku_42", inStock: 17, servedOnAttempt: attempt };
    });
    return {
      simulatedClock: true,
      summary: [
        { label: "Outcome", value: "success", tone: "good" },
        { label: "Attempts", value: report.attempts },
        { label: "Total backoff", value: `${report.delaysMs.reduce((a, b) => a + b, 0)}ms` },
        { label: "Delays", value: report.delaysMs.join(" → ") || "none" }
      ],
      timeline,
      output: { result: report.result, attempts: report.attempts, delaysMs: report.delaysMs },
      code
    };
  } catch (err) {
    const exhausted = err instanceof RetryExhaustedError;
    return {
      simulatedClock: true,
      summary: [
        { label: "Outcome", value: exhausted ? "retries exhausted" : "not retried", tone: "bad" },
        { label: "Attempts", value: calls },
        { label: "Error", value: err instanceof FoundryError ? err.code : "Error", tone: "bad" }
      ],
      timeline,
      output: {
        error: errorJson(err),
        clientResponse: toSafeErrorResponse(err).body,
        note: exhausted ? "RetryExhaustedError carries attempts and delays; 5xx details are hidden from clients." : "defaultShouldRetry() does not retry 4xx client errors (except 408/429)."
      },
      code
    };
  }
};

// ---------------------------------------------------------------------------
// circuit-breaker
// ---------------------------------------------------------------------------
const runCircuitBreaker: Runner = async (i) => {
  const failureThreshold = Math.floor(num(i.failureThreshold));
  const successThreshold = Math.floor(num(i.successThreshold));
  const resetTimeoutMs = Math.floor(num(i.resetTimeoutMs));
  const steps = tokens(str(i.sequence));
  let now = 0;
  const transitions: CircuitStateChangeEvent[] = [];
  const breaker = createCircuitBreaker({
    name: "payments-api",
    failureThreshold,
    successThreshold,
    resetTimeoutMs,
    now: () => now,
    onStateChange: (e) => transitions.push(e)
  });
  const timeline: TimelineEvent[] = [];
  let seen = 0;
  const flushTransitions = () => {
    for (; seen < transitions.length; seen++) {
      const e = transitions[seen]!;
      timeline.push({ at: `t+${e.timestamp}ms`, label: `${e.from} → ${e.to}`, detail: e.reason, status: e.to === "OPEN" ? "error" : e.to === "HALF_OPEN" ? "warn" : "ok" });
    }
  };
  let calls = 0;
  let rejected = 0;
  for (const step of steps) {
    const wait = parseWait(step);
    if (wait !== null) {
      now += wait;
      timeline.push({ at: `t+${now}ms`, label: `clock +${wait}ms`, status: "info" });
      breaker.getStats();
      flushTransitions();
      continue;
    }
    const lower = step.toLowerCase();
    const shouldFail = ["fail", "f", "error", "err", "x"].includes(lower);
    if (!shouldFail && !["ok", "s", "success", "pass"].includes(lower)) {
      throw new PlaygroundInputError(`Unknown step "${step}". Use ok, fail or wait:<ms>.`, "sequence");
    }
    calls++;
    const before = breaker.getStats().state;
    flushTransitions();
    let invoked = false;
    try {
      await breaker.execute(async () => {
        invoked = true;
        if (shouldFail) throw new Error("upstream 503 Service Unavailable");
        return "ok";
      });
      timeline.push({ at: `t+${now}ms`, label: `call ${calls}: success`, detail: `state ${before}`, status: "ok" });
    } catch (err) {
      if (err instanceof CircuitOpenError && !invoked) {
        rejected++;
        timeline.push({ at: `t+${now}ms`, label: `call ${calls}: rejected fast`, detail: `CIRCUIT_OPEN (503) · upstream not called · retry in ${err.retryAfterMs}ms`, status: "warn" });
      } else {
        timeline.push({ at: `t+${now}ms`, label: `call ${calls}: failure`, detail: `state ${before} · ${(err as Error).message}`, status: "error" });
      }
    }
    flushTransitions();
  }
  const stats = breaker.getStats();
  flushTransitions();
  return {
    simulatedClock: true,
    summary: [
      { label: "Final state", value: stats.state, tone: stats.state === "CLOSED" ? "good" : stats.state === "OPEN" ? "bad" : "warn" },
      { label: "Transitions", value: transitions.length },
      { label: "Rejected (fast-fail)", value: rejected, tone: rejected ? "warn" : "neutral" },
      { label: "Failures / successes", value: `${stats.failures} / ${stats.successes}` }
    ],
    timeline,
    output: { stats, transitions },
    code: `import { createCircuitBreaker } from "@backendfoundry/circuit-breaker";

const breaker = createCircuitBreaker({
  name: "payments-api",
  failureThreshold: ${failureThreshold},
  successThreshold: ${successThreshold},
  resetTimeoutMs: ${resetTimeoutMs},
  onStateChange: (e) => logger.warn(\`\${e.name}: \${e.from} -> \${e.to}\`)
});

const charge = await breaker.execute(() => payments.charge(order));`
  };
};

// ---------------------------------------------------------------------------
// cache
// ---------------------------------------------------------------------------
const runCache: Runner = async (i) => {
  const ttlMs = Math.floor(num(i.ttlMs));
  const latency = Math.floor(num(i.loaderLatencyMs));
  const scope = str(i.scope).trim() || "global";
  const steps = tokens(str(i.sequence));
  let now = 0;
  const cache = createCache({ namespace: "playground", defaultTtlMs: ttlMs, now: () => now });
  let loaderCalls = 0;
  const timeline: TimelineEvent[] = [];
  let servedMs = 0;
  for (const step of steps) {
    const wait = parseWait(step);
    if (wait !== null) {
      now += wait;
      timeline.push({ at: `t+${now}ms`, label: `clock +${wait}ms`, status: "info" });
      continue;
    }
    if (step.startsWith("del:")) {
      const key = step.slice(4);
      const removed = await cache.delete(key, { scope });
      timeline.push({ at: `t+${now}ms`, label: `delete ${key}`, detail: removed ? "invalidated" : "nothing to delete", status: "info" });
      continue;
    }
    const startedAt = now;
    const { value, hit } = await cache.getOrSet(
      step,
      async () => {
        loaderCalls++;
        now += latency;
        return { key: step, loadedAt: `t+${now}ms`, load: loaderCalls };
      },
      { scope, ttlMs }
    );
    servedMs += now - startedAt;
    timeline.push({
      at: `t+${startedAt}ms`,
      label: `${hit ? "HIT " : "MISS"} ${step}`,
      detail: hit ? `served from cache (load #${(value as { load: number }).load})` : `loader ran (${latency}ms) · key ${cache.buildKey(step, scope)} · expires t+${now + ttlMs}ms`,
      status: hit ? "ok" : "warn",
      magnitude: hit ? 0 : latency
    });
  }
  const stats = cache.getStats();
  const lookups = stats.hits + stats.misses;
  return {
    simulatedClock: true,
    summary: [
      { label: "Hits", value: stats.hits, tone: "good" },
      { label: "Misses", value: stats.misses, tone: stats.misses ? "warn" : "good" },
      { label: "Hit ratio", value: lookups ? `${Math.round((stats.hits / lookups) * 100)}%` : "n/a" },
      { label: "Loader calls", value: loaderCalls },
      { label: "Time in loaders", value: `${servedMs}ms` }
    ],
    timeline,
    output: { stats },
    code: `import { createCache } from "@backendfoundry/cache";

const cache = createCache({ namespace: "playground", defaultTtlMs: ${ttlMs} });

const { value, hit } = await cache.getOrSet(key, () => db.users.find(key), {
  scope: ${JSON.stringify(scope)},
  ttlMs: ${ttlMs}
});`
  };
};

// ---------------------------------------------------------------------------
// idempotency
// ---------------------------------------------------------------------------
const runIdempotency: Runner = async (i) => {
  const list = parseJson<unknown>(str(i.requests), "requests");
  if (!Array.isArray(list)) throw new PlaygroundInputError("requests must be a JSON array", "requests");
  if (list.length > 50) throw new PlaygroundInputError("At most 50 requests", "requests");
  const path = str(i.path) || "/v1/payments";
  const guard = createIdempotencyGuard({ ttlMs: 86_400_000 });
  let handlerRuns = 0;
  const timeline: TimelineEvent[] = [];
  const responses: unknown[] = [];
  let replayed = 0;
  let rejectedCount = 0;
  for (const [idx, raw] of list.entries()) {
    const req = (raw ?? {}) as { key?: unknown; body?: unknown; method?: unknown; scope?: unknown };
    const key = String(req.key ?? "");
    try {
      const res = await guard.execute(
        { key, method: typeof req.method === "string" ? req.method : "POST", path, body: req.body, scope: typeof req.scope === "string" ? req.scope : undefined },
        async () => {
          handlerRuns++;
          const body = req.body as { amount?: unknown; currency?: unknown } | undefined;
          return { statusCode: 201, body: { paymentId: `pay_${String(handlerRuns).padStart(4, "0")}`, amount: body?.amount, currency: body?.currency } };
        }
      );
      if (res.replayed) replayed++;
      responses.push({ request: idx + 1, statusCode: res.statusCode, headers: res.headers, body: res.body });
      timeline.push({
        label: `#${idx + 1} ${key} → ${res.statusCode} ${res.replayed ? "replayed" : "executed"}`,
        detail: res.replayed ? `handler NOT run · cached ${JSON.stringify(res.body)}` : `handler run #${handlerRuns} · fingerprint ${res.fingerprint.slice(0, 12)}…`,
        status: res.replayed ? "warn" : "ok"
      });
    } catch (err) {
      rejectedCount++;
      const safe = toSafeErrorResponse(err);
      responses.push({ request: idx + 1, statusCode: safe.statusCode, body: safe.body });
      const code = err instanceof FoundryError ? err.code : "ERROR";
      timeline.push({ label: `#${idx + 1} ${key || "(no key)"} → ${safe.statusCode} ${code}`, detail: (err as Error).message, status: "error" });
    }
  }
  return {
    summary: [
      { label: "Requests", value: list.length },
      { label: "Handler executions", value: handlerRuns, tone: "good" },
      { label: "Replayed", value: replayed, tone: replayed ? "warn" : "neutral" },
      { label: "Rejected", value: rejectedCount, tone: rejectedCount ? "bad" : "neutral" }
    ],
    timeline,
    output: responses,
    code: `import { createIdempotencyGuard } from "@backendfoundry/idempotency";

const idempotency = createIdempotencyGuard({ ttlMs: 86_400_000 });

const outcome = await idempotency.execute(
  { key: req.headers["idempotency-key"], method: "POST", path: ${JSON.stringify(path)}, body: req.body },
  async () => ({ statusCode: 201, body: await payments.create(req.body) })
);
res.status(outcome.statusCode).set(outcome.headers).json(outcome.body);`
  };
};

// ---------------------------------------------------------------------------
// webhooks
// ---------------------------------------------------------------------------
const runWebhooks: Runner = async (i) => {
  const payload = str(i.payload);
  const secret = str(i.secret);
  const verifySecrets = str(i.verifySecrets).split(",").map((s) => s.trim()).filter(Boolean);
  const tamper = bool(i.tamper);
  const skew = Math.floor(num(i.skewSeconds));
  const toleranceSeconds = Math.floor(num(i.toleranceSeconds));
  const code = `import { signWebhookPayload, verifyWebhookOrThrow } from "@backendfoundry/webhooks";

// sender
const { signatureHeader } = signWebhookPayload(rawBody, process.env.WEBHOOK_SECRET!);

// receiver (use the raw request body, not re-serialized JSON)
verifyWebhookOrThrow({
  payload: rawBody,
  signatureHeader: req.headers["x-foundry-signature"],
  secret: [process.env.WEBHOOK_SECRET!, process.env.WEBHOOK_SECRET_PREV!],
  toleranceSeconds: ${toleranceSeconds}
});`;
  const ts = Math.floor(Date.now() / 1000);
  let signed: ReturnType<typeof signWebhookPayload>;
  try {
    signed = signWebhookPayload(payload, secret, { timestampSeconds: ts });
  } catch (err) {
    return {
      summary: [{ label: "Signing", value: "failed", tone: "bad" }],
      timeline: [{ label: "signWebhookPayload() threw", detail: (err as Error).message, status: "error" }],
      output: errorJson(err),
      code
    };
  }
  const delivered = tamper ? (/\d/.test(payload) ? payload.replace(/\d/, (d) => String((Number(d) + 1) % 10)) : `${payload} `) : payload;
  const timeline: TimelineEvent[] = [
    { label: "signed", detail: signed.signatureHeader, status: "ok" },
    { label: tamper ? "delivered (body tampered in transit)" : "delivered", detail: `${delivered.length} bytes · verifier clock skew ${skew}s`, status: tamper ? "warn" : "info" }
  ];
  let result: ReturnType<typeof verifyWebhookSignature>;
  try {
    result = verifyWebhookSignature({
      payload: delivered,
      signatureHeader: signed.signatureHeader,
      secret: verifySecrets.length ? verifySecrets : [secret],
      toleranceSeconds,
      nowSeconds: ts + skew
    });
  } catch (err) {
    timeline.push({ label: "verifier misconfigured", detail: (err as Error).message, status: "error" });
    return { summary: [{ label: "Verified", value: false, tone: "bad" }], timeline, output: errorJson(err), code };
  }
  timeline.push({
    label: result.valid ? "verified ✓" : `rejected: ${result.reason}`,
    detail: result.valid ? `matched verifier secret #${(result.matchedSecretIndex ?? 0) + 1} (constant-time compare)` : "respond 401 WEBHOOK_VERIFICATION_FAILED",
    status: result.valid ? "ok" : "error"
  });
  let eventId: string | undefined;
  try {
    const parsed = JSON.parse(delivered) as { id?: unknown };
    if (typeof parsed?.id === "string") eventId = parsed.id;
  } catch {
    /* non-JSON payloads are fine */
  }
  if (result.valid && eventId) {
    const dedupe = new MemoryWebhookDeduplicator();
    const first = dedupe.checkAndRecord(eventId);
    const second = dedupe.checkAndRecord(eventId);
    timeline.push({ label: `dedupe ${eventId}`, detail: `first delivery duplicate=${first.duplicate}, redelivery duplicate=${second.duplicate}`, status: "info" });
  }
  return {
    summary: [
      { label: "Verified", value: result.valid, tone: result.valid ? "good" : "bad" },
      { label: "Reason", value: result.reason ?? "-" },
      { label: "Timestamp", value: ts },
      { label: "Secrets tried", value: verifySecrets.length || 1 }
    ],
    timeline,
    output: { signatureHeader: signed.signatureHeader, verification: result, deliveredBody: delivered },
    code
  };
};

// ---------------------------------------------------------------------------
// health
// ---------------------------------------------------------------------------
interface ProbeSpec {
  name?: unknown;
  critical?: unknown;
  latencyMs?: unknown;
  error?: unknown;
  healthy?: unknown;
}

const runHealth: Runner = async (i) => {
  const specs = parseJson<unknown>(str(i.probes), "probes");
  if (!Array.isArray(specs)) throw new PlaygroundInputError("probes must be a JSON array", "probes");
  if (specs.length > 20) throw new PlaygroundInputError("At most 20 probes", "probes");
  const timeoutMs = Math.floor(num(i.timeoutMs));
  const version = str(i.version) || undefined;
  const health = createHealthRegistry({ version, defaultTimeoutMs: timeoutMs, exposeErrorMessages: bool(i.exposeErrorMessages) });
  for (const [idx, raw] of specs.entries()) {
    const s = (raw ?? {}) as ProbeSpec;
    const name = typeof s.name === "string" && s.name ? s.name : `probe-${idx + 1}`;
    const latency = Math.min(5_000, Math.max(0, Number(s.latencyMs ?? 0) || 0));
    health.registerProbe({
      name,
      critical: s.critical !== false,
      check: (signal) =>
        new Promise<{ healthy: boolean; message?: string }>((resolve, reject) => {
          const timer = setTimeout(() => {
            if (typeof s.error === "string" && s.error) reject(new Error(s.error));
            else if (s.healthy === false) resolve({ healthy: false, message: `${name} reported unhealthy` });
            else resolve({ healthy: true });
          }, latency);
          signal.addEventListener("abort", () => clearTimeout(timer), { once: true });
        })
    });
  }
  const liveness = await health.checkLiveness();
  const report = await health.checkReadiness();
  const timeline: TimelineEvent[] = Object.entries(report.checks).map(([name, c]) => ({
    label: `${name} ${c.status}${c.critical ? "" : " (non-critical)"}`,
    detail: `${c.latencyMs}ms${c.message ? ` · ${c.message}` : ""}`,
    status: c.status === "healthy" ? "ok" : c.critical ? "error" : "warn",
    magnitude: c.latencyMs
  }));
  return {
    summary: [
      { label: "Readiness", value: report.status, tone: report.status === "healthy" ? "good" : report.status === "degraded" ? "warn" : "bad" },
      { label: "HTTP status", value: report.statusCode, tone: report.statusCode === 200 ? "good" : "bad" },
      { label: "Liveness", value: liveness.status, tone: "good" },
      { label: "Probe timeout", value: `${timeoutMs}ms` }
    ],
    timeline,
    output: { readiness: report, liveness },
    code: `import { createHealthRegistry } from "@backendfoundry/health";

const health = createHealthRegistry({ version: ${JSON.stringify(version ?? "1.0.0")}, defaultTimeoutMs: ${timeoutMs} });
health.registerProbe({ name: "postgres", critical: true, check: async () => { await db.query("SELECT 1"); } });

app.get("/readyz", async (_req, res) => {
  const report = await health.checkReadiness();
  res.status(report.statusCode).json(report);
});`
  };
};

// ---------------------------------------------------------------------------
// errors
// ---------------------------------------------------------------------------
function buildError(type: string, message: string): unknown {
  switch (type) {
    case "BadRequestError":
      return new BadRequestError(message, { field: "email" });
    case "UnauthorizedError":
      return new UnauthorizedError(message);
    case "ForbiddenError":
      return new ForbiddenError(message);
    case "NotFoundError":
      return new NotFoundError(message, { resource: "project", id: "proj_42" });
    case "ConflictError":
      return new ConflictError(message, { version: 7 });
    case "RateLimitExceededError":
      return new RateLimitExceededError(30, message);
    case "DependencyFailedError":
      return new DependencyFailedError("postgres", new Error(message));
    case "GatewayTimeoutError":
      return new GatewayTimeoutError(message, { timeoutMs: 5000 });
    case "Error (raw)":
      return new Error(message);
    case "ZodLikeIssues":
      return { issues: [{ path: ["user", "email"], code: "invalid_string", message }] };
    default:
      return message;
  }
}

const runErrors: Runner = async (i) => {
  const type = str(i.errorType);
  const message = str(i.message);
  const requestId = str(i.requestId) || undefined;
  const includeInternalDetails = bool(i.includeInternalDetails);
  const thrown = buildError(type, message);
  const captured: { value?: FoundryError } = {};
  const response = toSafeErrorResponse(thrown, { requestId, includeInternalDetails, onError: (err) => { captured.value = err; } });
  const bodyText = JSON.stringify(response.body);
  const scrubbed = bodyText.includes("[REDACTED_CREDENTIAL]");
  const hidden = bodyText.includes("An unexpected internal error occurred.");
  const n = captured.value;
  const timeline: TimelineEvent[] = [
    { label: `throw ${type}`, detail: typeof thrown === "string" ? `"${thrown}"` : thrown instanceof Error ? thrown.message : JSON.stringify(thrown), status: "info" },
    {
      label: `normalizeError() → ${n?.code ?? "?"}`,
      detail: n ? `status ${n.statusCode} · category ${n.category} · expose=${n.expose}` : undefined,
      status: (n?.statusCode ?? 500) >= 500 ? "error" : "warn"
    },
    {
      label: "serialized for client",
      detail: hidden ? "5xx message replaced with a generic message" : scrubbed ? "credentials scrubbed from message" : "message exposed as-is (4xx, expose=true)",
      status: hidden || scrubbed ? "ok" : "info"
    }
  ];
  if (response.headers["retry-after"]) timeline.push({ label: `Retry-After: ${response.headers["retry-after"]}`, status: "info" });
  return {
    summary: [
      { label: "HTTP status", value: response.statusCode, tone: response.statusCode >= 500 ? "bad" : "warn" },
      { label: "Code", value: n?.code ?? "-" },
      { label: "Message hidden", value: hidden, tone: hidden ? "good" : "neutral" },
      { label: "Secrets scrubbed", value: scrubbed, tone: scrubbed ? "good" : "neutral" }
    ],
    timeline,
    output: response,
    code: `import { ${/Error$/.test(type) && type !== "Error (raw)" ? `${type}, ` : ""}toSafeErrorResponse } from "@backendfoundry/errors";

try {
  await handler(req);
} catch (err) {
  const { statusCode, headers, body } = toSafeErrorResponse(err, {
    requestId: req.id,
    includeInternalDetails: ${includeInternalDetails}
  });
  res.status(statusCode).set(headers).json(body);
}`
  };
};

// ---------------------------------------------------------------------------
// logger
// ---------------------------------------------------------------------------
const LEVELS = ["debug", "info", "warn", "error", "fatal"] as const;
type Level = (typeof LEVELS)[number];

const runLogger: Runner = async (i) => {
  const level = str(i.level) as Level;
  const service = str(i.service) || "service";
  const requestId = str(i.requestId) || undefined;
  const redactFields = str(i.redactFields).split(",").map((s) => s.trim()).filter(Boolean);
  const calls = parseJson<unknown>(str(i.entries), "entries");
  if (!Array.isArray(calls)) throw new PlaygroundInputError("entries must be a JSON array", "entries");
  if (calls.length > 100) throw new PlaygroundInputError("At most 100 log calls", "entries");
  const transport = new MemoryLogTransport();
  const logger = createLogger({ service, level, redactFields, transport });
  const timeline: TimelineEvent[] = [];
  runWithRequestContext({ requestId, tenantId: "t_acme", route: "/v1/charges", method: "POST" }, () => {
    for (const raw of calls) {
      const c = (raw ?? {}) as { level?: unknown; message?: unknown; meta?: unknown };
      const lvl = (LEVELS as readonly string[]).includes(String(c.level)) ? (String(c.level) as Level) : "info";
      const before = transport.entries.length;
      const meta = c.meta && typeof c.meta === "object" && !Array.isArray(c.meta) ? (c.meta as Record<string, unknown>) : undefined;
      logger[lvl](String(c.message ?? ""), meta);
      const emitted = transport.entries.length > before;
      timeline.push({
        label: `${lvl.toUpperCase()} ${String(c.message ?? "")}`.slice(0, 90),
        detail: emitted ? "emitted" : `dropped (below "${level}")`,
        status: !emitted ? "info" : lvl === "error" || lvl === "fatal" ? "error" : lvl === "warn" ? "warn" : "ok"
      });
    }
  });
  const lines = transport.entries.map((e) => JSON.stringify(e));
  const redactedCount = lines.reduce((n, l) => n + (l.match(/\[REDACTED(_CREDENTIAL)?\]/g)?.length ?? 0), 0);
  return {
    summary: [
      { label: "Emitted", value: transport.entries.length, tone: "good" },
      { label: "Dropped", value: calls.length - transport.entries.length },
      { label: "Redactions", value: redactedCount, tone: redactedCount ? "good" : "neutral" },
      { label: "Request ID", value: requestId ?? "(generated)" }
    ],
    timeline,
    output: transport.entries,
    logs: lines,
    code: `import { createLogger, runWithRequestContext } from "@backendfoundry/logger";

const logger = createLogger({ service: ${JSON.stringify(service)}, level: "${level}", redactFields: ${JSON.stringify(redactFields)} });

runWithRequestContext({ requestId: ${JSON.stringify(requestId ?? "req_123")}, tenantId: "t_acme" }, () => {
  logger.info("charge created", { amountCents: 15000, apiKey: "sk-live-123" }); // apiKey -> [REDACTED]
});`
  };
};

// ---------------------------------------------------------------------------
// ai
// ---------------------------------------------------------------------------
function recording(inner: AiProviderAdapter, timeline: TimelineEvent[], t0: number): AiProviderAdapter {
  return {
    name: inner.name,
    defaultModel: inner.defaultModel,
    async generateText(req: AiGenerateRequest): Promise<AiGenerateResponse> {
      const started = Date.now();
      try {
        const res = await inner.generateText(req);
        timeline.push({ at: `t+${started - t0}ms`, label: `${inner.name}: success`, detail: `${res.latencyMs}ms · ${res.usage.totalTokens} tokens`, status: "ok", magnitude: res.latencyMs });
        return res;
      } catch (err) {
        timeline.push({ at: `t+${started - t0}ms`, label: `${inner.name}: ${err instanceof FoundryError ? err.code : "error"}`, detail: (err as Error).message, status: "error" });
        throw err;
      }
    }
  };
}

const runAi: Runner = async (i) => {
  const prompt = str(i.prompt).slice(0, 2000) || "Hello";
  const mode = str(i.primaryMode);
  const structured = bool(i.structured);
  const maxRetriesPerProvider = Math.floor(num(i.maxRetriesPerProvider));
  const useFallback = bool(i.useFallback);
  const summaryText = prompt.replace(/\s+/g, " ").slice(0, 120);
  const responseGenerator = structured
    ? () => JSON.stringify({ priority: /outage|down|spike|latency|error/i.test(prompt) ? "p1" : "p2", summary: summaryText.length >= 5 ? summaryText : `${summaryText} (summary)` })
    : undefined;
  const t0 = Date.now();
  const timeline: TimelineEvent[] = [];
  const primary = new MockAiProvider({
    name: "primary-llm",
    defaultModel: "mock-gpt-4o-mini",
    latencyMs: 15,
    failAttempts: mode === "flaky" ? Math.floor(num(i.primaryFailures)) : 0,
    alwaysFailWith: mode === "down" ? "upstream_error" : mode === "rate_limited" ? "rate_limit" : undefined,
    responseGenerator
  });
  const fallback = new MockAiProvider({ name: "fallback-llm", defaultModel: "mock-claude-haiku", latencyMs: 25, responseGenerator });
  const ai = createAiClient({
    primary: recording(primary, timeline, t0),
    fallbacks: useFallback ? [recording(fallback, timeline, t0)] : [],
    maxRetriesPerProvider,
    timeoutMs: 2_000
  });
  const code = `import { createAiClient, OpenAiCompatibleProvider, MockAiProvider } from "@backendfoundry/ai";
${structured ? 'import { v } from "@backendfoundry/validation";\n' : ""}
const ai = createAiClient({
  primary: new OpenAiCompatibleProvider({ apiKey: process.env.OPENAI_API_KEY }),
  fallbacks: [${useFallback ? 'new MockAiProvider({ name: "fallback-llm" })' : ""}],
  maxRetriesPerProvider: ${maxRetriesPerProvider}
});
${
  structured
    ? `
const { object, meta } = await ai.generateObject({
  prompt,
  schema: v.object({ priority: v.enum(["p0", "p1", "p2"]), summary: v.string().min(5) })
});`
    : `
const result = await ai.generateText({ prompt });`
}`;
  try {
    if (structured) {
      const { object, meta } = await ai.generateObject({
        prompt,
        schema: v.object({ priority: v.enum(["p0", "p1", "p2"] as const), summary: v.string().min(5) })
      });
      return {
        summary: [
          { label: "Provider", value: meta.provider, tone: meta.fallbackUsed ? "warn" : "good" },
          { label: "Fallback used", value: meta.fallbackUsed, tone: meta.fallbackUsed ? "warn" : "good" },
          { label: "Attempted", value: meta.attemptedProviders.join(" → ") },
          { label: "Tokens", value: meta.usage.totalTokens }
        ],
        timeline,
        output: { object, meta },
        code
      };
    }
    const result = await ai.generateText({ prompt });
    return {
      summary: [
        { label: "Provider", value: result.provider, tone: result.fallbackUsed ? "warn" : "good" },
        { label: "Fallback used", value: result.fallbackUsed, tone: result.fallbackUsed ? "warn" : "good" },
        { label: "Attempted", value: result.attemptedProviders.join(" → ") },
        { label: "Tokens", value: result.usage.totalTokens }
      ],
      timeline,
      output: result,
      code
    };
  } catch (err) {
    return {
      summary: [
        { label: "Outcome", value: "all providers failed", tone: "bad" },
        { label: "Calls made", value: primary.callCount + fallback.callCount },
        { label: "Error", value: err instanceof FoundryError ? err.code : "Error", tone: "bad" }
      ],
      timeline,
      output: { error: errorJson(err), clientResponse: toSafeErrorResponse(err).body },
      code
    };
  }
};

// ---------------------------------------------------------------------------

const RUNNERS: Record<string, Runner> = {
  core: runCore,
  validation: runValidation,
  "rate-limit": runRateLimit,
  retry: runRetry,
  "circuit-breaker": runCircuitBreaker,
  cache: runCache,
  idempotency: runIdempotency,
  webhooks: runWebhooks,
  health: runHealth,
  errors: runErrors,
  logger: runLogger,
  ai: runAi
};

export const playgroundSlugs = Object.keys(RUNNERS);

export async function runScenario(slug: string, rawInputs: Record<string, unknown> = {}): Promise<ScenarioResult> {
  const component = getPackageBySlug(slug);
  const runner = RUNNERS[slug];
  if (!component || !runner) throw new UnknownScenarioError(`No playground scenario for "${slug}"`);
  const inputs = coerceInputs(component.playground, rawInputs);
  const started = performance.now();
  const partial = await runner(inputs);
  return {
    slug,
    scenario: component.playground.scenario,
    title: component.playground.title,
    durationMs: Math.round((performance.now() - started) * 100) / 100,
    simulatedClock: partial.simulatedClock ?? false,
    summary: partial.summary,
    timeline: partial.timeline,
    output: partial.output,
    logs: partial.logs ?? [],
    code: partial.code,
    inputs
  };
}
