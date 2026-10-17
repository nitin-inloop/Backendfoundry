"use client";
/**
 * <CommandPalette> — ⌘K / Ctrl+K search across docs pages and components.
 * Controlled: open, onOpenChange. Keyboard: ↑/↓ to move, Enter to open, Esc to close.
 * Implements the ARIA combobox + listbox pattern with aria-activedescendant.
 */
import { ArrowRight, Box, CornerDownLeft, FileText, LayoutGrid, Search } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { cn } from "../ui/cn";
import type { SearchItem } from "./search-items";

const GROUP_ICON = { Docs: FileText, Components: Box, Pages: LayoutGrid } as const;

function score(item: SearchItem, q: string): number {
  if (!q) return 1;
  const title = item.title.toLowerCase();
  const hay = `${item.title} ${item.meta ?? ""} ${item.description}`.toLowerCase();
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  let s = 0;
  for (const w of words) {
    if (title.startsWith(w)) s += 6;
    else if (title.includes(w)) s += 4;
    else if (hay.includes(w)) s += 1;
    else return 0;
  }
  return s;
}

export function CommandPalette({
  items,
  open,
  onOpenChange
}: {
  items: SearchItem[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const id = useId();

  const results = useMemo(() => {
    const q = query.trim();
    const ranked = items
      .map((item) => ({ item, s: score(item, q) }))
      .filter((r) => r.s > 0)
      .sort((a, b) => (q ? b.s - a.s : 0));
    const order: SearchItem["group"][] = ["Docs", "Components", "Pages"];
    const grouped = order
      .map((g) => ({ group: g, items: ranked.filter((r) => r.item.group === g).map((r) => r.item) }))
      .filter((g) => g.items.length > 0);
    return { grouped, flat: grouped.flatMap((g) => g.items) };
  }, [items, query]);

  useEffect(() => {
    if (open) {
      returnFocus.current = document.activeElement as HTMLElement | null;
      setQuery("");
      setActive(0);
      const t = requestAnimationFrame(() => inputRef.current?.focus());
      document.documentElement.style.overflow = "hidden";
      return () => {
        cancelAnimationFrame(t);
        document.documentElement.style.overflow = "";
      };
    }
    returnFocus.current?.focus?.();
  }, [open]);

  useEffect(() => setActive(0), [query]);

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [active]);

  function go(item: SearchItem | undefined) {
    if (!item) return;
    onOpenChange(false);
    router.push(item.href);
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const n = results.flat.length;
    if (e.key === "Escape") {
      e.preventDefault();
      onOpenChange(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (n) setActive((a) => (a + 1) % n);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (n) setActive((a) => (a - 1 + n) % n);
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(results.flat[active]);
    } else if (e.key === "Tab") {
      // Keep focus inside the dialog: the input is the only tabbable element.
      e.preventDefault();
      inputRef.current?.focus();
    }
  }

  let index = -1;

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[70] flex items-start justify-center px-4 pt-[12vh]" onKeyDown={onKeyDown}>
          <motion.div
            aria-hidden="true"
            className="absolute inset-0 bg-black/25 backdrop-blur-[2px] dark:bg-black/60"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.15 }}
            onClick={() => onOpenChange(false)}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Search documentation and components"
            className="relative w-full max-w-[600px] overflow-hidden rounded-xl border border-hairline bg-canvas shadow-mockup"
            initial={reduce ? false : { opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: reduce ? 0 : 0.18, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="flex items-center gap-3 border-b border-hairline px-4">
              <Search className="h-4 w-4 shrink-0 text-stone" aria-hidden="true" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search docs and components"
                role="combobox"
                aria-expanded="true"
                aria-controls={`${id}-list`}
                aria-activedescendant={results.flat[active] ? `${id}-opt-${active}` : undefined}
                aria-autocomplete="list"
                className="h-14 w-full bg-transparent text-body-md text-ink placeholder:text-stone focus:outline-none"
                style={{ outline: "none" }}
              />
              <kbd className="hidden rounded-xs border border-hairline bg-surface px-1.5 py-0.5 font-mono text-micro text-steel sm:block">
                Esc
              </kbd>
            </div>
            <ul ref={listRef} id={`${id}-list`} role="listbox" aria-label="Results" className="max-h-[min(60vh,420px)] overflow-y-auto p-2">
              {results.grouped.map((g) => {
                const Icon = GROUP_ICON[g.group];
                return (
                  <li key={g.group} role="presentation">
                    <p className="px-3 pb-1.5 pt-3 text-micro font-medium text-stone">{g.group}</p>
                    <ul role="presentation">
                      {g.items.map((item) => {
                        index += 1;
                        const i = index;
                        const selected = i === active;
                        return (
                          <li
                            key={item.id}
                            id={`${id}-opt-${i}`}
                            data-index={i}
                            role="option"
                            aria-selected={selected}
                            onMouseMove={() => setActive(i)}
                            onClick={() => go(item)}
                            className={cn(
                              "flex cursor-pointer items-center gap-3 rounded-md px-3 py-2.5",
                              selected ? "bg-surface" : "bg-transparent"
                            )}
                          >
                            <span
                              className={cn(
                                "grid h-8 w-8 shrink-0 place-items-center rounded-md border",
                                selected ? "border-brand-green/40 bg-brand-green/10 text-brand-green-deep" : "border-hairline bg-canvas text-steel"
                              )}
                            >
                              <Icon className="h-4 w-4" aria-hidden="true" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="flex items-baseline gap-2">
                                <span className="truncate text-body-sm font-medium text-ink">{item.title}</span>
                                {item.meta && <span className="hidden truncate font-mono text-micro text-stone sm:inline">{item.meta}</span>}
                              </span>
                              <span className="block truncate text-caption text-steel">{item.description}</span>
                            </span>
                            {selected ? (
                              <CornerDownLeft className="h-4 w-4 shrink-0 text-steel" aria-hidden="true" />
                            ) : (
                              <ArrowRight className="h-4 w-4 shrink-0 text-transparent" aria-hidden="true" />
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </li>
                );
              })}
              {results.flat.length === 0 && (
                <li role="presentation" className="px-3 py-10 text-center text-body-sm text-steel">
                  Nothing matches “{query}”. Try a component name such as <span className="font-mono text-ink">retry</span> or a
                  framework such as <span className="font-mono text-ink">fastify</span>.
                </li>
              )}
            </ul>
            <div className="flex items-center gap-4 border-t border-hairline bg-surface-soft px-4 py-2.5 text-micro text-stone">
              <span className="flex items-center gap-1.5">
                <kbd className="rounded-xs border border-hairline bg-canvas px-1 font-mono">↑</kbd>
                <kbd className="rounded-xs border border-hairline bg-canvas px-1 font-mono">↓</kbd>
                to move
              </span>
              <span className="flex items-center gap-1.5">
                <kbd className="rounded-xs border border-hairline bg-canvas px-1 font-mono">Enter</kbd>
                to open
              </span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
