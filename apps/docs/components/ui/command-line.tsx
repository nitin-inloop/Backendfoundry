/**
 * <CommandLine> — a one-line copyable shell command.
 * Props:
 *   command: string             e.g. "npx @backendfoundry/cli add rate-limit"
 *   prompt?: string             leading prompt glyph (default "$"); pass "" to hide
 *   size?: "sm" | "md"          (default "md" = 44px tall)
 *   tone?: "light" | "dark"     light = surface chip with hairline (default); dark = surface-code
 *   className?: string
 *
 * <InlineCode> — DESIGN: code-inline. Mono chip for identifiers inside running text.
 *   Props: children, className?
 */
import type { ReactNode } from "react";
import { CopyButton } from "./copy-button";
import { cn } from "./cn";

export interface CommandLineProps {
  command: string;
  prompt?: string;
  size?: "sm" | "md";
  tone?: "light" | "dark";
  className?: string;
}

export function CommandLine({ command, prompt = "$", size = "md", tone = "light", className }: CommandLineProps) {
  const dark = tone === "dark";
  return (
    <div
      className={cn(
        "flex max-w-full items-center gap-3 rounded-md border font-mono",
        dark ? "border-hairline-dark bg-surface-code text-on-dark" : "border-hairline bg-surface-soft text-charcoal",
        size === "md" ? "h-11 pl-4 pr-1.5 text-[13.5px]" : "h-9 pl-3 pr-1 text-[12.5px]",
        className
      )}
    >
      <code className="bf-bare scrollbar-none min-w-0 flex-1 overflow-x-auto whitespace-nowrap py-1">
        {prompt && (
          <span aria-hidden="true" className={cn("mr-2.5 select-none", dark ? "text-brand-green" : "text-brand-green-deep")}>
            {prompt}
          </span>
        )}
        {command}
      </code>
      <CopyButton value={command} tone={dark ? "dark" : "light"} label={`Copy command: ${command}`} />
    </div>
  );
}

export function InlineCode({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <code
      className={cn(
        "bf-bare rounded-xs border border-hairline bg-surface px-1.5 py-px font-mono text-[0.84em] font-medium text-charcoal",
        className
      )}
    >
      {children}
    </code>
  );
}
