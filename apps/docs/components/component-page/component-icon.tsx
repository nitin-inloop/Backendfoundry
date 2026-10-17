/**
 * One glyph per BackendFoundry component. Safe in server and client components.
 */
import {
  Boxes,
  CircuitBoard,
  Database,
  Fingerprint,
  Gauge,
  HeartPulse,
  Package,
  RotateCw,
  ScrollText,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  Webhook,
  type LucideIcon
} from "lucide-react";
import { cn } from "../../lib/cn";

const ICONS: Record<string, LucideIcon> = {
  core: Boxes,
  validation: ShieldCheck,
  "rate-limit": Gauge,
  retry: RotateCw,
  "circuit-breaker": CircuitBoard,
  cache: Database,
  idempotency: Fingerprint,
  webhooks: Webhook,
  health: HeartPulse,
  errors: TriangleAlert,
  logger: ScrollText,
  ai: Sparkles
};

export function iconFor(slug: string): LucideIcon {
  return ICONS[slug] ?? Package;
}

/** Icon inside a hairline tile. `size` sm = 28px, md = 36px, lg = 44px. */
export function ComponentIcon({
  slug,
  size = "md",
  className
}: {
  slug: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const Icon = iconFor(slug);
  const box = size === "sm" ? "h-7 w-7 rounded-sm" : size === "lg" ? "h-11 w-11 rounded-md" : "h-9 w-9 rounded-md";
  const glyph = size === "sm" ? "h-3.5 w-3.5" : size === "lg" ? "h-5 w-5" : "h-[18px] w-[18px]";
  return (
    <span
      aria-hidden="true"
      className={cn("inline-flex shrink-0 items-center justify-center border border-hairline bg-surface-soft text-ink", box, className)}
    >
      <Icon className={glyph} strokeWidth={1.75} />
    </span>
  );
}
