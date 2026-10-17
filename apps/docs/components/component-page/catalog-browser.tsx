"use client";
/**
 * <CatalogBrowser> — client-side search + category filter for /packages.
 * Cards re-flow with shared-layout animation; respects prefers-reduced-motion.
 */
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "motion/react";
import { ArrowUpRight, Search, SearchX, X } from "lucide-react";
import { Badge } from "@/components/ui";
import { ComponentIcon } from "./component-icon";
import { cn } from "../../lib/cn";

export interface CatalogItem {
  slug: string;
  name: string;
  displayName: string;
  packageName: string;
  description: string;
  category: string;
  sourceAdd: boolean;
  npm: boolean;
  playgroundTitle: string;
  apiCount: number;
}

const ALL = "All";

function matches(item: CatalogItem, q: string): boolean {
  if (!q) return true;
  const hay = `${item.name} ${item.displayName} ${item.packageName} ${item.description} ${item.category} ${item.slug}`.toLowerCase();
  return q
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((t) => hay.includes(t));
}

export function CatalogBrowser({ items, categories }: { items: CatalogItem[]; categories: string[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState(ALL);
  const inputRef = useRef<HTMLInputElement>(null);
  const reduce = useReducedMotion();

  // "/" focuses search, like most docs sites.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
      if (e.key === "/" && !typing) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const searched = useMemo(() => items.filter((i) => matches(i, query.trim())), [items, query]);
  const visible = useMemo(() => searched.filter((i) => category === ALL || i.category === category), [searched, category]);
  const counts = useMemo(() => {
    const c: Record<string, number> = { [ALL]: searched.length };
    for (const i of searched) c[i.category] = (c[i.category] ?? 0) + 1;
    return c;
  }, [searched]);

  const tabs = [ALL, ...categories];
  const spring = reduce ? { duration: 0 } : { type: "spring" as const, stiffness: 420, damping: 36, mass: 0.7 };

  return (
    <div className="mx-auto w-full max-w-[1280px] px-5 pb-20 pt-8 sm:px-8">
      {/* Toolbar */}
      <div className="sticky top-16 z-20 -mx-5 border-b border-hairline-soft bg-canvas/90 px-5 py-4 backdrop-blur sm:-mx-8 sm:px-8 lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:px-0 lg:py-0 lg:backdrop-blur-none">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="relative w-full xl:order-2 xl:w-60 xl:shrink-0">
            <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone" />
            <label htmlFor="catalog-search" className="sr-only">
              Search components
            </label>
            <input
              ref={inputRef}
              id="catalog-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setQuery("");
              }}
              placeholder="Search components"
              autoComplete="off"
              className="h-10 w-full rounded-md border border-hairline bg-canvas pl-9 pr-16 text-[14px] text-ink placeholder:text-stone outline-none transition-[border-color,box-shadow] duration-150 focus:border-brand-green focus:shadow-[0_0_0_1px_theme(colors.brand-green)] [&::-webkit-search-cancel-button]:hidden"
            />
            {query ? (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  inputRef.current?.focus();
                }}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-sm text-stone hover:bg-surface hover:text-ink"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : (
              <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded-xs border border-hairline bg-surface-soft px-1.5 font-mono text-[11px] leading-5 text-stone sm:block">
                /
              </kbd>
            )}
          </div>

          <LayoutGroup id="catalog-tabs">
            <div
              role="tablist"
              aria-label="Filter by category"
              className="-mx-5 flex min-w-0 gap-2 overflow-x-auto px-5 py-0.5 [scrollbar-width:none] sm:-mx-8 sm:px-8 lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0 xl:order-1 [&::-webkit-scrollbar]:hidden"
            >
              {tabs.map((t) => {
                const active = t === category;
                const n = counts[t] ?? 0;
                return (
                  <button
                    key={t}
                    role="tab"
                    type="button"
                    aria-selected={active}
                    onClick={() => setCategory(t)}
                    className={cn(
                      "relative inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 text-[13px] font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green focus-visible:ring-offset-2",
                      active ? "border-primary text-on-primary" : "border-hairline text-steel hover:border-stone/60 hover:text-ink",
                      !active && n === 0 && "opacity-50"
                    )}
                  >
                    {active && (
                      <motion.span
                        layoutId="catalog-active-pill"
                        transition={spring}
                        className="absolute inset-0 rounded-full bg-primary"
                        aria-hidden="true"
                      />
                    )}
                    <span className="relative">{t}</span>
                    <span className={cn("relative font-mono text-[12px]", active ? "text-on-dark-muted" : "text-stone")}>{n}</span>
                  </button>
                );
              })}
            </div>
          </LayoutGroup>
        </div>
      </div>

      <p className="sr-only" aria-live="polite">
        {visible.length} {visible.length === 1 ? "component" : "components"} shown
      </p>

      {/* Grid */}
      <motion.ul layout={!reduce} className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <AnimatePresence mode="popLayout" initial={false}>
          {visible.map((item) => (
            <motion.li
              key={item.slug}
              layout={!reduce}
              initial={reduce ? false : { opacity: 0, scale: 0.97, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={reduce ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, scale: 0.97, transition: { duration: 0.15 } }}
              transition={spring}
              className="h-full"
            >
              <CatalogCard item={item} />
            </motion.li>
          ))}
        </AnimatePresence>
      </motion.ul>

      <AnimatePresence>
        {visible.length === 0 && (
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-8 flex flex-col items-center rounded-lg border border-dashed border-hairline px-6 py-16 text-center"
          >
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-hairline bg-surface-soft text-steel">
              <SearchX className="h-5 w-5" aria-hidden="true" />
            </span>
            <p className="mt-4 text-[16px] font-medium text-ink">
              No components match {query ? <span className="font-mono text-[15px]">“{query}”</span> : "this filter"}
              {category !== ALL ? ` in ${category}` : ""}
            </p>
            <p className="mt-1 max-w-sm text-[14px] text-steel">Try a shorter term, or search by what you need, like “429” or “backoff”.</p>
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setCategory(ALL);
              }}
              className="mt-5 inline-flex h-9 items-center rounded-full border border-hairline px-4 text-[14px] font-medium text-ink transition-colors hover:bg-surface"
            >
              Clear filters
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CatalogCard({ item }: { item: CatalogItem }) {
  return (
    <Link
      href={`/packages/${item.slug}`}
      className="group relative flex h-full flex-col rounded-lg border border-hairline bg-canvas p-6 transition-[transform,box-shadow,border-color] duration-200 ease-out hover:-translate-y-0.5 hover:border-[#d4d4d4] hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green focus-visible:ring-offset-2 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
    >
      <div className="flex items-start justify-between gap-3">
        <ComponentIcon slug={item.slug} />
        <ArrowUpRight
          aria-hidden="true"
          className="h-4 w-4 text-muted transition-[transform,color] duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-ink motion-reduce:transition-none"
        />
      </div>
      <h3 className="mt-5 text-[18px] font-semibold leading-[1.4] text-ink">{item.displayName}</h3>
      <p className="mt-0.5 font-mono text-[13px] text-stone">{item.packageName}</p>
      <p className="mt-3 line-clamp-3 flex-1 text-[14px] leading-[1.5] text-steel">{item.description}</p>
      <div className="mt-5 flex flex-wrap items-center gap-1.5 border-t border-hairline-soft pt-4">
        <Badge tone="tag">{item.category}</Badge>
        {item.npm && <Badge tone="neutral">package</Badge>}
        {item.sourceAdd && <Badge tone="neutral">source</Badge>}
      </div>
    </Link>
  );
}
