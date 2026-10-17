"use client";
/**
 * <CliTerminal> — tabbed terminal showing real `@backendfoundry/cli` sessions. Output lines are the
 * strings the CLI prints; they reveal line by line when a tab is chosen (instant under reduced motion).
 */
import { motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { CopyButton } from "../../ui/copy-button";
import { cn } from "../../ui/cn";

type Tone = "ok" | "add" | "dim" | "plain" | "head";

interface Session {
  id: string;
  label: string;
  command: string;
  output: { text: string; tone?: Tone }[];
}

const SESSIONS: Session[] = [
  {
    id: "source",
    label: "Copy source",
    command: "npx @backendfoundry/cli add retry",
    output: [
      { text: "✔ Detected pnpm and TypeScript 5.6.2", tone: "ok" },
      { text: "✔ Resolved retry + core, errors", tone: "ok" },
      { text: "✔ No conflicts in src/lib/backendfoundry", tone: "ok" },
      { text: "Added to src/lib/backendfoundry:" },
      { text: "  + src/lib/backendfoundry/core.ts [created] (dependency)", tone: "add" },
      { text: "  + src/lib/backendfoundry/errors.ts [created] (dependency)", tone: "add" },
      { text: "  + src/lib/backendfoundry/retry.ts [created]", tone: "add" },
      { text: "3 files written. 0 runtime dependencies added." },
      { text: "" },
      { text: 'Import from "./src/lib/backendfoundry/retry" (Node.js runtime required).', tone: "dim" }
    ]
  },
  {
    id: "npm",
    label: "Install package",
    command: "npx @backendfoundry/cli add rate-limit --npm --install",
    output: [
      { text: "$ pnpm add @backendfoundry/rate-limit", tone: "dim" },
      { text: "Packages: +3", tone: "plain" },
      { text: "dependencies:" },
      { text: "+ @backendfoundry/rate-limit 1.0.0", tone: "add" },
      { text: "" },
      { text: "Done in 1.8s", tone: "ok" }
    ]
  },
  {
    id: "list",
    label: "List",
    command: "npx @backendfoundry/cli list",
    output: [
      { text: "BackendFoundry components (12)", tone: "head" },
      { text: "" },
      { text: "Foundation", tone: "head" },
      { text: "  core              @backendfoundry/core              Shared TypeScript types, FoundryError base class, request ID generation/validati", tone: "plain" },
      { text: "  errors            @backendfoundry/errors            Typed HTTP application errors, machine-readable error categories, credential-scr", tone: "plain" },
      { text: "" },
      { text: "Security & Validation", tone: "head" },
      { text: "  validation        @backendfoundry/validation        Typed schema validation for request bodies, query strings, and route parameters", tone: "plain" },
      { text: "  rate-limit        @backendfoundry/rate-limit        Sliding-window and fixed-window rate limiting with standard IETF/X-RateLimit hea", tone: "plain" },
      { text: "  webhooks          @backendfoundry/webhooks          HMAC-SHA256 webhook signing, constant-time signature verification, timestamp rep", tone: "plain" },
      { text: "  ...", tone: "dim" }
    ]
  },
  {
    id: "info",
    label: "Info",
    command: "npx @backendfoundry/cli info idempotency",
    output: [
      { text: "Idempotency Keys (@backendfoundry/idempotency@1.0.0)", tone: "head" },
      { text: "Category: State & Caching", tone: "dim" },
      { text: "" },
      { text: "Install" },
      { text: "  pnpm add @backendfoundry/idempotency", tone: "plain" },
      { text: "  npx @backendfoundry/cli add idempotency   # copy source into your project", tone: "plain" },
      { text: "" },
      { text: "Dependencies: core, errors", tone: "plain" },
      { text: "Frameworks:   Express, Fastify, Next.js Route Handlers, Node.js HTTP", tone: "plain" }
    ]
  }
];

const toneClass: Record<Tone, string> = {
  ok: "text-brand-green",
  add: "text-brand-green-soft",
  dim: "text-[#8a8a90]",
  plain: "text-[#d6d6da]",
  head: "font-medium text-on-dark"
};

export function CliTerminal() {
  const [active, setActive] = useState(SESSIONS[0]!.id);
  const reduce = useReducedMotion();
  const session = SESSIONS.find((s) => s.id === active)!;

  return (
    <div className="overflow-hidden rounded-xl border border-hairline-dark bg-surface-code shadow-mockup">
      <div role="tablist" aria-label="CLI commands" className="scrollbar-none flex gap-1 overflow-x-auto border-b border-hairline-dark px-2 pt-2">
        {SESSIONS.map((s) => {
          const selected = s.id === active;
          return (
            <button
              key={s.id}
              role="tab"
              type="button"
              aria-selected={selected}
              aria-controls="cli-panel"
              onClick={() => setActive(s.id)}
              onKeyDown={(e) => {
                const i = SESSIONS.findIndex((x) => x.id === s.id);
                if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                  e.preventDefault();
                  const next = SESSIONS[(i + (e.key === "ArrowRight" ? 1 : -1) + SESSIONS.length) % SESSIONS.length]!;
                  setActive(next.id);
                  (e.currentTarget.parentElement?.querySelectorAll("[role=tab]")[SESSIONS.indexOf(next)] as HTMLElement | undefined)?.focus();
                }
              }}
              tabIndex={selected ? 0 : -1}
              className={cn(
                "relative whitespace-nowrap px-3 pb-2.5 pt-1.5 text-caption font-medium transition-colors",
                selected ? "text-on-dark" : "text-on-dark-muted hover:text-on-dark"
              )}
            >
              {s.label}
              {selected && (
                <motion.span
                  layoutId="cli-tab"
                  aria-hidden="true"
                  className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-brand-green"
                  transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 40 }}
                />
              )}
            </button>
          );
        })}
      </div>
      <div id="cli-panel" role="tabpanel" aria-label={session.label} className="relative min-h-[300px] p-5 font-mono text-[12.5px] leading-[1.75]">
        <div className="absolute right-3 top-3">
          <CopyButton value={session.command} tone="dark" label={`Copy command: ${session.command}`} />
        </div>
        <p className="pr-10 text-on-dark">
          <span className="mr-2 select-none text-brand-green" aria-hidden="true">
            $
          </span>
          {session.command}
        </p>
        <div key={session.id} className="mt-2 overflow-x-auto">
          {session.output.map((line, i) => (
            <motion.p
              key={i}
              className={cn("whitespace-pre", toneClass[line.tone ?? "plain"])}
              initial={reduce ? false : { opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: reduce ? 0 : 0.25 + i * 0.07, duration: 0.2 }}
            >
              {line.text || "​"}
            </motion.p>
          ))}
          {!reduce && (
            <motion.span
              aria-hidden="true"
              className="mt-1 inline-block h-4 w-2 animate-blink bg-on-dark-muted align-middle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 + session.output.length * 0.07 }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
