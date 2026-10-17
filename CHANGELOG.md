# Changelog

All notable changes to the BackendFoundry monorepo are documented in this file.

## [1.0.0] - 2026-10-17

### Added
- **Monorepo & Build System**: Workspace architecture supporting dual ESM + CommonJS builds and `.d.ts` generation across all packages.
- **12 Backend Packages**:
  - `@backendfoundry/core`: Base `FoundryError`, request ID utilities, response envelopes, and environment variable parsers.
  - `@backendfoundry/validation`: Fluent schema builder (`v`), Zod compatibility, Express/Fastify adapters, and sensitive field redaction.
  - `@backendfoundry/rate-limit`: Sliding-window and fixed-window rate limiter with standard headers, `MemoryRateLimitStore`, and `RedisRateLimitStore`.
  - `@backendfoundry/retry`: Exponential backoff, equal/full jitter, retry predicates, per-attempt timeouts, and `AbortSignal` support.
  - `@backendfoundry/circuit-breaker`: `CLOSED` / `OPEN` / `HALF_OPEN` state machine with probe concurrency limits and state transition hooks.
  - `@backendfoundry/cache`: Tenant-scoped caching with TTLs, `MemoryCacheStore`, `RedisCacheStore`, and stampede-coalesced `getOrSet()`.
  - `@backendfoundry/idempotency`: Atomic idempotency key locking, SHA-256 request fingerprinting, response replay, and 409/422 conflict detection.
  - `@backendfoundry/webhooks`: HMAC-SHA256 signing, constant-time verification, replay window enforcement, and key rotation support.
  - `@backendfoundry/health`: Liveness and readiness probes with per-probe timeouts and credential-sanitized diagnostics.
  - `@backendfoundry/errors`: Semantic HTTP error classes, credential scrubbing normalizer, and Express/Fastify error handlers.
  - `@backendfoundry/logger`: Structured JSON logger with `AsyncLocalStorage` request context and deep field redaction.
  - `@backendfoundry/ai`: Unified LLM interface with `MockAiProvider`, `OpenAiCompatibleProvider`, streaming, retry/fallback, and structured schema output validation.
- **CLI (`@backendfoundry/cli`)**: `list`, `info`, and `add` commands with package manager detection and pre-flight file conflict protection.
- **Documentation & Interactive Playgrounds**: Full developer documentation platform and 8 live interactive module playgrounds.
