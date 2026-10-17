# @backendfoundry/idempotency

> Idempotency Keys — part of [BackendFoundry](https://backendfoundry.dev), backend components you own.

Atomic idempotency key locking, canonical SHA-256 request payload fingerprinting, stored response replay, and concurrent conflict protection.

## Install

```bash
npm install @backendfoundry/idempotency
# or
pnpm add @backendfoundry/idempotency
```

Prefer to own the code? Copy the TypeScript source (plus its dependencies) into your project:

```bash
npx @backendfoundry/cli add idempotency
```

Ships ESM, CommonJS and TypeScript declarations. Requires Node.js >= 18.18.0, atomic key store for multi-instance deployment.
Depends on `@backendfoundry/core`, `@backendfoundry/errors`.

## Usage

```ts
import { createIdempotencyGuard } from "@backendfoundry/idempotency";

const idempotency = createIdempotencyGuard({ ttlMs: 86_400_000 });

const outcome = await idempotency.execute(
  {
    key: req.headers["idempotency-key"],
    scope: `tenant:${tenantId}`,
    method: "POST",
    path: "/v1/transfers",
    body: req.body
  },
  async () => {
    const transfer = await ledger.createTransfer(req.body);
    return { statusCode: 201, body: transfer };
  }
);
```

### Express

```ts
import { createIdempotencyGuard } from "@backendfoundry/idempotency";

const guard = createIdempotencyGuard();

app.post("/v1/payments", async (req, res, next) => {
  try {
    const key = guard.extractKey(req.headers);
    const result = await guard.execute({ key, method: req.method, path: req.path, body: req.body }, async () => ({
      statusCode: 201,
      body: { paymentId: "pay_101", status: "succeeded" }
    }));
    res.set(result.headers).status(result.statusCode).json(result.body);
  } catch (err) { next(err); }
});
```

### Fastify

```ts
import { createIdempotencyGuard } from "@backendfoundry/idempotency";

const guard = createIdempotencyGuard();

fastify.post("/v1/payments", async (request, reply) => {
  const key = guard.extractKey(request.headers);
  const result = await guard.execute({ key, method: request.method, path: request.url, body: request.body }, async () => ({
    statusCode: 201,
    body: { paymentId: "pay_101" }
  }));
  reply.headers(result.headers).code(result.statusCode).send(result.body);
});
```

### Next.js Route Handler

```ts
import { createIdempotencyGuard } from "@backendfoundry/idempotency";

const guard = createIdempotencyGuard();

export async function POST(req: Request) {
  const key = req.headers.get("idempotency-key") ?? "";
  const body = await req.json();
  const result = await guard.execute({ key, method: "POST", path: "/api/orders", body }, async () => ({
    statusCode: 201,
    body: { orderId: "ord_55" }
  }));
  return Response.json(result.body, { status: result.statusCode, headers: result.headers });
}
```

## API

| Export | Kind | Signature | Description |
| --- | --- | --- | --- |
| `createIdempotencyGuard` | function | `createIdempotencyGuard(config?: IdempotencyConfig)` | Creates an idempotency guard that locks keys, verifies SHA-256 fingerprints, and replays completed responses. |
| `computeRequestFingerprint` | function | `computeRequestFingerprint({ method, path, body, scope }): string` | Generates a deterministic SHA-256 fingerprint over method, path, and canonicalized JSON body. |
| `IdempotencyPayloadMismatchError` | class | `new IdempotencyPayloadMismatchError(key)` | HTTP 422 error thrown when a client reuses an Idempotency-Key with modified parameters. |
| `IdempotencyInProgressError` | class | `new IdempotencyInProgressError(key)` | HTTP 409 error thrown when a duplicate request arrives while the original execution is still in flight. |

## Configuration

| Option | Type | Default | Required | Description |
| --- | --- | --- | --- | --- |
| `ttlMs` | `number` | 86400000 | no | Retention window (default 24 hours) for completed idempotency records. |
| `lockTimeoutMs` | `number` | 30000 | no | In-progress lock lease duration before an abandoned lock expires. |
| `headerName` | `string` | "idempotency-key" | no | HTTP header name used to extract the idempotency token. |

## Error behavior

Throws IdempotencyInProgressError (409) for concurrent duplicates and IdempotencyPayloadMismatchError (422) for altered payloads.

## Security notes

- Always scope idempotency keys by authenticated tenant or user ID (scope: `tenant:${tenantId}`) so one tenant cannot probe or replay another tenant's responses.

## Limitations

- MemoryIdempotencyStore is single-process only; use a distributed store with atomic compare-and-set (Redis SET NX PX or PostgreSQL unique constraint) in multi-replica deployments.

## Playground

Try **Duplicate request detection** live at https://backendfoundry.dev/packages/idempotency — Sends each request through createIdempotencyGuard().execute(). Repeated keys with the same payload are replayed without re-running the handler; the same key with a different payload is rejected (422).

## License

MIT
