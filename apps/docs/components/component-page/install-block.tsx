"use client";
/**
 * <InstallBlock> — Mintlify-style code group for install commands: tabs live in
 * the dark header, the active tab is underlined in brand green, copy on the right.
 */
import { useId, useRef, useState, type KeyboardEvent } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check, Copy } from "lucide-react";
import { cn } from "../../lib/cn";

export interface InstallOption {
  id: string;
  label: string;
  command: string;
  note?: string;
}

export function InstallBlock({ options, defaultId }: { options: InstallOption[]; defaultId?: string }) {
  const [active, setActive] = useState(defaultId ?? options[0]?.id);
  const baseId = useId();
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const reduce = useReducedMotion();
  const current = options.find((o) => o.id === active) ?? options[0];
  if (!current) return null;

  const onKey = (e: KeyboardEvent<HTMLButtonElement>, idx: number) => {
    const delta = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    const next = (idx + delta + options.length) % options.length;
    setActive(options[next]!.id);
    tabRefs.current[next]?.focus();
  };

  return (
    <div className="overflow-hidden rounded-md bg-surface-code text-on-dark">
      <div className="flex items-center justify-between gap-2 border-b border-hairline-dark pr-2">
        <div role="tablist" aria-label="Install method" className="flex min-w-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {options.map((o, idx) => {
            const selected = o.id === current.id;
            return (
              <button
                key={o.id}
                ref={(el) => {
                  tabRefs.current[idx] = el;
                }}
                id={`${baseId}-tab-${o.id}`}
                role="tab"
                type="button"
                aria-selected={selected}
                aria-controls={`${baseId}-panel`}
                tabIndex={selected ? 0 : -1}
                onClick={() => setActive(o.id)}
                onKeyDown={(e) => onKey(e, idx)}
                className={cn(
                  "relative shrink-0 px-4 py-2.5 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-green",
                  selected ? "text-on-dark" : "text-on-dark-muted hover:text-on-dark"
                )}
              >
                {o.label}
                {selected && (
                  <motion.span
                    layoutId={`${baseId}-underline`}
                    transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 40 }}
                    className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-brand-green"
                    aria-hidden="true"
                  />
                )}
              </button>
            );
          })}
        </div>
        <CopyText value={current.command} dark />
      </div>
      <div id={`${baseId}-panel`} role="tabpanel" aria-labelledby={`${baseId}-tab-${current.id}`} className="px-4 py-4">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={current.id}
            initial={reduce ? false : { opacity: 0, y: 3 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, y: -3, transition: { duration: 0.1 } }}
            transition={{ duration: 0.16 }}
          >
            <code className="block overflow-x-auto whitespace-nowrap font-mono text-[14px] leading-[1.5]">
              <span className="select-none text-on-dark-muted">$ </span>
              {current.command}
            </code>
            {current.note && <p className="mt-2 text-[13px] leading-[1.4] text-on-dark-muted">{current.note}</p>}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

export function CopyText({ value, dark = false, label = "Copy" }: { value: string; dark?: boolean; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(value).then(() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1400);
        });
      }}
      aria-label={copied ? "Copied" : `${label}: ${value.slice(0, 60)}`}
      className={cn(
        "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-sm border px-2 text-[12px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green",
        dark
          ? "border-hairline-dark text-on-dark-muted hover:border-[#3a3a3c] hover:text-on-dark"
          : "border-hairline bg-canvas text-steel hover:text-ink"
      )}
    >
      {copied ? <Check className="h-3.5 w-3.5 text-brand-green" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
      <span>{copied ? "Copied" : label}</span>
    </button>
  );
}
