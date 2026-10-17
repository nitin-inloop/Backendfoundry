"use client";
/**
 * <DocsToc> — DESIGN: doc-toc-item. Right-rail "On this page" with scroll-spy.
 * The active heading is the last one whose top has crossed 30% of the viewport; a mint bar
 * slides along the rail to it.
 * Props: items: { id, title }[], editHref?: string
 */
import { ArrowUp, SquarePen } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { cn } from "../ui/cn";

export function DocsToc({ items, editHref }: { items: { id: string; title: string }[]; editHref?: string }) {
  const [active, setActive] = useState(items[0]?.id ?? "");
  const reduce = useReducedMotion();

  useEffect(() => {
    if (items.length === 0) return;
    let frame = 0;
    const compute = () => {
      frame = 0;
      const line = window.innerHeight * 0.3;
      let current = items[0]!.id;
      for (const item of items) {
        const el = document.getElementById(item.id);
        if (el && el.getBoundingClientRect().top <= line) current = item.id;
      }
      // At the very bottom, highlight the last heading.
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) {
        current = items[items.length - 1]!.id;
      }
      setActive(current);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(compute);
    };
    compute();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [items]);

  return (
    <nav aria-label="On this page" className="text-body-sm">
      {items.length > 0 && (
        <>
          <p className="text-caption font-medium text-ink">On this page</p>
          <ul className="relative mt-3 border-l border-hairline">
            {items.map((t) => {
              const isActive = t.id === active;
              return (
                <li key={t.id} className="relative">
                  {isActive && (
                    <motion.span
                      layoutId="toc-indicator"
                      aria-hidden="true"
                      className="absolute -left-px top-0 h-full w-0.5 rounded-full bg-brand-green"
                      transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 38 }}
                    />
                  )}
                  <a
                    href={`#${t.id}`}
                    aria-current={isActive ? "location" : undefined}
                    className={cn(
                      "block py-1 pl-4 leading-snug transition-colors",
                      isActive ? "font-medium text-ink" : "text-steel hover:text-ink"
                    )}
                  >
                    {t.title}
                  </a>
                </li>
              );
            })}
          </ul>
        </>
      )}
      <div className={cn("space-y-2.5 text-caption", items.length > 0 && "mt-6 border-t border-hairline-soft pt-5")}>
        {editHref && (
          <a href={editHref} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-steel transition-colors hover:text-ink">
            <SquarePen className="h-3.5 w-3.5" aria-hidden="true" /> Edit this page
          </a>
        )}
        <a href="#main" className="flex items-center gap-2 text-steel transition-colors hover:text-ink">
          <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" /> Back to top
        </a>
      </div>
    </nav>
  );
}
