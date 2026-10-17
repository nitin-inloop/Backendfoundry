import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "../../components/ui/badge";
import { DocsPage, DocsShell } from "../../components/site/docs-shell";

export const metadata: Metadata = {
  title: "Changelog",
  description: "Release history for BackendFoundry packages, the CLI and the documentation site."
};

const PACKAGES: [string, string][] = [
  ["core", "FoundryError base class, request ID utilities, response envelopes and environment parsers."],
  ["validation", "Fluent schema builder (v), Zod compatibility, Express and Fastify adapters, sensitive field redaction."],
  ["rate-limit", "Sliding and fixed window limiter with standard headers, memory and Redis stores."],
  ["retry", "Exponential backoff, equal and full jitter, retry predicates, per-attempt timeouts and AbortSignal."],
  ["circuit-breaker", "CLOSED, OPEN and HALF_OPEN state machine with probe limits and transition hooks."],
  ["cache", "Tenant-scoped caching with TTLs, memory and Redis stores, stampede-coalesced getOrSet."],
  ["idempotency", "Atomic key locking, SHA-256 request fingerprints, response replay, 409 and 422 conflicts."],
  ["webhooks", "HMAC-SHA256 signing, constant-time verification, replay windows and key rotation."],
  ["health", "Liveness and readiness probes with per-probe timeouts and sanitised diagnostics."],
  ["errors", "HTTP error classes, credential-scrubbing normaliser, Express and Fastify handlers."],
  ["logger", "Structured JSON logging with AsyncLocalStorage request context and deep redaction."],
  ["ai", "Unified LLM interface, mock and OpenAI-compatible providers, streaming, retry, fallback and schema output."]
];

export default function ChangelogPage() {
  return (
    <DocsShell>
      <DocsPage
        href="/changelog"
        title="Changelog"
        description="Notable changes to BackendFoundry. Versions follow semantic versioning."
      >
        <section aria-labelledby="v1-0-0">
          <div className="flex flex-wrap items-center gap-3">
            <h2 id="v1-0-0" className="!mt-0">
              1.0.0
            </h2>
            <Badge tone="primary" dot>
              Latest
            </Badge>
            <time dateTime="2026-10-17" className="text-body-sm text-stone">
              17 October 2026
            </time>
          </div>
          <p>The first public release.</p>
          <h3>Packages</h3>
          <ul>
            {PACKAGES.map(([slug, text]) => (
              <li key={slug}>
                <Link href={`/packages/${slug}`} className="font-mono text-[14px] font-medium text-ink underline decoration-hairline underline-offset-4 hover:decoration-brand-green">
                  @backendfoundry/{slug}
                </Link>
                : {text}
              </li>
            ))}
          </ul>
          <h3>Tooling</h3>
          <ul>
            <li>Monorepo build with dual ESM and CommonJS output and generated type declarations.</li>
            <li>
              CLI with <code>list</code>, <code>info</code> and <code>add</code>, package manager detection and
              pre-flight file conflict checks.
            </li>
            <li>Documentation site with component reference pages and interactive playgrounds.</li>
          </ul>
        </section>
      </DocsPage>
    </DocsShell>
  );
}
