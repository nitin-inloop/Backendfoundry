/**
 * <Logo> — the BackendFoundry mark: three outlined blocks and one solid mint block ("built in blocks").
 * Props: withWordmark?: boolean (default true), tone?: "light" | "dark" (dark = for dark bands), className?
 */
import { cn } from "../ui/cn";

export function LogoMark({ className, tone = "light" }: { className?: string; tone?: "light" | "dark" }) {
  const stroke = "currentColor";
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={cn("h-[22px] w-[22px]", tone === "dark" ? "text-on-dark" : "text-ink", className)}
      fill="none"
    >
      <rect x="2.75" y="2.75" width="8" height="8" rx="2" stroke={stroke} strokeWidth="1.5" />
      <rect x="13.25" y="2.75" width="8" height="8" rx="2" stroke={stroke} strokeWidth="1.5" />
      <rect x="2.75" y="13.25" width="8" height="8" rx="2" stroke={stroke} strokeWidth="1.5" />
      <rect x="12.5" y="12.5" width="9.5" height="9.5" rx="2.25" fill="#00d4a4" />
    </svg>
  );
}

export function Logo({
  withWordmark = true,
  tone = "light",
  className
}: {
  withWordmark?: boolean;
  tone?: "light" | "dark";
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark tone={tone} />
      {withWordmark && (
        <span className={cn("text-[16px] font-semibold tracking-[-0.3px]", tone === "dark" ? "text-on-dark" : "text-ink")}>
          BackendFoundry
        </span>
      )}
    </span>
  );
}
