"use client";
/**
 * useScenario — state machine for one playground scenario: input values, JSON
 * validation, POST /api/playground/<slug>, abort of in-flight runs, results.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PlaygroundComponentSummary, PlaygroundInputDef } from "../../lib/registry";
import type { ScenarioResult } from "../../lib/playground/types";

export type Values = Record<string, string | number | boolean>;

export interface ScenarioError {
  message: string;
  field?: string;
  code?: string;
  status?: number;
}

export function defaultValues(inputs: PlaygroundInputDef[]): Values {
  return Object.fromEntries(inputs.map((i) => [i.key, i.default]));
}

export function useScenario(component: PlaygroundComponentSummary, { autoRun = true }: { autoRun?: boolean } = {}) {
  const def = component.playground;
  const [values, setValues] = useState<Values>(() => defaultValues(def.inputs));
  const [result, setResult] = useState<ScenarioResult | null>(null);
  const [error, setError] = useState<ScenarioError | null>(null);
  const [loading, setLoading] = useState(false);
  const [runCount, setRunCount] = useState(0);
  const [lastRunAt, setLastRunAt] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const endpoint = `/api/playground/${component.slug}`;

  const jsonErrors = useMemo(() => {
    const errs: Record<string, string> = {};
    for (const input of def.inputs) {
      if (input.type !== "json") continue;
      try {
        JSON.parse(String(values[input.key] ?? ""));
      } catch (e) {
        errs[input.key] = (e as Error).message;
      }
    }
    return errs;
  }, [def.inputs, values]);
  const hasJsonErrors = Object.keys(jsonErrors).length > 0;

  const execute = useCallback(
    async (vals: Values) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ inputs: vals }),
          signal: controller.signal
        });
        let json: unknown = null;
        try {
          json = await res.json();
        } catch {
          json = null;
        }
        if (!res.ok) {
          const body = (json ?? {}) as { error?: { message?: string; field?: string; code?: string } };
          setError({
            message: body.error?.message ?? `The playground route returned HTTP ${res.status}.`,
            field: body.error?.field,
            code: body.error?.code,
            status: res.status
          });
          return;
        }
        setResult(json as ScenarioResult);
        setRunCount((n) => n + 1);
        setLastRunAt(Date.now());
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setError({ message: `Could not reach the playground route: ${(err as Error).message}`, code: "NETWORK" });
        }
      } finally {
        if (abortRef.current === controller) setLoading(false);
      }
    },
    [endpoint]
  );

  const run = useCallback(() => {
    if (hasJsonErrors) {
      const [field, message] = Object.entries(jsonErrors)[0]!;
      setError({ message: `Fix the JSON before running: ${message}`, field, code: "INVALID_JSON" });
      return;
    }
    void execute(values);
  }, [execute, values, hasJsonErrors, jsonErrors]);

  const reset = useCallback(() => {
    const d = defaultValues(def.inputs);
    setValues(d);
    void execute(d);
  }, [def.inputs, execute]);

  const set = useCallback((key: string, value: string | number | boolean) => {
    setValues((v) => ({ ...v, [key]: value }));
  }, []);

  useEffect(() => {
    if (autoRun) void execute(defaultValues(def.inputs));
    return () => abortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [component.slug]);

  const dirty = useMemo(() => def.inputs.some((i) => values[i.key] !== i.default), [def.inputs, values]);

  return { def, values, set, result, error, loading, run, reset, jsonErrors, hasJsonErrors, runCount, lastRunAt, endpoint, dirty };
}

export type ScenarioState = ReturnType<typeof useScenario>;
