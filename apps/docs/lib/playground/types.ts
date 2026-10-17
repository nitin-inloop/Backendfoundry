/** Shapes shared by the playground API route and the client renderer. */

export type Tone = "good" | "bad" | "warn" | "neutral";
export type EventStatus = "ok" | "error" | "warn" | "info";

export interface SummaryItem {
  label: string;
  value: string | number | boolean;
  tone?: Tone;
}

export interface TimelineEvent {
  /** Short label, e.g. "#3 429 blocked" */
  label: string;
  /** Secondary text */
  detail?: string;
  status: EventStatus;
  /** Relative (simulated or real) time marker, e.g. "t+300ms" */
  at?: string;
  /** Optional numeric magnitude for bar rendering (e.g. delay ms) */
  magnitude?: number;
}

export interface ScenarioResult {
  slug: string;
  scenario: string;
  title: string;
  /** Wall-clock runtime of the scenario on the server */
  durationMs: number;
  /** Whether time was simulated (virtual clock) rather than real */
  simulatedClock: boolean;
  summary: SummaryItem[];
  timeline: TimelineEvent[];
  /** Primary JSON output (response body, report, ...) */
  output: unknown;
  /** Raw log lines */
  logs: string[];
  /** Equivalent code for the run, using the submitted inputs */
  code: string;
  inputs: Record<string, unknown>;
}

export interface ScenarioErrorBody {
  error: { code: string; message: string; field?: string };
}
