# @backendfoundry/retry

> Retry Policy — part of [BackendFoundry](https://backendfoundry.dev), backend components you own.

Explicit retry policies with exponential backoff, full/equal jitter, retry predicates, per-attempt timeouts, AbortSignal cancellation, and attempt telemetry.

## Install

```bash
npm install @backendfoundry/retry
# or
pnpm add @backendfoundry/retry
```

Prefer to own the code? Copy the TypeScript source (plus its dependencies) into your project:

```bash
npx @backendfoundry/cli add retry
```

Ships ESM, CommonJS and TypeScript declarations. Requires Node.js >= 18.18.0, TypeScript >= 5.0.
Depends on `@backendfoundry/core`, `@backendfoundry/errors`.

## Usage

```ts
import { createRetry } from "@backendfoundry/retry";

const retry = createRetry({
  maxAttempts: 3,
  initialDelayMs: 200,
  maxDelayMs: 2000,
  jitter: "equal",
  attemptTimeoutMs: 1500
});

const data = await retry(async (attempt, signal) => {
  const res = await fetch("https://api.example.com/v1/inventory", { signal });
  if (!res.ok) throw new Error(`Upstream HTTP ${res.status}`);
  return res.json();
});
```

### Express

```ts
import { createRetry } from "@backendfoundry/retry";

const retry = createRetry({ maxAttempts: 3, initialDelayMs: 150 });

app.get("/v1/catalog", async (req, res, next) => {
  try {
    const items = await retry(() => fetchCatalogFromUpstream());
    res.json({ items });
  } catch (err) {
    next(err);
  }
});
```

### Fastify

```ts
import { createRetry } from "@backendfoundry/retry";

const retry = createRetry({ maxAttempts: 3, initialDelayMs: 150 });

fastify.get("/v1/catalog", async () => {
  const report = await retry.executeWithMetadata(() => fetchCatalogFromUpstream());
  return { items: report.result, attempts: report.attempts };
});
```

### Next.js Route Handler

```ts
import { createRetry } from "@backendfoundry/retry";

const retry = createRetry({ maxAttempts: 3, initialDelayMs: 200 });

export async function GET(req: Request) {
  const report = await retry.executeWithMetadata(
    (_attempt, signal) => fetch("https://api.example.com/data", { signal }),
    { signal: req.signal }
  );
  return Response.json({ attempts: report.attempts });
}
```

## API

| Export | Kind | Signature | Description |
| --- | --- | --- | --- |
| `createRetry` | function | `createRetry(config?: RetryConfig)` | Creates a reusable retry runner with .executeWithMetadata() and direct function invocation. |
| `computeBackoffDelay` | function | `computeBackoffDelay(attempt, options): number` | Calculates exponential backoff with none, full, or equal jitter. |
| `RetryExhaustedError` | class | `new RetryExhaustedError(attempts, delaysMs, lastError)` | Thrown when all configured retry attempts fail. |
| `RetryAbortedError` | class | `new RetryAbortedError()` | Thrown immediately when an AbortSignal cancels an in-flight attempt or backoff sleep. |

## Configuration

| Option | Type | Default | Required | Description |
| --- | --- | --- | --- | --- |
| `maxAttempts` | `number` | 3 | no | Maximum total execution attempts (1 to 20). |
| `initialDelayMs` | `number` | 200 | no | Base backoff delay in milliseconds before the first retry. |
| `maxDelayMs` | `number` | 5000 | no | Upper ceiling for exponential backoff delay in milliseconds. |
| `backoffFactor` | `number` | 2 | no | Exponential multiplier applied after each failed attempt. |
| `jitter` | `"equal" \| "full" \| "none"` | "equal" | no | Randomization strategy to prevent thundering-herd retry waves. |
| `attemptTimeoutMs` | `number` | undefined | no | Optional per-attempt execution timeout in milliseconds. |

## Error behavior

Throws RetryExhaustedError (HTTP 502) after exhausting maxAttempts, or rethrows non-retryable 4xx errors on first attempt.

## Security notes

- Never blindly retry non-idempotent mutations (such as charging a credit card or sending an email) unless paired with an upstream Idempotency-Key.
- Always use 'equal' or 'full' jitter in production to avoid synchronized retry storms against recovering downstream services.

## Limitations

- In-process timer-based retries do not survive process crashes; use a persistent job queue for long-horizon background retries.

## Playground

Try **Retry with simulated failures** live at https://backendfoundry.dev/packages/retry — Wraps an operation that fails a configurable number of times. The real createRetry() computes exponential backoff with jitter; delays are simulated so the timeline renders instantly.

## License

MIT
