import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_BRAND_CONFIG,
  createBrandConfig,
  generateRequestId,
  isValidRequestId,
  extractOrGenerateRequestId,
  FoundryError,
  ok,
  created,
  paginated,
  fail,
  parseEnvString,
  parseEnvInt,
  parseEnvBoolean,
  parseEnvEnum
} from "../dist/index.js";

test("@backendfoundry/core - brand configuration and validation", () => {
  assert.equal(DEFAULT_BRAND_CONFIG.name, "BackendFoundry");
  const custom = createBrandConfig({ name: "AcmeInfra", namespace: "@acme" });
  assert.equal(custom.name, "AcmeInfra");
  assert.equal(custom.namespace, "@acme");
  assert.throws(() => createBrandConfig({ name: "   " }), /non-empty/);
});

test("@backendfoundry/core - request ID generation and extraction", () => {
  const id = generateRequestId("api");
  assert.ok(id.startsWith("api_"));
  assert.equal(isValidRequestId(id), true);
  assert.equal(isValidRequestId("bad id with spaces!"), false);

  const preserved = extractOrGenerateRequestId({ "X-Request-Id": "req_valid_incoming_123" });
  assert.equal(preserved, "req_valid_incoming_123");

  const rejected = extractOrGenerateRequestId({ "X-Request-Id": "invalid header with spaces & symbols!" });
  assert.notEqual(rejected, "invalid header with spaces & symbols!");
  assert.ok(rejected.startsWith("req_"));
});

test("@backendfoundry/core - FoundryError safe serialization", () => {
  const internalErr = new FoundryError({
    code: "DB_CONN_FAILED",
    message: "postgres://admin:supersecret@10.0.0.12:5432/prod failed",
    statusCode: 500,
    details: { host: "10.0.0.12" }
  });
  const prodJson = internalErr.toJSON(false);
  assert.equal(prodJson.error.code, "DB_CONN_FAILED");
  assert.equal(prodJson.error.message, "An unexpected internal error occurred.");
  assert.equal(prodJson.error.details, undefined);

  const clientErr = new FoundryError({
    code: "INVALID_INPUT",
    message: "Email is required",
    statusCode: 400,
    requestId: "req_123456",
    details: { field: "email" }
  });
  const clientJson = clientErr.toJSON(false);
  assert.equal(clientJson.error.message, "Email is required");
  assert.deepEqual(clientJson.error.details, { field: "email" });
});

test("@backendfoundry/core - response helpers and env parsing without leaking secrets", () => {
  const res = ok({ status: "active" }, { requestId: "req_abc123" });
  assert.equal(res.ok, true);
  assert.equal(res.statusCode, 200);
  assert.equal(res.meta.requestId, "req_abc123");

  const pageRes = paginated(["a", "b"], { page: 1, pageSize: 2, totalItems: 5 });
  assert.equal(pageRes.meta.pagination.totalPages, 3);
  assert.equal(pageRes.meta.pagination.hasNextPage, true);

  const env = {
    PORT: "8080",
    ENABLE_TLS: "true",
    NODE_ENV: "production",
    API_SECRET: "short"
  };
  assert.equal(parseEnvInt("PORT", env, { min: 1024, max: 65535 }), 8080);
  assert.equal(parseEnvBoolean("ENABLE_TLS", env), true);
  assert.equal(parseEnvEnum("NODE_ENV", ["development", "production", "test"], env), "production");

  try {
    parseEnvString("API_SECRET", env, { minLength: 16, secret: true });
    assert.fail("Should have thrown");
  } catch (err) {
    assert.ok(!err.message.includes("short"), "Error message must not leak secret value");
  }
});
