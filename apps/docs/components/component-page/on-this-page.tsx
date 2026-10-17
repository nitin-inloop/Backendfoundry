"use client";
/**
 * <OnThisPage> — right-rail TOC with scroll-spy. The active item gets ink text and
 * a brand-green rail marker that glides between entries.
 */
import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ListTree } from "lucide-react";
import { cn } from "../../lib/cn";

export interface TocItem {
  id: string;
  title: string;
  depth?: 1 | 2;
}

export function OnThisPage({ items }: { items: TocItem[] }) {
  const [active, setActive] = useState(items[0]?.id);
  const reduce = useReducedMotion();

  useEffect(() => {
    const els = items.map((i) => document.getElementById(i.id)).filter((el): el is HTMLElement => !!el);
    if (els.length === 0) return;
    const visible = new Map<string, boolean>();
    const pick = () => {
      // Bottom of page: last item wins.
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) {
        setActive(items[items.length - 1]?.id);
        return;
      }
      const first = items.find((i) => visible.get(i.id));
      if (first) {
        setActive(first.id);
        return;
      }
      // Nothing intersecting: take the last section whose top is above the band.
      let current = items[0]?.id;
      for (const el of els) if (el.getBoundingClientRect().top < 120) current = el.id;
      setActive(current);
    };
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) visible.set(e.target.id, e.isIntersecting);
        pick();
      },
      { rootMargin: "-80px 0px -60% 0px", threshold: 0 }
    );
    els.forEach((el) => io.observe(el));
    window.addEventListener("scroll", pick, { passive: true });
    return () => {
      io.disconnect();
      window.removeEventListener("scroll", pick);
    };
  }, [items]);

  return (
    <nav aria-label="On this page">
      <p className="flex items-center gap-2 text-[13px] font-semibold text-ink">
        <ListTree className="h-3.5 w-3.5 text-steel" aria-hidden="true" />
        On this page
      </p>
      <ul className="mt-3 border-l border-hairline">
        {items.map((item) => {
          const isActive = item.id === active;
          return (
            <li key={item.id} className="relative">
              {isActive && (
                <motion.span
                  layoutId="toc-marker"
                  transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 40 }}
                  className="absolute -left-px top-1 bottom-1 w-0.5 rounded-full bg-brand-green"
                  aria-hidden="true"
                />
              )}
              <a
                href={`#${item.id}`}
                aria-current={isActive ? "location" : undefined}
                className={cn(
                  "block py-1 text-[14px] leading-[1.5] transition-colors duration-150",
                  item.depth === 2 ? "pl-7" : "pl-4",
                  isActive ? "font-medium text-ink" : "text-steel hover:text-ink"
                )}
              >
                {item.title}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
