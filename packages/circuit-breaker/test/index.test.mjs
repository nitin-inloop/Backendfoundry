import test from "node:test";
import assert from "node:assert/strict";
import {
  createCircuitBreaker,
  CircuitOpenError
} from "../dist/index.js";

test("@backendfoundry/circuit-breaker - full state machine transitions CLOSED -> OPEN -> HALF_OPEN -> CLOSED", async () => {
  let clock = 1_000_000;
  const transitions = [];
  const breaker = createCircuitBreaker({
    name: "payments-gateway",
    failureThreshold: 3,
    successThreshold: 2,
    resetTimeoutMs: 5_000,
    halfOpenMaxAttempts: 1,
    now: () => clock,
    onStateChange: (e) => transitions.push(`${e.from}->${e.to}`)
  });

  assert.equal(breaker.getStats().state, "CLOSED");

  // Trigger 3 consecutive failures
  for (let i = 0; i < 3; i++) {
    await assert.rejects(() => breaker.execute(async () => { throw new Error("503 upstream"); }));
  }
  assert.equal(breaker.getStats().state, "OPEN");

  // Calls while OPEN are fast-rejected with CircuitOpenError
  await assert.rejects(
    () => breaker.execute(async () => "ok"),
    (err) => err instanceof CircuitOpenError && err.circuitName === "payments-gateway"
  );
  assert.equal(breaker.getStats().rejectedCount, 1);

  // Advance clock past resetTimeoutMs -> HALF_OPEN
  clock += 5_100;
  assert.equal(breaker.getStats().state, "HALF_OPEN");

  // Fail a probe in HALF_OPEN -> immediately re-opens
  await assert.rejects(() => breaker.execute(async () => { throw new Error("still down"); }));
  assert.equal(breaker.getStats().state, "OPEN");

  // Advance clock again -> HALF_OPEN, then succeed twice -> CLOSED
  clock += 5_100;
  assert.equal(await breaker.execute(async () => "probe-1"), "probe-1");
  assert.equal(breaker.getStats().state, "HALF_OPEN");
  assert.equal(await breaker.execute(async () => "probe-2"), "probe-2");
  assert.equal(breaker.getStats().state, "CLOSED");

  assert.deepEqual(transitions, [
    "CLOSED->OPEN",
    "OPEN->HALF_OPEN",
    "HALF_OPEN->OPEN",
    "OPEN->HALF_OPEN",
    "HALF_OPEN->CLOSED"
  ]);
});

test("@backendfoundry/circuit-breaker - limits concurrent probes in HALF_OPEN state", async () => {
  let clock = 10_000;
  const breaker = createCircuitBreaker({
    name: "inventory-service",
    failureThreshold: 1,
    successThreshold: 1,
    resetTimeoutMs: 1_000,
    halfOpenMaxAttempts: 1,
    now: () => clock
  });

  await assert.rejects(() => breaker.execute(async () => { throw new Error("down"); }));
  clock += 1_500;
  assert.equal(breaker.getStats().state, "HALF_OPEN");

  let resolveFirst;
  const p1 = breaker.execute(() => new Promise((r) => { resolveFirst = r; }));
  // Second concurrent call while first probe is in flight must be rejected
  await assert.rejects(() => breaker.execute(async () => "second"), CircuitOpenError);
  resolveFirst("first-ok");
  assert.equal(await p1, "first-ok");
  assert.equal(breaker.getStats().state, "CLOSED");
});
