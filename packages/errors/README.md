# @backendfoundry/errors

> Error Handling — part of [BackendFoundry](https://backendfoundry.dev), backend components you own.

Typed HTTP application errors, machine-readable error categories, credential-scrubbing normalizer, and Express/Fastify error-handling adapters.

## Install

```bash
npm install @backendfoundry/errors
# or
pnpm add @backendfoundry/errors
```

Prefer to own the code? Copy the TypeScript source (plus its dependencies) into your project:

```bash
npx @backendfoundry/cli add errors
```

Ships ESM, CommonJS and TypeScript declarations. Requires Node.js >= 18.18.0, TypeScript >= 5.0.
Depends on `@backendfoundry/core`.

## Usage

```ts
import { NotFoundError, toSafeErrorResponse } from "@backendfoundry/errors";

try {
  throw new NotFoundError("Project proj_42 not found", { projectId: "proj_42" });
} catch (err) {
  const response = toSafeErrorResponse(err, { requestId: "req_99" });
  // response.statusCode === 404
}
```

### Express

```ts
import { createExpressErrorHandler } from "@backendfoundry/errors";

app.use(createExpressErrorHandler({
  includeInternalDetails: process.env.NODE_ENV === "development",
  onError: (err) => logger.error(err.message, { code: err.code })
}));
```

### Fastify

```ts
import { createFastifyErrorHandler } from "@backendfoundry/errors";

fastify.setErrorHandler(createFastifyErrorHandler({
  onError: (err) => logger.error(err.message, { code: err.code })
}));
```

### Next.js Route Handler

```ts
import { toSafeErrorResponse } from "@backendfoundry/errors";

export async function GET() {
  try {
    // route logic
    return Response.json({ ok: true });
  } catch (err) {
    const res = toSafeErrorResponse(err);
    return Response.json(res.body, { status: res.statusCode, headers: res.headers });
  }
}
```

## API

| Export | Kind | Signature | Description |
| --- | --- | --- | --- |
| `BadRequestError / UnauthorizedError / ForbiddenError / NotFoundError / ConflictError / RateLimitExceededError / DependencyFailedError / GatewayTimeoutError` | class | `new NotFoundError(message?, details?, code?)` | Semantic HTTP error subclasses with preconfigured statusCode, category, and expose settings. |
| `normalizeError` | function | `normalizeError(err: unknown, requestId?: string): FoundryError` | Converts unknown exceptions or Zod errors into a standardized FoundryError with scrubbed credentials. |
| `toSafeErrorResponse` | function | `toSafeErrorResponse(err, options?): { statusCode, headers, body }` | Produces a client-safe HTTP response payload and invokes internal diagnostic hooks. |
| `createExpressErrorHandler / createFastifyErrorHandler` | function | `createExpressErrorHandler(options?)` | Drop-in framework error handlers with request ID correlation. |

## Configuration

| Option | Type | Default | Required | Description |
| --- | --- | --- | --- | --- |
| `includeInternalDetails` | `boolean` | false | no | Whether to expose 5xx error messages/details (enable only in local development). |
| `onError` | `(normalized, raw) => void` | undefined | no | Callback invoked with the normalized and raw error for internal structured logging. |

## Error behavior

Normalizes all uncaught errors into structured JSON `{ error: { code, message, category, statusCode, requestId, timestamp } }`.

## Security notes

- Stack traces are never included in HTTP responses.
- PostgreSQL, MySQL, MongoDB, Redis URLs, Bearer tokens, and sk-* API keys are automatically scrubbed via scrubSensitiveMessage().

## Limitations

- Must be registered as the final middleware in Express (after all routes) to catch downstream errors.

## Playground

Try **Safe error serialization** live at https://backendfoundry.dev/packages/errors — Throws the selected error and runs it through toSafeErrorResponse(). 5xx internals are hidden, credentials are scrubbed, and 429s get a Retry-After header.

## License

MIT
