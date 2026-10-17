# @backendfoundry/logger

> Request Context & Logging — part of [BackendFoundry](https://backendfoundry.dev), backend components you own.

Structured JSON logging with Node.js AsyncLocalStorage request-context propagation, automatic sensitive-field redaction, pluggable transports, and HTTP duration middleware.

## Install

```bash
npm install @backendfoundry/logger
# or
pnpm add @backendfoundry/logger
```

Prefer to own the code? Copy the TypeScript source (plus its dependencies) into your project:

```bash
npx @backendfoundry/cli add logger
```

Ships ESM, CommonJS and TypeScript declarations. Requires Node.js >= 18.18.0 (node:async_hooks AsyncLocalStorage).
Depends on `@backendfoundry/core`, `@backendfoundry/errors`.

## Usage

```ts
import { createLogger, runWithRequestContext } from "@backendfoundry/logger";

const logger = createLogger({ service: "payments-worker", level: "info" });

await runWithRequestContext({ requestId: "req_8821", tenantId: "t_acme" }, async () => {
  logger.info("Processing settlement", { amountCents: 15000, apiKey: "sk-secret" });
  // Logs JSON with requestId: "req_8821" and apiKey: "[REDACTED]"
});
```

### Express

```ts
import { createLogger, expressRequestLogger } from "@backendfoundry/logger";

const logger = createLogger({ service: "api-gateway" });
app.use(expressRequestLogger(logger));
```

### Fastify

```ts
import { createLogger, runWithRequestContext } from "@backendfoundry/logger";

const logger = createLogger({ service: "fastify-api" });
fastify.addHook("onRequest", (req, _reply, done) => {
  runWithRequestContext({ requestId: req.id, method: req.method, route: req.url }, done);
});
```

### Next.js Route Handler

```ts
import { createLogger, runWithRequestContext } from "@backendfoundry/logger";

const logger = createLogger({ service: "nextjs-route" });

export async function POST(req: Request) {
  return runWithRequestContext({ route: "/api/checkout" }, async () => {
    logger.info("Checkout initiated");
    return Response.json({ ok: true });
  });
}
```

## API

| Export | Kind | Signature | Description |
| --- | --- | --- | --- |
| `createLogger` | function | `createLogger(config?: LoggerConfig)` | Creates a structured logger with debug, info, warn, error, fatal, and child() methods. |
| `runWithRequestContext` | function | `runWithRequestContext(context, callback)` | Runs synchronous or asynchronous code within an isolated AsyncLocalStorage request context. |
| `redactSensitiveObject` | function | `redactSensitiveObject(input, customKeys?)` | Recursively clones objects while replacing sensitive keys and credential strings with [REDACTED]. |
| `expressRequestLogger` | function | `expressRequestLogger(logger)` | Express middleware that initializes request context and logs HTTP method, path, status, outcome, and durationMs. |

## Configuration

| Option | Type | Default | Required | Description |
| --- | --- | --- | --- | --- |
| `service` | `string` | "backendfoundry-service" | no | Service identifier attached to every JSON log entry. |
| `level` | `"debug" \| "info" \| "warn" \| "error" \| "fatal"` | "info" | no | Minimum log severity threshold. |
| `redactFields` | `string[]` | [] | no | Additional field names to redact alongside default password/token/secret keys. |

## Error behavior

Handles circular object references safely via WeakSet ([Circular]) and never throws during log serialization.

## Security notes

- Automatically redacts password, passphrase, secret, token, accessToken, refreshToken, apiKey, authorization, cookie, creditCard, cvv, ssn, and privateKey at any nesting depth.
- Never logs full HTTP request bodies by default.

## Limitations

- AsyncLocalStorage context propagates across native Promises and async/await, but custom callback queues or EventEmitters that bind outside the request lifecycle may require explicit context binding.

## Playground

Try **Structured logs with redaction** live at https://backendfoundry.dev/packages/logger — Emits log entries through createLogger() inside runWithRequestContext(). Entries below the minimum level are dropped, sensitive keys are redacted, and every line carries the request ID.

## License

MIT
