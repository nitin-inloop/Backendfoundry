/**
 * <ComponentsBento> — every registry component grouped by category in an asymmetric grid.
 * Each component row links to /packages/<slug>; rows nudge their arrow on hover.
 */
import { ArrowUpRight, Bot, Boxes, Gauge, Layers, RefreshCcw, ShieldCheck } from "lucide-react";
import Link from "next/link";
import type { ComponentType } from "react";
import { cn } from "../../ui/cn";
import { Stagger, StaggerItem } from "../../ui/motion";
import { getSiteComponents, groupByCategory } from "../registry-items";

const CATEGORY: Record<string, { blurb: string; icon: ComponentType<{ className?: string }>; span: string; cols: string }> = {
  "Security & Validation": {
    blurb: "Decide what gets in: typed request schemas, per-client limits and signed webhooks.",
    icon: ShieldCheck,
    span: "lg:col-span-6",
    cols: "sm:grid-cols-3"
  },
  Foundation: {
    blurb: "The error base class, request IDs and response shapes the rest builds on.",
    icon: Boxes,
    span: "lg:col-span-2",
    cols: ""
  },
  Reliability: {
    blurb: "Call flaky dependencies without making an outage worse.",
    icon: RefreshCcw,
    span: "lg:col-span-2",
    cols: ""
  },
  "State & Caching": {
    blurb: "Remember work already done, and do it once even when clients retry.",
    icon: Layers,
    span: "lg:col-span-2",
    cols: ""
  },
  Observability: {
    blurb: "Know what each request did and whether the service is ready for traffic.",
    icon: Gauge,
    span: "lg:col-span-3",
    cols: "sm:grid-cols-2"
  },
  "AI Infrastructure": {
    blurb: "One typed interface over LLM providers, with timeouts, fallback and schema-checked output.",
    icon: Bot,
    span: "lg:col-span-3",
    cols: ""
  }
};

const ORDER = ["Security & Validation", "Foundation", "Reliability", "State & Caching", "Observability", "AI Infrastructure"];

export function ComponentsBento() {
  const rank = (c: string) => (ORDER.includes(c) ? ORDER.indexOf(c) : ORDER.length);
  const groups = groupByCategory(getSiteComponents()).sort((a, b) => rank(a.category) - rank(b.category));

  return (
    <Stagger className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-6" stagger={0.07}>
      {groups.map((group) => {
        const meta = CATEGORY[group.category] ?? { blurb: "", icon: Boxes, span: "lg:col-span-2", cols: "" };
        const Icon = meta.icon;
        const wide = meta.span.includes("col-span-6") || group.category === "AI Infrastructure";
        return (
          <StaggerItem
            key={group.category}
            className={cn("flex flex-col rounded-xl border border-hairline bg-surface-soft p-2", meta.span, wide && "md:col-span-2")}
          >
            <div className={cn("flex gap-4 px-4 pb-4 pt-4", meta.span.includes("col-span-6") ? "flex-col sm:flex-row sm:items-start sm:justify-between" : "flex-col")}>
              <div className="flex items-center gap-2.5">
                <span className="grid h-8 w-8 place-items-center rounded-md border border-hairline bg-canvas text-ink">
                  <Icon className="h-4 w-4" />
                </span>
                <h3 className="text-heading-5 text-ink">{group.category}</h3>
              </div>
              <p className={cn("text-body-sm text-steel", meta.span.includes("col-span-6") ? "max-w-md sm:text-right" : "")}>{meta.blurb}</p>
            </div>
            <ul className={cn("mt-auto grid gap-2", meta.cols)}>
              {group.items.map((item) => (
                <li key={item.slug} className="flex">
                  <Link
                    href={item.href}
                    className="group flex w-full flex-col rounded-lg border border-hairline bg-canvas p-4 transition-[border-color,box-shadow,transform] duration-200 ease-out hover:-translate-y-0.5 hover:border-stone/40 hover:shadow-card"
                  >
                    <span className="flex items-start justify-between gap-3">
                      <span className="text-body-md font-medium text-ink">{item.name}</span>
                      <ArrowUpRight
                        className="mt-0.5 h-4 w-4 shrink-0 text-muted transition-[transform,color] duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-ink"
                        aria-hidden="true"
                      />
                    </span>
                    <span className="mt-0.5 font-mono text-micro text-stone">{item.packageName}</span>
                    <span className="mt-2.5 line-clamp-2 text-body-sm text-steel">{item.description}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </StaggerItem>
        );
      })}
    </Stagger>
  );
}
