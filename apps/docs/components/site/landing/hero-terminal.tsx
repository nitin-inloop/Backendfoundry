"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { cn } from "../../ui/cn";

export function HeroTerminal({ className }: { className?: string }) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

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
        "group relative w-full overflow-hidden rounded-xl border border-white/10 bg-[#000000] shadow-[0_20px_50px_-12px_rgba(0,0,0,0.95)] transition-all duration-300 hover:border-white/20",
        className
      )}
    >
      {/* Top subtle highlight reflection border */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"
      />

      {/* Terminal Titlebar */}
      <div className="flex h-10 items-center justify-between border-b border-white/[0.08] px-4 text-xs">
        <div className="flex items-center gap-2 font-mono text-zinc-400">
          <span className="text-zinc-500 font-semibold">&gt;_</span>
          <span className="font-medium tracking-normal text-zinc-300">terminal</span>
        </div>

        <button
          type="button"
          onClick={() => handleCopy(fullSnippet, "all")}
          className="flex items-center gap-1.5 rounded p-1 text-zinc-400 transition-colors hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-green"
          aria-label={copiedKey === "all" ? "Copied all commands" : "Copy commands"}
          title={copiedKey === "all" ? "Copied!" : "Copy"}
        >
          {copiedKey === "all" ? (
            <Check className="h-3.5 w-3.5 text-brand-green" aria-hidden="true" />
          ) : (
            <Copy className="h-3.5 w-3.5" aria-hidden="true" />
          )}
        </button>
      </div>

      {/* Terminal Body */}
      <div className="p-4 sm:p-5 font-mono text-[12px] sm:text-[12.5px] leading-[1.75]">
        {/* Block 1: CLI Add Source */}
        <div className="group/line relative">
          <p className="select-none text-zinc-500 italic">
            # copy components (source + TypeScript) into your app
          </p>
          <div className="mt-1 flex items-center justify-between gap-2 overflow-x-auto scrollbar-none">
            <p className="whitespace-nowrap text-zinc-200">
              npx @backendfoundry/cli add rate-limit idempotency validation
            </p>
            <button
              type="button"
              onClick={() => handleCopy("npx @backendfoundry/cli add rate-limit idempotency validation", "cli")}
              className="shrink-0 opacity-0 transition-opacity group-hover/line:opacity-100 rounded p-1 text-zinc-400 hover:text-white"
              title="Copy command"
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
        <div className="my-3.5" />

        {/* Block 2: Package Manager Install */}
        <div className="group/line relative">
          <p className="select-none text-zinc-500 italic">
            # or install the package
          </p>
          <div className="mt-1 flex items-center justify-between gap-2 overflow-x-auto scrollbar-none">
            <p className="whitespace-nowrap text-zinc-200">
              pnpm add @backendfoundry/rate-limit @backendfoundry/idempotency
            </p>
            <button
              type="button"
              onClick={() => handleCopy("pnpm add @backendfoundry/rate-limit @backendfoundry/idempotency", "pnpm")}
              className="shrink-0 opacity-0 transition-opacity group-hover/line:opacity-100 rounded p-1 text-zinc-400 hover:text-white"
              title="Copy command"
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
