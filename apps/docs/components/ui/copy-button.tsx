"use client";
/**
 * <CopyButton> — copies `value` to the clipboard and confirms with an animated check for 1.6s.
 * Props:
 *   value: string                 text to copy
 *   label?: string                accessible label (default "Copy to clipboard")
 *   tone?: "light" | "dark"       "dark" for use on surface-code (code blocks) (default "light")
 *   showLabel?: boolean           render a visible "Copy" / "Copied" text next to the icon (default false)
 *   className?: string
 */
import { Check, Copy } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { cn } from "./cn";

export interface CopyButtonProps {
  value: string;
  label?: string;
  tone?: "light" | "dark";
  showLabel?: boolean;
  className?: string;
}

export function CopyButton({ value, label = "Copy to clipboard", tone = "light", showLabel = false, className }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(t);
  }, [copied]);

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      // Clipboard API unavailable (insecure context): fall back to a hidden textarea.
      const el = document.createElement("textarea");
      el.value = value;
      el.setAttribute("readonly", "");
      el.style.position = "absolute";
      el.style.left = "-9999px";
      document.body.appendChild(el);
      el.select();
      try {
        document.execCommand("copy");
        setCopied(true);
      } finally {
        document.body.removeChild(el);
      }
    }
  }

  const iconMotion = reduce
    ? {}
    : { initial: { scale: 0.6, opacity: 0 }, animate: { scale: 1, opacity: 1 }, exit: { scale: 0.6, opacity: 0 }, transition: { duration: 0.14 } };

  return (
    <button
      type="button"
      onClick={onCopy}
      aria-label={copied ? "Copied" : label}
      title={copied ? "Copied" : label}
      className={cn(
        "relative inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-sm border text-caption transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-green",
        showLabel ? "px-2" : "w-8",
        tone === "dark"
          ? "border-hairline-dark text-on-dark-muted hover:border-white/20 hover:bg-white/5 hover:text-on-dark"
          : "border-transparent text-steel hover:border-hairline hover:bg-canvas hover:text-ink",
        copied && (tone === "dark" ? "text-brand-green hover:text-brand-green" : "text-brand-green-deep hover:text-brand-green-deep"),
        className
      )}
    >
      <span className="relative grid h-4 w-4 place-items-center">
        <AnimatePresence initial={false} mode="popLayout">
          {copied ? (
            <motion.span key="check" className="absolute inset-0 grid place-items-center" {...iconMotion}>
              <Check className="h-4 w-4" aria-hidden="true" />
            </motion.span>
          ) : (
            <motion.span key="copy" className="absolute inset-0 grid place-items-center" {...iconMotion}>
              <Copy className="h-3.5 w-3.5" aria-hidden="true" />
            </motion.span>
          )}
        </AnimatePresence>
      </span>
      {showLabel && <span>{copied ? "Copied" : "Copy"}</span>}
      <span className="sr-only" aria-live="polite">
        {copied ? "Copied" : ""}
      </span>
    </button>
  );
}
