import test from "node:test";
import assert from "node:assert/strict";
import {
  createIdempotencyGuard,
  IdempotencyPayloadMismatchError,
  IdempotencyInProgressError
} from "../dist/index.js";

test("@backendfoundry/idempotency - executes first call, replays duplicate, and rejects mismatched payload", async () => {
  const guard = createIdempotencyGuard({ ttlMs: 60_000 });
  let chargeCount = 0;

  const first = await guard.execute(
    {
      key: "idem_pay_1001",
      method: "POST",
      path: "/v1/charges",
      body: { amount: 2500, currency: "USD" }
    },
    async () => {
      chargeCount++;
      return { statusCode: 201, body: { chargeId: "ch_999", amount: 2500 } };
    }
  );

  assert.equal(first.replayed, false);
  assert.equal(first.statusCode, 201);
  assert.equal(chargeCount, 1);

  // Duplicate request with identical payload (even with different key order) replays stored response
  const second = await guard.execute(
    {
      key: "idem_pay_1001",
      method: "POST",
      path: "/v1/charges",
      body: { currency: "USD", amount: 2500 }
    },
    async () => {
      chargeCount++;
      return { statusCode: 201, body: { chargeId: "ch_other", amount: 2500 } };
    }
  );

  assert.equal(second.replayed, true);
  assert.equal(second.body.chargeId, "ch_999");
  assert.equal(second.headers["X-Idempotency-Replayed"], "true");
  assert.equal(chargeCount, 1, "Handler must not run a second time");

  // Same key with modified amount throws 422 IdempotencyPayloadMismatchError
  await assert.rejects(
    () =>
      guard.execute(
        {
          key: "idem_pay_1001",
          method: "POST",
          path: "/v1/charges",
          body: { amount: 9900, currency: "USD" }
        },
        async () => ({ body: {} })
      ),
    (err) => err instanceof IdempotencyPayloadMismatchError && err.statusCode === 422
  );
});

test("@backendfoundry/idempotency - detects concurrent in-progress requests and releases lock on failure", async () => {
  const guard = createIdempotencyGuard();

  let finishFirst;
  const inFlight = guard.execute(
    { key: "idem_concurrent_1", body: { order: 1 } },
    () => new Promise((r) => { finishFirst = r; })
  );

  await assert.rejects(
    () => guard.execute({ key: "idem_concurrent_1", body: { order: 1 } }, async () => ({ body: "dup" })),
    (err) => err instanceof IdempotencyInProgressError && err.statusCode === 409
  );

  finishFirst({ statusCode: 200, body: { ok: true } });
  const completed = await inFlight;
  assert.equal(completed.replayed, false);

  // Failed execution releases lock so retry succeeds
  await assert.rejects(() =>
    guard.execute({ key: "idem_fail_then_succeed", body: { x: 1 } }, async () => {
      throw new Error("Transient DB error");
    })
  );

  const recovered = await guard.execute(
    { key: "idem_fail_then_succeed", body: { x: 1 } },
    async () => ({ statusCode: 200, body: { recovered: true } })
  );
  assert.equal(recovered.body.recovered, true);
});
