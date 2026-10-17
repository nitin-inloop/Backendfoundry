import test from "node:test";
import assert from "node:assert/strict";
import {
  createRetry,
  RetryExhaustedError,
  RetryAbortedError
} from "../dist/index.js";
import { BadRequestError } from "@backendfoundry/errors";

test("@backendfoundry/retry - retries transient errors with exponential backoff and succeeds", async () => {
  const delays = [];
  const retry = createRetry({
    maxAttempts: 4,
    initialDelayMs: 100,
    maxDelayMs: 1000,
    backoffFactor: 2,
    jitter: "none",
    sleep: async (ms) => { delays.push(ms); }
  });

  let count = 0;
  const report = await retry.executeWithMetadata(async (attempt) => {
    count = attempt;
    if (attempt < 3) {
      throw new Error("ECONNRESET");
    }
    return "recovered_payload";
  });

  assert.equal(report.result, "recovered_payload");
  assert.equal(report.attempts, 3);
  assert.deepEqual(delays, [100, 200]);
});

test("@backendfoundry/retry - does not retry 400 BadRequestError and blocks non-idempotent operations", async () => {
  const retry = createRetry({ maxAttempts: 3, sleep: async () => {} });
  let calls = 0;

  await assert.rejects(
    () => retry(async () => {
      calls++;
      throw new BadRequestError("Invalid JSON syntax");
    }),
    (err) => err instanceof BadRequestError
  );
  assert.equal(calls, 1, "Must not retry 400 client error");

  await assert.rejects(
    () => retry(async () => "ok", { idempotent: false }),
    (err) => err.code === "NON_IDEMPOTENT_RETRY_BLOCKED"
  );
});

test("@backendfoundry/retry - supports AbortSignal cancellation and per-attempt timeout", async () => {
  const controller = new AbortController();
  const retry = createRetry({
    maxAttempts: 3,
    initialDelayMs: 50,
    attemptTimeoutMs: 30
  });

  // Per-attempt timeout exhaustion
  await assert.rejects(
    () => retry(async () => {
      await new Promise((r) => setTimeout(r, 120));
      return "slow";
    }),
    (err) => err instanceof RetryExhaustedError && err.attempts === 3
  );

  // AbortSignal cancellation
  controller.abort();
  await assert.rejects(
    () => retry(async () => "never", { signal: controller.signal }),
    (err) => err instanceof RetryAbortedError
  );
});
