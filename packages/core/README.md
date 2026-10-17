# @backendfoundry/core

> Core Primitives — part of [BackendFoundry](https://backendfoundry.dev), backend components you own.

Shared TypeScript types, FoundryError base class, request ID generation/validation, standard API response envelopes, and secret-safe environment variable parsers.

## Install

```bash
npm install @backendfoundry/core
# or
pnpm add @backendfoundry/core
```

Prefer to own the code? Copy the TypeScript source (plus its dependencies) into your project:

```bash
npx @backendfoundry/cli add core
```

Ships ESM, CommonJS and TypeScript declarations. Requires Node.js >= 18.18.0, TypeScript >= 5.0.
Zero runtime dependencies.

## Usage

```ts
import { extractOrGenerateRequestId, ok, parseEnvInt } from "@backendfoundry/core";

const port = parseEnvInt("PORT", process.env, { defaultValue: 3000, min: 1024, max: 65535 });
const requestId = extractOrGenerateRequestId(req.headers);
return ok({ service: "billing", port }, { requestId });
```

### Express

```ts
import { extractOrGenerateRequestId, ok } from "@backendfoundry/core";

app.get("/v1/status", (req, res) => {
  const requestId = extractOrGenerateRequestId(req.headers);
  res.setHeader("x-request-id", requestId);
  res.json(ok({ healthy: true }, { requestId }));
});
```

### Fastify

```ts
import { extractOrGenerateRequestId, ok } from "@backendfoundry/core";

fastify.get("/v1/status", async (request, reply) => {
  const requestId = extractOrGenerateRequestId(request.headers);
  reply.header("x-request-id", requestId);
  return ok({ healthy: true }, { requestId });
});
```

### Next.js Route Handler

```ts
import { extractOrGenerateRequestId, ok } from "@backendfoundry/core";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const headers = Object.fromEntries(request.headers.entries());
  const requestId = extractOrGenerateRequestId(headers);
  return NextResponse.json(ok({ runtime: "nodejs" }, { requestId }), {
    headers: { "x-request-id": requestId }
  });
}
```

## API

| Export | Kind | Signature | Description |
| --- | --- | --- | --- |
| `FoundryError` | class | `new FoundryError(options: FoundryErrorOptions)` | Base operational error with code, statusCode, category, expose flag, and safe JSON serialization. |
| `generateRequestId` | function | `generateRequestId(prefix?: string): string` | Generates a collision-resistant, URL-safe request correlation ID. |
| `extractOrGenerateRequestId` | function | `extractOrGenerateRequestId(headers, options?): string` | Validates incoming x-request-id header against injection characters or generates a fresh ID. |
| `ok / created / paginated / fail` | function | `ok<T>(data: T, meta?: Partial<ApiMeta>, statusCode?: number): ApiSuccessResponse<T>` | Standardized JSON response envelope builders with requestId and pagination metadata. |
| `parseEnvString / parseEnvInt / parseEnvBoolean / parseEnvEnum` | function | `parseEnvString(key: string, env?, options?): string` | Validates environment variables at startup without leaking raw secret values in exception messages. |

## Configuration

| Option | Type | Default | Required | Description |
| --- | --- | --- | --- | --- |
| `prefix` | `string` | "req" | no | Prefix prepended to generated request IDs. |
| `headerName` | `string` | "x-request-id" | no | HTTP header inspected for incoming request ID correlation. |
| `trustIncoming` | `boolean` | true | no | Whether to preserve valid incoming request IDs from upstream proxies. |

## Error behavior

Throws FoundryError with code ENV_CONFIG_INVALID (HTTP 500, expose: false) when required environment variables are missing or malformed.

## Security notes

- Incoming x-request-id headers are validated against /^[a-zA-Z0-9._:-]{6,128}$/ to prevent log injection and header splitting.
- Environment parsers never echo rejected raw values in error messages to prevent accidental secret leakage in crash logs.
- FoundryError.toJSON() redacts error messages and details when statusCode >= 500 unless expose: true is explicitly set.

## Limitations

- Framework-agnostic by design; does not attach middleware directly (use @backendfoundry/logger or @backendfoundry/errors for HTTP lifecycle hooks).

## Playground

Try **Request IDs, envelopes & env parsing** live at https://backendfoundry.dev/packages/core — Resolve an incoming x-request-id (or generate a safe one), build a paginated response envelope, and parse environment variables without leaking raw values.

## License

MIT
