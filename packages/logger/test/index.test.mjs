import test from "node:test";
import assert from "node:assert/strict";
import {
  createLogger,
  MemoryLogTransport,
  runWithRequestContext,
  setRequestContextFields
} from "../dist/index.js";

test("@backendfoundry/logger - propagates AsyncLocalStorage context across concurrent requests and redacts secrets", async () => {
  const transport = new MemoryLogTransport();
  const logger = createLogger({
    service: "orders-api",
    level: "debug",
    redactFields: ["customSecret"],
    transport
  });

  await Promise.all([
    runWithRequestContext({ requestId: "req_concurrent_A", tenantId: "t_alpha" }, async () => {
      await new Promise((r) => setTimeout(r, 15));
      setRequestContextFields({ userId: "usr_1" });
      logger.info("Order created", {
        orderId: "ord_101",
        password: "super_secret_password",
        customSecret: "my_custom_key",
        nested: { authorization: "Bearer eyJhbGciOiJIUzI1NiJ9" }
      });
    }),
    runWithRequestContext({ requestId: "req_concurrent_B", tenantId: "t_beta" }, async () => {
      await new Promise((r) => setTimeout(r, 5));
      logger.warn("Inventory low", { sku: "SKU-99", apiKey: "sk-1234567890abcdef1234" });
    })
  ]);

  assert.equal(transport.entries.length, 2);
  const entryA = transport.entries.find((e) => e.requestId === "req_concurrent_A");
  const entryB = transport.entries.find((e) => e.requestId === "req_concurrent_B");

  assert.equal(entryA.context.tenantId, "t_alpha");
  assert.equal(entryA.context.userId, "usr_1");
  assert.equal(entryA.meta.password, "[REDACTED]");
  assert.equal(entryA.meta.customSecret, "[REDACTED]");
  assert.equal(entryA.meta.nested.authorization, "[REDACTED]");

  assert.equal(entryB.context.tenantId, "t_beta");
  assert.equal(entryB.meta.apiKey, "[REDACTED]");
});
