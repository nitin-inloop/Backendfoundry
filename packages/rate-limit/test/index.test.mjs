import test from "node:test";
import assert from "node:assert/strict";
import {
  createRateLimiter,
  MemoryRateLimitStore,
  RedisRateLimitStore,
  expressRateLimit
} from "../dist/index.js";

test("@backendfoundry/rate-limit - enforces sliding window limits, headers, and boundary reset", async () => {
  let clock = 1_700_000_000_000;
  const limiter = createRateLimiter({
    limit: 3,
    windowMs: 10_000,
    algorithm: "sliding-window",
    now: () => clock
  });

  const r1 = await limiter.check({ key: "user_1" });
  const r2 = await limiter.check({ key: "user_1" });
  const r3 = await limiter.check({ key: "user_1" });
  const r4 = await limiter.check({ key: "user_1" });

  assert.equal(r1.allowed, true);
  assert.equal(r1.remaining, 2);
  assert.equal(r3.allowed, true);
  assert.equal(r3.remaining, 0);
  assert.equal(r4.allowed, false);
  assert.equal(r4.statusCode, 429);
  assert.equal(r4.headers["Retry-After"], "10");

  // Advance clock past window
  clock += 10_001;
  const r5 = await limiter.check({ key: "user_1" });
  assert.equal(r5.allowed, true);
  assert.equal(r5.remaining, 2);
});

test("@backendfoundry/rate-limit - concurrent requests and RedisRateLimitStore mock", async () => {
  const redisCounts = new Map();
  const mockRedis = {
    async eval(_script, _numKeys, key, windowMs, cost) {
      const next = (redisCounts.get(key) || 0) + Number(cost);
      redisCounts.set(key, next);
      return [next, Number(windowMs)];
    },
    async del(key) {
      redisCounts.delete(key);
      return 1;
    }
  };

  const store = new RedisRateLimitStore({ client: mockRedis });
  const limiter = createRateLimiter({ limit: 5, windowMs: 60_000, store });

  const results = await Promise.all(
    Array.from({ length: 7 }, () => limiter.check({ key: "tenant_a" }))
  );
  const allowedCount = results.filter((r) => r.allowed).length;
  const blockedCount = results.filter((r) => !r.allowed).length;
  assert.equal(allowedCount, 5);
  assert.equal(blockedCount, 2);

  await limiter.reset("tenant_a");
  const afterReset = await limiter.check({ key: "tenant_a" });
  assert.equal(afterReset.allowed, true);
  assert.equal(afterReset.used, 1);
});
