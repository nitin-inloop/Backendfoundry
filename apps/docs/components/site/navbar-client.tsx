"use client";
/**
 * <NavbarClient> — sticky top navigation (DESIGN: Top Navigation).
 * Transparent at the top of the page, gains a blurred white surface and hairline once scrolled.
 * Search pill opens the ⌘K command palette; mobile menu animates open below the bar.
 */
import { Github, Menu, Search, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "../ui/button";
import { cn } from "../ui/cn";
import { CommandPalette } from "./command-palette";
import { Logo } from "./logo";
import type { SearchItem } from "./search-items";
import { GITHUB_URL, MAIN_NAV } from "./site-config";
import { ThemeToggle } from "./theme-toggle";

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function NavbarClient({ searchItems }: { searchItems: SearchItem[] }) {
  const pathname = usePathname() ?? "/";
  const reduce = useReducedMotion();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [isMac, setIsMac] = useState(true);
  const [hovered, setHovered] = useState<string | null>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setIsMac(/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent));
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setSearchOpen((o) => !o);
      } else if (e.key === "/" && !typing) {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => setMenuOpen(false), [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  const solid = scrolled || menuOpen || pathname !== "/";

  return (
    <>
      <header
        className={cn(
          "sticky top-0 z-50 w-full transition-[background-color,border-color,box-shadow] duration-200",
          solid
            ? "border-b border-hairline-soft bg-canvas/80 backdrop-blur-xl backdrop-saturate-150"
            : "dark border-b border-transparent bg-transparent"
        )}
      >
        <nav aria-label="Main" className="mx-auto flex h-16 w-full max-w-container items-center gap-6 px-5 sm:px-8">
          <Link href="/" aria-label="BackendFoundry home" className="shrink-0 rounded-sm">
            <Logo />
          </Link>

          <ul className="hidden items-center lg:flex" onMouseLeave={() => setHovered(null)}>
            {MAIN_NAV.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <li key={item.href} className="relative" onMouseEnter={() => setHovered(item.href)}>
                  {hovered === item.href && (
                    <motion.span
                      layoutId="nav-hover"
                      aria-hidden="true"
                      className="absolute inset-0 rounded-md bg-ink/[0.05]"
                      transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 40 }}
                    />
                  )}
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "relative block rounded-md px-3 py-1.5 text-body-sm transition-colors",
                      active ? "font-medium text-ink" : "text-steel hover:text-ink"
                    )}
                  >
                    {item.label}
                    {active && (
                      <span aria-hidden="true" className="absolute inset-x-3 -bottom-[13px] h-0.5 rounded-full bg-brand-green" />
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>

          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="hidden h-9 w-[248px] items-center gap-2 rounded-md border border-hairline bg-surface/80 pl-3 pr-1.5 text-body-sm text-steel transition-colors hover:border-stone/50 hover:bg-surface md:flex"
              aria-label="Search documentation and components"
              aria-keyshortcuts="Meta+K Control+K"
            >
              <Search className="h-4 w-4" aria-hidden="true" />
              <span className="flex-1 text-left">Search...</span>
              <kbd className="rounded-xs border border-hairline bg-canvas px-1.5 py-0.5 font-mono text-micro text-steel">
                {isMac ? "⌘K" : "Ctrl K"}
              </kbd>
            </button>
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="grid h-9 w-9 place-items-center rounded-full border border-hairline bg-canvas text-ink md:hidden"
              aria-label="Search documentation and components"
            >
              <Search className="h-4 w-4" aria-hidden="true" />
            </button>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noreferrer"
              aria-label="BackendFoundry on GitHub"
              className="hidden h-9 w-9 place-items-center rounded-full border border-hairline bg-canvas text-ink transition-colors hover:bg-surface sm:grid"
            >
              <Github className="h-4 w-4" aria-hidden="true" />
            </a>
            <ThemeToggle className="hidden sm:inline-flex" />
            <Button href="/docs/getting-started" size="sm" className="hidden h-9 px-4 sm:inline-flex">
              Get started
            </Button>
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              aria-expanded={menuOpen}
              aria-controls="mobile-menu"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              className="grid h-9 w-9 place-items-center rounded-full border border-hairline bg-canvas text-ink lg:hidden"
            >
              <span className="relative h-4 w-4">
                <AnimatePresence initial={false} mode="popLayout">
                  <motion.span
                    key={menuOpen ? "x" : "menu"}
                    className="absolute inset-0"
                    initial={reduce ? false : { rotate: -90, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={reduce ? { opacity: 0 } : { rotate: 90, opacity: 0 }}
                    transition={{ duration: 0.15 }}
                  >
                    {menuOpen ? <X className="h-4 w-4" aria-hidden="true" /> : <Menu className="h-4 w-4" aria-hidden="true" />}
                  </motion.span>
                </AnimatePresence>
              </span>
            </button>
          </div>
        </nav>

        <AnimatePresence initial={false}>
          {menuOpen && (
            <motion.div
              id="mobile-menu"
              key="mobile-menu"
              className="overflow-hidden border-t border-hairline-soft bg-canvas lg:hidden"
              initial={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
              animate={reduce ? { opacity: 1 } : { height: "auto", opacity: 1 }}
              exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
              transition={{ duration: reduce ? 0 : 0.28, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="mx-auto max-w-container px-5 pb-6 pt-3 sm:px-8">
                <ul className="divide-y divide-hairline-soft">
                  {MAIN_NAV.map((item, i) => (
                    <motion.li
                      key={item.href}
                      initial={reduce ? false : { opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: reduce ? 0 : 0.04 * i + 0.05, duration: 0.2 }}
                    >
                      <Link
                        href={item.href}
                        aria-current={isActive(pathname, item.href) ? "page" : undefined}
                        className={cn(
                          "flex h-12 items-center justify-between text-body-md",
                          isActive(pathname, item.href) ? "font-medium text-ink" : "text-slate"
                        )}
                      >
                        {item.label}
                        {isActive(pathname, item.href) && <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-brand-green" />}
                      </Link>
                    </motion.li>
                  ))}
                </ul>
                <ThemeToggle withLabel className="mt-4 h-11 w-full sm:hidden" />
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <Button href={GITHUB_URL} variant="secondary" className="h-11">
                    <Github aria-hidden="true" /> GitHub
                  </Button>
                  <Button href="/docs/getting-started" className="h-11">
                    Get started
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>
      <CommandPalette items={searchItems} open={searchOpen} onOpenChange={setSearchOpen} />
    </>
  );
}
