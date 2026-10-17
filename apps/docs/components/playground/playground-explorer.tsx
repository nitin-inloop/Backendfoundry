"use client";
/**
 * <PlaygroundExplorer> — full-page, app-like playground.
 *   lg+:  [ component picker | inputs | results ]  each panel scrolls on its own
 *   <lg:  grouped select + sticky action bar, panels stacked
 * Selection is mirrored to ?component=<slug>; Ctrl/Cmd+Enter runs from anywhere.
 */
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LayoutGroup, motion, useReducedMotion } from "motion/react";
import { BookOpen, Search, X } from "lucide-react";
import type { PlaygroundComponentSummary } from "../../lib/registry";
import { cn } from "../../lib/cn";
import { ComponentIcon } from "../component-page/component-icon";
import { ResultsPanel } from "./results";
import { InputsForm, ResetButton, RunButton, ShortcutHint } from "./scenario-runner";
import { useScenario } from "./use-scenario";

export interface PlaygroundExplorerProps {
  components: PlaygroundComponentSummary[];
  categories: string[];
  initialSlug?: string;
}

export function PlaygroundExplorer({ components, categories, initialSlug }: PlaygroundExplorerProps) {
  const first = components.find((c) => c.slug === initialSlug) ?? components[0];
  const [slug, setSlug] = useState(first?.slug ?? "");
  const selected = components.find((c) => c.slug === slug) ?? first;

  const select = useCallback((next: string) => {
    setSlug(next);
    const url = new URL(window.location.href);
    url.searchParams.set("component", next);
    window.history.replaceState(window.history.state, "", url.toString());
  }, []);

  // Keep in sync if the user edits the URL / navigates back.
  useEffect(() => {
    const onPop = () => {
      const s = new URL(window.location.href).searchParams.get("component");
      if (s && components.some((c) => c.slug === s)) setSlug(s);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [components]);

  const groups = useMemo(
    () =>
      categories
        .map((category) => ({ category, items: components.filter((c) => c.category === category) }))
        .filter((g) => g.items.length > 0),
    [categories, components]
  );

  if (!selected) return <p className="p-8 text-[14px] text-steel">No components are registered.</p>;

  return (
    <div className="lg:flex lg:h-[calc(100vh-4rem)] lg:min-h-[640px]">
      <Picker groups={groups} selected={selected.slug} onSelect={select} />
      <div className="min-w-0 flex-1">
        <Workspace key={selected.slug} component={selected} groups={groups} onSelect={select} />
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- picker */

function Picker({
  groups,
  selected,
  onSelect
}: {
  groups: { category: string; items: PlaygroundComponentSummary[] }[];
  selected: string;
  onSelect: (slug: string) => void;
}) {
  const [query, setQuery] = useState("");
  const reduce = useReducedMotion();
  const q = query.trim().toLowerCase();
  const filtered = groups
    .map((g) => ({
      ...g,
      items: g.items.filter((c) => !q || `${c.name} ${c.displayName} ${c.packageName} ${c.playground.title} ${g.category}`.toLowerCase().includes(q))
    }))
    .filter((g) => g.items.length > 0);
  const flat = filtered.flatMap((g) => g.items);

  return (
    <aside aria-label="Components" className="hidden w-[264px] shrink-0 flex-col border-r border-hairline-soft bg-surface-soft lg:flex">
      <div className="border-b border-hairline-soft p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-stone" aria-hidden="true" />
          <label htmlFor="pg-search" className="sr-only">
            Filter components
          </label>
          <input
            id="pg-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setQuery("");
              if (e.key === "Enter" && flat[0]) onSelect(flat[0].slug);
            }}
            placeholder="Filter components"
            autoComplete="off"
            className="h-9 w-full rounded-md border border-hairline bg-canvas pl-8 pr-8 text-[13px] text-ink outline-none transition-[border-color,box-shadow] placeholder:text-stone focus:border-brand-green focus:shadow-[0_0_0_1px_theme(colors.brand-green)] [&::-webkit-search-cancel-button]:hidden"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear filter"
              className="absolute right-1.5 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-sm text-stone hover:text-ink"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto px-2 py-3" aria-label="Playground scenarios">
        <LayoutGroup id="pg-picker">
          {filtered.map((g) => (
            <div key={g.category} className="mb-4 last:mb-0">
              <p className="px-2.5 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.5px] text-steel">{g.category}</p>
              <ul className="space-y-px">
                {g.items.map((c) => {
                  const active = c.slug === selected;
                  return (
                    <li key={c.slug}>
                      <button
                        type="button"
                        onClick={() => onSelect(c.slug)}
                        aria-current={active ? "true" : undefined}
                        className={cn(
                          "relative flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-[14px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green",
                          active ? "font-medium text-ink" : "text-steel hover:bg-canvas/70 hover:text-ink"
                        )}
                      >
                        {active && (
                          <motion.span
                            layoutId="pg-picker-active"
                            className="absolute inset-0 rounded-md border border-hairline bg-canvas shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
                            transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 40 }}
                            aria-hidden="true"
                          />
                        )}
                        <ComponentIcon slug={c.slug} size="sm" className={cn("relative", active && "border-brand-green/40 text-brand-green-deep")} />
                        <span className="relative truncate">{c.name}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </LayoutGroup>
        {filtered.length === 0 && (
          <div className="px-3 py-8 text-center">
            <p className="text-[13px] font-medium text-ink">No match for “{query}”</p>
            <button type="button" onClick={() => setQuery("")} className="mt-2 text-[13px] text-steel underline underline-offset-4 hover:text-ink">
              Clear filter
            </button>
          </div>
        )}
      </nav>
    </aside>
  );
}

/* ---------------------------------------------------------------- workspace */

function Workspace({
  component,
  groups,
  onSelect
}: {
  component: PlaygroundComponentSummary;
  groups: { category: string; items: PlaygroundComponentSummary[] }[];
  onSelect: (slug: string) => void;
}) {
  const state = useScenario(component, { autoRun: true });
  const reduce = useReducedMotion();
  const runRef = useRef(state.run);
  runRef.current = state.run;
  const resultsRef = useRef<HTMLElement>(null);

  // On narrow screens results sit below the form: bring them into view after a manual run.
  useEffect(() => {
    if (state.runCount < 2 || window.innerWidth >= 1024) return;
    resultsRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  }, [state.runCount, reduce]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        runRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <motion.div
      className="flex h-full min-h-0 flex-col"
      initial={reduce ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
    >
      {/* Action bar */}
      <div className="sticky top-16 z-20 border-b border-hairline-soft bg-canvas/95 backdrop-blur lg:static lg:bg-canvas lg:backdrop-blur-none">
        <div className="flex flex-wrap items-center gap-3 px-5 py-3 sm:px-6">
          <div className="w-full lg:hidden">
            <label htmlFor="pg-select" className="sr-only">
              Component
            </label>
            <div className="relative">
              <select
                id="pg-select"
                value={component.slug}
                onChange={(e) => onSelect(e.target.value)}
                className="h-10 w-full appearance-none rounded-md border border-hairline bg-canvas pl-3 pr-9 text-[14px] font-medium text-ink outline-none focus:border-brand-green"
              >
                {groups.map((g) => (
                  <optgroup key={g.category} label={g.category}>
                    {g.items.map((c) => (
                      <option key={c.slug} value={c.slug}>
                        {c.displayName}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <svg aria-hidden="true" viewBox="0 0 16 16" className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-stone">
                <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <ComponentIcon slug={component.slug} className="hidden sm:inline-flex" />
            <div className="min-w-0">
              <h2 className="truncate text-[16px] font-semibold leading-[1.3] text-ink sm:text-[18px]">{component.playground.title}</h2>
              <p className="truncate font-mono text-[12px] text-stone">{component.packageName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ShortcutHint className="mr-1 xl:inline-flex" />
            <Link
              href={`/packages/${component.slug}`}
              className="hidden h-10 items-center gap-1.5 rounded-full px-3 text-[14px] font-medium text-steel transition-colors hover:bg-surface hover:text-ink md:inline-flex"
            >
              <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
              Docs
            </Link>
            <RunButton state={state} />
          </div>
        </div>
      </div>

      {/* Panels */}
      <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(320px,400px)_minmax(0,1fr)]">
        <section aria-label="Inputs" className="min-h-0 overflow-y-auto border-b border-hairline-soft px-5 py-6 sm:px-6 lg:border-b-0 lg:border-r">
          <p className="max-w-[60ch] text-[14px] leading-[1.5] text-steel">{component.playground.description}</p>
          <div className="mt-6">
            <InputsForm state={state} idPrefix={`pg-${component.slug}`} columns={1} />
          </div>
          <div className="mt-6 flex items-center justify-between gap-3 border-t border-hairline-soft pt-5">
            <ResetButton state={state} />
            <span className="font-mono text-[12px] text-stone">POST {state.endpoint}</span>
          </div>
        </section>
        <section ref={resultsRef} aria-label="Results" className="min-h-0 scroll-mt-32 overflow-y-auto bg-surface-soft px-5 py-6 sm:px-6">
          <ResultsPanel state={state} tileColumns={4} />
        </section>
      </div>
    </motion.div>
  );
}
