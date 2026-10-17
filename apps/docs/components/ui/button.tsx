/**
 * <Button> — DESIGN: button-primary / button-secondary / button-accent-green / button-ghost / button-on-dark.
 * Props:
 *   variant?: "primary" | "secondary" | "accent" | "ghost" | "on-dark" | "outline"
 *             (default "primary"; "outline" is an alias of "secondary")
 *             primary  = black pill            secondary = hairline-outlined pill
 *             accent   = brand-green pill      ghost     = quiet 8px-radius text button
 *             on-dark  = white pill for dark bands
 *   size?: "sm" | "md"   (default "md" = 40px tall; sm = 32px)
 *   href?: string        renders a Next <Link> (internal) or <a> (http/mailto) instead of <button>
 *   external?: boolean   force target=_blank rel=noreferrer on links
 *   ...native button / anchor attributes
 * Also exported: buttonClasses(variant, size, className) for styling other elements as buttons.
 */
import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

export type ButtonVariant = "primary" | "secondary" | "accent" | "ghost" | "on-dark" | "outline";
export type ButtonSize = "sm" | "md";

const base =
  "inline-flex select-none items-center justify-center gap-2 whitespace-nowrap font-medium transition-[background-color,border-color,color,box-shadow,transform] duration-150 ease-out active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-green disabled:pointer-events-none disabled:bg-hairline disabled:text-muted [&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0";

const secondary =
  "rounded-full border border-hairline bg-canvas/70 text-ink backdrop-blur-sm hover:border-stone/60 hover:bg-canvas";

const variants: Record<ButtonVariant, string> = {
  primary: "rounded-full bg-primary text-on-primary shadow-subtle hover:bg-slate active:bg-charcoal",
  secondary,
  outline: secondary,
  accent: "rounded-full bg-brand-green text-primary hover:bg-brand-green-soft active:bg-brand-green-deep",
  ghost: "rounded-md bg-transparent text-ink hover:bg-surface",
  "on-dark": "rounded-full bg-on-dark text-primary hover:bg-white/85"
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-8 px-3.5 text-[13px]",
  md: "h-10 px-5 text-body-sm"
};
const ghostSizes: Record<ButtonSize, string> = {
  sm: "h-8 px-2.5 text-[13px]",
  md: "h-9 px-3 text-body-sm"
};

interface CommonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  children?: ReactNode;
}

export type ButtonProps = CommonProps &
  (
    | ({ href: string; external?: boolean } & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href" | "className" | "children">)
    | ({ href?: undefined; external?: never } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children">)
  );

export function buttonClasses(variant: ButtonVariant = "primary", size: ButtonSize = "md", className?: string): string {
  return cn(base, variants[variant], variant === "ghost" ? ghostSizes[size] : sizes[size], className);
}

export function Button(props: ButtonProps) {
  const { variant = "primary", size = "md", className, children } = props;
  const classes = buttonClasses(variant, size, className);

  if (typeof props.href === "string") {
    const { href, external, variant: _v, size: _s, className: _c, children: _ch, ...rest } = props;
    const isExternal = external ?? /^(https?:|mailto:)/.test(href);
    if (isExternal) {
      return (
        <a href={href} target="_blank" rel="noreferrer" className={classes} {...rest}>
          {children}
        </a>
      );
    }
    return (
      <Link href={href} className={classes} {...rest}>
        {children}
      </Link>
    );
  }

  const { variant: _v, size: _s, className: _c, children: _ch, href: _h, external: _e, ...rest } = props;
  return (
    <button type="button" className={classes} {...rest}>
      {children}
    </button>
  );
}
