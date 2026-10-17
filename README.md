# BackendFoundry

**Backend infrastructure, built in blocks.**

Reusable, tested TypeScript modules for API security, reliability, caching, idempotency, webhooks, observability, and AI infrastructure. Install what you need—or vendor supported modules via the CLI—and keep full control of your code.

## Architecture & Packages

BackendFoundry is organized as a modular monorepo containing 12 backend packages, a CLI (`@backendfoundry/cli`), a central package registry (`registry/registry.json`), framework integration examples, and an interactive documentation & playground application (`apps/docs`).

| ID | Package | Category | Source Add | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `01` | `@backendfoundry/core` | Foundation | Yes | Shared types, `FoundryError`, request IDs, response helpers, safe env parsing |
| `02` | `@backendfoundry/validation` | Security & Validation | Yes | Request body/query/params schema validation with sensitive field redaction |
| `03` | `@backendfoundry/rate-limit` | Security & Validation | Package | Sliding/fixed-window rate limiting with standard headers, memory & Redis stores |
| `04` | `@backendfoundry/retry` | Reliability | Yes | Exponential backoff, jitter, retry predicates, timeouts, `AbortSignal` |
| `05` | `@backendfoundry/circuit-breaker` | Reliability | Yes | `CLOSED` / `OPEN` / `HALF_OPEN` state machine isolating degraded upstreams |
| `06` | `@backendfoundry/cache` | State & Caching | Package | Explicitly scoped caching, TTLs, stampede-coalesced `getOrSet`, Redis/memory stores |
| `07` | `@backendfoundry/idempotency` | State & Caching | Package | Atomic idempotency key locking, SHA-256 request fingerprinting, response replay |
| `08` | `@backendfoundry/webhooks` | Security & Validation | Yes | HMAC-SHA256 signing, `timingSafeEqual` verification, replay windows, secret rotation |
| `09` | `@backendfoundry/health` | Observability | Yes | Liveness & readiness probes with per-probe timeouts and credential scrubbing |
| `10` | `@backendfoundry/errors` | Foundation | Yes | Typed HTTP errors, credential scrubbing normalizer, Express/Fastify handlers |
| `11` | `@backendfoundry/logger` | Observability | Package | Structured JSON logging, `AsyncLocalStorage` context propagation, field redaction |
| `12` | `@backendfoundry/ai` | AI Infrastructure | Package | Unified LLM interface, structured output validation, streaming, retry & fallback |

## Quick Start

```bash
# Build all packages (ESM, CommonJS, and TypeScript .d.ts declarations)
node scripts/build-packages.mjs

# Run all unit and ecosystem integration tests
node scripts/run-tests.mjs

# Run lint and TypeScript AST & registry verification
node scripts/lint-check.mjs

# Use the BackendFoundry CLI
node packages/cli/dist/index.cjs list
node packages/cli/dist/index.cjs info retry
node packages/cli/dist/index.cjs add retry webhooks --source --with-config
```

## Security & Operational Honesty

- **Process-Local vs Distributed State**: In-memory adapters (`MemoryRateLimitStore`, `MemoryCacheStore`, `MemoryIdempotencyStore`, and `createCircuitBreaker`) maintain state in a single Node.js process. For multi-replica production deployments, configure the Redis adapters (`RedisRateLimitStore`, `RedisCacheStore`) or atomic database backing stores.
- **No Secret Leakage**: `@backendfoundry/core`, `@backendfoundry/validation`, `@backendfoundry/errors`, `@backendfoundry/health`, and `@backendfoundry/logger` automatically scrub credentials and redact sensitive fields (`password`, `token`, `secret`, `apiKey`, `authorization`, connection strings).
- **Publication Status**: Packages in this repository use `workspace:*` references until published to a public or private npm registry.

## License

MIT — see [LICENSE](./LICENSE).
