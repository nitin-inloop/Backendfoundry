# @backendfoundry/circuit-breaker

> Circuit Breaker — part of [BackendFoundry](https://backendfoundry.dev), backend components you own.

Deterministic CLOSED / OPEN / HALF_OPEN state machine that fast-fails degraded dependencies, limits concurrent recovery probes, and emits state-change telemetry.

## Install

```bash
npm install @backendfoundry/circuit-breaker
# or
pnpm add @backendfoundry/circuit-breaker
```

Prefer to own the code? Copy the TypeScript source (plus its dependencies) into your project:

```bash
npx @backendfoundry/cli add circuit-breaker
```

Ships ESM, CommonJS and TypeScript declarations. Requires Node.js >= 18.18.0, TypeScript >= 5.0.
Depends on `@backendfoundry/core`.

## Usage

```ts
import { createCircuitBreaker } from "@backendfoundry/circuit-breaker";

const paymentsBreaker = createCircuitBreaker({
  name: "stripe-gateway",
  failureThreshold: 4,
  successThreshold: 2,
  resetTimeoutMs: 10_000,
  onStateChange: (evt) => console.info(`[Circuit ${evt.name}] ${evt.from} -> ${evt.to}`)
});

const result = await paymentsBreaker.execute(() => callPaymentProvider());
```

### Express

```ts
import { createCircuitBreaker } from "@backendfoundry/circuit-breaker";

const breaker = createCircuitBreaker({ name: "shipping-api", failureThreshold: 5 });

app.get("/v1/rates", async (req, res, next) => {
  try {
    const quotes = await breaker.execute(() => fetchShippingRates());
    res.json({ quotes, circuit: breaker.getStats().state });
  } catch (err) {
    next(err);
  }
});
```

### Fastify

```ts
import { createCircuitBreaker } from "@backendfoundry/circuit-breaker";

const breaker = createCircuitBreaker({ name: "shipping-api", failureThreshold: 5 });

fastify.get("/v1/rates", async () => {
  const quotes = await breaker.execute(() => fetchShippingRates());
  return { quotes, circuitState: breaker.getStats().state };
});
```

### Next.js Route Handler

```ts
import { createCircuitBreaker } from "@backendfoundry/circuit-breaker";

const breaker = createCircuitBreaker({ name: "cms-upstream", failureThreshold: 3 });

export async function GET() {
  const data = await breaker.execute(() => fetch("https://cms.example.com/posts").then((r) => r.json()));
  return Response.json({ data, stats: breaker.getStats() });
}
```

## API

| Export | Kind | Signature | Description |
| --- | --- | --- | --- |
| `createCircuitBreaker` | function | `createCircuitBreaker(config?: CircuitBreakerConfig)` | Creates a circuit breaker instance with execute(), getStats(), and reset(). |
| `CircuitOpenError` | class | `new CircuitOpenError(circuitName, retryAfterMs)` | Thrown immediately (HTTP 503) when execute() is called while the circuit is OPEN or probe capacity is full. |

## Configuration

| Option | Type | Default | Required | Description |
| --- | --- | --- | --- | --- |
| `name` | `string` | "default-circuit" | no | Identifier included in logs, metrics, and CircuitOpenError. |
| `failureThreshold` | `number` | 5 | no | Consecutive failures required to trip from CLOSED to OPEN. |
| `successThreshold` | `number` | 2 | no | Consecutive successful probes in HALF_OPEN required to close the circuit. |
| `resetTimeoutMs` | `number` | 15000 | no | Cooldown duration in OPEN state before transitioning to HALF_OPEN. |
| `halfOpenMaxAttempts` | `number` | 1 | no | Maximum concurrent in-flight probe calls permitted while HALF_OPEN. |

## Error behavior

Throws CircuitOpenError (HTTP 503, code: CIRCUIT_OPEN) when OPEN or when HALF_OPEN probe slots are saturated.

## Security notes

- Configure isFailure() so client-side 400/404 errors do not trip the circuit breaker—otherwise an attacker sending invalid IDs could intentionally trip the circuit for all users.

## Limitations

- State is process-local per Node.js instance, which is typically desirable for fast zero-network-hop shedding but means each replica trips independently.

## Playground

Try **Circuit breaker state machine** live at https://backendfoundry.dev/packages/circuit-breaker — Drive createCircuitBreaker() with a sequence of calls. Use ok / fail for calls and wait:<ms> to advance the simulated clock. Watch CLOSED -> OPEN -> HALF_OPEN -> CLOSED transitions.

## License

MIT
