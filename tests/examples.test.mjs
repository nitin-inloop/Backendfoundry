import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("framework examples type-check against the published package declarations", () => {
  const ts = require("typescript");
  const examplesDir = path.join(ROOT, "examples");
  const files = [];
  for (const ex of fs.readdirSync(examplesDir)) {
    const src = path.join(examplesDir, ex, "src");
    if (!fs.existsSync(src)) continue;
    for (const f of fs.readdirSync(src)) if (f.endsWith(".ts")) files.push(path.join(src, f));
  }
  assert.ok(files.length >= 3, "expected express, fastify and nextjs examples");
  const program = ts.createProgram(files, {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    strict: true,
    noEmit: true,
    skipLibCheck: true,
    lib: ["lib.es2022.d.ts", "lib.dom.d.ts", "lib.dom.iterable.d.ts"],
    types: ["node"],
    typeRoots: [path.join(ROOT, "node_modules", "@types")],
    baseUrl: ROOT,
    paths: { "@backendfoundry/*": ["packages/*/dist/index.d.ts"] }
  });
  const diags = ts.getPreEmitDiagnostics(program).map((d) => {
    const msg = ts.flattenDiagnosticMessageText(d.messageText, "\n");
    if (!d.file || d.start === undefined) return msg;
    const { line } = d.file.getLineAndCharacterOfPosition(d.start);
    return `${path.relative(ROOT, d.file.fileName)}:${line + 1} ${msg}`;
  });
  assert.deepEqual(diags, []);
});
