/**
 * <Card> — DESIGN: card-base. White canvas, 1px hairline, 12px radius, flat.
 * Props:
 *   href?: string                 makes the whole card a Next <Link> with hover (lift + border) and focus states
 *   emphasis?: "none" | "featured" | "strong"
 *                                 featured = 2px brand-green border + brand-tinted glow (pricing-card-featured)
 *                                 strong   = surface background, no visible border (card-feature)
 *   padding?: "sm" | "md" | "lg" | "none" (default "md" = 24px; sm = 20px; lg = 32px)
 *   as?: "div" | "article" | "section" | "li"
 * Also exported: <CardTitle> (heading-5, ink), <CardDescription> (body-sm, steel).
 */
import Link from "next/link";
import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

export interface CardProps extends HTMLAttributes<HTMLElement> {
  href?: string;
  emphasis?: "none" | "featured" | "strong";
  padding?: "sm" | "md" | "lg" | "none";
  as?: "div" | "article" | "section" | "li";
}

const paddings = { none: "", sm: "p-5", md: "p-6", lg: "p-8" } as const;
const emphases = {
  none: "border border-hairline bg-canvas",
  featured: "border-2 border-brand-green bg-canvas shadow-brand",
  strong: "border border-transparent bg-surface"
} as const;

export function Card({ href, emphasis = "none", padding = "md", as = "div", className, children, ...rest }: CardProps) {
  const classes = cn("block rounded-lg text-charcoal", emphases[emphasis], paddings[padding], className);
  if (href) {
    return (
      <Link
        href={href}
        className={cn(
          classes,
          "group transition-[border-color,box-shadow,transform] duration-200 ease-out hover:-translate-y-0.5 hover:border-stone/40 hover:shadow-card focus-visible:border-brand-green"
        )}
      >
        {children}
      </Link>
    );
  }
  const Tag = as;
  return (
    <Tag className={classes} {...rest}>
      {children}
    </Tag>
  );
}

export function CardTitle({ className, children }: { className?: string; children: ReactNode }) {
  return <h3 className={cn("text-heading-5 text-ink", className)}>{children}</h3>;
}

export function CardDescription({ className, children }: { className?: string; children: ReactNode }) {
  return <p className={cn("mt-1.5 text-body-sm text-steel", className)}>{children}</p>;
}
