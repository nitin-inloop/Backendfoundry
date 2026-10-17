"use client";
/**
 * <ScenarioRunner> — one component's playground: registry-generated inputs, a Run
 * button (Ctrl/Cmd+Enter), and the animated results panel. Executes the real
 * @backendfoundry package via POST /api/playground/<slug>.
 *
 * Also exports the pieces (<InputsForm>, <RunButton>, <ShortcutHint>) that the
 * full-page <PlaygroundExplorer> composes into its app layout.
 */
import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check, Loader2, Play, RotateCcw } from "lucide-react";
import type { PlaygroundComponentSummary } from "../../lib/registry";
import { cn } from "../../lib/cn";
import { Field } from "./fields";
import { ResultsPanel } from "./results";
import { useScenario, type ScenarioState } from "./use-scenario";

export function useIsMac(): boolean {
  const [mac, setMac] = useState(false);
  useEffect(() => {
    setMac(/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent));
  }, []);
  return mac;
}

export function ShortcutHint({ className }: { className?: string }) {
  const mac = useIsMac();
  return (
    <span className={cn("hidden items-center gap-1 text-[12px] text-stone sm:inline-flex", className)}>
      <kbd className="rounded-xs border border-hairline bg-surface-soft px-1.5 font-mono text-[11px] leading-5 text-steel">{mac ? "⌘" : "Ctrl"}</kbd>
      <kbd className="rounded-xs border border-hairline bg-surface-soft px-1.5 font-mono text-[11px] leading-5 text-steel">Enter</kbd>
      <span className="ml-0.5">to run</span>
    </span>
  );
}

export function RunButton({ state, className }: { state: ScenarioState; className?: string }) {
  const reduce = useReducedMotion();
  const [flash, setFlash] = useState(false);
  const { runCount } = state;
  useEffect(() => {
    if (runCount === 0) return;
    setFlash(true);
    const t = window.setTimeout(() => setFlash(false), 900);
    return () => window.clearTimeout(t);
  }, [runCount]);

  return (
    <motion.button
      type="button"
      onClick={state.run}
      disabled={state.loading}
      whileTap={reduce ? undefined : { scale: 0.97 }}
      aria-label={state.loading ? "Running scenario" : "Run scenario"}
      className={cn(
        "inline-flex h-10 items-center justify-center gap-2 rounded-full bg-primary px-5 text-[14px] font-medium text-on-primary transition-colors hover:bg-charcoal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green focus-visible:ring-offset-2 disabled:cursor-progress",
        className
      )}
    >
      <span className="relative inline-flex h-4 w-4 items-center justify-center">
        <AnimatePresence mode="wait" initial={false}>
          {state.loading ? (
            <motion.span key="spin" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute">
              <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
            </motion.span>
          ) : flash ? (
            <motion.span key="ok" initial={reduce ? false : { scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }} className="absolute">
              <Check className="h-4 w-4 text-brand-green" strokeWidth={2.5} aria-hidden="true" />
            </motion.span>
          ) : (
            <motion.span key="play" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute">
              <Play className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
            </motion.span>
          )}
        </AnimatePresence>
      </span>
      {state.loading ? "Running" : "Run"}
    </motion.button>
  );
}

export function ResetButton({ state }: { state: ScenarioState }) {
  return (
    <button
      type="button"
      onClick={state.reset}
      disabled={state.loading}
      className="inline-flex h-10 items-center gap-1.5 rounded-full border border-hairline px-4 text-[14px] font-medium text-ink transition-colors hover:bg-surface disabled:opacity-50"
    >
      <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
      Reset
    </button>
  );
}

export function InputsForm({ state, idPrefix, columns = 1 }: { state: ScenarioState; idPrefix: string; columns?: 1 | 2 }) {
  const { def, values, set, jsonErrors, error } = state;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        state.run();
      }}
      className={cn("grid gap-x-5 gap-y-5", columns === 2 && "sm:grid-cols-2")}
      aria-label={`${def.title} inputs`}
    >
      {def.inputs.map((input) => (
        <Field
          key={input.key}
          input={input}
          value={values[input.key] ?? input.default}
          onChange={(v) => set(input.key, v)}
          error={jsonErrors[input.key] ?? (error?.field === input.key ? error.message : undefined)}
          idPrefix={idPrefix}
          compact={columns === 1}
        />
      ))}
      <button type="submit" className="sr-only" tabIndex={-1}>
        Run
      </button>
    </form>
  );
}

/** Embedded runner used on /packages/[slug]. */
export function ScenarioRunner({
  component,
  autoRun = true,
  variant = "embedded"
}: {
  component: PlaygroundComponentSummary;
  autoRun?: boolean;
  variant?: "embedded";
}) {
  const state = useScenario(component, { autoRun });
  return (
    <div
      data-variant={variant}
      className="overflow-hidden rounded-lg border border-hairline bg-canvas"
      onKeyDown={(e) => {
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          state.run();
        }
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline-soft bg-surface-soft px-5 py-3.5">
        <div className="min-w-0">
          <p className="text-[15px] font-semibold text-ink">{component.playground.title}</p>
          <p className="mt-0.5 font-mono text-[12px] text-stone">POST {state.endpoint}</p>
        </div>
        <div className="flex items-center gap-3">
          <ShortcutHint />
          <RunButton state={state} />
        </div>
      </div>
      <div className="border-b border-hairline-soft px-5 py-5">
        <p className="mb-5 max-w-[68ch] text-[14px] leading-[1.5] text-steel">{component.playground.description}</p>
        <InputsForm state={state} idPrefix={`emb-${component.slug}`} columns={2} />
        <div className="mt-5 flex items-center gap-3">
          <ResetButton state={state} />
          <a href={`/playground?component=${component.slug}`} className="text-[13px] font-medium text-steel underline-offset-4 hover:text-ink hover:underline">
            Open full playground
          </a>
        </div>
      </div>
      <div className="bg-surface-soft/60 px-5 py-5">
        <ResultsPanel state={state} tileColumns={4} />
      </div>
    </div>
  );
}
