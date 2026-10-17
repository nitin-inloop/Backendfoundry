import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { validateRegistry } from "../scripts/validate-registry.mjs";

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const registry = JSON.parse(fs.readFileSync(path.join(ROOT, "registry", "registry.json"), "utf8"));

test("registry.json validates against its schema and matches packages on disk", () => {
  const { errors } = validateRegistry(ROOT);
  assert.deepEqual(errors, []);
});

for (const p of registry.packages) {
  test(`${p.packageName} - ESM and CJS entry points expose the same API, including registry-documented exports`, async () => {
    const esm = await import(p.packageName);
    const cjs = require(p.packageName);
    const esmKeys = Object.keys(esm).filter((k) => k !== "default").sort();
    const cjsKeys = Object.keys(cjs).filter((k) => k !== "__esModule" && k !== "default").sort();
    assert.ok(esmKeys.length > 0, "package should export something");
    assert.deepEqual(cjsKeys, esmKeys, "CJS and ESM exports differ");

    for (const api of p.exportedApis) {
      const names = api.name.split("/").map((s) => s.trim().replace(/\(.*$/, "").split(".")[0]);
      for (const name of names) {
        if (!/^[A-Za-z_$][\w$]*$/.test(name)) continue;
        assert.ok(name in esm, `${p.packageName} registry documents "${name}" but it is not exported`);
      }
    }

    const dts = fs.readFileSync(path.join(ROOT, "packages", p.slug, "dist", "index.d.ts"), "utf8");
    assert.ok(dts.length > 100, "declarations should be emitted");
  });
}
