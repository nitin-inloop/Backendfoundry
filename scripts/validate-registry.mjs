#!/usr/bin/env node
/**
 * Validates registry/registry.json against registry/schemas/registry.schema.json
 * (a dependency-free JSON Schema draft-07 subset) and cross-checks it against the
 * actual packages on disk so the registry stays the single source of truth.
 *
 * Usage: node scripts/validate-registry.mjs            (exits 1 on any error)
 *        import { validateRegistry } from "./validate-registry.mjs"
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

function typeOf(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (typeof value === "number") return Number.isInteger(value) ? "integer" : "number";
  return typeof value;
}

function matchesType(value, expected) {
  const actual = typeOf(value);
  const list = Array.isArray(expected) ? expected : [expected];
  return list.some((t) => t === actual || (t === "number" && actual === "integer"));
}

export function validateAgainstSchema(value, schema, rootSchema = schema, at = "$") {
  const errors = [];
  if (schema.$ref) {
    const refPath = schema.$ref.replace(/^#\//, "").split("/");
    let target = rootSchema;
    for (const seg of refPath) target = target?.[seg];
    if (!target) return [`${at}: unresolved $ref ${schema.$ref}`];
    return validateAgainstSchema(value, target, rootSchema, at);
  }
  if (schema.type && !matchesType(value, schema.type)) {
    return [`${at}: expected ${JSON.stringify(schema.type)}, got ${typeOf(value)}`];
  }
  if (schema.enum && !schema.enum.includes(value)) errors.push(`${at}: must be one of ${schema.enum.join(", ")}`);
  if (typeof value === "string") {
    if (schema.minLength !== undefined && value.length < schema.minLength) errors.push(`${at}: shorter than ${schema.minLength}`);
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) errors.push(`${at}: does not match ${schema.pattern}`);
  }
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) errors.push(`${at}: needs at least ${schema.minItems} items`);
    if (schema.items) value.forEach((item, i) => errors.push(...validateAgainstSchema(item, schema.items, rootSchema, `${at}[${i}]`)));
  }
  if (typeOf(value) === "object") {
    for (const key of schema.required ?? []) {
      if (!(key in value)) errors.push(`${at}: missing required property "${key}"`);
    }
    for (const [key, sub] of Object.entries(schema.properties ?? {})) {
      if (key in value) errors.push(...validateAgainstSchema(value[key], sub, rootSchema, `${at}.${key}`));
    }
  }
  return errors;
}

export function validateRegistry(root = ROOT) {
  const registry = JSON.parse(fs.readFileSync(path.join(root, "registry", "registry.json"), "utf8"));
  const schema = JSON.parse(fs.readFileSync(path.join(root, "registry", "schemas", "registry.schema.json"), "utf8"));
  const errors = validateAgainstSchema(registry, schema);

  const slugs = new Set();
  const categories = new Set(registry.brand?.categories ?? []);
  for (const [i, p] of (registry.packages ?? []).entries()) {
    const at = `packages[${i}] (${p.slug ?? p.id})`;
    if (slugs.has(p.slug)) errors.push(`${at}: duplicate slug`);
    slugs.add(p.slug);
    if (p.id !== p.slug) errors.push(`${at}: id and slug must match`);
    if (p.packageName !== `@backendfoundry/${p.slug}`) errors.push(`${at}: packageName must be @backendfoundry/${p.slug}`);
    if (p.docsRoute !== `/packages/${p.slug}`) errors.push(`${at}: docsRoute must be /packages/${p.slug}`);
    if (p.directory !== `packages/${p.slug}`) errors.push(`${at}: directory must be packages/${p.slug}`);
    if (!categories.has(p.category)) errors.push(`${at}: category "${p.category}" is not listed in brand.categories`);
    if (p.hasPlayground !== true) errors.push(`${at}: every component must ship a playground scenario`);

    const pkgDir = path.join(root, "packages", p.slug);
    const pkgJsonPath = path.join(pkgDir, "package.json");
    if (!fs.existsSync(pkgJsonPath)) {
      errors.push(`${at}: packages/${p.slug}/package.json does not exist`);
      continue;
    }
    const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, "utf8"));
    if (pkgJson.name !== p.packageName) errors.push(`${at}: package.json name ${pkgJson.name} != ${p.packageName}`);
    if (pkgJson.version !== p.version) errors.push(`${at}: package.json version ${pkgJson.version} != ${p.version}`);
    const regDeps = JSON.stringify(Object.keys(p.dependencies ?? {}).sort());
    const pkgDeps = JSON.stringify(Object.keys(pkgJson.dependencies ?? {}).sort());
    if (regDeps !== pkgDeps) errors.push(`${at}: dependencies ${regDeps} do not match package.json ${pkgDeps}`);
    const expectedRegDeps = Object.keys(p.dependencies ?? {})
      .filter((d) => d.startsWith("@backendfoundry/"))
      .map((d) => d.slice("@backendfoundry/".length))
      .sort();
    if (JSON.stringify([...(p.registryDependencies ?? [])].sort()) !== JSON.stringify(expectedRegDeps)) {
      errors.push(`${at}: registryDependencies must mirror @backendfoundry/* dependencies (${expectedRegDeps.join(", ")})`);
    }
    for (const f of p.files ?? []) {
      if (!fs.existsSync(path.join(root, f.path))) errors.push(`${at}: file ${f.path} does not exist`);
    }
    if (!fs.existsSync(path.join(pkgDir, "README.md"))) errors.push(`${at}: packages/${p.slug}/README.md is missing`);

    // Imports used by the source must be declared as dependencies.
    const srcFile = path.join(pkgDir, "src", "index.ts");
    if (fs.existsSync(srcFile)) {
      const src = fs.readFileSync(srcFile, "utf8");
      const imported = new Set([...src.matchAll(/from\s+"(@backendfoundry\/[a-z0-9-]+)"/g)].map((m) => m[1]));
      for (const dep of imported) {
        if (!(dep in (pkgJson.dependencies ?? {}))) errors.push(`${at}: source imports ${dep} but it is not a dependency`);
      }
    }

    const pg = p.playground;
    if (pg && Array.isArray(pg.inputs)) {
      const keys = new Set();
      for (const input of pg.inputs) {
        if (keys.has(input.key)) errors.push(`${at}: duplicate playground input key "${input.key}"`);
        keys.add(input.key);
        const t = input.type;
        if (t === "number" && typeof input.default !== "number") errors.push(`${at}: input ${input.key} default must be a number`);
        if (t === "boolean" && typeof input.default !== "boolean") errors.push(`${at}: input ${input.key} default must be a boolean`);
        if (["text", "textarea", "json", "select"].includes(t) && typeof input.default !== "string") {
          errors.push(`${at}: input ${input.key} default must be a string`);
        }
        if (t === "select" && !(input.options ?? []).includes(input.default)) {
          errors.push(`${at}: input ${input.key} default "${input.default}" is not one of its options`);
        }
        if (t === "json") {
          try {
            JSON.parse(input.default);
          } catch {
            errors.push(`${at}: input ${input.key} default is not valid JSON`);
          }
        }
      }
    }
  }
  for (const p of registry.packages ?? []) {
    for (const dep of p.registryDependencies ?? []) {
      if (!slugs.has(dep)) errors.push(`packages (${p.slug}): registryDependency "${dep}" is not a registered component`);
    }
  }
  return { registry, errors };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const { registry, errors } = validateRegistry();
  if (errors.length) {
    for (const e of errors) console.error(`✖ ${e}`);
    console.error(`\nRegistry validation failed with ${errors.length} error(s).`);
    process.exit(1);
  }
  console.log(`✔ registry.json is valid against registry.schema.json (${registry.packages.length} components, ${registry.brand.categories.length} categories)`);
}
