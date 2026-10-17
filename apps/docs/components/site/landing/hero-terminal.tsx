"use client";

import { Check, Copy, Terminal as TerminalIcon } from "lucide-react";
import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "../../ui/cn";

export function HeroTerminal({ className }: { className?: string }) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const reduce = useReducedMotion();

  const fullSnippet = `# copy components (source + TypeScript) into your app
npx @backendfoundry/cli add rate-limit idempotency validation

# or install the package
pnpm add @backendfoundry/rate-limit @backendfoundry/idempotency`;

  async function handleCopy(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      const el = document.createElement("textarea");
      el.value = text;
      el.setAttribute("readonly", "");
      el.style.position = "absolute";
      el.style.left = "-9999px";
      document.body.appendChild(el);
      el.select();
      try {
        document.execCommand("copy");
        setCopiedKey(key);
        setTimeout(() => setCopiedKey(null), 2000);
      } finally {
        document.body.removeChild(el);
      }
    }
  }

  return (
    <div
      className={cn(
        "group relative w-full overflow-hidden rounded-2xl border border-white/10 bg-[#090d14]/85 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.85),0_0_35px_-8px_rgba(0,212,164,0.15)] backdrop-blur-xl transition-all duration-300 hover:border-white/20",
        className
      )}
    >
      {/* Top subtle highlight reflection border */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent"
      />

      {/* Terminal Titlebar */}
      <div className="flex h-11 items-center justify-between border-b border-white/10 px-4 text-xs">
        <div className="flex items-center gap-2 font-mono text-zinc-300">
          <TerminalIcon className="h-3.5 w-3.5 text-brand-green" aria-hidden="true" />
          <span className="font-medium tracking-wide">terminal</span>
        </div>

        <button
          type="button"
          onClick={() => handleCopy(fullSnippet, "all")}
          className="flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-2.5 py-1 font-mono text-[11px] text-zinc-400 transition-colors hover:border-white/20 hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-green"
          aria-label={copiedKey === "all" ? "Copied all commands" : "Copy commands"}
        >
          {copiedKey === "all" ? (
            <>
              <Check className="h-3.5 w-3.5 text-brand-green" aria-hidden="true" />
              <span className="text-brand-green">Copied</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Terminal Body */}
      <div className="p-5 font-mono text-[13px] leading-[1.8] sm:p-6 sm:text-[13.5px]">
        {/* Block 1: CLI Add Source */}
        <div className="group/line relative">
          <p className="select-none text-zinc-500 italic">
            # copy components (source + TypeScript) into your app
          </p>
          <div className="mt-1 flex items-center justify-between gap-2">
            <p className="text-zinc-100">
              <span className="select-none text-brand-green font-semibold mr-2.5">&gt;</span>
              npx <span className="text-brand-green-soft">@backendfoundry/cli</span> add rate-limit idempotency validation
            </p>
            <button
              type="button"
              onClick={() => handleCopy("npx @backendfoundry/cli add rate-limit idempotency validation", "cli")}
              className="opacity-0 transition-opacity group-hover/line:opacity-100 rounded p-1 text-zinc-400 hover:text-white"
              title="Copy CLI command"
              aria-label="Copy CLI command"
            >
              {copiedKey === "cli" ? (
                <Check className="h-3.5 w-3.5 text-brand-green" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        </div>

        {/* Spacer */}
        <div className="my-5 border-t border-white/[0.06]" />

        {/* Block 2: Package Manager Install */}
        <div className="group/line relative">
          <p className="select-none text-zinc-500 italic">
            # or install the package
          </p>
          <div className="mt-1 flex items-center justify-between gap-2">
            <p className="text-zinc-100">
              <span className="select-none text-brand-green font-semibold mr-2.5">&gt;</span>
              pnpm add <span className="text-brand-green-soft">@backendfoundry/rate-limit</span> @backendfoundry/idempotency
            </p>
            <button
              type="button"
              onClick={() => handleCopy("pnpm add @backendfoundry/rate-limit @backendfoundry/idempotency", "pnpm")}
              className="opacity-0 transition-opacity group-hover/line:opacity-100 rounded p-1 text-zinc-400 hover:text-white"
              title="Copy package command"
              aria-label="Copy package command"
            >
              {copiedKey === "pnpm" ? (
                <Check className="h-3.5 w-3.5 text-brand-green" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
