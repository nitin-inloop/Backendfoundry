# @backendfoundry/ai

> AI Provider Adapter — part of [BackendFoundry](https://backendfoundry.dev), backend components you own.

Unified LLM provider interface with structured schema output validation, streaming chunks, per-attempt timeouts, retry/fallback orchestration, and token accounting.

## Install

```bash
npm install @backendfoundry/ai
# or
pnpm add @backendfoundry/ai
```

Prefer to own the code? Copy the TypeScript source (plus its dependencies) into your project:

```bash
npx @backendfoundry/cli add ai
```

Ships ESM, CommonJS and TypeScript declarations. Requires Node.js >= 18.18.0 (native fetch & AsyncGenerator).
Depends on `@backendfoundry/core`, `@backendfoundry/validation`, `@backendfoundry/retry`.

## Usage

```ts
import { createAiClient, OpenAiCompatibleProvider, MockAiProvider } from "@backendfoundry/ai";
import { v } from "@backendfoundry/validation";

const ai = createAiClient({
  primary: new OpenAiCompatibleProvider({ apiKey: process.env.OPENAI_API_KEY }),
  fallbacks: [new MockAiProvider({ name: "local-fallback" })],
  maxRetriesPerProvider: 2,
  timeoutMs: 8_000
});

const TicketSchema = v.object({
  priority: v.enum(["p0", "p1", "p2"]),
  summary: v.string().min(5)
});

const { object, meta } = await ai.generateObject({
  prompt: "Summarize outage report",
  schema: TicketSchema
});
```

### Express

```ts
import { createAiClient, MockAiProvider } from "@backendfoundry/ai";

const ai = createAiClient({ primary: new MockAiProvider() });

app.post("/v1/summarize", async (req, res, next) => {
  try {
    const result = await ai.generateText({ prompt: req.body.text });
    res.json(result);
  } catch (err) { next(err); }
});
```

### Fastify

```ts
import { createAiClient, MockAiProvider } from "@backendfoundry/ai";

const ai = createAiClient({ primary: new MockAiProvider() });

fastify.post("/v1/summarize", async (request) => {
  const { text } = request.body as { text: string };
  return ai.generateText({ prompt: text });
});
```

### Next.js Route Handler

```ts
import { createAiClient, MockAiProvider } from "@backendfoundry/ai";

const ai = createAiClient({ primary: new MockAiProvider() });

export async function POST(req: Request) {
  const { prompt } = await req.json();
  const res = await ai.generateText({ prompt, signal: req.signal });
  return Response.json(res);
}
```

## API

| Export | Kind | Signature | Description |
| --- | --- | --- | --- |
| `createAiClient` | function | `createAiClient({ primary, fallbacks?, maxRetriesPerProvider?, timeoutMs? })` | Creates a resilient AI client supporting generateText() and schema-validated generateObject(). |
| `MockAiProvider` | class | `new MockAiProvider(options?)` | Deterministic mock provider for local development, CI tests, and playground fault injection. |
| `OpenAiCompatibleProvider` | class | `new OpenAiCompatibleProvider(config?)` | Optional HTTP adapter for OpenAI-compatible chat completion APIs. |
| `AiProviderError` | class | `new AiProviderError(provider, code, message, statusCode?)` | Normalized error across providers (AI_TIMEOUT, AI_RATE_LIMITED, AI_AUTH_ERROR, AI_INVALID_OUTPUT). |

## Configuration

| Option | Type | Default | Required | Description |
| --- | --- | --- | --- | --- |
| `primary` | `AiProviderAdapter` | required | yes | Primary model provider adapter. |
| `fallbacks` | `AiProviderAdapter[]` | [] | no | Ordered fallback providers invoked when the primary provider exhausts retries. |
| `maxRetriesPerProvider` | `number` | 2 | no | Retry attempts per provider before failing over. |
| `timeoutMs` | `number` | 10000 | no | Timeout in milliseconds per provider attempt. |

## Error behavior

Throws AiProviderError; authentication errors (401) skip retries on the misconfigured provider and immediately attempt fallback.

## Security notes

- Never hardcode OPENAI_API_KEY or provider secrets in source files; pass keys via server-side environment configuration.
- Always validate structured LLM outputs with generateObject({ schema }) before passing model output to database queries or downstream APIs.

## Limitations

- Different model providers have distinct tokenization, system prompt behavior, and JSON adherence; fallback models should be tested against the same validation schema.

## Playground

Try **AI client with retries & fallback** live at https://backendfoundry.dev/packages/ai — Calls createAiClient() with a primary MockAiProvider that can be flaky or down and an optional fallback. Optionally asks for structured output validated with a schema via generateObject().

## License

MIT
