"use client";
/**
 * Results side of the playground: error banner, animated summary tiles, and the
 * Timeline / JSON / Logs / Code tabs.
 */
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { AnimatePresence, animate, motion, useReducedMotion } from "motion/react";
import { AlertTriangle, Clock, Server } from "lucide-react";
import { CodeBlock } from "@/components/ui";
import type { ScenarioResult, SummaryItem, Tone } from "../../lib/playground/types";
import { cn } from "../../lib/cn";
import type { ScenarioState } from "./use-scenario";
import { ScenarioTimeline } from "./visualizations";

const TONE_TEXT: Record<Tone, string> = {
  good: "text-brand-green-deep",
  bad: "text-brand-error",
  warn: "text-brand-warn",
  neutral: "text-ink"
};

const TONE_BAR: Record<Tone, string> = {
  good: "bg-brand-green",
  bad: "bg-brand-error",
  warn: "bg-brand-warn",
  neutral: "bg-transparent"
};

/* ---------------------------------------------------------------- tiles */

function CountUp({ value }: { value: number }) {
  const reduce = useReducedMotion();
  const [display, setDisplay] = useState(reduce ? value : 0);
  const prev = useRef(0);
  useEffect(() => {
    if (reduce) {
      setDisplay(value);
      return;
    }
    const controls = animate(prev.current, value, {
      duration: Math.min(0.9, 0.35 + Math.log10(Math.abs(value) + 1) * 0.2),
      ease: [0.2, 0.8, 0.2, 1],
      onUpdate: (v) => setDisplay(v)
    });
    prev.current = value;
    return () => controls.stop();
  }, [value, reduce]);
  const decimals = Number.isInteger(value) ? 0 : 2;
  return <>{display.toFixed(decimals)}</>;
}

function StatTile({ item, index, runKey }: { item: SummaryItem; index: number; runKey: number }) {
  const reduce = useReducedMotion();
  const tone = item.tone ?? "neutral";
  const v = item.value;
  const text = typeof v === "boolean" ? (v ? "yes" : "no") : String(v);
  return (
    <motion.div
      key={`${runKey}-${item.label}`}
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: reduce ? 0 : index * 0.05, type: "spring", stiffness: 380, damping: 30 }}
      className="relative min-w-0 overflow-hidden rounded-lg border border-hairline bg-canvas px-3.5 py-3"
    >
      <span aria-hidden="true" className={cn("absolute inset-x-0 top-0 h-0.5", TONE_BAR[tone])} />
      <dt className="truncate text-[12px] text-stone">{item.label}</dt>
      <dd
        className={cn("mt-1 truncate font-mono font-semibold tabular-nums", typeof v === "number" ? "text-[20px] leading-[28px]" : "text-[14px] leading-[28px]", TONE_TEXT[tone])}
        title={text}
      >
        {typeof v === "number" ? <CountUp value={v} /> : text}
      </dd>
    </motion.div>
  );
}

export function SummaryTiles({ result, runKey, columns = 4 }: { result: ScenarioResult; runKey: number; columns?: 2 | 4 }) {
  return (
    <dl className={cn("grid grid-cols-2 gap-2", columns === 4 && "xl:grid-cols-4", result.summary.length === 5 && columns === 4 && "xl:grid-cols-5")}>
      {result.summary.map((s, i) => (
        <StatTile key={`${runKey}-${s.label}`} item={s} index={i} runKey={runKey} />
      ))}
    </dl>
  );
}

function SkeletonTiles() {
  return (
    <div className="grid grid-cols-2 gap-2 xl:grid-cols-4" aria-hidden="true">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="h-[66px] animate-pulse rounded-lg border border-hairline-soft bg-surface-soft motion-reduce:animate-none" />
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------- tabs */

type OutputTab = "timeline" | "json" | "logs" | "code";
const TAB_LABEL: Record<OutputTab, string> = { timeline: "Timeline", json: "JSON", logs: "Logs", code: "Code" };

function OutputTabs({ result, runKey }: { result: ScenarioResult; runKey: number }) {
  const [tab, setTab] = useState<OutputTab>("timeline");
  const id = useId();
  const reduce = useReducedMotion();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const tabs: OutputTab[] = ["timeline", "json", "logs", "code"];

  const onKey = (e: KeyboardEvent<HTMLButtonElement>, idx: number) => {
    const delta = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    const next = (idx + delta + tabs.length) % tabs.length;
    setTab(tabs[next]!);
    refs.current[next]?.focus();
  };

  return (
    <div>
      <div role="tablist" aria-label="Scenario output" className="flex gap-1 border-b border-hairline">
        {tabs.map((t, idx) => {
          const active = t === tab;
          const count = t === "timeline" ? result.timeline.length : t === "logs" ? result.logs.length : null;
          return (
            <button
              key={t}
              ref={(el) => {
                refs.current[idx] = el;
              }}
              id={`${id}-${t}`}
              role="tab"
              type="button"
              aria-selected={active}
              aria-controls={`${id}-panel`}
              tabIndex={active ? 0 : -1}
              onClick={() => setTab(t)}
              onKeyDown={(e) => onKey(e, idx)}
              className={cn(
                "relative -mb-px flex items-center gap-1.5 px-3 py-2.5 text-[14px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-green",
                active ? "text-ink" : "text-steel hover:text-ink"
              )}
            >
              {TAB_LABEL[t]}
              {count !== null && count > 0 && <span className="rounded-full bg-surface px-1.5 font-mono text-[11px] text-stone">{count}</span>}
              {active && (
                <motion.span
                  layoutId={`${id}-tab-underline`}
                  className="absolute inset-x-0 bottom-0 h-0.5 bg-ink"
                  transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 40 }}
                  aria-hidden="true"
                />
              )}
            </button>
          );
        })}
      </div>
      <div id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-${tab}`} className="pt-4">
        {tab === "timeline" && <ScenarioTimeline key={runKey} result={result} />}
        {tab === "json" && (
          <div className="max-h-[560px] overflow-auto rounded-md">
            <CodeBlock code={JSON.stringify(result.output, null, 2)} language="json" filename="response.json" />
          </div>
        )}
        {tab === "logs" &&
          (result.logs.length ? (
            <div className="max-h-[560px] overflow-auto rounded-md">
              <CodeBlock code={result.logs.join("\n")} language="text" filename="stdout" />
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-hairline px-4 py-8 text-center text-[13px] text-stone">
              This scenario writes no log lines. Its events are in the Timeline tab.
            </p>
          ))}
        {tab === "code" && <CodeBlock code={result.code} language="ts" filename="equivalent.ts" showLineNumbers />}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- panel */

export function ErrorBanner({ error }: { error: NonNullable<ScenarioState["error"]> }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      role="alert"
      initial={reduce ? false : { opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="flex items-start gap-3 rounded-lg border border-brand-error/30 bg-brand-error/[0.06] px-4 py-3"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-brand-error" aria-hidden="true" />
      <div className="min-w-0 text-[13px] leading-[1.5]">
        <p className="font-medium text-ink">
          {error.code === "INVALID_INPUT" || error.code === "INVALID_JSON"
            ? "Check the highlighted input"
            : error.code === "NETWORK"
              ? "The run did not reach the server"
              : "The scenario failed"}
          {error.code && <span className="ml-2 rounded-xs bg-brand-error/10 px-1.5 py-0.5 font-mono text-[11px] text-brand-error">{error.code}</span>}
        </p>
        <p className="mt-0.5 break-words text-steel">{error.message}</p>
      </div>
    </motion.div>
  );
}

export function ResultsPanel({ state, tileColumns = 4 }: { state: ScenarioState; tileColumns?: 2 | 4 }) {
  const { result, error, loading, runCount } = state;
  return (
    <div className="min-w-0 space-y-4" aria-busy={loading}>
      <AnimatePresence>{error && <ErrorBanner key="err" error={error} />}</AnimatePresence>

      {!result ? (
        loading ? (
          <div className="space-y-4">
            <SkeletonTiles />
            <div className="h-56 animate-pulse rounded-lg border border-hairline-soft bg-surface-soft motion-reduce:animate-none" />
            <p className="sr-only" aria-live="polite">
              Running the scenario
            </p>
          </div>
        ) : (
          !error && (
            <div className="flex min-h-[240px] flex-col items-center justify-center rounded-lg border border-dashed border-hairline px-6 text-center">
              <p className="text-[14px] font-medium text-ink">Nothing has run yet</p>
              <p className="mt-1 text-[13px] text-steel">Press Run to execute the scenario with these inputs.</p>
            </div>
          )
        )
      ) : (
        <div className={cn("space-y-4 transition-opacity duration-200", loading && "opacity-50")}>
          <SummaryTiles result={result} runKey={runCount} columns={tileColumns} />
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-stone" aria-live="polite">
            <span className="inline-flex items-center gap-1.5">
              <Server className="h-3.5 w-3.5" aria-hidden="true" />
              Run {runCount} finished in <span className="font-mono text-steel">{result.durationMs}ms</span> on the server
            </span>
            {result.simulatedClock && (
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                Simulated clock
              </span>
            )}
          </div>
          <OutputTabs key={result.slug} result={result} runKey={runCount} />
        </div>
      )}
    </div>
  );
}
