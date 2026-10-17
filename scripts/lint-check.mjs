#!/usr/bin/env node
/**
 * Repository lint:
 *  - registry.json schema + cross-check validation
 *  - package.json conventions for every package (exports, files, publishConfig, ...)
 *  - source safety checks (no eval / new Function) via the TypeScript AST
 *  - build artifacts present
 *  - with --typecheck: strict type-check of every package against built declarations
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { validateRegistry } from "./validate-registry.mjs";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PACKAGES_DIR = path.join(ROOT, "packages");
const typecheck = process.argv.includes("--typecheck");

let errors = 0;
const fail = (msg) => {
  console.error(`✖ ${msg}`);
  errors++;
};

// 1. Registry
const { registry, errors: registryErrors } = validateRegistry(ROOT);
registryErrors.forEach(fail);
if (!registryErrors.length) console.log(`✔ registry.json validated (${registry.packages.length} components)`);

// 2. package.json conventions
const pkgDirs = fs.readdirSync(PACKAGES_DIR).filter((d) => fs.existsSync(path.join(PACKAGES_DIR, d, "package.json"))).sort();
for (const dir of pkgDirs) {
  const pkg = JSON.parse(fs.readFileSync(path.join(PACKAGES_DIR, dir, "package.json"), "utf8"));
  const where = `packages/${dir}/package.json`;
  const isCli = dir === "cli";
  if (pkg.name !== `@backendfoundry/${dir}`) fail(`${where}: name must be @backendfoundry/${dir}`);
  for (const field of ["version", "description", "license", "repository", "keywords", "files", "engines", "exports", "types", "main"]) {
    if (pkg[field] === undefined) fail(`${where}: missing "${field}"`);
  }
  if (pkg.sideEffects !== false) fail(`${where}: sideEffects must be false`);
  if (pkg.publishConfig?.access !== "public") fail(`${where}: publishConfig.access must be "public"`);
  if (pkg.private) fail(`${where}: must not be private`);
  const root = pkg.exports?.["."];
  if (!root?.types || !root?.require) fail(`${where}: exports["."] must declare types and require`);
  if (!isCli && !root?.import) fail(`${where}: exports["."] must declare an ESM import entry`);
  if (isCli && !pkg.bin?.backendfoundry) fail(`${where}: must declare the "backendfoundry" bin`);
  if (!fs.existsSync(path.join(PACKAGES_DIR, dir, "README.md"))) fail(`packages/${dir}/README.md is missing`);
  if (!fs.existsSync(path.join(PACKAGES_DIR, dir, "test", "index.test.mjs"))) fail(`packages/${dir}/test/index.test.mjs is missing`);
  for (const dep of Object.keys(pkg.dependencies ?? {})) {
    if (dep.startsWith("@backendfoundry/") && pkg.dependencies[dep] !== "workspace:*") {
      fail(`${where}: internal dependency ${dep} must use workspace:*`);
    }
  }
}

// 3. Source safety + artifacts
for (const dir of pkgDirs) {
  const srcFile = path.join(PACKAGES_DIR, dir, "src", "index.ts");
  if (!fs.existsSync(srcFile)) {
    fail(`packages/${dir}/src/index.ts is missing`);
    continue;
  }
  const code = fs.readFileSync(srcFile, "utf8");
  const sf = ts.createSourceFile(srcFile, code, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
  const parseDiagnostics = sf.parseDiagnostics ?? [];
  for (const d of parseDiagnostics) fail(`packages/${dir}: parse error ${ts.flattenDiagnosticMessageText(d.messageText, "\n")}`);
  const visit = (node) => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "eval") {
      fail(`packages/${dir}: eval() is forbidden`);
    }
    if (ts.isNewExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "Function") {
      fail(`packages/${dir}: new Function() is forbidden`);
    }
    if (ts.isDebuggerStatement(node)) fail(`packages/${dir}: debugger statement`);
    ts.forEachChild(node, visit);
  };
  visit(sf);

  const artifacts = dir === "cli" ? ["index.cjs", "index.d.ts", "registry/registry.json"] : ["index.js", "index.mjs", "index.cjs", "index.d.ts"];
  for (const a of artifacts) {
    if (!fs.existsSync(path.join(PACKAGES_DIR, dir, "dist", a))) fail(`missing build artifact packages/${dir}/dist/${a} (run pnpm build)`);
  }
}
console.log(`✔ Checked package.json conventions, sources and artifacts for ${pkgDirs.length} packages`);

// 4. Optional strict type-check
if (typecheck) {
  const files = pkgDirs.map((d) => path.join(PACKAGES_DIR, d, "src", "index.ts")).filter((f) => fs.existsSync(f));
  const program = ts.createProgram(files, {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    strict: true,
    noUncheckedIndexedAccess: true,
    noImplicitOverride: true,
    noEmit: true,
    skipLibCheck: true,
    esModuleInterop: true,
    lib: ["lib.es2022.d.ts", "lib.dom.d.ts"],
    types: ["node"],
    typeRoots: [path.join(ROOT, "node_modules", "@types")],
    baseUrl: ROOT,
    paths: { "@backendfoundry/*": ["packages/*/src/index.ts"] }
  });
  const diags = ts.getPreEmitDiagnostics(program);
  for (const d of diags) {
    const msg = ts.flattenDiagnosticMessageText(d.messageText, "\n");
    if (d.file && d.start !== undefined) {
      const { line, character } = d.file.getLineAndCharacterOfPosition(d.start);
      fail(`${path.relative(ROOT, d.file.fileName)}:${line + 1}:${character + 1} ${msg}`);
    } else fail(msg);
  }
  if (!diags.length) console.log(`✔ Strict TypeScript type-check passed for ${files.length} packages`);
}

if (errors > 0) {
  console.error(`\nLint failed with ${errors} error(s).`);
  process.exit(1);
}
console.log(`✔ Lint passed (0 errors).`);
