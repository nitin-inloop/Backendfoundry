/**
 * <Badge> — DESIGN: badge-type / badge-tag / badge-discount. Inline status / category chip (pill).
 * Props:
 *   tone?: "neutral" | "primary" | "muted" | "tag" | "warn" | "error"   (default "neutral")
 *          neutral = surface chip, slate text       primary = mint tint (active / available)
 *          muted   = white chip, steel text         tag     = tag-blue tint
 *          warn    = amber tint                     error   = red tint
 *   dot?: boolean   leading status dot in the tone colour
 *   className?, children, ...span attributes
 */
import type { HTMLAttributes } from "react";
import { cn } from "./cn";

export type BadgeTone = "neutral" | "primary" | "muted" | "tag" | "warn" | "error";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  dot?: boolean;
}

const tones: Record<BadgeTone, string> = {
  neutral: "border-hairline bg-surface text-slate",
  primary: "border-brand-green/30 bg-brand-green/10 text-[#00785f] dark:text-brand-green-soft",
  muted: "border-hairline bg-canvas text-steel",
  tag: "border-brand-tag/20 bg-brand-tag/10 text-brand-tag",
  warn: "border-brand-warn/25 bg-brand-warn/10 text-[#94600a] dark:text-[#f2b862]",
  error: "border-brand-error/25 bg-brand-error/10 text-[#b23b3b] dark:text-[#ff8a8a]"
};

const dots: Record<BadgeTone, string> = {
  neutral: "bg-stone",
  primary: "bg-brand-green",
  muted: "bg-muted",
  tag: "bg-brand-tag",
  warn: "bg-brand-warn",
  error: "bg-brand-error"
};

export function Badge({ tone = "neutral", dot, className, children, ...rest }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-micro font-medium",
        tones[tone],
        className
      )}
      {...rest}
    >
      {dot && <span aria-hidden="true" className={cn("h-1.5 w-1.5 rounded-full", dots[tone])} />}
      {children}
    </span>
  );
}
