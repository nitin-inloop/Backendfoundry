"use client";
/**
 * <Tabs> — accessible tab set (WAI-ARIA tabs pattern, arrow/Home/End key navigation).
 * Props:
 *   items: { id: string; label: ReactNode; content: ReactNode }[]
 *   defaultId?: string        initially selected tab (default: first item)
 *   label?: string            aria-label for the tab list
 *   variant?: "underline" | "segmented" | "pill"   (default "underline")
 *             underline = segmented-tab (2px ink underline, animated)
 *             segmented = toggle on surface track with a sliding white thumb
 *             pill      = pill-tab (active = black pill)
 *   onChange?: (id: string) => void
 *   className?, listClassName?, panelClassName?
 * Server components may pass pre-rendered ReactNode content (e.g. <CodeBlock>).
 */
import { motion, useReducedMotion } from "motion/react";
import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "./cn";

export interface TabItem {
  id: string;
  label: ReactNode;
  content: ReactNode;
}

export interface TabsProps {
  items: TabItem[];
  defaultId?: string;
  label?: string;
  variant?: "underline" | "segmented" | "pill";
  onChange?: (id: string) => void;
  className?: string;
  listClassName?: string;
  panelClassName?: string;
}

export function Tabs({
  items,
  defaultId,
  label,
  variant = "underline",
  onChange,
  className,
  listClassName,
  panelClassName
}: TabsProps) {
  const [active, setActive] = useState(defaultId ?? items[0]?.id ?? "");
  const baseId = useId();
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const reduce = useReducedMotion();
  const spring = reduce ? { duration: 0 } : { type: "spring" as const, stiffness: 500, damping: 40 };

  function select(id: string) {
    setActive(id);
    onChange?.(id);
  }

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next = -1;
    if (e.key === "ArrowRight") next = (index + 1) % items.length;
    else if (e.key === "ArrowLeft") next = (index - 1 + items.length) % items.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = items.length - 1;
    if (next < 0) return;
    e.preventDefault();
    const item = items[next];
    if (item) {
      select(item.id);
      refs.current[next]?.focus();
    }
  }

  return (
    <div className={className}>
      <div
        role="tablist"
        aria-label={label}
        className={cn(
          "scrollbar-none flex overflow-x-auto",
          variant === "underline" && "gap-1 border-b border-hairline",
          variant === "segmented" && "inline-flex max-w-full gap-0.5 rounded-full bg-surface p-1",
          variant === "pill" && "gap-2",
          listClassName
        )}
      >
        {items.map((item, i) => {
          const selected = item.id === active;
          return (
            <button
              key={item.id}
              ref={(el) => {
                refs.current[i] = el;
              }}
              role="tab"
              type="button"
              id={`${baseId}-tab-${item.id}`}
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${item.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => select(item.id)}
              onKeyDown={(e) => onKeyDown(e, i)}
              className={cn(
                "relative whitespace-nowrap text-body-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-green",
                variant === "underline" && cn("px-3 py-2.5", selected ? "text-ink" : "text-steel hover:text-ink"),
                variant === "segmented" && cn("rounded-full px-3.5 py-1.5", selected ? "text-ink" : "text-steel hover:text-ink"),
                variant === "pill" &&
                  cn(
                    "rounded-full border px-4 py-2",
                    selected ? "border-primary text-on-primary" : "border-hairline bg-canvas text-steel hover:text-ink"
                  )
              )}
            >
              {selected && variant === "underline" && (
                <motion.span
                  layoutId={`${baseId}-indicator`}
                  transition={spring}
                  aria-hidden="true"
                  className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-ink"
                />
              )}
              {selected && variant === "segmented" && (
                <motion.span
                  layoutId={`${baseId}-indicator`}
                  transition={spring}
                  aria-hidden="true"
                  className="absolute inset-0 rounded-full bg-canvas shadow-subtle ring-1 ring-hairline"
                />
              )}
              {selected && variant === "pill" && (
                <motion.span
                  layoutId={`${baseId}-indicator`}
                  transition={spring}
                  aria-hidden="true"
                  className="absolute inset-[-1px] rounded-full bg-primary"
                />
              )}
              <span className="relative">{item.label}</span>
            </button>
          );
        })}
      </div>
      {items.map((item) => (
        <div
          key={item.id}
          role="tabpanel"
          id={`${baseId}-panel-${item.id}`}
          aria-labelledby={`${baseId}-tab-${item.id}`}
          hidden={item.id !== active}
          className={panelClassName}
        >
          {item.content}
        </div>
      ))}
    </div>
  );
}
