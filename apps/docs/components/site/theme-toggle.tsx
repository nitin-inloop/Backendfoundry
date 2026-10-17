"use client";

/**
 * <ThemeToggle> — light/dark switch. Persists to localStorage("bf-theme"); with no stored value
 * the site follows prefers-color-scheme (applied before paint by THEME_SCRIPT in app/layout.tsx).
 * Props: className?, withLabel?: boolean (adds a "Dark mode"/"Light mode" text label, for the mobile menu)
 */
import { Moon, Sun } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { cn } from "../ui/cn";
import { THEME_STORAGE_KEY } from "./theme";

type Theme = "light" | "dark";

export function ThemeToggle({ className, withLabel = false }: { className?: string; withLabel?: boolean }) {
  const reduce = useReducedMotion();
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light");

    // Follow OS changes until the user picks a theme explicitly.
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e: MediaQueryListEvent) => {
      if (localStorage.getItem(THEME_STORAGE_KEY)) return;
      document.documentElement.classList.toggle("dark", e.matches);
      setTheme(e.matches ? "dark" : "light");
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  const toggle = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    const root = document.documentElement;
    // Swap colours instantly instead of letting every element's colour transition run.
    root.classList.add("bf-theme-switching");
    root.classList.toggle("dark", next === "dark");
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      /* storage unavailable (private mode) — theme still applies for this page view */
    }
    setTheme(next);
    requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove("bf-theme-switching")));
  };

  const isDark = theme === "dark";
  const label = isDark ? "Switch to light mode" : "Switch to dark mode";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex h-9 items-center justify-center gap-2 rounded-full border border-hairline bg-canvas text-ink transition-colors hover:bg-surface",
        withLabel ? "px-4 text-body-sm font-medium" : "w-9",
        className
      )}
    >
      <span className="relative h-4 w-4" aria-hidden="true">
        {/* Until mounted the theme is unknown; render nothing rather than a wrong icon. */}
        {theme && (
          <AnimatePresence initial={false} mode="popLayout">
            <motion.span
              key={theme}
              className="absolute inset-0"
              initial={reduce ? { opacity: 0 } : { rotate: -90, scale: 0.4, opacity: 0 }}
              animate={{ rotate: 0, scale: 1, opacity: 1 }}
              exit={reduce ? { opacity: 0 } : { rotate: 90, scale: 0.4, opacity: 0 }}
              transition={{ duration: reduce ? 0 : 0.22, ease: [0.22, 1, 0.36, 1] }}
            >
              {isDark ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            </motion.span>
          </AnimatePresence>
        )}
      </span>
      {withLabel && <span>{isDark ? "Dark mode" : "Light mode"}</span>}
    </button>
  );
}
