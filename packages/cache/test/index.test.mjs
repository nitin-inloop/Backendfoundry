import test from "node:test";
import assert from "node:assert/strict";
import { createCache, MemoryCacheStore } from "../dist/index.js";

test("@backendfoundry/cache - set, get, TTL expiration, and explicit tenant scoping", async () => {
  let clock = 5_000_000;
  const cache = createCache({
    namespace: "catalog",
    defaultTtlMs: 10_000,
    requireExplicitScope: true,
    now: () => clock
  });

  // Missing scope when requireExplicitScope is true throws
  await assert.rejects(
    () => cache.set("products", ["p1"]),
    (err) => err.code === "CACHE_SCOPE_REQUIRED"
  );

  await cache.set("products", [{ id: "p1" }], { scope: "tenant:acme", ttlMs: 5_000 });
  const tenantA = await cache.get("products", { scope: "tenant:acme" });
  const tenantB = await cache.get("products", { scope: "tenant:globex" });

  assert.deepEqual(tenantA, [{ id: "p1" }]);
  assert.equal(tenantB, null, "Tenants must be strictly isolated by scope");

  // Expire TTL
  clock += 5_001;
  assert.equal(await cache.get("products", { scope: "tenant:acme" }), null);
});

test("@backendfoundry/cache - getOrSet coalesces concurrent stampede misses and handles corrupt values", async () => {
  const store = new MemoryCacheStore();
  const cache = createCache({ namespace: "pricing", store });

  let loaderInvocations = 0;
  const loader = async () => {
    loaderInvocations++;
    await new Promise((r) => setTimeout(r, 20));
    return { plan: "pro", priceCents: 4900 };
  };

  const [r1, r2, r3] = await Promise.all([
    cache.getOrSet("tier:pro", loader),
    cache.getOrSet("tier:pro", loader),
    cache.getOrSet("tier:pro", loader)
  ]);

  assert.equal(loaderInvocations, 1, "Concurrent cache misses must coalesce into a single loader call");
  assert.equal(r1.value.priceCents, 4900);
  assert.equal(r2.value.priceCents, 4900);
  assert.equal(r3.value.priceCents, 4900);

  // Corrupt underlying store entry -> gracefully treated as miss and evicted
  await store.set("pricing:global:corrupt_key", "{not-valid-json", 10_000);
  const val = await cache.get("corrupt_key");
  assert.equal(val, null);
  assert.equal(cache.getStats().deserializationErrors, 1);
});
