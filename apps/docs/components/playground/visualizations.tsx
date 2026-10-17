"use client";
/**
 * Scenario visualisations. Each one reads the generic ScenarioResult timeline
 * produced by lib/playground/runners.ts and renders a purpose-built view:
 * rate-limit bars, retry backoff track, circuit-breaker state machine, cache
 * hit/miss strip, health probe latencies, and an animated event log for all.
 * Every animation collapses to an instant render under prefers-reduced-motion.
 */
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Check, Pause, Play, RotateCcw, X, Zap } from "lucide-react";
import type { EventStatus, ScenarioResult, TimelineEvent } from "../../lib/playground/types";
import { cn } from "../../lib/cn";

export const STATUS_DOT: Record<EventStatus, string> = {
  ok: "bg-brand-green",
  error: "bg-brand-error",
  warn: "bg-brand-warn",
  info: "bg-muted"
};

const STATUS_TEXT: Record<EventStatus, string> = {
  ok: "text-ink",
  error: "text-brand-error",
  warn: "text-brand-warn",
  info: "text-steel"
};

function atMs(e: TimelineEvent): number | null {
  const m = /t\+(-?\d+(?:\.\d+)?)ms/.exec(e.at ?? "");
  return m ? Number(m[1]) : null;
}

function fmtMs(ms: number): string {
  if (ms >= 60_000) return `${+(ms / 60_000).toFixed(1)}m`;
  if (ms >= 1000) return `${+(ms / 1000).toFixed(2)}s`;
  return `${Math.round(ms)}ms`;
}

function Panel({ title, aside, children, className }: { title: string; aside?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <figure className={cn("rounded-lg border border-hairline bg-canvas", className)}>
      <figcaption className="flex flex-wrap items-center justify-between gap-2 border-b border-hairline-soft px-4 py-2.5">
        <span className="text-[13px] font-semibold text-ink">{title}</span>
        {aside && <span className="flex flex-wrap items-center gap-3 text-[12px] text-stone">{aside}</span>}
      </figcaption>
      <div className="p-4">{children}</div>
    </figure>
  );
}

function Legend({ items }: { items: [string, string][] }) {
  return (
    <>
      {items.map(([cls, label]) => (
        <span key={label} className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className={cn("h-2 w-2 rounded-full", cls)} />
          {label}
        </span>
      ))}
    </>
  );
}

/* ======================================================================== */
/* Rate limit: one bar per request, height = quota left after the request   */
/* ======================================================================== */

function RateLimitViz({ result }: { result: ScenarioResult }) {
  const reduce = useReducedMotion();
  const reqs = useMemo(
    () =>
      result.timeline.map((e, i) => {
        const allowed = e.status === "ok";
        const m = /remaining (\d+)\/(\d+)/.exec(e.detail ?? "");
        return { i, allowed, remaining: m ? Number(m[1]) : 0, limit: m ? Number(m[2]) : 0, at: atMs(e), e };
      }),
    [result]
  );
  const limit = Math.max(1, ...reqs.map((r) => r.limit), Number(result.inputs.limit) || 1);
  const [hover, setHover] = useState<number | null>(null);
  const focus = hover !== null ? reqs[hover] : null;
  const dense = reqs.length > 40;

  return (
    <Panel title="Requests over time" aside={<Legend items={[["bg-brand-green", "200 allowed"], ["bg-brand-error", "429 blocked"]]} />}>
      <div className="relative">
        {/* limit line */}
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center gap-2" aria-hidden="true">
          <span className="h-px flex-1 border-t border-dashed border-hairline" />
          <span className="font-mono text-[11px] text-stone">limit {limit}</span>
        </div>
        <div
          className={cn("flex h-40 items-end pt-5", dense ? "gap-px" : "gap-1")}
          role="img"
          aria-label={`${reqs.filter((r) => r.allowed).length} of ${reqs.length} requests allowed`}
          onMouseLeave={() => setHover(null)}
        >
          {reqs.map((r) => {
            const h = r.allowed ? Math.max(8, ((r.remaining + 1) / limit) * 100) : 100;
            return (
              <button
                key={r.i}
                type="button"
                onMouseEnter={() => setHover(r.i)}
                onFocus={() => setHover(r.i)}
                aria-label={r.e.label}
                className="group relative flex h-full min-w-[3px] flex-1 items-end focus-visible:outline-none"
              >
                <motion.span
                  className={cn(
                    "block w-full origin-bottom rounded-t-[3px]",
                    r.allowed && "bg-brand-green",
                    !r.allowed && "bg-[repeating-linear-gradient(135deg,transparent_0_3px,rgba(255,255,255,0.35)_3px_5px)]",
                    hover !== null && hover !== r.i && "opacity-40",
                    "transition-opacity group-focus-visible:ring-2 group-focus-visible:ring-ink"
                  )}
                  style={{ height: `${r.allowed ? h : 100}%`, backgroundColor: r.allowed ? undefined : "rgb(212 86 86 / 0.85)" }}
                  initial={reduce ? false : { scaleY: 0 }}
                  animate={{ scaleY: 1 }}
                  transition={reduce ? { duration: 0 } : { delay: Math.min(1.2, r.i * (1.2 / Math.max(reqs.length, 1))), type: "spring", stiffness: 380, damping: 26 }}
                />
              </button>
            );
          })}
        </div>
        <div className="mt-2 flex justify-between font-mono text-[11px] text-stone">
          <span>t+0ms</span>
          <span>{reqs.length ? reqs[reqs.length - 1]!.e.at : ""}</span>
        </div>
      </div>
      <div className="mt-3 min-h-[40px] rounded-md bg-surface-soft px-3 py-2 text-[12px] leading-[1.5]" aria-live="polite">
        {focus ? (
          <>
            <span className={cn("font-mono font-medium", focus.allowed ? "text-ink" : "text-brand-error")}>{focus.e.label}</span>
            <span className="ml-2 font-mono text-stone">{focus.e.at}</span>
            <p className="text-steel">{focus.e.detail}</p>
          </>
        ) : (
          <span className="text-stone">Bar height shows the quota left after each request. Hover a bar for its headers.</span>
        )}
      </div>
    </Panel>
  );
}

/* ======================================================================== */
/* Retry: attempts as nodes, backoff waits as proportional gaps             */
/* ======================================================================== */

type RetryStep = { kind: "attempt"; ok: boolean; n: number; e: TimelineEvent } | { kind: "wait"; ms: number; e: TimelineEvent };

function RetryViz({ result }: { result: ScenarioResult }) {
  const reduce = useReducedMotion();
  const steps: RetryStep[] = useMemo(
    () =>
      result.timeline.flatMap<RetryStep>((e) => {
        const a = /attempt (\d+) (failed|succeeded)/.exec(e.label);
        if (a) return [{ kind: "attempt", ok: a[2] === "succeeded", n: Number(a[1]), e }];
        const b = /backoff (\d+(?:\.\d+)?)ms/.exec(e.label);
        if (b) return [{ kind: "wait", ms: Number(b[1]), e }];
        return [];
      }),
    [result]
  );
  const waits = steps.filter((s): s is Extract<RetryStep, { kind: "wait" }> => s.kind === "wait");
  const total = waits.reduce((a, b) => a + b.ms, 0);
  const maxWait = Math.max(1, ...waits.map((w) => w.ms));

  if (steps.length === 0) return null;

  return (
    <Panel
      title="Attempts and backoff"
      aside={
        <>
          <Legend items={[["bg-brand-green", "succeeded"], ["bg-brand-error", "failed"]]} />
          <span className="font-mono">waited {fmtMs(total)}</span>
        </>
      }
    >
      <ol className="flex flex-col gap-0 sm:flex-row sm:items-center sm:overflow-x-auto sm:pb-2" aria-label="Retry sequence">
        {steps.map((s, idx) => {
          const delay = reduce ? 0 : idx * 0.22;
          if (s.kind === "attempt") {
            return (
              <motion.li
                key={idx}
                className="flex shrink-0 items-center gap-3 sm:flex-col sm:gap-1.5"
                initial={reduce ? false : { opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay, type: "spring", stiffness: 420, damping: 22 }}
              >
                <span
                  className={cn(
                    "relative inline-flex h-10 w-10 items-center justify-center rounded-full border-2",
                    s.ok ? "border-brand-green bg-brand-green/10 text-brand-green-deep" : "border-brand-error bg-brand-error/10 text-brand-error"
                  )}
                >
                  {s.ok ? <Check className="h-4 w-4" strokeWidth={2.5} /> : <X className="h-4 w-4" strokeWidth={2.5} />}
                  {s.ok && !reduce && (
                    <motion.span
                      className="absolute inset-0 rounded-full border-2 border-brand-green"
                      initial={{ opacity: 0.8, scale: 1 }}
                      animate={{ opacity: 0, scale: 1.7 }}
                      transition={{ delay: delay + 0.15, duration: 0.9, ease: "easeOut" }}
                      aria-hidden="true"
                    />
                  )}
                </span>
                <span className="text-left sm:text-center">
                  <span className="block text-[12px] font-medium text-ink">Attempt {s.n}</span>
                  <span className="block font-mono text-[11px] text-stone">{s.e.at}</span>
                </span>
              </motion.li>
            );
          }
          const w = 48 + (s.ms / maxWait) * 120;
          return (
            <li key={idx} className="flex shrink-0 items-center py-1 pl-[19px] sm:block sm:px-1 sm:py-0" style={{ ["--w" as string]: `${w}px` }}>
              {/* vertical on mobile, horizontal on sm+ */}
              <div className="flex items-center gap-3 sm:block">
                <div className="relative h-10 w-0.5 overflow-hidden bg-hairline sm:h-0.5 sm:w-[var(--w)]">
                  <motion.div
                    className="absolute inset-0 origin-top bg-ink/70 sm:origin-left"
                    initial={reduce ? false : { scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: delay - 0.1, duration: reduce ? 0 : 0.3, ease: "easeOut" }}
                  />
                </div>
                <motion.span
                  className="block font-mono text-[11px] text-steel sm:mt-1.5 sm:text-center"
                  initial={reduce ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: delay + 0.1 }}
                >
                  wait {fmtMs(s.ms)}
                </motion.span>
              </div>
            </li>
          );
        })}
      </ol>
    </Panel>
  );
}

/* ======================================================================== */
/* Circuit breaker: animated state machine with playback                   */
/* ======================================================================== */

type BreakerState = "CLOSED" | "OPEN" | "HALF_OPEN";
type Frame = { state: BreakerState; e: TimelineEvent; transition: boolean };

const STATE_META: Record<BreakerState, { label: string; hint: string; ring: string; fill: string; text: string }> = {
  CLOSED: { label: "Closed", hint: "Calls flow to the upstream", ring: "border-brand-green", fill: "bg-brand-green/10", text: "text-brand-green-deep" },
  OPEN: { label: "Open", hint: "Calls fail fast, upstream rests", ring: "border-brand-error", fill: "bg-brand-error/10", text: "text-brand-error" },
  HALF_OPEN: { label: "Half-open", hint: "Trial calls probe recovery", ring: "border-brand-warn", fill: "bg-brand-warn/10", text: "text-brand-warn" }
};

function CircuitViz({ result }: { result: ScenarioResult }) {
  const reduce = useReducedMotion();
  const frames: Frame[] = useMemo(() => {
    let state: BreakerState = "CLOSED";
    return result.timeline.map((e) => {
      const t = /^(CLOSED|OPEN|HALF_OPEN) → (CLOSED|OPEN|HALF_OPEN)$/.exec(e.label);
      if (t) state = t[2] as BreakerState;
      return { state, e, transition: !!t };
    });
  }, [result]);

  const [idx, setIdx] = useState(frames.length - 1);
  const [playing, setPlaying] = useState(false);

  // Auto-play each new result (instant final state under reduced motion).
  useEffect(() => {
    if (reduce || frames.length < 2) {
      setIdx(frames.length - 1);
      setPlaying(false);
      return;
    }
    setIdx(0);
    setPlaying(true);
  }, [frames, reduce]);

  useEffect(() => {
    if (!playing) return;
    if (idx >= frames.length - 1) {
      setPlaying(false);
      return;
    }
    const t = window.setTimeout(() => setIdx((i) => i + 1), frames[idx]?.transition ? 650 : 360);
    return () => window.clearTimeout(t);
  }, [playing, idx, frames]);

  const current = frames[Math.max(0, idx)];
  const state = current?.state ?? "CLOSED";
  const calls = frames.filter((f) => /^call \d+/.test(f.e.label));
  const shownUpTo = idx;

  const order: BreakerState[] = ["CLOSED", "OPEN", "HALF_OPEN"];

  return (
    <Panel
      title="Breaker state"
      aside={
        <span className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              if (idx >= frames.length - 1) setIdx(0);
              setPlaying((p) => !p);
            }}
            className="inline-flex h-7 items-center gap-1 rounded-full border border-hairline px-2.5 text-[12px] text-ink transition-colors hover:bg-surface"
            aria-label={playing ? "Pause replay" : "Replay sequence"}
          >
            {playing ? <Pause className="h-3 w-3" /> : idx >= frames.length - 1 ? <RotateCcw className="h-3 w-3" /> : <Play className="h-3 w-3" />}
            {playing ? "Pause" : idx >= frames.length - 1 ? "Replay" : "Play"}
          </button>
        </span>
      }
    >
      {/* State machine */}
      <div className="relative grid grid-cols-3 items-start gap-2" role="img" aria-label={`Current state ${STATE_META[state].label}`}>
        {order.map((s, i) => {
          const active = s === state;
          const meta = STATE_META[s];
          return (
            <div key={s} className="relative flex flex-col items-center text-center">
              {i < order.length - 1 && (
                <svg aria-hidden="true" className="absolute left-[calc(50%+30px)] top-[22px] h-3 w-[calc(100%-60px)] overflow-visible text-hairline" preserveAspectRatio="none" viewBox="0 0 100 10">
                  <line x1="0" y1="5" x2="96" y2="5" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />
                  <path d="M92 1 L99 5 L92 9" fill="none" stroke="currentColor" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
                </svg>
              )}
              <div className="relative h-12 w-12">
                <span className={cn("absolute inset-0 rounded-full border-2 border-hairline bg-surface-soft transition-colors duration-300", active && cn(meta.ring, meta.fill))} />
                {active && (
                  <motion.span
                    layoutId="breaker-halo"
                    className={cn("absolute -inset-1.5 rounded-full border-2", meta.ring)}
                    transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 260, damping: 24 }}
                  />
                )}
                <span className={cn("absolute inset-0 flex items-center justify-center", active ? meta.text : "text-muted")}>
                  {s === "OPEN" ? <Zap className="h-4 w-4" /> : s === "CLOSED" ? <Check className="h-4 w-4" /> : <span className="font-mono text-[12px] font-semibold">½</span>}
                </span>
              </div>
              <span className={cn("mt-3 text-[13px] font-medium transition-colors", active ? "text-ink" : "text-stone")}>{meta.label}</span>
              <span className="mt-0.5 hidden text-[11px] leading-[1.35] text-stone sm:block">{meta.hint}</span>
            </div>
          );
        })}
      </div>

      {/* Current frame */}
      <div className="mt-5 flex min-h-[44px] items-center gap-3 rounded-md bg-surface-soft px-3 py-2" aria-live="polite">
        {current && (
          <motion.div
            key={idx}
            initial={reduce ? false : { opacity: 0.2, x: 4 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.18 }}
            className="min-w-0 text-[12px] leading-[1.45]"
          >
            <span className="font-mono text-stone">{current.e.at}</span>
            <span className={cn("ml-2 font-mono font-medium", STATUS_TEXT[current.e.status])}>{current.e.label}</span>
            {current.e.detail && <p className="truncate text-steel">{current.e.detail}</p>}
          </motion.div>
        )}
      </div>

      {/* Scrubber of calls */}
      {calls.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-[12px] text-stone">Calls</p>
          <div className="flex flex-wrap gap-1">
            {frames.map((f, i) => {
              const m = /^call (\d+): (success|failure|rejected fast)/.exec(f.e.label);
              if (!m) return null;
              const reached = i <= shownUpTo;
              const tone = m[2] === "success" ? "bg-brand-green" : m[2] === "failure" ? "bg-brand-error" : "bg-brand-warn";
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    setPlaying(false);
                    setIdx(i);
                  }}
                  aria-label={`Jump to ${f.e.label}`}
                  className={cn(
                    "h-6 w-6 rounded-sm font-mono text-[10px] font-semibold text-canvas transition-[opacity,transform] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink",
                    tone,
                    reached ? "opacity-100" : "opacity-20",
                    i === idx && "scale-110 ring-2 ring-ink ring-offset-1"
                  )}
                >
                  {m[1]}
                </button>
              );
            })}
          </div>
          <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-stone">
            <Legend items={[["bg-brand-green", "success"], ["bg-brand-error", "failure"], ["bg-brand-warn", "rejected fast"]]} />
          </div>
        </div>
      )}
    </Panel>
  );
}

/* ======================================================================== */
/* Cache: lookup strip with hit/miss + loader latency                       */
/* ======================================================================== */

function CacheViz({ result }: { result: ScenarioResult }) {
  const reduce = useReducedMotion();
  const steps = result.timeline;
  const lookups = steps.filter((e) => /^(HIT|MISS)/.test(e.label));
  const hits = lookups.filter((e) => e.label.startsWith("HIT")).length;
  const ratio = lookups.length ? hits / lookups.length : 0;
  const maxLat = Math.max(1, ...steps.map((e) => e.magnitude ?? 0));

  return (
    <Panel
      title="Cache lookups"
      aside={<Legend items={[["bg-brand-green", "hit"], ["bg-brand-warn", "miss (loader ran)"], ["bg-muted", "clock / delete"]]} />}
    >
      <div className="flex items-center gap-4">
        <div className="relative h-14 w-14 shrink-0">
          <svg viewBox="0 0 36 36" className="h-14 w-14 -rotate-90" aria-hidden="true">
            <circle cx="18" cy="18" r="15.5" fill="none" className="stroke-hairline" strokeWidth="4" />
            <motion.circle
              cx="18"
              cy="18"
              r="15.5"
              fill="none"
              className="stroke-brand-green"
              strokeWidth="4"
              strokeLinecap="round"
              initial={reduce ? false : { pathLength: 0 }}
              animate={{ pathLength: ratio }}
              transition={{ duration: reduce ? 0 : 0.9, ease: "easeOut" }}
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center font-mono text-[12px] font-semibold text-ink">{Math.round(ratio * 100)}%</span>
        </div>
        <p className="text-[13px] leading-[1.5] text-steel">
          <span className="font-medium text-ink">
            {hits} of {lookups.length}
          </span>{" "}
          lookups served from cache. Each miss runs the loader and pays its latency.
        </p>
      </div>
      <ol className="mt-4 space-y-1.5" aria-label="Lookup sequence">
        {steps.map((e, i) => {
          const isHit = e.label.startsWith("HIT");
          const isMiss = e.label.startsWith("MISS");
          const key = e.label.replace(/^(HIT|MISS)\s+/, "");
          return (
            <motion.li
              key={i}
              className="grid grid-cols-[64px_44px_minmax(0,1fr)] items-center gap-2 text-[12px]"
              initial={reduce ? false : { opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: reduce ? 0 : Math.min(1.4, i * 0.06), duration: 0.25 }}
            >
              <span className="truncate font-mono text-[11px] text-stone">{e.at}</span>
              <span
                className={cn(
                  "inline-flex h-5 items-center justify-center rounded-xs font-mono text-[10px] font-semibold",
                  isHit ? "bg-brand-green/15 text-brand-green-deep" : isMiss ? "bg-brand-warn/15 text-brand-warn" : "bg-surface text-stone"
                )}
              >
                {isHit ? "HIT" : isMiss ? "MISS" : e.label.startsWith("delete") ? "DEL" : "WAIT"}
              </span>
              <span className="flex min-w-0 items-center gap-2">
                <span className={cn("truncate font-mono", isHit || isMiss ? "text-ink" : "text-stone")}>{isHit || isMiss ? key : e.label}</span>
                {isMiss && (e.magnitude ?? 0) > 0 && (
                  <span className="flex min-w-0 flex-1 items-center gap-1.5">
                    <motion.span
                      className="block h-1.5 origin-left rounded-full bg-brand-warn/70"
                      style={{ width: `${Math.max(6, ((e.magnitude ?? 0) / maxLat) * 100)}%` }}
                      initial={reduce ? false : { scaleX: 0 }}
                      animate={{ scaleX: 1 }}
                      transition={{ delay: reduce ? 0 : Math.min(1.4, i * 0.06) + 0.1, duration: 0.35 }}
                    />
                    <span className="shrink-0 font-mono text-[11px] text-stone">{fmtMs(e.magnitude ?? 0)}</span>
                  </span>
                )}
              </span>
            </motion.li>
          );
        })}
      </ol>
    </Panel>
  );
}

/* ======================================================================== */
/* Magnitude bars (health probes, AI provider latency)                      */
/* ======================================================================== */

function LatencyViz({ result, title }: { result: ScenarioResult; title: string }) {
  const reduce = useReducedMotion();
  const rows = result.timeline.filter((e) => e.magnitude !== undefined);
  if (rows.length === 0) return null;
  const max = Math.max(1, ...rows.map((e) => e.magnitude ?? 0), Number(result.inputs.timeoutMs) || 0);
  const timeout = Number(result.inputs.timeoutMs) || 0;
  return (
    <Panel
      title={title}
      aside={
        <>
          <Legend items={[["bg-brand-green", "healthy"], ["bg-brand-warn", "degraded"], ["bg-brand-error", "failing"]]} />
          {timeout > 0 && <span className="font-mono">full bar = {fmtMs(max)}</span>}
        </>
      }
    >
      <div className="relative space-y-3">
        {rows.map((e, i) => (
          <div key={i} className="grid grid-cols-[100px_minmax(0,1fr)_44px] items-center gap-3 text-[12px]">
            <span className="truncate font-mono text-ink" title={e.label}>
              {e.label.split(" ")[0]}
            </span>
            <div className="h-2 rounded-full bg-surface">
              <motion.div
                className={cn("h-2 origin-left rounded-full", STATUS_DOT[e.status])}
                style={{ width: `${Math.max(2, ((e.magnitude ?? 0) / max) * 100)}%` }}
                initial={reduce ? false : { scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ delay: reduce ? 0 : i * 0.08, duration: reduce ? 0 : 0.5, ease: [0.2, 0.8, 0.2, 1] }}
              />
            </div>
            <span className="text-right font-mono text-[11px] text-stone">{fmtMs(e.magnitude ?? 0)}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

/* ======================================================================== */
/* Generic animated event log                                               */
/* ======================================================================== */

export function EventLog({ events, title = "Events" }: { events: TimelineEvent[]; title?: string }) {
  const reduce = useReducedMotion();
  if (events.length === 0) {
    return <p className="rounded-lg border border-dashed border-hairline px-4 py-8 text-center text-[13px] text-stone">The scenario produced no events.</p>;
  }
  return (
    <Panel title={title} aside={<span className="font-mono">{events.length}</span>}>
      <ol className="max-h-[420px] overflow-y-auto pr-1">
        {events.map((e, idx) => (
          <motion.li
            key={idx}
            className="relative flex gap-3 pb-3 last:pb-0"
            initial={reduce ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: reduce ? 0 : Math.min(1.2, idx * 0.04), duration: 0.22 }}
          >
            <span className="relative flex w-2.5 shrink-0 flex-col items-center pt-[5px]">
              <span className={cn("h-2.5 w-2.5 rounded-full ring-4 ring-canvas", STATUS_DOT[e.status])} aria-hidden="true" />
              {idx < events.length - 1 && <span className="absolute bottom-[-6px] top-[18px] w-px bg-hairline" aria-hidden="true" />}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className={cn("font-mono text-[13px]", STATUS_TEXT[e.status])}>{e.label}</span>
                {e.at && <span className="font-mono text-[11px] text-stone">{e.at}</span>}
                <span className="sr-only">({e.status})</span>
              </div>
              {e.detail && <p className="mt-0.5 break-words text-[12px] leading-[1.5] text-steel">{e.detail}</p>}
            </div>
          </motion.li>
        ))}
      </ol>
    </Panel>
  );
}

/** Picks the purpose-built view for a scenario, followed by the event log. */
export function ScenarioTimeline({ result }: { result: ScenarioResult }) {
  let viz: ReactNode = null;
  switch (result.slug) {
    case "rate-limit":
      viz = <RateLimitViz result={result} />;
      break;
    case "retry":
      viz = <RetryViz result={result} />;
      break;
    case "circuit-breaker":
      viz = <CircuitViz result={result} />;
      break;
    case "cache":
      viz = <CacheViz result={result} />;
      break;
    case "health":
      viz = <LatencyViz result={result} title="Probe latency" />;
      break;
  }
  const showLog = result.slug !== "cache";
  return (
    <div className="space-y-4">
      {viz}
      {showLog && <EventLog events={result.timeline} title={viz ? "Event log" : "Timeline"} />}
    </div>
  );
}
