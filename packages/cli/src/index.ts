/**
 * backendfoundry — shadcn-style CLI for BackendFoundry backend components.
 *
 *   backendfoundry list [--category <name>] [--json]
 *   backendfoundry info <component> [--json]
 *   backendfoundry init [--dir <path>] [--mode source|npm] [--force]
 *   backendfoundry add <component...> [--source|--npm] [--dir <path>] [--overwrite] [--dry-run] [--install]
 *
 * Everything is driven by registry/registry.json. A copy of the registry and all
 * component sources is bundled into dist/registry at build time so the CLI works
 * offline once installed.
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

export const CLI_VERSION = "1.0.0";
export const CONFIG_FILE = "backendfoundry.json";
const SCOPE = "@backendfoundry/";

export interface PlaygroundInput {
  key: string;
  label: string;
  type: string;
  default: string | number | boolean;
}

export interface RegistryComponent {
  id: string;
  slug: string;
  name: string;
  packageName: string;
  displayName: string;
  category: string;
  version: string;
  description: string;
  install: { npm: string; pnpm: string; yarn: string; cli: string };
  usage: string;
  registryDependencies: string[];
  files: Array<{ path: string; target: string }>;
  dependencies: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  supportedFrameworks: string[];
  runtimeRequirements: string;
  docsRoute: string;
  cli: { npmInstall: boolean; sourceAddSupported: boolean; sourceAddReason: string; targetFile?: string | null };
  exportedApis: Array<{ name: string; kind: string; signature: string; description: string }>;
  securityNotes: string[];
  limitations: string[];
  playground: { scenario: string; title: string; description: string; inputs: PlaygroundInput[] };
}

export interface Registry {
  brand: { name: string; tagline: string; namespace: string; version: string; categories?: string[] };
  packages: RegistryComponent[];
}

export interface ProjectConfig {
  $schema?: string;
  targetDir: string;
  mode: "source" | "npm";
  packageManager?: PackageManager;
}

export type PackageManager = "npm" | "pnpm" | "yarn" | "bun";

export interface CliIO {
  cwd: string;
  stdout: (line: string) => void;
  stderr: (line: string) => void;
  env?: Record<string, string | undefined>;
}

export class CliError extends Error {
  public readonly exitCode: number;
  constructor(message: string, exitCode = 1) {
    super(message);
    this.name = "CliError";
    this.exitCode = exitCode;
  }
}

// ---------------------------------------------------------------------------
// Registry resolution
// ---------------------------------------------------------------------------

function findUp(startDir: string, relative: string, maxDepth = 10): string | null {
  let current = path.resolve(startDir);
  for (let i = 0; i < maxDepth; i++) {
    const candidate = path.join(current, relative);
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return null;
}

/** Directory holding the bundled registry assets (dist/registry) when running the built CLI. */
function bundledAssetsDir(): string | null {
  const here = typeof __dirname === "string" ? __dirname : process.cwd();
  const candidate = path.join(here, "registry");
  return fs.existsSync(path.join(candidate, "registry.json")) ? candidate : null;
}

export function resolveRegistryPath(io: Pick<CliIO, "cwd" | "env">): string {
  const env = io.env ?? process.env;
  const fromEnv = env.BACKENDFOUNDRY_REGISTRY;
  if (fromEnv) {
    const abs = path.resolve(io.cwd, fromEnv);
    if (!fs.existsSync(abs)) throw new CliError(`BACKENDFOUNDRY_REGISTRY points to a missing file: ${abs}`);
    return abs;
  }
  const bundled = bundledAssetsDir();
  if (bundled) return path.join(bundled, "registry.json");
  const local = findUp(io.cwd, path.join("registry", "registry.json"));
  if (local) return local;
  throw new CliError("Unable to locate the BackendFoundry registry (registry.json).");
}

export function loadRegistry(io: Pick<CliIO, "cwd" | "env">): Registry {
  const file = resolveRegistryPath(io);
  let parsed: Registry;
  try {
    parsed = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (err) {
    throw new CliError(`Failed to parse registry at ${file}: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (!parsed || !Array.isArray(parsed.packages)) {
    throw new CliError(`Registry at ${file} does not contain a "packages" array.`);
  }
  return parsed;
}

export function findComponent(registry: Registry, query: string): RegistryComponent {
  const q = query.trim().toLowerCase().replace(/^@backendfoundry\//, "");
  const match = registry.packages.find(
    (p) => p.slug === q || p.id === q || p.packageName === `${SCOPE}${q}` || p.name.toLowerCase() === q
  );
  if (!match) {
    const suggestions = registry.packages
      .filter((p) => p.slug.includes(q) || q.includes(p.slug))
      .map((p) => p.slug);
    const hint = suggestions.length ? ` Did you mean: ${suggestions.join(", ")}?` : "";
    throw new CliError(`Unknown component "${query}".${hint} Run "backendfoundry list" to see all components.`);
  }
  return match;
}

/** Component + all transitive registryDependencies, dependencies first. */
export function resolveDependencyOrder(registry: Registry, slugs: string[]): RegistryComponent[] {
  const ordered: RegistryComponent[] = [];
  const visiting = new Set<string>();
  const done = new Set<string>();
  const visit = (slug: string) => {
    if (done.has(slug)) return;
    if (visiting.has(slug)) throw new CliError(`Circular registry dependency detected at "${slug}"`);
    visiting.add(slug);
    const comp = findComponent(registry, slug);
    for (const dep of comp.registryDependencies ?? []) visit(dep);
    visiting.delete(slug);
    done.add(comp.slug);
    ordered.push(comp);
  };
  for (const s of slugs) visit(findComponent(registry, s).slug);
  return ordered;
}

export function readComponentSource(io: Pick<CliIO, "cwd" | "env">, component: RegistryComponent): string {
  const bundled = bundledAssetsDir();
  const registryFile = resolveRegistryPath(io);
  const candidates: string[] = [];
  if (bundled) candidates.push(path.join(bundled, "sources", `${component.slug}.ts`));
  candidates.push(path.join(path.dirname(registryFile), "sources", `${component.slug}.ts`));
  const repoRoot = path.dirname(path.dirname(registryFile));
  for (const f of component.files ?? []) candidates.push(path.join(repoRoot, f.path));
  for (const c of candidates) {
    if (fs.existsSync(c)) return fs.readFileSync(c, "utf8");
  }
  throw new CliError(`Source for "${component.slug}" not found in the registry bundle.`);
}

/** Rewrites `@backendfoundry/<x>` imports to sibling relative imports for vendored source. */
export function rewriteImportsForVendoring(source: string): string {
  return source.replace(/(from\s+["'])@backendfoundry\/([a-z0-9-]+)(["'])/g, (_m, pre, slug, post) => `${pre}./${slug}${post}`);
}

// ---------------------------------------------------------------------------
// Project helpers
// ---------------------------------------------------------------------------

export function detectPackageManager(projectDir: string): PackageManager {
  const lock = (name: string) => findUp(projectDir, name, 6) !== null;
  if (lock("pnpm-lock.yaml") || lock("pnpm-workspace.yaml")) return "pnpm";
  if (lock("yarn.lock")) return "yarn";
  if (lock("bun.lockb") || lock("bun.lock")) return "bun";
  return "npm";
}

export function detectTypeScriptVersion(projectDir: string): string | null {
  const installed = findUp(projectDir, path.join("node_modules", "typescript", "package.json"), 6);
  const candidates: Array<() => unknown> = [
    () => (installed ? JSON.parse(fs.readFileSync(installed, "utf8")).version : undefined),
    () => {
      const pkg = JSON.parse(fs.readFileSync(path.join(projectDir, "package.json"), "utf8"));
      return pkg.devDependencies?.typescript ?? pkg.dependencies?.typescript;
    }
  ];
  for (const read of candidates) {
    try {
      const raw = read();
      if (typeof raw === "string") {
        const version = raw.replace(/^[^0-9]*/, "").split(".").slice(0, 2).join(".");
        if (version) return version;
      }
    } catch {
      /* not available */
    }
  }
  return null;
}

export function formatInstallCommand(pm: PackageManager, packages: string[]): string {
  const joined = packages.join(" ");
  switch (pm) {
    case "pnpm":
      return `pnpm add ${joined}`;
    case "yarn":
      return `yarn add ${joined}`;
    case "bun":
      return `bun add ${joined}`;
    default:
      return `npm install ${joined}`;
  }
}

export function readProjectConfig(cwd: string): ProjectConfig | null {
  const file = path.join(cwd, CONFIG_FILE);
  if (!fs.existsSync(file)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
    return {
      targetDir: typeof parsed.targetDir === "string" ? parsed.targetDir : "src/lib/backendfoundry",
      mode: parsed.mode === "npm" ? "npm" : "source",
      ...(parsed.packageManager ? { packageManager: parsed.packageManager } : {})
    };
  } catch {
    throw new CliError(`${CONFIG_FILE} is not valid JSON.`);
  }
}

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

export interface ParsedArgs {
  command: string | undefined;
  positionals: string[];
  flags: Record<string, string | boolean>;
}

const VALUE_FLAGS = new Set(["dir", "category", "mode", "cwd", "pm"]);

export function parseArgs(argv: string[]): ParsedArgs {
  const positionals: string[] = [];
  const flags: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "-h") {
      flags.help = true;
    } else if (arg === "-v") {
      flags.version = true;
    } else if (arg === "-y") {
      flags.yes = true;
    } else if (arg.startsWith("--")) {
      const eq = arg.indexOf("=");
      const name = eq >= 0 ? arg.slice(2, eq) : arg.slice(2);
      if (eq >= 0) {
        flags[name] = arg.slice(eq + 1);
      } else if (VALUE_FLAGS.has(name)) {
        const next = argv[i + 1];
        if (next === undefined || next.startsWith("--")) throw new CliError(`Flag --${name} requires a value.`);
        flags[name] = next;
        i++;
      } else {
        flags[name] = true;
      }
    } else {
      positionals.push(arg);
    }
  }
  return { command: positionals.shift(), positionals, flags };
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

const HELP = `backendfoundry ${CLI_VERSION} — backend components you own

Usage:
  backendfoundry list [--category <name>] [--json]      List all components by category
  backendfoundry info <component> [--json]              Show API, install and usage for a component
  backendfoundry init [--dir <path>] [--mode source|npm] [--force]
                                                        Create ${CONFIG_FILE} in the current project
  backendfoundry add <component...> [options]           Add components to your project

Add options:
  --source            Copy TypeScript source (and its dependencies) into your project (default)
  --npm               Use the published npm package instead of copying source
  --dir <path>        Target directory for source files (default from ${CONFIG_FILE} or src/lib/backendfoundry)
  --overwrite         Overwrite files that differ from the registry version
  --dry-run           Show what would happen without writing files
  --install           With --npm, run the install command instead of printing it
  --pm <npm|pnpm|yarn|bun>  Override package manager detection

Global options:
  --cwd <path>        Run as if started in <path>
  -h, --help          Show help
  -v, --version       Show version
`;

function pad(text: string, width: number): string {
  return text.length >= width ? text : text + " ".repeat(width - text.length);
}

function groupByCategory(registry: Registry): Map<string, RegistryComponent[]> {
  const order = registry.brand.categories ?? [];
  const groups = new Map<string, RegistryComponent[]>();
  for (const cat of order) groups.set(cat, []);
  for (const p of registry.packages) {
    if (!groups.has(p.category)) groups.set(p.category, []);
    groups.get(p.category)!.push(p);
  }
  for (const [k, v] of groups) if (v.length === 0) groups.delete(k);
  return groups;
}

function cmdList(registry: Registry, args: ParsedArgs, io: CliIO): number {
  const category = typeof args.flags.category === "string" ? args.flags.category.toLowerCase() : null;
  const items = registry.packages.filter((p) => !category || p.category.toLowerCase().includes(category));
  if (args.flags.json) {
    io.stdout(
      JSON.stringify(
        items.map((p) => ({
          slug: p.slug,
          name: p.name,
          packageName: p.packageName,
          category: p.category,
          description: p.description,
          sourceAdd: p.cli.sourceAddSupported
        })),
        null,
        2
      )
    );
    return 0;
  }
  if (items.length === 0) {
    io.stderr(`No components match category "${args.flags.category}".`);
    return 1;
  }
  io.stdout(`${registry.brand.name} components (${items.length})\n`);
  const filtered: Registry = { ...registry, packages: items };
  for (const [cat, comps] of groupByCategory(filtered)) {
    io.stdout(cat);
    for (const p of comps) {
      io.stdout(`  ${pad(p.slug, 17)} ${pad(p.packageName, 33)} ${p.description.split(". ")[0]!.slice(0, 80)}`);
    }
    io.stdout("");
  }
  io.stdout(`Run "backendfoundry info <component>" for details or "backendfoundry add <component>" to install.`);
  return 0;
}

function cmdInfo(registry: Registry, args: ParsedArgs, io: CliIO): number {
  const query = args.positionals[0];
  if (!query) throw new CliError('Usage: backendfoundry info <component>');
  const p = findComponent(registry, query);
  if (args.flags.json) {
    io.stdout(JSON.stringify(p, null, 2));
    return 0;
  }
  const pm = detectPackageManager(io.cwd);
  io.stdout(`${p.displayName} (${p.packageName}@${p.version})`);
  io.stdout(`Category: ${p.category}`);
  io.stdout("");
  io.stdout(p.description);
  io.stdout("");
  io.stdout("Install");
  io.stdout(`  ${formatInstallCommand(pm, [p.packageName])}`);
  io.stdout(`  ${p.install.cli}${p.cli.sourceAddSupported ? "   # copy source into your project" : ""}`);
  io.stdout("");
  io.stdout(`Dependencies: ${p.registryDependencies.length ? p.registryDependencies.join(", ") : "none"}`);
  io.stdout(`Frameworks:   ${p.supportedFrameworks.join(", ")}`);
  io.stdout(`Runtime:      ${p.runtimeRequirements}`);
  io.stdout("");
  io.stdout("API");
  for (const api of p.exportedApis) {
    io.stdout(`  ${api.kind.padEnd(8)} ${api.signature}`);
    io.stdout(`           ${api.description}`);
  }
  io.stdout("");
  io.stdout("Usage");
  for (const line of p.usage.split("\n")) io.stdout(`  ${line}`);
  if (p.securityNotes.length) {
    io.stdout("");
    io.stdout("Security notes");
    for (const n of p.securityNotes) io.stdout(`  - ${n}`);
  }
  io.stdout("");
  io.stdout(`Docs & playground: https://backendfoundry.dev${p.docsRoute}`);
  return 0;
}

function cmdInit(registry: Registry, args: ParsedArgs, io: CliIO): number {
  const file = path.join(io.cwd, CONFIG_FILE);
  if (fs.existsSync(file) && !args.flags.force) {
    io.stderr(`${CONFIG_FILE} already exists. Use --force to overwrite.`);
    return 1;
  }
  const mode = args.flags.mode === "npm" ? "npm" : "source";
  if (args.flags.mode && args.flags.mode !== "npm" && args.flags.mode !== "source") {
    throw new CliError('--mode must be "source" or "npm"');
  }
  const hasSrc = fs.existsSync(path.join(io.cwd, "src"));
  const defaultDir = hasSrc ? "src/lib/backendfoundry" : "lib/backendfoundry";
  const targetDir = typeof args.flags.dir === "string" ? args.flags.dir : defaultDir;
  const config: ProjectConfig = {
    $schema: "https://backendfoundry.dev/schemas/config.json",
    targetDir: targetDir.replace(/\\/g, "/"),
    mode,
    packageManager: (args.flags.pm as PackageManager) || detectPackageManager(io.cwd)
  };
  if (args.flags["dry-run"]) {
    io.stdout(JSON.stringify(config, null, 2));
    return 0;
  }
  fs.writeFileSync(file, JSON.stringify(config, null, 2) + "\n", "utf8");
  io.stdout(`✔ Created ${CONFIG_FILE}`);
  io.stdout(`  targetDir: ${config.targetDir}`);
  io.stdout(`  mode:      ${config.mode}`);
  io.stdout(`  packageManager: ${config.packageManager}`);
  io.stdout("");
  io.stdout(`Next: backendfoundry add ${registry.packages.slice(0, 2).map((p) => p.slug).join(" ")}`);
  return 0;
}

export interface AddResultFile {
  slug: string;
  file: string;
  status: "created" | "updated" | "unchanged" | "skipped";
}

function cmdAdd(registry: Registry, args: ParsedArgs, io: CliIO): number {
  if (args.positionals.length === 0) throw new CliError("Usage: backendfoundry add <component...>");
  const config = readProjectConfig(io.cwd);
  const requested = args.positionals.map((q) => findComponent(registry, q));
  const pm = (args.flags.pm as PackageManager) || config?.packageManager || detectPackageManager(io.cwd);
  const dryRun = Boolean(args.flags["dry-run"]);

  let mode: "source" | "npm" = args.flags.npm ? "npm" : args.flags.source ? "source" : config?.mode ?? "source";
  if (args.flags.npm && args.flags.source) throw new CliError("Use either --source or --npm, not both.");

  if (mode === "npm") {
    const pkgs = requested.map((p) => p.packageName);
    const command = formatInstallCommand(pm, pkgs);
    if (args.flags.install && !dryRun) {
      io.stdout(`$ ${command}`);
      const [bin, ...rest] = command.split(" ");
      const res = spawnSync(bin!, rest, { cwd: io.cwd, stdio: "inherit", shell: process.platform === "win32" });
      return res.status ?? 1;
    }
    io.stdout("Install with:");
    io.stdout(`  ${command}`);
    io.stdout("");
    for (const p of requested) {
      io.stdout(`${p.packageName}:`);
      for (const line of p.usage.split("\n").slice(0, 3)) io.stdout(`  ${line}`);
    }
    return 0;
  }

  const targetDirRel = typeof args.flags.dir === "string" ? args.flags.dir : config?.targetDir ?? "src/lib/backendfoundry";
  const targetDir = path.resolve(io.cwd, targetDirRel);
  const ordered = resolveDependencyOrder(registry, requested.map((r) => r.slug));
  const requestedSlugs = new Set(requested.map((r) => r.slug));
  const results: AddResultFile[] = [];

  for (const comp of ordered) {
    if (!comp.cli.sourceAddSupported && requestedSlugs.has(comp.slug)) {
      io.stderr(`! ${comp.slug}: ${comp.cli.sourceAddReason}`);
    }
    const source = rewriteImportsForVendoring(readComponentSource(io, comp));
    const header = `// Added by backendfoundry ${CLI_VERSION} from ${comp.packageName}@${comp.version}. You own this file.\n`;
    const content = header + source;
    const target = path.join(targetDir, comp.files?.[0]?.target ?? `${comp.slug}.ts`);
    const rel = path.relative(io.cwd, target).replace(/\\/g, "/");
    let status: AddResultFile["status"];
    if (fs.existsSync(target)) {
      const existing = fs.readFileSync(target, "utf8");
      if (existing === content) status = "unchanged";
      else if (args.flags.overwrite) status = "updated";
      else status = "skipped";
    } else {
      status = "created";
    }
    if (!dryRun && (status === "created" || status === "updated")) {
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, content, "utf8");
    }
    results.push({ slug: comp.slug, file: rel, status });
  }

  const symbols: Record<AddResultFile["status"], string> = { created: "+", updated: "~", unchanged: "=", skipped: "!" };
  const relTarget = path.relative(io.cwd, targetDir).replace(/\\/g, "/") || ".";
  const tsVersion = detectTypeScriptVersion(io.cwd);
  const deps = ordered.filter((c) => !requestedSlugs.has(c.slug)).map((c) => c.slug);
  const conflicts = results.filter((r) => r.status === "skipped").length;
  io.stdout(`✔ Detected ${pm}${tsVersion ? ` and TypeScript ${tsVersion}` : ""}`);
  io.stdout(`✔ Resolved ${requested.map((r) => r.slug).join(", ")}${deps.length ? ` + ${deps.join(", ")}` : ""}`);
  io.stdout(conflicts ? `! ${conflicts} conflict(s) in ${relTarget}` : `✔ No conflicts in ${relTarget}`);
  io.stdout(dryRun ? "Dry run — no files written:" : `Added to ${relTarget}:`);
  for (const r of results) {
    const via = requestedSlugs.has(r.slug) ? "" : " (dependency)";
    io.stdout(`  ${symbols[r.status]} ${r.file} [${r.status}]${via}`);
  }
  if (!dryRun) {
    const written = results.filter((r) => r.status === "created" || r.status === "updated").length;
    io.stdout(`${written} file${written === 1 ? "" : "s"} written. 0 runtime dependencies added.`);
  }
  const skipped = results.filter((r) => r.status === "skipped");
  if (skipped.length) {
    io.stderr(`\n${skipped.length} file(s) differ locally and were not overwritten. Re-run with --overwrite to replace them.`);
  }
  const nodeOnly = ordered.some((c) => /node:/.test(readComponentSource(io, c)));
  io.stdout("");
  io.stdout(`Import from "./${path.relative(io.cwd, targetDir).replace(/\\/g, "/")}/${requested[0]!.slug}"${nodeOnly ? " (Node.js runtime required)" : ""}.`);
  const optional = requested.flatMap((p) => Object.keys(p.optionalDependencies ?? {}));
  if (optional.length) io.stdout(`Optional peer packages: ${Array.from(new Set(optional)).join(", ")}`);
  return skipped.length ? 2 : 0;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export function runCli(argv: string[], ioOverrides: Partial<CliIO> = {}): number {
  const io: CliIO = {
    cwd: ioOverrides.cwd ?? process.cwd(),
    stdout: ioOverrides.stdout ?? ((line) => process.stdout.write(line + "\n")),
    stderr: ioOverrides.stderr ?? ((line) => process.stderr.write(line + "\n")),
    env: ioOverrides.env ?? process.env
  };
  try {
    const args = parseArgs(argv);
    if (typeof args.flags.cwd === "string") io.cwd = path.resolve(io.cwd, args.flags.cwd);
    if (args.flags.version) {
      io.stdout(CLI_VERSION);
      return 0;
    }
    if (!args.command || args.flags.help || args.command === "help") {
      io.stdout(HELP);
      return args.command || args.flags.help ? 0 : 1;
    }
    const registry = loadRegistry(io);
    switch (args.command) {
      case "list":
      case "ls":
        return cmdList(registry, args, io);
      case "info":
      case "show":
        return cmdInfo(registry, args, io);
      case "init":
        return cmdInit(registry, args, io);
      case "add":
        return cmdAdd(registry, args, io);
      default:
        throw new CliError(`Unknown command "${args.command}". Run "backendfoundry --help".`);
    }
  } catch (err) {
    if (err instanceof CliError) {
      io.stderr(`✖ ${err.message}`);
      return err.exitCode;
    }
    io.stderr(`✖ Unexpected error: ${err instanceof Error ? err.stack ?? err.message : String(err)}`);
    return 1;
  }
}

if (typeof require !== "undefined" && typeof module !== "undefined" && require.main === module) {
  process.exitCode = runCli(process.argv.slice(2));
}
