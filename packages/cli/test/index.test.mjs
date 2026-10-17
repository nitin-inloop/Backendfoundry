import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BIN = path.resolve(__dirname, "..", "dist", "index.cjs");
const cli = require(BIN);
const registry = JSON.parse(fs.readFileSync(path.resolve(__dirname, "..", "..", "..", "registry", "registry.json"), "utf8"));

function tmpProject(withSrc = true) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bf-cli-"));
  fs.writeFileSync(path.join(dir, "package.json"), JSON.stringify({ name: "demo", version: "0.0.0" }));
  if (withSrc) fs.mkdirSync(path.join(dir, "src"));
  return dir;
}

function run(args, cwd) {
  const res = spawnSync(process.execPath, [BIN, ...args], { cwd, encoding: "utf8" });
  return { code: res.status, stdout: res.stdout, stderr: res.stderr };
}

function capture(args, cwd) {
  const out = [];
  const err = [];
  const code = cli.runCli(args, { cwd, stdout: (l) => out.push(l), stderr: (l) => err.push(l) });
  return { code, stdout: out.join("\n"), stderr: err.join("\n") };
}

test("@backendfoundry/cli - --version and --help", () => {
  const v = run(["--version"], process.cwd());
  assert.equal(v.code, 0);
  assert.equal(v.stdout.trim(), cli.CLI_VERSION);
  const h = run(["--help"], process.cwd());
  assert.equal(h.code, 0);
  assert.match(h.stdout, /backendfoundry add <component/);
});

test("@backendfoundry/cli - list prints every registry component grouped by category", () => {
  const dir = tmpProject();
  const res = run(["list"], dir);
  assert.equal(res.code, 0, res.stderr);
  for (const p of registry.packages) {
    assert.ok(res.stdout.includes(p.slug), `list output missing ${p.slug}`);
  }
  for (const cat of registry.brand.categories) assert.ok(res.stdout.includes(cat));

  const json = JSON.parse(run(["list", "--json"], dir).stdout);
  assert.equal(json.length, registry.packages.length);
  const reliability = JSON.parse(run(["list", "--json", "--category", "reliability"], dir).stdout);
  assert.deepEqual(reliability.map((p) => p.slug).sort(), ["circuit-breaker", "retry"]);
});

test("@backendfoundry/cli - info shows API, install and usage; unknown components fail with suggestions", () => {
  const dir = tmpProject();
  const res = run(["info", "rate-limit"], dir);
  assert.equal(res.code, 0, res.stderr);
  assert.match(res.stdout, /@backendfoundry\/rate-limit@1\.0\.0/);
  assert.match(res.stdout, /npm install @backendfoundry\/rate-limit/);
  assert.match(res.stdout, /createRateLimiter/);

  const byPkgName = JSON.parse(run(["info", "@backendfoundry/retry", "--json"], dir).stdout);
  assert.equal(byPkgName.slug, "retry");

  const bad = run(["info", "rate"], dir);
  assert.equal(bad.code, 1);
  assert.match(bad.stderr, /Unknown component "rate".*rate-limit/);
});

test("@backendfoundry/cli - init writes backendfoundry.json and refuses to overwrite", () => {
  const dir = tmpProject();
  fs.writeFileSync(path.join(dir, "pnpm-lock.yaml"), "lockfileVersion: 9");
  const res = run(["init"], dir);
  assert.equal(res.code, 0, res.stderr);
  const config = JSON.parse(fs.readFileSync(path.join(dir, "backendfoundry.json"), "utf8"));
  assert.equal(config.targetDir, "src/lib/backendfoundry");
  assert.equal(config.mode, "source");
  assert.equal(config.packageManager, "pnpm");

  const again = run(["init"], dir);
  assert.equal(again.code, 1);
  assert.match(again.stderr, /already exists/);
  assert.equal(run(["init", "--force", "--dir", "server/bf", "--mode", "npm"], dir).code, 0);
  const updated = JSON.parse(fs.readFileSync(path.join(dir, "backendfoundry.json"), "utf8"));
  assert.equal(updated.targetDir, "server/bf");
  assert.equal(updated.mode, "npm");
});

test("@backendfoundry/cli - add copies source with transitive dependencies and rewrites imports", () => {
  const dir = tmpProject();
  const res = run(["add", "rate-limit"], dir);
  assert.equal(res.code, 0, res.stderr);
  const base = path.join(dir, "src", "lib", "backendfoundry");
  for (const f of ["core.ts", "errors.ts", "rate-limit.ts"]) {
    assert.ok(fs.existsSync(path.join(base, f)), `${f} should be created`);
  }
  const rl = fs.readFileSync(path.join(base, "rate-limit.ts"), "utf8");
  assert.match(rl, /from "\.\/core"/);
  assert.match(rl, /from "\.\/errors"/);
  assert.doesNotMatch(rl, /@backendfoundry\/core"/);
  assert.match(rl, /^\/\/ Added by backendfoundry/);
  assert.match(res.stdout, /\+ src\/lib\/backendfoundry\/core\.ts \[created\] \(dependency\)/);

  // Re-running is idempotent
  const again = run(["add", "rate-limit"], dir);
  assert.equal(again.code, 0);
  assert.match(again.stdout, /\[unchanged\]/);

  // Local edits are protected unless --overwrite
  fs.appendFileSync(path.join(base, "core.ts"), "\n// local change\n");
  const conflict = run(["add", "core"], dir);
  assert.equal(conflict.code, 2);
  assert.match(conflict.stdout, /\[skipped\]/);
  assert.match(conflict.stderr, /--overwrite/);
  const forced = run(["add", "core", "--overwrite"], dir);
  assert.equal(forced.code, 0);
  assert.match(forced.stdout, /\[updated\]/);
});

test("@backendfoundry/cli - every component can be vendored and the vendored sources compile", () => {
  const dir = tmpProject();
  const slugs = registry.packages.map((p) => p.slug);
  const res = run(["add", ...slugs, "--dir", "vendor"], dir);
  assert.equal(res.code, 0, res.stderr);
  const files = fs.readdirSync(path.join(dir, "vendor")).sort();
  assert.deepEqual(files, slugs.map((s) => `${s}.ts`).sort());

  let ts;
  try {
    ts = require("typescript");
  } catch {
    return; // typescript not installed: skip compile check
  }
  const program = ts.createProgram(
    files.map((f) => path.join(dir, "vendor", f)),
    {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      strict: true,
      noEmit: true,
      skipLibCheck: true,
      types: ["node"],
      typeRoots: [path.resolve(__dirname, "..", "..", "..", "node_modules", "@types")]
    }
  );
  const diags = ts.getPreEmitDiagnostics(program).map((d) => ts.flattenDiagnosticMessageText(d.messageText, "\n"));
  assert.deepEqual(diags, [], "vendored components should type-check");
});

test("@backendfoundry/cli - add --npm prints the install command for the detected package manager", () => {
  const dir = tmpProject();
  fs.writeFileSync(path.join(dir, "yarn.lock"), "");
  const res = run(["add", "retry", "cache", "--npm"], dir);
  assert.equal(res.code, 0, res.stderr);
  assert.match(res.stdout, /yarn add @backendfoundry\/retry @backendfoundry\/cache/);
  assert.equal(fs.existsSync(path.join(dir, "src", "lib")), false);

  // config mode=npm is respected without the flag
  fs.writeFileSync(path.join(dir, "backendfoundry.json"), JSON.stringify({ targetDir: "x", mode: "npm", packageManager: "pnpm" }));
  const viaConfig = run(["add", "webhooks"], dir);
  assert.match(viaConfig.stdout, /pnpm add @backendfoundry\/webhooks/);
});

test("@backendfoundry/cli - dry run writes nothing; programmatic helpers work", () => {
  const dir = tmpProject();
  const res = capture(["add", "ai", "--dry-run"], dir);
  assert.equal(res.code, 0, res.stderr);
  assert.match(res.stdout, /Dry run/);
  assert.equal(fs.existsSync(path.join(dir, "src", "lib")), false);

  const reg = cli.loadRegistry({ cwd: dir });
  const order = cli.resolveDependencyOrder(reg, ["ai"]).map((c) => c.slug);
  assert.deepEqual(order, ["core", "validation", "errors", "retry", "ai"]);
  assert.equal(cli.rewriteImportsForVendoring('import { x } from "@backendfoundry/core";'), 'import { x } from "./core";');
  assert.equal(cli.formatInstallCommand("bun", ["@backendfoundry/core"]), "bun add @backendfoundry/core");
  assert.throws(() => cli.parseArgs(["add", "--dir"]), /requires a value/);

  const unknown = capture(["frobnicate"], dir);
  assert.equal(unknown.code, 1);
  assert.match(unknown.stderr, /Unknown command/);
});
