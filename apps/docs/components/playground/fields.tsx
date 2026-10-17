"use client";
/**
 * Input controls generated from registry playground input definitions:
 * slider + number (linear or log scale), switch, segmented/select, JSON editor, text.
 */
import { useId, useMemo, useRef } from "react";
import { motion, useReducedMotion } from "motion/react";
import { AlertCircle, Check, Wand2 } from "lucide-react";
import type { PlaygroundInputDef } from "../../lib/registry";
import { cn } from "../../lib/cn";

type Value = string | number | boolean;

const inputBase =
  "w-full rounded-md border bg-canvas text-ink outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-muted focus:border-brand-green focus:shadow-[0_0_0_1px_theme(colors.brand-green)]";

export function Field({
  input,
  value,
  onChange,
  error,
  idPrefix,
  compact = false
}: {
  input: PlaygroundInputDef;
  value: Value;
  onChange: (v: Value) => void;
  error?: string;
  idPrefix: string;
  compact?: boolean;
}) {
  const id = `${idPrefix}-${input.key}`;
  const helpId = `${id}-help`;
  const describedBy = error || input.help ? helpId : undefined;

  if (input.type === "boolean") {
    return (
      <div>
        <SwitchField id={id} label={input.label} checked={value === true} onChange={onChange} describedBy={describedBy} />
        <Help id={helpId} error={error} help={input.help} />
      </div>
    );
  }

  return (
    <div className={cn("min-w-0", (input.type === "json" || input.type === "textarea") && !compact && "sm:col-span-2")}>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-[13px] font-medium text-charcoal">
          {input.label}
        </label>
        {input.type === "number" && input.min !== undefined && input.max !== undefined && (
          <span className="shrink-0 font-mono text-[11px] text-muted">
            {fmt(input.min)}–{fmt(input.max)}
          </span>
        )}
      </div>
      {input.type === "number" ? (
        <NumberField id={id} input={input} value={value} onChange={onChange} error={!!error} describedBy={describedBy} />
      ) : input.type === "select" ? (
        <SelectField id={id} input={input} value={String(value)} onChange={onChange} describedBy={describedBy} />
      ) : input.type === "json" ? (
        <JsonField id={id} value={String(value)} onChange={onChange} error={error} describedBy={describedBy} />
      ) : input.type === "textarea" ? (
        <textarea
          id={id}
          value={String(value)}
          spellCheck={false}
          rows={3}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          onChange={(e) => onChange(e.target.value)}
          className={cn(inputBase, "resize-y px-3 py-2 font-mono text-[13px] leading-[1.6]", error ? "border-brand-error" : "border-hairline")}
        />
      ) : (
        <input
          id={id}
          type="text"
          value={String(value)}
          spellCheck={false}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          onChange={(e) => onChange(e.target.value)}
          className={cn(inputBase, "h-10 px-3 font-mono text-[13px]", error ? "border-brand-error" : "border-hairline")}
        />
      )}
      {input.type !== "json" && <Help id={helpId} error={error} help={input.help} />}
    </div>
  );
}

function Help({ id, error, help }: { id: string; error?: string; help?: string }) {
  if (error) {
    return (
      <p id={id} role="alert" className="mt-1.5 flex items-start gap-1.5 text-[12px] leading-[1.4] text-brand-error">
        <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        {error}
      </p>
    );
  }
  if (help) {
    return (
      <p id={id} className="mt-1.5 text-[12px] leading-[1.4] text-stone">
        {help}
      </p>
    );
  }
  return null;
}

function fmt(n: number): string {
  const a = Math.abs(n);
  if (a >= 1_000_000) return `${+(n / 1_000_000).toFixed(1)}M`;
  if (a >= 10_000) return `${+(n / 1000).toFixed(1)}k`;
  return String(n);
}

/* ---------------------------------------------------------------- number */

/** Linear for small ranges; logarithmic for wide non-negative ranges (e.g. 50ms–1h). */
function scaleFor(input: PlaygroundInputDef) {
  const min = input.min ?? 0;
  const max = input.max ?? 100;
  const span = max - min;
  if (span <= 0) return null;
  if (span <= 200 || min < 0) {
    if (span > 2000) return null; // huge signed ranges: number input only
    return {
      steps: span / (input.step ?? 1),
      toPos: (v: number) => (v - min) / (input.step ?? 1),
      fromPos: (p: number) => min + p * (input.step ?? 1)
    };
  }
  const STEPS = 1000;
  const lo = Math.log(min + 1);
  const hi = Math.log(max + 1);
  const nice = (v: number) => {
    if (v < 20) return Math.round(v);
    const mag = Math.pow(10, Math.floor(Math.log10(v)) - 1);
    return Math.round(v / mag) * mag;
  };
  return {
    steps: STEPS,
    toPos: (v: number) => ((Math.log(Math.max(min, Math.min(max, v)) + 1) - lo) / (hi - lo)) * STEPS,
    fromPos: (p: number) => Math.max(min, Math.min(max, nice(Math.exp(lo + (p / STEPS) * (hi - lo)) - 1)))
  };
}

function NumberField({
  id,
  input,
  value,
  onChange,
  error,
  describedBy
}: {
  id: string;
  input: PlaygroundInputDef;
  value: Value;
  onChange: (v: Value) => void;
  error: boolean;
  describedBy?: string;
}) {
  const scale = useMemo(() => scaleFor(input), [input]);
  const numeric = typeof value === "number" ? value : Number(value);
  const pos = scale && Number.isFinite(numeric) ? scale.toPos(numeric) : 0;
  const pct = scale ? Math.max(0, Math.min(100, (pos / scale.steps) * 100)) : 0;
  const unit = /ms$/i.test(input.key) ? "ms" : /seconds$/i.test(input.key) ? "s" : "";

  return (
    <div className="flex items-center gap-3">
      {scale && (
        <div className="relative h-5 min-w-0 flex-1">
          <input
            type="range"
            aria-label={`${input.label} slider`}
            aria-valuetext={`${numeric}${unit}`}
            min={0}
            max={scale.steps}
            step={1}
            value={pos}
            onChange={(e) => onChange(scale.fromPos(Number(e.target.value)))}
            className="peer absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
          />
          <span aria-hidden="true" className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-hairline" />
          <span
            aria-hidden="true"
            className="absolute left-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-ink transition-[width] duration-75"
            style={{ width: `${pct}%` }}
          />
          <span
            aria-hidden="true"
            className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border border-hairline bg-canvas shadow-[0_1px_3px_rgba(0,0,0,0.18)] transition-[left,box-shadow] duration-75 peer-hover:shadow-[0_0_0_4px_rgba(0,212,164,0.18)] peer-focus-visible:shadow-[0_0_0_4px_rgba(0,212,164,0.35)] peer-active:scale-110"
            style={{ left: `${pct}%` }}
          />
        </div>
      )}
      <div className={cn("relative shrink-0", scale ? "w-[112px]" : "w-full")}>
        <input
          id={id}
          type="number"
          inputMode="decimal"
          value={typeof value === "number" || typeof value === "string" ? value : String(value)}
          min={input.min}
          max={input.max}
          step={input.step ?? 1}
          aria-invalid={error}
          aria-describedby={describedBy}
          onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
          className={cn(
            inputBase,
            "h-9 px-2.5 text-right font-mono text-[13px] tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
            unit && "pr-8",
            error ? "border-brand-error" : "border-hairline"
          )}
        />
        {unit && (
          <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 font-mono text-[11px] text-muted">{unit}</span>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- switch */

function SwitchField({
  id,
  label,
  checked,
  onChange,
  describedBy
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  describedBy?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <div className="flex items-center justify-between gap-4 rounded-md border border-hairline bg-canvas px-3 py-2.5">
      <label htmlFor={id} className="cursor-pointer text-[13px] font-medium text-charcoal">
        {label}
      </label>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-describedby={describedBy}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green focus-visible:ring-offset-2",
          checked ? "justify-end bg-brand-green" : "justify-start bg-hairline"
        )}
      >
        <motion.span
          layout={!reduce}
          transition={{ type: "spring", stiffness: 700, damping: 35 }}
          className="block h-4 w-4 rounded-full bg-canvas shadow-[0_1px_2px_rgba(0,0,0,0.2)]"
        />
      </button>
    </div>
  );
}

/* ---------------------------------------------------------------- select */

function SelectField({
  id,
  input,
  value,
  onChange,
  describedBy
}: {
  id: string;
  input: PlaygroundInputDef;
  value: string;
  onChange: (v: string) => void;
  describedBy?: string;
}) {
  const options = input.options ?? [];
  const groupId = useId();
  const reduce = useReducedMotion();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const segmented = options.length <= 4 && options.every((o) => o.length <= 14);

  if (!segmented) {
    return (
      <div className="relative">
        <select
          id={id}
          value={value}
          aria-describedby={describedBy}
          onChange={(e) => onChange(e.target.value)}
          className={cn(inputBase, "h-10 appearance-none border-hairline pl-3 pr-9 font-mono text-[13px]")}
        >
          {options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        <svg aria-hidden="true" viewBox="0 0 16 16" className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-stone">
          <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    );
  }

  return (
    <div
      id={id}
      role="radiogroup"
      aria-describedby={describedBy}
      className="flex w-full rounded-full bg-surface p-1"
      onKeyDown={(e) => {
        const idx = options.indexOf(value);
        const delta = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
        if (!delta) return;
        e.preventDefault();
        const next = (idx + delta + options.length) % options.length;
        onChange(options[next]!);
        refs.current[next]?.focus();
      }}
    >
      {options.map((o, idx) => {
        const active = o === value;
        return (
          <button
            key={o}
            ref={(el) => {
              refs.current[idx] = el;
            }}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(o)}
            className={cn(
              "relative flex-1 truncate rounded-full px-2 py-1.5 font-mono text-[12px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green",
              active ? "text-ink" : "text-steel hover:text-ink"
            )}
          >
            {active && (
              <motion.span
                layoutId={`${groupId}-thumb`}
                transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 38 }}
                className="absolute inset-0 rounded-full bg-canvas shadow-[0_1px_2px_rgba(0,0,0,0.08)]"
                aria-hidden="true"
              />
            )}
            <span className="relative">{o}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------------- json */

function JsonField({
  id,
  value,
  onChange,
  error,
  describedBy
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  describedBy?: string;
}) {
  const lines = value.split("\n").length;
  const gutterRef = useRef<HTMLDivElement>(null);
  const rows = Math.min(16, Math.max(5, lines + 1));
  const format = () => {
    try {
      onChange(JSON.stringify(JSON.parse(value), null, 2));
    } catch {
      /* keep as-is; error already shown */
    }
  };
  return (
    <div>
      <div
        className={cn(
          "overflow-hidden rounded-md border bg-surface-code transition-[border-color,box-shadow] duration-150 focus-within:border-brand-green focus-within:shadow-[0_0_0_1px_theme(colors.brand-green)]",
          error ? "border-brand-error" : "border-surface-code"
        )}
      >
        <div className="flex">
          <div
            ref={gutterRef}
            aria-hidden="true"
            className="select-none overflow-hidden border-r border-hairline-dark py-2.5 pl-3 pr-2 text-right font-mono text-[12px] leading-[20px] text-[#5a5a5c]"
            style={{ height: rows * 20 + 20 }}
          >
            {Array.from({ length: lines }, (_, i) => (
              <div key={i}>{i + 1}</div>
            ))}
          </div>
          <textarea
            id={id}
            value={value}
            spellCheck={false}
            rows={rows}
            aria-invalid={!!error}
            aria-describedby={describedBy}
            onChange={(e) => onChange(e.target.value)}
            onScroll={(e) => {
              if (gutterRef.current) gutterRef.current.scrollTop = e.currentTarget.scrollTop;
            }}
            onKeyDown={(e) => {
              if (e.key === "Tab" && !e.shiftKey) {
                e.preventDefault();
                const el = e.currentTarget;
                const { selectionStart: s, selectionEnd: end } = el;
                const next = `${value.slice(0, s)}  ${value.slice(end)}`;
                onChange(next);
                requestAnimationFrame(() => {
                  el.selectionStart = el.selectionEnd = s + 2;
                });
              }
            }}
            className="block min-w-0 flex-1 resize-none whitespace-pre bg-transparent px-3 py-2.5 font-mono text-[12.5px] leading-[20px] text-on-dark caret-brand-green outline-none"
            style={{ height: rows * 20 + 20 }}
          />
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-hairline-dark px-3 py-1.5">
          <span id={describedBy} className={cn("flex min-w-0 items-center gap-1.5 text-[12px]", error ? "text-[#ff8a8a]" : "text-on-dark-muted")}>
            {error ? (
              <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            ) : (
              <Check className="h-3.5 w-3.5 shrink-0 text-brand-green" aria-hidden="true" />
            )}
            <span className="truncate">{error ?? "Valid JSON"}</span>
          </span>
          <button
            type="button"
            onClick={format}
            disabled={!!error}
            className="inline-flex shrink-0 items-center gap-1 rounded-sm px-1.5 py-0.5 text-[12px] text-on-dark-muted transition-colors hover:text-on-dark disabled:opacity-40"
          >
            <Wand2 className="h-3 w-3" aria-hidden="true" />
            Format
          </button>
        </div>
      </div>
    </div>
  );
}
