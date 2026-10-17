/**
 * <Callout> — docs admonition. Tinted surface, hairline border, tone icon.
 * Props:
 *   tone?: "note" | "tip" | "warning" | "danger"   (default "note")
 *   title?: ReactNode
 *   children, className?
 */
import { AlertTriangle, Info, Lightbulb, OctagonAlert } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "./cn";

export interface CalloutProps {
  tone?: "note" | "tip" | "warning" | "danger";
  title?: ReactNode;
  children: ReactNode;
  className?: string;
}

const config = {
  note: { icon: Info, box: "border-hairline bg-surface-soft", iconClass: "text-brand-tag", label: "Note" },
  tip: { icon: Lightbulb, box: "border-brand-green/30 bg-brand-green/[0.06]", iconClass: "text-brand-green-deep", label: "Tip" },
  warning: { icon: AlertTriangle, box: "border-brand-warn/30 bg-brand-warn/[0.06]", iconClass: "text-brand-warn", label: "Warning" },
  danger: { icon: OctagonAlert, box: "border-brand-error/30 bg-brand-error/[0.06]", iconClass: "text-brand-error", label: "Danger" }
} as const;

export function Callout({ tone = "note", title, children, className }: CalloutProps) {
  const { icon: Icon, box, iconClass, label } = config[tone];
  return (
    <aside
      aria-label={typeof title === "string" ? title : label}
      className={cn("not-prose flex gap-3 rounded-lg border px-4 py-3.5 text-body-sm leading-relaxed text-slate", box, className)}
    >
      <Icon className={cn("mt-[3px] h-4 w-4 shrink-0", iconClass)} aria-hidden="true" />
      <div className="min-w-0 space-y-1 [&_code]:rounded-xs [&_code]:border [&_code]:border-hairline [&_code]:bg-canvas [&_code]:px-1 [&_code]:font-mono [&_code]:text-[0.88em] [&_code]:text-charcoal">
        {title && <p className="font-semibold text-ink">{title}</p>}
        <div>{children}</div>
      </div>
    </aside>
  );
}
