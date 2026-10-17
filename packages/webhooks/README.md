# @backendfoundry/webhooks

> Webhooks & HMAC Security — part of [BackendFoundry](https://backendfoundry.dev), backend components you own.

HMAC-SHA256 webhook signing, constant-time signature verification, timestamp replay-window enforcement, zero-downtime secret rotation, and event deduplication.

## Install

```bash
npm install @backendfoundry/webhooks
# or
pnpm add @backendfoundry/webhooks
```

Prefer to own the code? Copy the TypeScript source (plus its dependencies) into your project:

```bash
npx @backendfoundry/cli add webhooks
```

Ships ESM, CommonJS and TypeScript declarations. Requires Node.js >= 18.18.0 (node:crypto timingSafeEqual).
Depends on `@backendfoundry/core`.

## Usage

```ts
import { signWebhookPayload, verifyWebhookOrThrow } from "@backendfoundry/webhooks";

const rawBody = JSON.stringify({ id: "evt_101", type: "order.fulfilled" });
const { signatureHeader } = signWebhookPayload(rawBody, process.env.WEBHOOK_SECRET!);

const verified = verifyWebhookOrThrow({
  payload: rawBody,
  signatureHeader,
  secret: [process.env.WEBHOOK_SECRET!, process.env.WEBHOOK_SECRET_PREV!].filter(Boolean),
  toleranceSeconds: 300
});
```

### Express

```ts
import express from "express";
import { verifyWebhookOrThrow } from "@backendfoundry/webhooks";

app.post("/v1/webhooks/incoming", express.raw({ type: "application/json" }), (req, res, next) => {
  try {
    verifyWebhookOrThrow({
      payload: req.body,
      signatureHeader: req.headers["x-foundry-signature"] as string,
      secret: process.env.WEBHOOK_SECRET!
    });
    res.status(200).json({ received: true });
  } catch (err) { next(err); }
});
```

### Fastify

```ts
import { verifyWebhookOrThrow } from "@backendfoundry/webhooks";

fastify.post("/v1/webhooks/incoming", async (request) => {
  verifyWebhookOrThrow({
    payload: JSON.stringify(request.body),
    signatureHeader: request.headers["x-foundry-signature"] as string,
    secret: process.env.WEBHOOK_SECRET!
  });
  return { received: true };
});
```

### Next.js Route Handler

```ts
import { verifyWebhookOrThrow } from "@backendfoundry/webhooks";

export async function POST(req: Request) {
  const rawBody = await req.text();
  verifyWebhookOrThrow({
    payload: rawBody,
    signatureHeader: req.headers.get("x-foundry-signature") ?? "",
    secret: process.env.WEBHOOK_SECRET!
  });
  return Response.json({ received: true });
}
```

## API

| Export | Kind | Signature | Description |
| --- | --- | --- | --- |
| `signWebhookPayload` | function | `signWebhookPayload(payload, secret, options?)` | Computes `t=<epoch>,v1=<hmac_sha256>` signature header over `<timestamp>.<rawBody>`. |
| `verifyWebhookSignature` | function | `verifyWebhookSignature({ payload, signatureHeader, secret, toleranceSeconds? })` | Verifies HMAC signature using crypto.timingSafeEqual and checks replay window tolerance. |
| `verifyWebhookOrThrow` | function | `verifyWebhookOrThrow(options): WebhookVerificationResult` | Throws WebhookVerificationError (HTTP 401) if signature or timestamp is invalid. |
| `MemoryWebhookDeduplicator` | class | `new MemoryWebhookDeduplicator()` | Tracks processed webhook event IDs to prevent duplicate side effects during at-least-once delivery. |

## Configuration

| Option | Type | Default | Required | Description |
| --- | --- | --- | --- | --- |
| `secret` | `string \| readonly string[]` | required | yes | Signing secret or array of active secrets during key rotation (>= 8 chars). |
| `toleranceSeconds` | `number` | 300 | no | Maximum allowed clock skew / replay window in seconds (default 5 minutes). |
| `scheme` | `string` | "v1" | no | Signature version tag in the header. |

## Error behavior

verifyWebhookOrThrow() throws WebhookVerificationError (HTTP 401, code: WEBHOOK_VERIFICATION_FAILED) with reason metadata.

## Security notes

- Always verify signatures against the exact raw request body string or Buffer before JSON parsing and re-serialization, as whitespace changes alter the HMAC.
- Uses crypto.timingSafeEqual on equal-length hex digests to prevent timing side-channel attacks.
- Never log signing secrets in debug or error logs.

## Limitations

- Provider-specific formats (e.g. GitHub X-Hub-Signature-256 or Slack v0=) use different header layouts; @backendfoundry/webhooks implements the timestamped `t=...,v1=...` envelope.

## Playground

Try **Sign & verify a webhook** live at https://backendfoundry.dev/packages/webhooks — Signs the payload with HMAC-SHA256 (t=<ts>,v1=<sig>) and verifies it with timestamp tolerance and secret rotation. Toggle tampering or clock skew to see verification fail.

## License

MIT
