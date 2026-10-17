#!/usr/bin/env node
/**
 * Runs every package unit suite (packages/<name>/test/index.test.mjs, including the CLI)
 * plus the repository-level suites in tests/*.test.mjs using the built-in node:test runner.
 * Run `pnpm build` first: suites exercise the built dist/ output.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PACKAGES_DIR = path.join(ROOT, "packages");
const TESTS_DIR = path.join(ROOT, "tests");

const packages = fs
  .readdirSync(PACKAGES_DIR)
  .sort()
  .filter((p) => fs.existsSync(path.join(PACKAGES_DIR, p, "test", "index.test.mjs")));

const missingBuild = packages.filter((p) => !fs.existsSync(path.join(PACKAGES_DIR, p, "dist", "index.cjs")));
if (missingBuild.length) {
  console.error(`✖ Missing build output for: ${missingBuild.join(", ")}. Run \`pnpm build\` first.`);
  process.exit(1);
}

const repoSuites = fs.readdirSync(TESTS_DIR).filter((f) => f.endsWith(".test.mjs")).sort();
const testFiles = [
  ...packages.map((p) => path.join(PACKAGES_DIR, p, "test", "index.test.mjs")),
  ...repoSuites.map((f) => path.join(TESTS_DIR, f))
];

console.log(`Running ${testFiles.length} test suites (${packages.length} packages + ${repoSuites.length} repository suites)...\n`);

const res = spawnSync(process.execPath, ["--test", ...testFiles], { cwd: ROOT, stdio: "inherit" });
process.exit(res.status ?? 1);
