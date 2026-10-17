# @backendfoundry/rate-limit

> Rate Limiting — part of [BackendFoundry](https://backendfoundry.dev), backend components you own.

Sliding-window and fixed-window rate limiting with standard IETF/X-RateLimit headers, per-route and per-tenant keys, in-memory local store, and atomic Redis Lua adapter.

## Install

```bash
npm install @backendfoundry/rate-limit
# or
pnpm add @backendfoundry/rate-limit
```

Prefer to own the code? Copy the TypeScript source (plus its dependencies) into your project:

```bash
npx @backendfoundry/cli add rate-limit
```

Ships ESM, CommonJS and TypeScript declarations. Requires Node.js >= 18.18.0, Redis >= 6.2 (for distributed deployments).
Depends on `@backendfoundry/core`, `@backendfoundry/errors`.

## Usage

```ts
import { createRateLimiter, MemoryRateLimitStore } from "@backendfoundry/rate-limit";

const limiter = createRateLimiter({
  limit: 60,
  windowMs: 60_000,
  algorithm: "sliding-window",
  store: new MemoryRateLimitStore()
});

const decision = await limiter.check({ key: `api:${userId}` });
if (!decision.allowed) {
  console.log("Retry after (s):", decision.retryAfterSeconds);
}
```

### Express

```ts
import { expressRateLimit } from "@backendfoundry/rate-limit";

app.use(
  "/v1/auth",
  expressRateLimit({ limit: 10, windowMs: 60_000, routeId: "auth" })
);
```

### Fastify

```ts
import { fastifyRateLimit } from "@backendfoundry/rate-limit";

fastify.post(
  "/v1/login",
  { preHandler: fastifyRateLimit({ limit: 10, windowMs: 60_000, routeId: "login" }) },
  async () => ({ ok: true })
);
```

### Next.js Route Handler

```ts
import { createRateLimiter } from "@backendfoundry/rate-limit";

const limiter = createRateLimiter({ limit: 20, windowMs: 60_000 });

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for") ?? "local";
  const decision = await limiter.check({ key: `next:${ip}` });
  if (!decision.allowed) {
    return Response.json({ error: "Too many requests" }, { status: 429, headers: decision.headers });
  }
  return Response.json({ ok: true }, { headers: decision.headers });
}
```

## API

| Export | Kind | Signature | Description |
| --- | --- | --- | --- |
| `createRateLimiter` | function | `createRateLimiter(config: RateLimitConfig)` | Creates a rate limiter instance with check(), consumeOrThrow(), and reset(). |
| `MemoryRateLimitStore` | class | `new MemoryRateLimitStore({ algorithm?, maxKeys? })` | Single-process in-memory sliding or fixed window counter store. |
| `RedisRateLimitStore` | class | `new RedisRateLimitStore({ client, prefix? })` | Distributed atomic rate-limit store using a Redis Lua script. |
| `expressRateLimit / fastifyRateLimit` | function | `expressRateLimit(config: RateLimitConfig)` | Framework middlewares that attach standard rate-limit headers and reject excess traffic with HTTP 429. |

## Configuration

| Option | Type | Default | Required | Description |
| --- | --- | --- | --- | --- |
| `limit` | `number` | required | yes | Maximum allowed requests within windowMs. |
| `windowMs` | `number` | required | yes | Time window duration in milliseconds (>= 50ms). |
| `algorithm` | `"sliding-window" \| "fixed-window"` | "sliding-window" | no | Counting strategy for in-memory rate limiting. |
| `store` | `RateLimitStore` | MemoryRateLimitStore | no | Storage backend (MemoryRateLimitStore for local/single-process, RedisRateLimitStore for multi-instance). |
| `failOpen` | `boolean` | false | no | Whether to allow traffic if the backing Redis store is temporarily unreachable. |

## Error behavior

consumeOrThrow() and framework middlewares throw RateLimitExceededError (HTTP 429, code: RATE_LIMIT_EXCEEDED) with Retry-After header.

## Security notes

- When behind a reverse proxy (Cloudflare, ALB, Nginx), configure your framework's trust proxy setting before relying on x-forwarded-for, or spoofed headers can bypass IP limits.
- In-memory counters are strictly process-local and are NOT shared across cluster workers or horizontal container replicas.

## Limitations

- MemoryRateLimitStore resets on process restart and does not synchronize across multiple Node.js instances.
- RedisRateLimitStore requires a Redis client supporting eval() for atomic INCRBY + PEXPIRE execution.

## Playground

Try **Burst of requests against a limiter** live at https://backendfoundry.dev/packages/rate-limit — Fires N requests at a fixed interval against createRateLimiter() using a simulated clock, and shows which are allowed (200) and which are blocked (429) with Retry-After.

## License

MIT
