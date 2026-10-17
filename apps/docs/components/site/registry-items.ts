/**
 * Defensive adapter over lib/registry (owned elsewhere; its shape may evolve).
 * Normalises whatever the registry exposes into a stable list for site UI.
 */
import * as registryModule from "../../lib/registry";

export interface SiteComponentItem {
  slug: string;
  name: string;
  packageName: string;
  description: string;
  category: string;
  sourceAdd: boolean;
  href: string;
}

export const CATEGORY_ORDER = [
  "Foundation",
  "Security & Validation",
  "Reliability",
  "State & Caching",
  "Observability",
  "AI Infrastructure"
];

type Loose = Record<string, unknown>;

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" && v.trim() ? v : fallback;
}

function rawList(): Loose[] {
  const mod = registryModule as unknown as Loose;
  const reg = (mod.registry ?? mod.default) as Loose | undefined;
  const candidates = [mod.packages, mod.components, reg?.packages, reg?.components, reg?.items];
  for (const c of candidates) if (Array.isArray(c)) return c as Loose[];
  return [];
}

export function getSiteComponents(): SiteComponentItem[] {
  return rawList()
    .map((p) => {
      const slug = str(p.slug, str(p.id, str(p.name)));
      const cli = (p.cli ?? {}) as Loose;
      return {
        slug,
        name: str(p.displayName, str(p.title, str(p.name, slug))),
        packageName: str(p.packageName, slug ? `@backendfoundry/${slug}` : ""),
        description: str(p.description, str(p.summary)),
        category: str(p.category, "Other"),
        sourceAdd: Boolean(cli.sourceAddSupported ?? p.sourceAddSupported ?? false),
        href: `/packages/${slug}`
      };
    })
    .filter((p) => p.slug);
}

export function groupByCategory(items: SiteComponentItem[]): { category: string; items: SiteComponentItem[] }[] {
  const map = new Map<string, SiteComponentItem[]>();
  for (const item of items) {
    const list = map.get(item.category) ?? [];
    list.push(item);
    map.set(item.category, list);
  }
  const rank = (c: string) => {
    const i = CATEGORY_ORDER.indexOf(c);
    return i === -1 ? CATEGORY_ORDER.length : i;
  };
  return [...map.entries()]
    .sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b))
    .map(([category, list]) => ({ category, items: list }));
}
