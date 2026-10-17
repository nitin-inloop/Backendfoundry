import test from "node:test";
import assert from "node:assert/strict";
import { createHealthRegistry } from "../dist/index.js";

test("@backendfoundry/health - distinguishes healthy, degraded (non-critical), and unhealthy (critical) probes", async () => {
  const health = createHealthRegistry({ version: "1.0.0", defaultTimeoutMs: 50, exposeErrorMessages: false });

  health.registerProbe({
    name: "postgres",
    critical: true,
    check: async () => ({ healthy: true })
  });

  health.registerProbe({
    name: "search-index",
    critical: false,
    check: async () => {
      throw new Error("Connection refused at postgres://admin:secret@10.0.1.9:5432/idx");
    }
  });

  const degradedReport = await health.checkReadiness();
  assert.equal(degradedReport.status, "degraded");
  assert.equal(degradedReport.statusCode, 200);
  assert.equal(degradedReport.checks["search-index"].message, "Dependency check failed");
  assert.ok(!JSON.stringify(degradedReport).includes("secret"), "Never leak credentials in health endpoint");

  // Register a critical probe that times out
  health.registerProbe({
    name: "redis-primary",
    critical: true,
    timeoutMs: 25,
    check: async () => {
      await new Promise((r) => setTimeout(r, 150));
      return true;
    }
  });

  const unhealthyReport = await health.checkReadiness();
  assert.equal(unhealthyReport.status, "unhealthy");
  assert.equal(unhealthyReport.statusCode, 503);
  assert.equal(unhealthyReport.checks["redis-primary"].status, "unhealthy");
});
