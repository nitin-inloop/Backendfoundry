import { ok } from "@backendfoundry/core";
import { v, fastifyValidate } from "@backendfoundry/validation";
import { fastifyRateLimit } from "@backendfoundry/rate-limit";
import { createRetry } from "@backendfoundry/retry";
import { createCircuitBreaker } from "@backendfoundry/circuit-breaker";
import { createCache } from "@backendfoundry/cache";
import { createFastifyErrorHandler } from "@backendfoundry/errors";

export function configureFastifyExample(fastify: any, fetchUpstreamQuote: (sku: string) => Promise<any>) {
  const cache = createCache({ namespace: "quotes", defaultTtlMs: 30_000, requireExplicitScope: true });
  const retry = createRetry({ maxAttempts: 3, initialDelayMs: 50, jitter: "equal" });
  const breaker = createCircuitBreaker({ name: "pricing-engine", failureThreshold: 3, resetTimeoutMs: 10_000 });

  fastify.setErrorHandler(createFastifyErrorHandler());

  fastify.get(
    "/v1/quotes/:sku",
    {
      preHandler: [
        fastifyRateLimit({ limit: 50, windowMs: 60_000, routeId: "quotes" }),
        fastifyValidate({ params: v.object({ sku: v.string().min(2) }) })
      ]
    },
    async (request: any, reply: any) => {
      const { sku } = request.params;
      const { value, hit } = await cache.getOrSet(
        `sku:${sku}`,
        () => breaker.execute(() => retry(() => fetchUpstreamQuote(sku))),
        { scope: "public", ttlMs: 30_000 }
      );
      reply.header("x-cache", hit ? "HIT" : "MISS");
      return ok(value);
    }
  );
}
