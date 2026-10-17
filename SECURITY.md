# Security Policy

## Reporting a Vulnerability

Do **not** open a public GitHub issue for suspected security vulnerabilities.

Please report sensitive vulnerabilities privately to the maintainers via your organization's security disclosure address or GitHub Private Vulnerability Reporting. Include:
- Affected package(s) and version(s).
- A minimal reproduction script or proof-of-concept.
- Assessment of impact and deployment assumptions.

## Security Design Principles in BackendFoundry

1. **Constant-Time HMAC Verification**: `@backendfoundry/webhooks` uses `crypto.timingSafeEqual` over equal-length hex digests and enforces timestamp replay windows (`toleranceSeconds`, default 300s).
2. **Default Credential Redaction**: `@backendfoundry/logger`, `@backendfoundry/errors`, `@backendfoundry/validation`, and `@backendfoundry/health` scrub database connection URIs, Bearer tokens, and sensitive object keys before serialization.
3. **Explicit Tenant Cache Scoping**: `@backendfoundry/cache` supports `requireExplicitScope: true` to prevent accidental cross-tenant cache key collisions.
4. **Safe Retry Defaults**: `@backendfoundry/retry` refuses to retry operations marked `{ idempotent: false }` and does not retry HTTP 4xx client errors (except 408/429).
