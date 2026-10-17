/**
 * Layout primitives.
 *   <Container>       centred 1280px column with responsive gutters (20px mobile, 32px desktop).
 *                     Props: className?, children
 *   <Section>         vertical marketing band (64px mobile / 96px desktop padding).
 *                     Props: id?, divider?: "none" | "hairline" | "dashed" | "green" (default "none";
 *                     "dashed" is kept as an alias of "hairline"), tone?: "canvas" | "surface" (default "canvas"),
 *                     className?, containerClassName?, labelledBy?
 *   <SectionHeading>  optional eyebrow + heading + lead paragraph.
 *                     Props: eyebrow?, title, description?, align?: "left" | "center",
 *                     as?: "h1" | "h2" (h1 = heading-1 48px, h2 = heading-2 36px), id?, className?
 *   <Eyebrow>         small brand-green-dot label above a heading (sentence case, 13px medium).
 */
import type { ReactNode } from "react";
import { cn } from "./cn";

export function Container({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("mx-auto w-full max-w-container px-5 sm:px-8", className)}>{children}</div>;
}

export interface SectionProps {
  id?: string;
  divider?: "none" | "hairline" | "dashed" | "green";
  tone?: "canvas" | "surface";
  className?: string;
  containerClassName?: string;
  labelledBy?: string;
  children: ReactNode;
}

export function Section({
  id,
  divider = "none",
  tone = "canvas",
  className,
  containerClassName,
  labelledBy,
  children
}: SectionProps) {
  return (
    <section
      id={id}
      aria-labelledby={labelledBy}
      className={cn(
        "py-16 md:py-24",
        tone === "surface" ? "bg-surface-soft" : "bg-canvas",
        (divider === "hairline" || divider === "dashed") && "border-t border-hairline",
        divider === "green" && "border-t-2 border-brand-green",
        className
      )}
    >
      <Container className={containerClassName}>{children}</Container>
    </section>
  );
}

export function Eyebrow({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <p className={cn("inline-flex items-center gap-2 text-caption font-medium text-steel", className)}>
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-brand-green" />
      {children}
    </p>
  );
}

export interface SectionHeadingProps {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  align?: "left" | "center";
  as?: "h1" | "h2";
  id?: string;
  className?: string;
}

export function SectionHeading({ eyebrow, title, description, align = "left", as = "h2", id, className }: SectionHeadingProps) {
  const Heading = as;
  return (
    <div className={cn("max-w-2xl", align === "center" && "mx-auto text-center", className)}>
      {eyebrow && <Eyebrow className="mb-4">{eyebrow}</Eyebrow>}
      <Heading
        id={id}
        className={cn(
          "text-balance text-ink",
          as === "h1"
            ? "text-[36px] font-semibold leading-[1.1] tracking-[-1px] md:text-heading-1"
            : "text-[28px] font-semibold leading-[1.2] tracking-[-0.5px] md:text-heading-2"
        )}
      >
        {title}
      </Heading>
      {description && <p className="mt-4 text-pretty text-subtitle text-steel">{description}</p>}
    </div>
  );
}
