#!/usr/bin/env node
/**
 * Generates packages/<slug>/README.md for every component from registry/registry.json,
 * keeping the npm READMEs in sync with the registry (the single source of truth).
 * The CLI README is maintained by hand in packages/cli/README.md.
 *
 * Usage: node scripts/generate-readmes.mjs [--check]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const check = process.argv.includes("--check");
const registry = JSON.parse(fs.readFileSync(path.join(ROOT, "registry", "registry.json"), "utf8"));

function table(rows, headers) {
  const esc = (s) => String(s ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((r) => `| ${r.map(esc).join(" | ")} |`)
  ].join("\n");
}

function render(p) {
  const lines = [];
  lines.push(`# ${p.packageName}`);
  lines.push("");
  lines.push(`> ${p.displayName} — part of [BackendFoundry](https://backendfoundry.dev), backend components you own.`);
  lines.push("");
  lines.push(p.description);
  lines.push("");
  lines.push("## Install");
  lines.push("");
  lines.push("```bash");
  lines.push(p.install.npm);
  lines.push("# or");
  lines.push(p.install.pnpm);
  lines.push("```");
  lines.push("");
  lines.push("Prefer to own the code? Copy the TypeScript source (plus its dependencies) into your project:");
  lines.push("");
  lines.push("```bash");
  lines.push(p.install.cli);
  lines.push("```");
  lines.push("");
  lines.push(`Ships ESM, CommonJS and TypeScript declarations. Requires ${p.runtimeRequirements}.`);
  if (p.registryDependencies.length) {
    lines.push(`Depends on ${p.registryDependencies.map((d) => `\`@backendfoundry/${d}\``).join(", ")}.`);
  } else {
    lines.push("Zero runtime dependencies.");
  }
  lines.push("");
  lines.push("## Usage");
  lines.push("");
  lines.push("```ts");
  lines.push(p.usage);
  lines.push("```");
  lines.push("");
  for (const [fw, label] of [["express", "Express"], ["fastify", "Fastify"], ["nextjs", "Next.js Route Handler"]]) {
    if (p.examples?.[fw]) {
      lines.push(`### ${label}`);
      lines.push("");
      lines.push("```ts");
      lines.push(p.examples[fw]);
      lines.push("```");
      lines.push("");
    }
  }
  lines.push("## API");
  lines.push("");
  lines.push(table(p.exportedApis.map((a) => [`\`${a.name}\``, a.kind, `\`${a.signature}\``, a.description]), ["Export", "Kind", "Signature", "Description"]));
  lines.push("");
  if (p.configSchema?.length) {
    lines.push("## Configuration");
    lines.push("");
    lines.push(table(p.configSchema.map((c) => [`\`${c.option}\``, `\`${c.type}\``, c.default ?? "", c.required ? "yes" : "no", c.description]), ["Option", "Type", "Default", "Required", "Description"]));
    lines.push("");
  }
  if (p.errorBehavior) {
    lines.push("## Error behavior");
    lines.push("");
    lines.push(p.errorBehavior);
    lines.push("");
  }
  if (p.securityNotes?.length) {
    lines.push("## Security notes");
    lines.push("");
    for (const n of p.securityNotes) lines.push(`- ${n}`);
    lines.push("");
  }
  if (p.limitations?.length) {
    lines.push("## Limitations");
    lines.push("");
    for (const n of p.limitations) lines.push(`- ${n}`);
    lines.push("");
  }
  lines.push("## Playground");
  lines.push("");
  lines.push(`Try **${p.playground.title}** live at https://backendfoundry.dev${p.docsRoute} — ${p.playground.description}`);
  lines.push("");
  lines.push("## License");
  lines.push("");
  lines.push("MIT");
  lines.push("");
  return lines.join("\n");
}

let stale = 0;
for (const p of registry.packages) {
  const file = path.join(ROOT, "packages", p.slug, "README.md");
  const content = render(p);
  const existing = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
  if (existing === content) continue;
  if (check) {
    console.error(`✖ packages/${p.slug}/README.md is out of date`);
    stale++;
  } else {
    fs.writeFileSync(file, content, "utf8");
    console.log(`✔ wrote packages/${p.slug}/README.md`);
  }
}
if (check && stale) process.exit(1);
if (check) console.log("✔ READMEs are in sync with the registry");
