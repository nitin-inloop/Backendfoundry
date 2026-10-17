"use client";
/**
 * <PipelineDemo> — the hero product visual. A real Express route on the left; on the right a live trace of
 * one request moving through rate-limit, validation, idempotency, the handler and the error handler.
 * Four scenarios (new payment, client retry, burst, bad payload) autoplay while in view; visitors can pick one.
 * Reduced motion: no autoplay, each scenario renders its final state immediately.
 */
import { Check, RotateCcw, X } from "lucide-react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "../../ui/cn";
import { highlight } from "../../ui/highlight";

type StageId = "rate-limit" | "validation" | "idempotency" | "handler" | "errors";
type Outcome = "pass" | "fail" | "skip" | "replay";
type StageState = "idle" | "active" | Outcome;

interface ScenarioStage {
  id: StageId;
  outcome: Outcome;
  note: string;
  ms?: string;
}

interface Scenario {
  id: string;
  label: string;
  body: string;
  stages: ScenarioStage[];
  response: { status: number; text: string; header: string; body: string };
}

const STAGE_META: Record<StageId, { label: string; pkg: string; lines: number[] }> = {
  "rate-limit": { label: "Rate limit", pkg: "@backendfoundry/rate-limit", lines: [2] },
  validation: { label: "Validate body", pkg: "@backendfoundry/validation", lines: [3] },
  idempotency: { label: "Idempotency key", pkg: "@backendfoundry/idempotency", lines: [5, 6, 7] },
  handler: { label: "Your handler", pkg: "charge(req.body)", lines: [8] },
  errors: { label: "Error handler", pkg: "@backendfoundry/errors", lines: [14] }
};

const SCENARIOS: Scenario[] = [
  {
    id: "new",
    label: "New payment",
    body: `{ "amountCents": 4200, "currency": "usd" }`,
    stages: [
      { id: "rate-limit", outcome: "pass", note: "19 of 20 left this minute", ms: "0.2ms" },
      { id: "validation", outcome: "pass", note: "Body typed as CreatePayment", ms: "0.1ms" },
      { id: "idempotency", outcome: "pass", note: "Key pay_8f2c locked", ms: "1.3ms" },
      { id: "handler", outcome: "pass", note: "Charge created", ms: "38ms" },
      { id: "errors", outcome: "skip", note: "Nothing thrown" }
    ],
    response: { status: 201, text: "Created", header: "X-Idempotency-Replayed: false", body: `{ "id": "pay_01JA4X", "status": "succeeded" }` }
  },
  {
    id: "retry",
    label: "Client retry",
    body: `{ "amountCents": 4200, "currency": "usd" }`,
    stages: [
      { id: "rate-limit", outcome: "pass", note: "18 of 20 left this minute", ms: "0.2ms" },
      { id: "validation", outcome: "pass", note: "Body typed as CreatePayment", ms: "0.1ms" },
      { id: "idempotency", outcome: "replay", note: "Stored response replayed", ms: "0.9ms" },
      { id: "handler", outcome: "skip", note: "Not charged twice" },
      { id: "errors", outcome: "skip", note: "Nothing thrown" }
    ],
    response: { status: 201, text: "Created", header: "X-Idempotency-Replayed: true", body: `{ "id": "pay_01JA4X", "status": "succeeded" }` }
  },
  {
    id: "burst",
    label: "Traffic burst",
    body: `{ "amountCents": 4200, "currency": "usd" }`,
    stages: [
      { id: "rate-limit", outcome: "fail", note: "Limit of 20 per minute reached", ms: "0.1ms" },
      { id: "validation", outcome: "skip", note: "Skipped" },
      { id: "idempotency", outcome: "skip", note: "Skipped" },
      { id: "handler", outcome: "skip", note: "Never reached" },
      { id: "errors", outcome: "pass", note: "Sent 429 with Retry-After", ms: "0.1ms" }
    ],
    response: { status: 429, text: "Too Many Requests", header: "Retry-After: 12", body: `{ "error": { "code": "RATE_LIMIT_EXCEEDED" } }` }
  },
  {
    id: "invalid",
    label: "Bad payload",
    body: `{ "amountCents": 0, "currency": "btc" }`,
    stages: [
      { id: "rate-limit", outcome: "pass", note: "17 of 20 left this minute", ms: "0.2ms" },
      { id: "validation", outcome: "fail", note: "2 issues: amountCents, currency", ms: "0.1ms" },
      { id: "idempotency", outcome: "skip", note: "Skipped" },
      { id: "handler", outcome: "skip", note: "Never reached" },
      { id: "errors", outcome: "pass", note: "Safe 400, no stack trace", ms: "0.1ms" }
    ],
    response: { status: 400, text: "Bad Request", header: "Content-Type: application/json", body: `{ "error": { "code": "VALIDATION_FAILED" } }` }
  }
];

const CODE = `app.post("/v1/payments",
  expressRateLimit({ limit: 20, windowMs: 60_000 }),
  expressValidate({ body: CreatePayment }),
  async (req, res) => {
    const result = await idempotency.execute(
      { key: idempotency.extractKey(req.headers),
        method: "POST", path: req.path, body: req.body },
      async () => ({ statusCode: 201, body: await charge(req.body) })
    );
    res.set(result.headers).status(result.statusCode).json(result.body);
  }
);

app.use(createExpressErrorHandler());`;

const RESPONSE_LINE = 10;
const STEP_MS = 720;
const HOLD_MS = 3400;

function splitLines(code: string) {
  const lines: ReturnType<typeof highlight>[] = [[]];
  for (const token of highlight(code, "ts")) {
    token.text.split("\n").forEach((part, i) => {
      if (i > 0) lines.push([]);
      if (part) lines[lines.length - 1]!.push({ text: part, cls: token.cls });
    });
  }
  return lines;
}

const CODE_LINES = splitLines(CODE);

export function PipelineDemo() {
  const reduce = useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const inView = useInView(rootRef, { amount: 0.3 });
  const [scenarioIndex, setScenarioIndex] = useState(0);
  const [step, setStep] = useState(0);

  const scenario = SCENARIOS[scenarioIndex]!;
  const visits = useMemo(
    () => scenario.stages.map((s, order) => ({ ...s, order })).filter((s) => s.outcome !== "skip"),
    [scenario]
  );
  const done = step >= visits.length;
  const effectiveStep = reduce ? visits.length : step;
  const cursorOrder = visits[effectiveStep]?.order ?? Number.POSITIVE_INFINITY;
  const showResponse = reduce || done;

  useEffect(() => {
    if (reduce || !inView) return;
    const t = setTimeout(
      () => {
        if (step < visits.length) setStep((s) => s + 1);
        else {
          setScenarioIndex((i) => (i + 1) % SCENARIOS.length);
          setStep(0);
        }
      },
      step === 0 ? 500 : step < visits.length ? STEP_MS : HOLD_MS
    );
    return () => clearTimeout(t);
  }, [step, visits.length, inView, reduce]);

  function choose(i: number) {
    setScenarioIndex(i);
    setStep(0);
  }

  function stateOf(order: number, outcome: Outcome): StageState {
    if (order < cursorOrder) return outcome;
    if (order === cursorOrder) return "active";
    return "idle";
  }

  const activeStage = visits[effectiveStep];
  const activeLines = new Set(showResponse ? (scenario.response.status < 400 ? [RESPONSE_LINE] : []) : activeStage ? STAGE_META[activeStage.id].lines : []);
  const statusTone =
    scenario.response.status >= 500 || scenario.response.status === 400
      ? "error"
      : scenario.response.status === 429
        ? "warn"
        : "ok";

  return (
    <div ref={rootRef} className="overflow-hidden rounded-xl border border-hairline-soft bg-canvas shadow-mockup">
      {/* Window bar */}
      <div className="flex items-center justify-between gap-4 border-b border-hairline-soft bg-surface-soft px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2 text-caption">
          <span className="rounded-sm bg-canvas px-2 py-0.5 font-mono text-micro text-slate ring-1 ring-hairline">src/routes/payments.ts</span>
          <span className="hidden truncate text-stone sm:inline">Express, Node.js 20</span>
        </div>
        <span className="flex items-center gap-1.5 text-micro font-medium text-steel">
          <span className="relative flex h-2 w-2">
            {!reduce && inView && <span className="absolute inset-0 animate-ping rounded-full bg-brand-green/60" />}
            <span className="relative h-2 w-2 rounded-full bg-brand-green" />
          </span>
          Live trace
        </span>
      </div>

      <div className="grid md:grid-cols-[minmax(0,1.12fr)_minmax(0,1fr)]">
        {/* Code */}
        <div className="hidden min-w-0 border-r border-hairline-dark bg-surface-code md:block">
          <pre tabIndex={0} className="scrollbar-none overflow-x-auto py-4 font-mono text-[12px] leading-[1.75] text-[#e8e8ea] lg:text-[12.5px]" aria-label="Express route using rate-limit, validation, idempotency and errors">
            <code className="block min-w-max">
              {CODE_LINES.map((line, i) => {
                const n = i + 1;
                const on = activeLines.has(n);
                return (
                  <span
                    key={i}
                    className={cn(
                      "block whitespace-pre border-l-2 pl-3 pr-4 transition-[background-color,border-color,opacity] duration-300",
                      on ? "border-brand-green bg-brand-green/[0.12]" : "border-transparent",
                      activeLines.size > 0 && !on && "opacity-60"
                    )}
                  >
                    <span aria-hidden="true" className="mr-4 inline-block w-4 select-none text-right text-[#55555b]">
                      {n}
                    </span>
                    {line.length === 0
                      ? "​"
                      : line.map((t, j) => (
                          <span key={j} className={t.cls}>
                            {t.text}
                          </span>
                        ))}
                  </span>
                );
              })}
            </code>
          </pre>
        </div>

        {/* Trace */}
        <div className="flex min-w-0 flex-col p-4 sm:p-5">
          <div role="group" aria-label="Choose a request scenario" className="scrollbar-none -mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
            {SCENARIOS.map((s, i) => {
              const selected = i === scenarioIndex;
              return (
                <button
                  key={s.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => choose(i)}
                  className={cn(
                    "relative shrink-0 rounded-full px-3 py-1 text-micro font-medium transition-colors",
                    selected ? "text-on-primary" : "text-steel hover:text-ink"
                  )}
                >
                  {selected && (
                    <motion.span
                      layoutId="scenario-pill"
                      aria-hidden="true"
                      className="absolute inset-0 rounded-full bg-primary"
                      transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 480, damping: 38 }}
                    />
                  )}
                  <span className="relative">{s.label}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-3 rounded-md border border-hairline-soft bg-surface-soft px-3 py-2 font-mono text-[11.5px] leading-relaxed text-slate">
            <p>
              <span className="font-semibold text-ink">POST</span> /v1/payments
            </p>
            <p className="truncate text-steel">Idempotency-Key: pay_8f2c</p>
            <AnimatePresence mode="wait" initial={false}>
              <motion.p
                key={scenario.id}
                className="truncate text-steel"
                initial={reduce ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                {scenario.body}
              </motion.p>
            </AnimatePresence>
          </div>

          <ol className="mt-4 flex-1" aria-label={`Pipeline trace: ${scenario.label}`}>
            {scenario.stages.map((stage, order) => {
              const state = stateOf(order, stage.outcome);
              const meta = STAGE_META[stage.id];
              const last = order === scenario.stages.length - 1;
              const resolved = state !== "idle" && state !== "active";
              return (
                <li key={stage.id} className="relative flex gap-3 pb-3 last:pb-0">
                  {!last && (
                    <span aria-hidden="true" className="absolute left-[11px] top-6 h-[calc(100%-18px)] w-px bg-hairline">
                      <motion.span
                        className="absolute inset-0 origin-top bg-brand-green"
                        initial={false}
                        animate={{ scaleY: resolved && state !== "skip" ? 1 : 0 }}
                        transition={{ duration: reduce ? 0 : 0.35, ease: "easeOut" }}
                      />
                    </span>
                  )}
                  <StageNode state={state} reduce={!!reduce} />
                  <div className={cn("min-w-0 flex-1 transition-opacity duration-300", state === "skip" && "opacity-45")}>
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate text-body-sm font-medium text-ink">{meta.label}</p>
                      <span className="shrink-0 font-mono text-[11px] text-stone">{resolved && stage.ms ? stage.ms : ""}</span>
                    </div>
                    <p className="truncate text-micro text-steel">
                      {resolved ? (
                        <span className={cn(state === "fail" && "text-[#b23b3b] dark:text-[#ff8a8a]", state === "replay" && "text-brand-tag")}>{stage.note}</span>
                      ) : (
                        <span className="font-mono text-[11px] text-stone">{meta.pkg}</span>
                      )}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>

          <div className="mt-4 min-h-[66px] rounded-md border border-hairline-soft">
            <AnimatePresence mode="wait" initial={false}>
              {showResponse ? (
                <motion.div
                  key={`res-${scenario.id}`}
                  className="px-3 py-2.5"
                  initial={reduce ? false : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "rounded-full px-2 py-px font-mono text-[11px] font-semibold",
                        statusTone === "ok" && "bg-brand-green/15 text-[#00785f] dark:text-brand-green-soft",
                        statusTone === "warn" && "bg-brand-warn/15 text-[#94600a] dark:text-[#f2b862]",
                        statusTone === "error" && "bg-brand-error/15 text-[#b23b3b] dark:text-[#ff8a8a]"
                      )}
                    >
                      {scenario.response.status}
                    </span>
                    <span className="text-micro font-medium text-ink">{scenario.response.text}</span>
                    <span className="ml-auto hidden truncate font-mono text-[11px] text-stone sm:inline">{scenario.response.header}</span>
                  </div>
                  <p className="mt-1.5 truncate font-mono text-[11.5px] text-slate">{scenario.response.body}</p>
                </motion.div>
              ) : (
                <motion.div
                  key="waiting"
                  className="flex h-[64px] items-center gap-2 px-3 text-micro text-stone"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <span className="flex gap-1" aria-hidden="true">
                    {[0, 1, 2].map((d) => (
                      <motion.span
                        key={d}
                        className="h-1 w-1 rounded-full bg-stone"
                        animate={{ opacity: [0.25, 1, 0.25] }}
                        transition={{ duration: 1, repeat: Infinity, delay: d * 0.15 }}
                      />
                    ))}
                  </span>
                  Waiting for response
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}

function StageNode({ state, reduce }: { state: StageState; reduce: boolean }) {
  return (
    <span className="relative z-10 mt-0.5 grid h-[22px] w-[22px] shrink-0 place-items-center">
      {state === "active" && !reduce && (
        <motion.span
          aria-hidden="true"
          className="absolute inset-0 rounded-full bg-brand-green/30"
          initial={{ scale: 0.8, opacity: 0.9 }}
          animate={{ scale: 1.7, opacity: 0 }}
          transition={{ duration: 1.1, repeat: Infinity, ease: "easeOut" }}
        />
      )}
      <motion.span
        className={cn(
          "relative grid h-[22px] w-[22px] place-items-center rounded-full border text-white transition-colors duration-200",
          state === "idle" && "border-hairline bg-canvas",
          state === "active" && "border-brand-green bg-canvas",
          state === "pass" && "border-brand-green bg-brand-green",
          state === "replay" && "border-brand-tag bg-brand-tag",
          state === "fail" && "border-brand-error bg-brand-error",
          state === "skip" && "border-dashed border-muted bg-canvas"
        )}
        initial={false}
        animate={{ scale: state === "pass" || state === "fail" || state === "replay" ? [1.15, 1] : 1 }}
        transition={{ duration: reduce ? 0 : 0.25 }}
      >
        {state === "active" && <span className="h-2 w-2 rounded-full bg-brand-green" />}
        {state === "pass" && <Check className="h-3 w-3 text-primary" strokeWidth={3} aria-label="passed" />}
        {state === "replay" && <RotateCcw className="h-3 w-3" strokeWidth={2.5} aria-label="replayed" />}
        {state === "fail" && <X className="h-3 w-3" strokeWidth={3} aria-label="rejected" />}
      </motion.span>
    </span>
  );
}
