#!/usr/bin/env node
/**
 * BackendFoundry package builder.
 *
 * For every package in packages/<name>/src/index.ts this produces:
 *   dist/index.js   (ESM)
 *   dist/index.mjs  (ESM alias)
 *   dist/index.cjs  (CommonJS)
 *   dist/index.d.ts (real TypeScript declarations emitted by the compiler)
 *
 * Packages are built in dependency order so declaration emit for a package can
 * resolve `@backendfoundry/*` imports against the already-built dist/index.d.ts
 * of its dependencies.
 *
 * The CLI package is special: it is emitted as CommonJS only (bin entry) and
 * receives a bundled copy of registry/registry.json plus every component's
 * source so `backendfoundry add` works offline after `npm i -g backendfoundry`.
 *
 * Usage: node scripts/build-packages.mjs [--only core,retry] [--strict]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PACKAGES_DIR = path.join(ROOT, "packages");
const NODE_MODULES_SCOPE = path.join(ROOT, "node_modules", "@backendfoundry");

let ts;
try {
  ts = require("typescript");
} catch {
  console.error("✖ The 'typescript' package is required to build. Run `pnpm install` at the repository root first.");
  process.exit(1);
}

const args = process.argv.slice(2);
const strict = args.includes("--strict");
const onlyIdx = args.indexOf("--only");
const only = onlyIdx >= 0 && args[onlyIdx + 1] ? new Set(args[onlyIdx + 1].split(",")) : null;

export const PACKAGE_ORDER = [
  "core",
  "errors",
  "validation",
  "rate-limit",
  "retry",
  "circuit-breaker",
  "cache",
  "idempotency",
  "webhooks",
  "health",
  "logger",
  "ai",
  "cli"
];

const CJS_ONLY = new Set(["cli"]);

const baseCompilerOptions = {
  target: ts.ScriptTarget.ES2022,
  strict: true,
  noUncheckedIndexedAccess: true,
  noImplicitOverride: true,
  esModuleInterop: true,
  skipLibCheck: true,
  forceConsistentCasingInFileNames: true,
  lib: ["lib.es2022.d.ts", "lib.dom.d.ts"],
  types: ["node"],
  typeRoots: [path.join(ROOT, "node_modules", "@types")]
};

function transpile(code, fileName, moduleKind) {
  const out = ts.transpileModule(code, {
    fileName,
    reportDiagnostics: false,
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: moduleKind,
      esModuleInterop: true,
      removeComments: false,
      sourceMap: false
    }
  });
  return out.outputText;
}

function emitDeclarations(pkg, srcFile) {
  const options = {
    ...baseCompilerOptions,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    declaration: true,
    emitDeclarationOnly: true,
    noEmitOnError: false,
    rootDir: path.dirname(srcFile),
    outDir: path.join(PACKAGES_DIR, pkg, "dist"),
    baseUrl: ROOT,
    paths: {
      "@backendfoundry/*": ["packages/*/dist/index.d.ts"]
    }
  };
  const program = ts.createProgram([srcFile], options);
  let dts = null;
  program.emit(undefined, (fileName, text) => {
    if (fileName.endsWith("index.d.ts")) dts = text;
  });
  const diagnostics = ts.getPreEmitDiagnostics(program).filter((d) => d.category === ts.DiagnosticCategory.Error);
  return { dts, diagnostics };
}

function formatDiagnostic(d) {
  const msg = ts.flattenDiagnosticMessageText(d.messageText, "\n");
  if (d.file && d.start !== undefined) {
    const { line, character } = d.file.getLineAndCharacterOfPosition(d.start);
    return `${path.relative(ROOT, d.file.fileName)}:${line + 1}:${character + 1} - ${msg}`;
  }
  return msg;
}

function linkIntoRootNodeModules(pkg, pkgDir) {
  // Make every package resolvable from the repo root (integration tests, docs).
  // If pnpm already created a workspace symlink/junction, leave it alone.
  fs.mkdirSync(NODE_MODULES_SCOPE, { recursive: true });
  const target = path.join(NODE_MODULES_SCOPE, pkg);
  let stat = null;
  try {
    stat = fs.lstatSync(target);
  } catch {
    stat = null;
  }
  if (stat && stat.isSymbolicLink()) return "linked";
  if (stat) fs.rmSync(target, { recursive: true, force: true });
  try {
    fs.symlinkSync(pkgDir, target, "junction");
    return "linked";
  } catch {
    fs.mkdirSync(path.join(target, "dist"), { recursive: true });
    fs.copyFileSync(path.join(pkgDir, "package.json"), path.join(target, "package.json"));
    for (const f of fs.readdirSync(path.join(pkgDir, "dist"))) {
      const from = path.join(pkgDir, "dist", f);
      if (fs.statSync(from).isFile()) fs.copyFileSync(from, path.join(target, "dist", f));
    }
    return "copied";
  }
}

function bundleCliAssets(cliDir) {
  const assetsDir = path.join(cliDir, "dist", "registry");
  fs.rmSync(assetsDir, { recursive: true, force: true });
  fs.mkdirSync(path.join(assetsDir, "sources"), { recursive: true });
  fs.copyFileSync(path.join(ROOT, "registry", "registry.json"), path.join(assetsDir, "registry.json"));
  let count = 0;
  for (const pkg of PACKAGE_ORDER) {
    if (pkg === "cli") continue;
    const src = path.join(PACKAGES_DIR, pkg, "src", "index.ts");
    if (!fs.existsSync(src)) continue;
    fs.copyFileSync(src, path.join(assetsDir, "sources", `${pkg}.ts`));
    count++;
  }
  return count;
}

let builtCount = 0;
let diagnosticCount = 0;

for (const pkg of PACKAGE_ORDER) {
  if (only && !only.has(pkg)) continue;
  const pkgDir = path.join(PACKAGES_DIR, pkg);
  const srcFile = path.join(pkgDir, "src", "index.ts");
  if (!fs.existsSync(srcFile)) continue;

  const distDir = path.join(pkgDir, "dist");
  fs.rmSync(distDir, { recursive: true, force: true });
  fs.mkdirSync(distDir, { recursive: true });

  const code = fs.readFileSync(srcFile, "utf8");
  const outputs = [];

  if (CJS_ONLY.has(pkg)) {
    let cjs = transpile(code.replace(/^#!.*\n/, ""), srcFile, ts.ModuleKind.CommonJS);
    cjs = `#!/usr/bin/env node\n${cjs}`;
    fs.writeFileSync(path.join(distDir, "index.cjs"), cjs, "utf8");
    outputs.push("cjs");
  } else {
    const esm = transpile(code, srcFile, ts.ModuleKind.ESNext);
    const cjs = transpile(code, srcFile, ts.ModuleKind.CommonJS);
    fs.writeFileSync(path.join(distDir, "index.js"), esm, "utf8");
    fs.writeFileSync(path.join(distDir, "index.mjs"), esm, "utf8");
    fs.writeFileSync(path.join(distDir, "index.cjs"), cjs, "utf8");
    outputs.push("js", "mjs", "cjs");
  }

  const { dts, diagnostics } = emitDeclarations(pkg, srcFile);
  if (dts) {
    fs.writeFileSync(path.join(distDir, "index.d.ts"), dts, "utf8");
    outputs.push("d.ts");
  }
  if (diagnostics.length) {
    diagnosticCount += diagnostics.length;
    for (const d of diagnostics) console.warn(`  ⚠ ${formatDiagnostic(d)}`);
  }

  let extra = "";
  if (pkg === "cli") {
    const n = bundleCliAssets(pkgDir);
    extra = ` (+ registry.json and ${n} component sources)`;
  }

  const linkMode = linkIntoRootNodeModules(pkg, pkgDir);
  builtCount++;
  console.log(`✔ Built @backendfoundry/${pkg} -> dist/index.{${outputs.join(",")}}${extra} [${linkMode}]`);
}

console.log(`\nSuccessfully built ${builtCount} packages${diagnosticCount ? ` with ${diagnosticCount} type diagnostic(s)` : " (0 type errors)"}.`);
if (strict && diagnosticCount > 0) process.exit(1);
