import test from "node:test";
import assert from "node:assert/strict";
import {
  BadRequestError,
  UnauthorizedError,
  NotFoundError,
  RateLimitExceededError,
  DependencyFailedError,
  normalizeError,
  toSafeErrorResponse,
  createExpressErrorHandler
} from "../dist/index.js";

test("@backendfoundry/errors - typed errors and safe production responses", () => {
  const err = new NotFoundError("Invoice inv_99 not found", { invoiceId: "inv_99" });
  const res = toSafeErrorResponse(err, { requestId: "req_err_1" });
  assert.equal(res.statusCode, 404);
  assert.equal(res.headers["x-request-id"], "req_err_1");
  assert.equal(res.body.error.code, "NOT_FOUND");
  assert.equal(res.body.error.message, "Invoice inv_99 not found");
  assert.deepEqual(res.body.error.details, { invoiceId: "inv_99" });
});

test("@backendfoundry/errors - scrubs connection strings and hides stack traces in production", () => {
  const rawDbError = new Error("Connection failed to postgres://user:secret123@db.internal:5432/app");
  let loggedInternal = null;
  const res = toSafeErrorResponse(rawDbError, {
    requestId: "req_sec_99",
    includeInternalDetails: false,
    onError: (norm) => { loggedInternal = norm; }
  });

  assert.equal(res.statusCode, 500);
  assert.equal(res.body.error.code, "INTERNAL_SERVER_ERROR");
  assert.equal(res.body.error.message, "An unexpected internal error occurred.");
  assert.ok(!JSON.stringify(res.body).includes("secret123"));
  assert.ok(loggedInternal.message.includes("[REDACTED_CREDENTIAL]"));
});

test("@backendfoundry/errors - RateLimitExceededError sets Retry-After header", () => {
  const rlErr = new RateLimitExceededError(30);
  const res = toSafeErrorResponse(rlErr, { requestId: "req_rl_1" });
  assert.equal(res.statusCode, 429);
  assert.equal(res.headers["retry-after"], "30");
});
