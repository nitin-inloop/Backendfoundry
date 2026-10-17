import Image from "next/image";
import { cn } from "../ui/cn";

export function LogoMark({ className, tone = "light" }: { className?: string; tone?: "light" | "dark" }) {
  return (
    <span
      className={cn(
        "relative inline-flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-lg shadow-sm border border-white/10 bg-white/5",
        className
      )}
    >
      <Image
        src="/logo.png"
        alt="BackendFoundry logo"
        width={28}
        height={28}
        className="h-full w-full object-cover"
        priority
      />
    </span>
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
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark tone={tone} />
      {withWordmark && (
        <span className={cn("text-[16px] font-semibold tracking-[-0.3px]", tone === "dark" ? "text-on-dark" : "text-ink")}>
          BackendFoundry
        </span>
      )}
    </span>
  );
}
