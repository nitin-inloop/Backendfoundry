/**
 * Typed access to registry/registry.json — the single source of truth for every
 * BackendFoundry component (docs pages, playground scenarios, CLI, READMEs).
 *
 * Exports kept stable for other site code: `registry`, `packages`, `getPackageBySlug`.
 */
import registryData from "../../../registry/registry.json";

export type PlaygroundInputType = "text" | "textarea" | "number" | "boolean" | "select" | "json";

export interface PlaygroundInputDef {
  key: string;
  label: string;
  type: PlaygroundInputType;
  default: string | number | boolean;
  min?: number;
  max?: number;
  step?: number;
  options?: string[];
  help?: string;
}

export interface PlaygroundDef {
  scenario: string;
  title: string;
  description: string;
  inputs: PlaygroundInputDef[];
}

export interface ExportedApi {
  name: string;
  kind: string;
  signature: string;
  description: string;
}

export interface ConfigOption {
  option: string;
  type: string;
  default?: string;
  required?: boolean;
  description: string;
}

export interface RegistryComponent {
  id: string;
  slug: string;
  name: string;
  packageName: string;
  displayName: string;
  category: string;
  directory: string;
  version: string;
  description: string;
  install: { npm: string; pnpm: string; yarn: string; cli: string };
  usage: string;
  registryDependencies: string[];
  files: { path: string; target: string }[];
  playground: PlaygroundDef;
  dependencies: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  supportedFrameworks: string[];
  runtimeRequirements: string;
  entryPoints: { esm: string; cjs: string; types: string };
  docsRoute: string;
  hasPlayground: boolean;
  cli: { npmInstall: boolean; sourceAddSupported: boolean; sourceAddReason: string; targetFile?: string | null };
  exportedApis: ExportedApi[];
  configSchema: ConfigOption[];
  errorBehavior?: string;
  securityNotes: string[];
  limitations: string[];
  status?: Record<string, string>;
  examples: { basic: string; express?: string; fastify?: string; nextjs?: string };
}

export interface Registry {
  brand: {
    name: string;
    tagline: string;
    namespace: string;
    version: string;
    license: string;
    publicationStatus?: string;
    categories: string[];
    cli: { package: string; bin: string; defaultTargetDir: string };
  };
  packages: RegistryComponent[];
}

export const registry = registryData as unknown as Registry;
export const packages: RegistryComponent[] = registry.packages;
export const components = packages;
export const categories: string[] = registry.brand.categories;

export function getPackageBySlug(slug: string): RegistryComponent | undefined {
  return packages.find((p) => p.slug === slug || p.id === slug);
}

export const getComponent = getPackageBySlug;

export function getComponentsByCategory(): { category: string; items: RegistryComponent[] }[] {
  const order = [...categories];
  for (const p of packages) if (!order.includes(p.category)) order.push(p.category);
  return order
    .map((category) => ({ category, items: packages.filter((p) => p.category === category) }))
    .filter((g) => g.items.length > 0);
}

export function categorySlug(category: string): string {
  return category.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/** Serializable subset passed to client components (keeps the full registry out of the client bundle). */
export interface PlaygroundComponentSummary {
  slug: string;
  name: string;
  displayName: string;
  packageName: string;
  category: string;
  playground: PlaygroundDef;
}

export function toPlaygroundSummary(p: RegistryComponent): PlaygroundComponentSummary {
  return {
    slug: p.slug,
    name: p.name,
    displayName: p.displayName,
    packageName: p.packageName,
    category: p.category,
    playground: p.playground
  };
}

export function defaultInputs(def: PlaygroundDef): Record<string, string | number | boolean> {
  return Object.fromEntries(def.inputs.map((i) => [i.key, i.default]));
}
