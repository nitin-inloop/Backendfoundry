# @backendfoundry/health

> Health Checks — part of [BackendFoundry](https://backendfoundry.dev), backend components you own.

Kubernetes/cloud-ready liveness and readiness checks with custom dependency probes, strict per-probe timeouts, and credential-sanitized JSON output.

## Install

```bash
npm install @backendfoundry/health
# or
pnpm add @backendfoundry/health
```

Prefer to own the code? Copy the TypeScript source (plus its dependencies) into your project:

```bash
npx @backendfoundry/cli add health
```

Ships ESM, CommonJS and TypeScript declarations. Requires Node.js >= 18.18.0, TypeScript >= 5.0.
Depends on `@backendfoundry/errors`.

## Usage

```ts
import { createHealthRegistry } from "@backendfoundry/health";

const health = createHealthRegistry({ version: "1.4.2", defaultTimeoutMs: 1500 });

health.registerProbe({
  name: "postgres",
  critical: true,
  check: async () => { await db.query("SELECT 1"); }
});

const report = await health.checkReadiness();
```

### Express

```ts
import { createHealthRegistry } from "@backendfoundry/health";

const health = createHealthRegistry({ version: "1.0.0" });
const handlers = health.expressHandlers();

app.get("/health/live", handlers.liveness);
app.get("/health/ready", handlers.readiness);
```

### Fastify

```ts
import { createHealthRegistry } from "@backendfoundry/health";

const health = createHealthRegistry({ version: "1.0.0" });

fastify.get("/health/ready", async (_req, reply) => {
  const report = await health.checkReadiness();
  return reply.code(report.statusCode).send(report);
});
```

### Next.js Route Handler

```ts
import { createHealthRegistry } from "@backendfoundry/health";

const health = createHealthRegistry({ version: "1.0.0" });

export async function GET() {
  const report = await health.checkReadiness();
  return Response.json(report, { status: report.statusCode });
}
```

## API

| Export | Kind | Signature | Description |
| --- | --- | --- | --- |
| `createHealthRegistry` | function | `createHealthRegistry(config?: HealthRegistryConfig)` | Creates a probe registry with registerProbe(), checkLiveness(), checkReadiness(), and expressHandlers(). |

## Configuration

| Option | Type | Default | Required | Description |
| --- | --- | --- | --- | --- |
| `version` | `string` | undefined | no | Application release version reported in health responses. |
| `defaultTimeoutMs` | `number` | 2000 | no | Default timeout in milliseconds per dependency probe. |
| `exposeErrorMessages` | `boolean` | false | no | Whether to include sanitized probe error messages in public readiness responses. |

## Error behavior

Never throws from checkReadiness(); returns HTTP 503 with status 'unhealthy' when any critical probe fails or times out, and HTTP 200 'degraded' when only non-critical probes fail.

## Security notes

- By default exposeErrorMessages is false so public /health/ready endpoints never reveal internal database hostnames, ports, or driver exceptions.
- Even when exposeErrorMessages is enabled, scrubSensitiveMessage() strips connection strings and bearer tokens.

## Limitations

- Avoid running expensive full-table queries in readiness probes, as orchestrators poll readiness every few seconds.

## Playground

Try **Readiness probes** live at https://backendfoundry.dev/packages/health — Registers probes with simulated latency and failures, then runs checkReadiness(). Critical failures yield 503/unhealthy, non-critical ones yield degraded, slow probes time out. Credentials in messages are scrubbed.

## License

MIT
