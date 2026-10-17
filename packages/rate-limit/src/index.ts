import { FoundryError, normalizeHeaders } from "@backendfoundry/core";
import { RateLimitExceededError } from "@backendfoundry/errors";

export interface RateLimitState {
  count: number;
  resetAtMs: number;
}

export interface RateLimitStore {
  increment(key: string, windowMs: number, cost?: number, nowMs?: number): Promise<RateLimitState>;
  reset(key: string): Promise<void>;
  clear?(): Promise<void>;
}

/**
 * Process-local in-memory rate limit store.
 * NOTE: Not shared across multiple Node.js worker processes or horizontal container instances.
 * Use RedisRateLimitStore for multi-instance production deployments.
 */
export class MemoryRateLimitStore implements RateLimitStore {
  private readonly buckets = new Map<string, { timestamps: number[]; count: number; resetAtMs: number }>();
  private readonly algorithm: "sliding-window" | "fixed-window";
  private readonly maxKeys: number;

  constructor(options: { algorithm?: "sliding-window" | "fixed-window"; maxKeys?: number } = {}) {
    this.algorithm = options.algorithm ?? "sliding-window";
    this.maxKeys = options.maxKeys ?? 50_000;
  }

  public async increment(key: string, windowMs: number, cost = 1, nowMs = Date.now()): Promise<RateLimitState> {
    if (this.buckets.size >= this.maxKeys && !this.buckets.has(key)) {
      this.evictExpired(nowMs);
    }

    if (this.algorithm === "fixed-window") {
      const existing = this.buckets.get(key);
      if (!existing || nowMs >= existing.resetAtMs) {
        const state = { timestamps: [], count: cost, resetAtMs: nowMs + windowMs };
        this.buckets.set(key, state);
        return { count: state.count, resetAtMs: state.resetAtMs };
      }
      existing.count += cost;
      return { count: existing.count, resetAtMs: existing.resetAtMs };
    }

    // Sliding window log
    const windowStart = nowMs - windowMs;
    const existing = this.buckets.get(key);
    const activeTimestamps = existing ? existing.timestamps.filter((t) => t > windowStart) : [];
    for (let i = 0; i < cost; i++) {
      activeTimestamps.push(nowMs);
    }
    const oldest = activeTimestamps[0] ?? nowMs;
    const resetAtMs = oldest + windowMs;
    this.buckets.set(key, {
      timestamps: activeTimestamps,
      count: activeTimestamps.length,
      resetAtMs
    });
    return {
      count: activeTimestamps.length,
      resetAtMs
    };
  }

  public async reset(key: string): Promise<void> {
    this.buckets.delete(key);
  }

  public async clear(): Promise<void> {
    this.buckets.clear();
  }

  private evictExpired(nowMs: number): void {
    for (const [k, v] of this.buckets.entries()) {
      if (nowMs >= v.resetAtMs) {
        this.buckets.delete(k);
      }
    }
  }
}

export interface RedisLikeClient {
  eval(script: string, numKeys: number, ...args: Array<string | number>): Promise<[number, number] | any>;
  del(key: string): Promise<number>;
}

const REDIS_FIXED_WINDOW_LUA = `
local current = redis.call("INCRBY", KEYS[1], tonumber(ARGV[2]))
if current == tonumber(ARGV[2]) then
  redis.call("PEXPIRE", KEYS[1], tonumber(ARGV[1]))
end
local ttl = redis.call("PTTL", KEYS[1])
if ttl < 0 then
  redis.call("PEXPIRE", KEYS[1], tonumber(ARGV[1]))
  ttl = tonumber(ARGV[1])
end
return { current, ttl }
`;

export class RedisRateLimitStore implements RateLimitStore {
  private readonly client: RedisLikeClient;
  private readonly prefix: string;

  constructor(options: { client: RedisLikeClient; prefix?: string }) {
    if (!options?.client || typeof options.client.eval !== "function") {
      throw new FoundryError({
        code: "INVALID_REDIS_CLIENT",
        message: "RedisRateLimitStore requires a Redis client implementing eval() and del()",
        statusCode: 500
      });
    }
    this.client = options.client;
    this.prefix = options.prefix ?? "bf:rl:";
  }

  public async increment(key: string, windowMs: number, cost = 1, nowMs = Date.now()): Promise<RateLimitState> {
    const namespacedKey = `${this.prefix}${key}`;
    const res = await this.client.eval(REDIS_FIXED_WINDOW_LUA, 1, namespacedKey, windowMs, cost);
    const count = Number(Array.isArray(res) ? res[0] : 1);
    const ttlMs = Number(Array.isArray(res) ? res[1] : windowMs);
    return {
      count,
      resetAtMs: nowMs + Math.max(1, ttlMs)
    };
  }

  public async reset(key: string): Promise<void> {
    await this.client.del(`${this.prefix}${key}`);
  }
}

export interface RateLimitConfig {
  limit: number;
  windowMs: number;
  algorithm?: "sliding-window" | "fixed-window";
  store?: RateLimitStore;
  prefix?: string;
  routeId?: string;
  cost?: number | ((context: RateLimitInput) => number);
  keyGenerator?: (context: RateLimitInput) => string;
  skip?: (context: RateLimitInput) => boolean;
  failOpen?: boolean;
  onLimitReached?: (decision: RateLimitDecision, context: RateLimitInput) => void;
  now?: () => number;
}

export interface RateLimitInput {
  key?: string;
  ip?: string;
  route?: string;
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
}

export interface RateLimitDecision {
  allowed: boolean;
  statusCode: 200 | 429;
  key: string;
  limit: number;
  remaining: number;
  used: number;
  resetAtMs: number;
  retryAfterSeconds: number;
  headers: Record<string, string>;
}

export function createRateLimiter(config: RateLimitConfig) {
  if (!Number.isInteger(config.limit) || config.limit < 1) {
    throw new FoundryError({
      code: "INVALID_RATE_LIMIT_CONFIG",
      message: "RateLimitConfig.limit must be a positive integer >= 1",
      statusCode: 500
    });
  }
  if (!Number.isInteger(config.windowMs) || config.windowMs < 50) {
    throw new FoundryError({
      code: "INVALID_RATE_LIMIT_CONFIG",
      message: "RateLimitConfig.windowMs must be an integer >= 50ms",
      statusCode: 500
    });
  }

  const store = config.store ?? new MemoryRateLimitStore({ algorithm: config.algorithm ?? "sliding-window" });
  const prefix = config.prefix ?? "rl";
  const routeId = config.routeId ?? "default";
  const failOpen = config.failOpen ?? false;
  const nowFn = config.now ?? (() => Date.now());

  const defaultKeyGen = (ctx: RateLimitInput): string => {
    if (ctx.key) return ctx.key;
    const headers = normalizeHeaders(ctx.headers);
    const ip = ctx.ip || headers["x-forwarded-for"]?.split(",")[0]?.trim() || "anonymous";
    const route = ctx.route || routeId;
    return `${prefix}:${route}:${ip}`;
  };

  const keyGen = config.keyGenerator ?? defaultKeyGen;

  async function check(input: RateLimitInput = {}): Promise<RateLimitDecision> {
    const nowMs = nowFn();
    const resolvedKey = keyGen(input);

    if (config.skip && config.skip(input)) {
      return {
        allowed: true,
        statusCode: 200,
        key: resolvedKey,
        limit: config.limit,
        remaining: config.limit,
        used: 0,
        resetAtMs: nowMs + config.windowMs,
        retryAfterSeconds: 0,
        headers: {
          "X-RateLimit-Limit": String(config.limit),
          "X-RateLimit-Remaining": String(config.limit),
          "X-RateLimit-Reset": String(Math.ceil((nowMs + config.windowMs) / 1000))
        }
      };
    }

    const cost = typeof config.cost === "function" ? Math.max(1, config.cost(input)) : Math.max(1, config.cost ?? 1);

    try {
      const state = await store.increment(resolvedKey, config.windowMs, cost, nowMs);
      const allowed = state.count <= config.limit;
      const remaining = Math.max(0, config.limit - state.count);
      const retryAfterSeconds = allowed ? 0 : Math.max(1, Math.ceil((state.resetAtMs - nowMs) / 1000));
      const resetEpochSeconds = Math.ceil(state.resetAtMs / 1000);

      const headers: Record<string, string> = {
        "X-RateLimit-Limit": String(config.limit),
        "X-RateLimit-Remaining": String(remaining),
        "X-RateLimit-Reset": String(resetEpochSeconds),
        "RateLimit-Limit": String(config.limit),
        "RateLimit-Remaining": String(remaining),
        "RateLimit-Reset": String(Math.max(0, Math.ceil((state.resetAtMs - nowMs) / 1000)))
      };
      if (!allowed) {
        headers["Retry-After"] = String(retryAfterSeconds);
      }

      const decision: RateLimitDecision = {
        allowed,
        statusCode: allowed ? 200 : 429,
        key: resolvedKey,
        limit: config.limit,
        remaining,
        used: state.count,
        resetAtMs: state.resetAtMs,
        retryAfterSeconds,
        headers
      };

      if (!allowed && config.onLimitReached) {
        config.onLimitReached(decision, input);
      }
      return decision;
    } catch (err) {
      if (failOpen) {
        return {
          allowed: true,
          statusCode: 200,
          key: resolvedKey,
          limit: config.limit,
          remaining: 1,
          used: 0,
          resetAtMs: nowMs + config.windowMs,
          retryAfterSeconds: 0,
          headers: {
            "X-RateLimit-Limit": String(config.limit),
            "X-RateLimit-Remaining": "1",
            "X-RateLimit-Reset": String(Math.ceil((nowMs + config.windowMs) / 1000))
          }
        };
      }
      throw err;
    }
  }

  async function consumeOrThrow(input: RateLimitInput = {}): Promise<RateLimitDecision> {
    const decision = await check(input);
    if (!decision.allowed) {
      throw new RateLimitExceededError(decision.retryAfterSeconds, "Rate limit exceeded", {
        limit: decision.limit,
        resetAtMs: decision.resetAtMs
      });
    }
    return decision;
  }

  async function reset(keyOrInput: string | RateLimitInput): Promise<void> {
    const resolvedKey = typeof keyOrInput === "string" ? keyOrInput : keyGen(keyOrInput);
    await store.reset(resolvedKey);
  }

  return {
    check,
    consumeOrThrow,
    reset,
    config
  };
}

export function expressRateLimit(config: RateLimitConfig) {
  const limiter = createRateLimiter(config);
  return async function expressRateLimitMiddleware(req: any, res: any, next: (err?: unknown) => void) {
    try {
      const decision = await limiter.check({
        ip: req.ip,
        route: req.baseUrl ? `${req.baseUrl}${req.path || ""}` : req.path,
        method: req.method,
        headers: req.headers
      });
      for (const [header, value] of Object.entries(decision.headers)) {
        if (typeof res.setHeader === "function") {
          res.setHeader(header, value);
        }
      }
      if (!decision.allowed) {
        return next(
          new RateLimitExceededError(decision.retryAfterSeconds, "Rate limit exceeded", {
            limit: decision.limit,
            remaining: decision.remaining,
            resetAtMs: decision.resetAtMs
          })
        );
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

export function fastifyRateLimit(config: RateLimitConfig) {
  const limiter = createRateLimiter(config);
  return async function fastifyRateLimitPreHandler(request: any, reply: any) {
    const decision = await limiter.check({
      ip: request.ip,
      route: request.routerPath ?? request.url,
      method: request.method,
      headers: request.headers
    });
    for (const [header, value] of Object.entries(decision.headers)) {
      reply.header(header, value);
    }
    if (!decision.allowed) {
      const err = new RateLimitExceededError(decision.retryAfterSeconds, "Rate limit exceeded", {
        limit: decision.limit,
        remaining: decision.remaining,
        resetAtMs: decision.resetAtMs
      });
      return reply.code(429).send(err.toJSON(false));
    }
  };
}
