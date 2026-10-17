import test from "node:test";
import assert from "node:assert/strict";
import { extractOrGenerateRequestId, ok } from "@backendfoundry/core";
import { v, validateBody } from "@backendfoundry/validation";
import { createRateLimiter } from "@backendfoundry/rate-limit";
import { createRetry } from "@backendfoundry/retry";
import { createCircuitBreaker } from "@backendfoundry/circuit-breaker";
import { createCache } from "@backendfoundry/cache";
import { createIdempotencyGuard } from "@backendfoundry/idempotency";
import { signWebhookPayload, verifyWebhookOrThrow } from "@backendfoundry/webhooks";
import { createHealthRegistry } from "@backendfoundry/health";
import { toSafeErrorResponse } from "@backendfoundry/errors";
import { createLogger, MemoryLogTransport, runWithRequestContext } from "@backendfoundry/logger";
import { createAiClient, MockAiProvider } from "@backendfoundry/ai";

test("End-to-End Ecosystem Integration: all 12 BackendFoundry modules compose in a unified API pipeline", async () => {
  const logTransport = new MemoryLogTransport();
  const logger = createLogger({ service: "e2e-gateway", transport: logTransport });
  const rateLimiter = createRateLimiter({ limit: 10, windowMs: 60_000 });
  const idempotency = createIdempotencyGuard({ ttlMs: 60_000 });
  const cache = createCache({ namespace: "e2e", requireExplicitScope: true });
  const retry = createRetry({ maxAttempts: 2, initialDelayMs: 5 });
  const breaker = createCircuitBreaker({ name: "ai-upstream", failureThreshold: 3 });
  const health = createHealthRegistry({ version: "1.0.0" });
  const ai = createAiClient({
    primary: new MockAiProvider({
      name: "primary-llm",
      latencyMs: 2,
      responseGenerator: () => JSON.stringify({ approved: true, riskScore: 12 })
    })
  });

  health.registerProbe({
    name: "circuit-breaker",
    critical: true,
    check: async () => ({ healthy: breaker.getStats().state === "CLOSED" })
  });

  const secret = "whsec_e2e_integration_secret_12345";
  const rawPayload = JSON.stringify({
    transactionId: "txn_777",
    amountCents: 14900,
    apiKey: "sk-live-should-be-redacted-12345678"
  });
  const signed = signWebhookPayload(rawPayload, secret);

  const PayloadSchema = v.object({
    transactionId: v.string().min(3),
    amountCents: v.number().int().min(1),
    apiKey: v.string()
  }).strict();

  const RiskSchema = v.object({
    approved: v.boolean(),
    riskScore: v.number().int().min(0).max(100)
  });

  const response = await runWithRequestContext({ requestId: "req_e2e_001", tenantId: "tenant_acme" }, async () => {
    const rl = await rateLimiter.consumeOrThrow({ key: "tenant_acme" });
    assert.equal(rl.allowed, true);

    verifyWebhookOrThrow({
      payload: rawPayload,
      signatureHeader: signed.signatureHeader,
      secret
    });

    const body = validateBody(PayloadSchema, JSON.parse(rawPayload), "req_e2e_001");
    logger.info("Processing verified webhook transaction", body);

    return idempotency.execute(
      { key: `idem_${body.transactionId}`, scope: "tenant_acme", body },
      async () => {
        const { value: riskAssessment } = await cache.getOrSet(
          `risk:${body.transactionId}`,
          () =>
            breaker.execute(() =>
              retry(async () => {
                const { object } = await ai.generateObject({
                  prompt: `Assess risk for ${body.amountCents}`,
                  schema: RiskSchema
                });
                return object;
              })
            ),
          { scope: "tenant:acme", ttlMs: 30_000 }
        );
        return {
          statusCode: 200,
          body: ok({ transactionId: body.transactionId, riskAssessment }, { requestId: "req_e2e_001" })
        };
      }
    );
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.data.riskAssessment.approved, true);
  assert.equal(response.body.data.riskAssessment.riskScore, 12);

  // Verify logger redacted the apiKey inside the request context
  assert.equal(logTransport.entries.length, 1);
  assert.equal(logTransport.entries[0].requestId, "req_e2e_001");
  assert.equal(logTransport.entries[0].meta.apiKey, "[REDACTED]");

  const readiness = await health.checkReadiness();
  assert.equal(readiness.status, "healthy");
  assert.equal(readiness.statusCode, 200);
});
