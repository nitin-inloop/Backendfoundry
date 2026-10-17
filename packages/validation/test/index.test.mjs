import test from "node:test";
import assert from "node:assert/strict";
import {
  v,
  validateBody,
  validateQuery,
  validateParams,
  ValidationError,
  expressValidate,
  fastifyValidate
} from "../dist/index.js";

test("@backendfoundry/validation - validates body, query, and params schemas", () => {
  const userSchema = v.object({
    email: v.string().trim().email(),
    age: v.number().int().min(18).max(120),
    role: v.enum(["admin", "member", "viewer"]).default("member"),
    tags: v.array(v.string().min(2)).optional()
  }).strict();

  const valid = validateBody(userSchema, {
    email: "  dev@backendfoundry.dev ",
    age: 29,
    tags: ["backend", "infra"]
  });
  assert.equal(valid.email, "dev@backendfoundry.dev");
  assert.equal(valid.role, "member");
  assert.deepEqual(valid.tags, ["backend", "infra"]);

  const querySchema = v.object({
    page: v.number().coerce().int().min(1).default(1),
    active: v.boolean().coerce().default(true)
  });
  const parsedQuery = validateQuery(querySchema, { page: "3", active: "false" });
  assert.equal(parsedQuery.page, 3);
  assert.equal(parsedQuery.active, false);

  const paramSchema = v.object({ id: v.string().regex(/^[a-z0-9-]+$/) });
  assert.deepEqual(validateParams(paramSchema, { id: "pkg-01" }), { id: "pkg-01" });
});

test("@backendfoundry/validation - redacts sensitive fields and rejects extra keys in strict mode", () => {
  const loginSchema = v.object({
    email: v.string().email(),
    password: v.string().min(12)
  }).strict();

  assert.throws(
    () => validateBody(loginSchema, { email: "bad", password: "my_super_secret_short", extra: 1 }, "req_val001"),
    (err) => {
      assert.ok(err instanceof ValidationError);
      assert.equal(err.statusCode, 400);
      assert.equal(err.code, "VALIDATION_FAILED");
      const serialized = JSON.stringify(err.toJSON());
      assert.ok(!serialized.includes("my_super_secret_short"), "Must never leak raw password in error response");
      assert.ok(err.issues.some((i) => i.code === "unrecognized_key"));
      return true;
    }
  );
});

test("@backendfoundry/validation - Express and Fastify adapters", async () => {
  const mw = expressValidate({
    body: v.object({ name: v.string().min(2) })
  });

  const req = { body: { name: "Foundry" }, headers: {} };
  let nextErr = null;
  mw(req, {}, (err) => { nextErr = err; });
  assert.equal(nextErr, undefined);
  assert.equal(req.validated.body.name, "Foundry");

  const hook = fastifyValidate({
    body: v.object({ name: v.string().min(3) })
  });
  let statusSent = 200;
  let bodySent = null;
  const reply = {
    code(c) { statusSent = c; return this; },
    send(b) { bodySent = b; return this; }
  };
  await hook({ body: { name: "a" }, headers: {} }, reply);
  assert.equal(statusSent, 400);
  assert.equal(bodySent.error.code, "VALIDATION_FAILED");
});
