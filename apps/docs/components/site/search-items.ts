/**
 * Builds the serializable search index used by the command palette (server-side only).
 */
import { getSiteComponents } from "./registry-items";
import { DOCS_NAV } from "./site-config";

export interface SearchItem {
  id: string;
  title: string;
  description: string;
  href: string;
  group: "Docs" | "Components" | "Pages";
  meta?: string;
}

export function getSearchItems(): SearchItem[] {
  const docs: SearchItem[] = DOCS_NAV.flatMap((g) =>
    g.items.map((i) => ({ id: `doc:${i.href}`, title: i.title, description: i.description, href: i.href, group: "Docs" as const, meta: g.title }))
  );
  const components: SearchItem[] = getSiteComponents().map((c) => ({
    id: `pkg:${c.slug}`,
    title: c.name,
    description: c.description,
    href: c.href,
    group: "Components" as const,
    meta: c.packageName
  }));
  const pages: SearchItem[] = [
    { id: "page:/", title: "Home", description: "Overview of BackendFoundry.", href: "/", group: "Pages" },
    { id: "page:/packages", title: "All components", description: "Browse every component by category.", href: "/packages", group: "Pages" },
    { id: "page:/playground", title: "Playground", description: "Run real components in the browser.", href: "/playground", group: "Pages" }
  ];
  return [...docs, ...components, ...pages];
}
