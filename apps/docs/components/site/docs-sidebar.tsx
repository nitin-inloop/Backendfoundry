"use client";
/**
 * <DocsSidebar> — DESIGN: sidebar-nav-item / sidebar-section-header. Grouped docs navigation.
 * Active row: surface background, ink medium text and a mint indicator that slides between items.
 * Below lg it renders as a collapsible "menu" bar at the top of the page.
 */
import { ChevronDown } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "../ui/cn";
import { DOCS_FLAT, DOCS_NAV } from "./site-config";

function NavList({ pathname, layoutKey }: { pathname: string; layoutKey: string }) {
  const reduce = useReducedMotion();
  return (
    <div className="space-y-6">
      {DOCS_NAV.map((group) => (
        <div key={group.title}>
          <h2 className="px-3 pb-2 text-micro-upper uppercase text-steel">{group.title}</h2>
          <ul className="space-y-px">
            {group.items.map((item) => {
              const active = pathname === item.href;
              return (
                <li key={item.href} className="relative">
                  {active && (
                    <motion.span
                      layoutId={`docs-active-${layoutKey}`}
                      aria-hidden="true"
                      className="absolute inset-0 rounded-sm bg-surface"
                      transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 42 }}
                    >
                      <span className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-brand-green" />
                    </motion.span>
                  )}
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "relative block rounded-sm px-3 py-1.5 text-body-sm transition-colors",
                      active ? "font-medium text-ink" : "text-steel hover:bg-surface-soft hover:text-ink"
                    )}
                  >
                    {item.title}
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

export function DocsSidebar() {
  const pathname = usePathname() ?? "/docs";
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion();
  const current = DOCS_FLAT.find((i) => i.href === pathname);

  useEffect(() => setOpen(false), [pathname]);

  return (
    <>
      <div className="rounded-lg border border-hairline lg:hidden">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls="docs-mobile-nav"
          className="flex h-11 w-full items-center justify-between px-4 text-body-sm"
        >
          <span className="truncate">
            <span className="text-steel">Docs / </span>
            <span className="font-medium text-ink">{current?.title ?? "Menu"}</span>
          </span>
          <ChevronDown className={cn("h-4 w-4 text-steel transition-transform", open && "rotate-180")} aria-hidden="true" />
        </button>
        <AnimatePresence initial={false}>
          {open && (
            <motion.nav
              id="docs-mobile-nav"
              aria-label="Documentation"
              className="overflow-hidden border-t border-hairline"
              initial={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
              animate={reduce ? { opacity: 1 } : { height: "auto", opacity: 1 }}
              exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
              transition={{ duration: reduce ? 0 : 0.25, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="px-1 py-4">
                <NavList pathname={pathname} layoutKey="mobile" />
              </div>
            </motion.nav>
          )}
        </AnimatePresence>
      </div>
      <nav aria-label="Documentation" className="hidden lg:block">
        <NavList pathname={pathname} layoutKey="desktop" />
      </nav>
    </>
  );
}
