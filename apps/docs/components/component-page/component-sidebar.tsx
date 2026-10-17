"use client";
/**
 * <ComponentSidebar> — left rail listing every component by category.
 * Desktop: sticky rail. Below lg: a slim sticky bar that opens a slide-in drawer.
 */
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ChevronRight, PanelLeft, X } from "lucide-react";
import { cn } from "../../lib/cn";

export interface SidebarGroup {
  category: string;
  items: { slug: string; name: string }[];
}

function NavList({ groups, activeSlug, onNavigate }: { groups: SidebarGroup[]; activeSlug: string; onNavigate?: () => void }) {
  return (
    <div className="space-y-5">
      <ul>
        <li>
          <Link
            href="/packages"
            onClick={onNavigate}
            className="flex items-center rounded-sm px-3 py-1.5 text-[14px] text-steel transition-colors hover:bg-surface-soft hover:text-ink"
          >
            All components
          </Link>
        </li>
        <li>
          <Link
            href={`/playground?component=${activeSlug}`}
            onClick={onNavigate}
            className="flex items-center rounded-sm px-3 py-1.5 text-[14px] text-steel transition-colors hover:bg-surface-soft hover:text-ink"
          >
            Playground
          </Link>
        </li>
      </ul>
      {groups.map((g) => (
        <div key={g.category}>
          <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.5px] text-steel">{g.category}</p>
          <ul className="space-y-px">
            {g.items.map((item) => {
              const active = item.slug === activeSlug;
              return (
                <li key={item.slug}>
                  <Link
                    href={`/packages/${item.slug}`}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-2 rounded-sm px-3 py-1.5 text-[14px] transition-colors duration-150 max-lg:py-2.5",
                      active ? "bg-surface font-medium text-ink" : "text-steel hover:bg-surface-soft hover:text-ink"
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cn("h-1.5 w-1.5 shrink-0 rounded-full transition-colors", active ? "bg-brand-green" : "bg-transparent")}
                    />
                    {item.name}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

export function ComponentSidebar({ groups, activeSlug }: { groups: SidebarGroup[]; activeSlug: string }) {
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion();
  const closeRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const active = groups.flatMap((g) => g.items.map((i) => ({ ...i, category: g.category }))).find((i) => i.slug === activeSlug);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const trigger = triggerRef.current;
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
      trigger?.focus();
    };
  }, [open]);

  return (
    <>
      {/* Desktop rail */}
      <aside aria-label="Components" className="hidden lg:block">
        <div className="sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto overscroll-contain py-8 pl-5 pr-4 [scrollbar-width:thin] xl:pl-8">
          <NavList groups={groups} activeSlug={activeSlug} />
        </div>
      </aside>

      {/* Mobile bar */}
      <div className="sticky top-16 z-30 border-b border-hairline-soft bg-canvas/95 backdrop-blur lg:hidden">
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={open}
          aria-controls="component-drawer"
          className="flex w-full items-center gap-2 px-5 py-3 text-left text-[14px] sm:px-8"
        >
          <PanelLeft className="h-4 w-4 text-steel" aria-hidden="true" />
          <span className="text-steel">{active?.category ?? "Components"}</span>
          <ChevronRight className="h-3.5 w-3.5 text-muted" aria-hidden="true" />
          <span className="truncate font-medium text-ink">{active?.name}</span>
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-[60] lg:hidden" id="component-drawer">
            <motion.div
              className="absolute inset-0 bg-black/30 dark:bg-black/60"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduce ? 0 : 0.2 }}
              onClick={() => setOpen(false)}
              aria-hidden="true"
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Components"
              className="absolute inset-y-0 left-0 flex w-[min(320px,86vw)] flex-col bg-canvas shadow-[0_24px_48px_-8px_rgba(0,0,0,0.25)]"
              initial={reduce ? { opacity: 0 } : { x: "-100%" }}
              animate={reduce ? { opacity: 1 } : { x: 0 }}
              exit={reduce ? { opacity: 0 } : { x: "-100%" }}
              transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 40 }}
            >
              <div className="flex items-center justify-between border-b border-hairline-soft px-5 py-3">
                <span className="text-[14px] font-semibold text-ink">Components</span>
                <button
                  ref={closeRef}
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close navigation"
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full text-steel hover:bg-surface hover:text-ink"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-2 py-4">
                <NavList groups={groups} activeSlug={activeSlug} onNavigate={() => setOpen(false)} />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
