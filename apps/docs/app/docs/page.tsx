import type { Metadata } from "next";
import Link from "next/link";
import { Callout } from "../../components/ui/callout";
import { Card } from "../../components/ui/card";
import { CommandLine } from "../../components/ui/command-line";
import { DocsPage } from "../../components/site/docs-shell";
import { DOCS_NAV } from "../../components/site/site-config";

export const metadata: Metadata = {
  title: "Introduction",
  description: "What BackendFoundry is, what it is not, and how the documentation is organised."
};

export default function DocsIndexPage() {
  return (
    <DocsPage
      href="/docs"
      title="Introduction"
      description="BackendFoundry is a library of small, typed TypeScript modules for the infrastructure parts of an API: the code that sits between an HTTP request and your business logic."
      toc={[
        { id: "what-you-get", title: "What you get" },
        { id: "how-it-works", title: "Package or source" },
        { id: "what-it-is-not", title: "What it is not" },
        { id: "next-steps", title: "Next steps" }
      ]}
    >
      <h2 id="what-you-get">What you get</h2>
      <p>
        Twelve components, each in its own package under the <code>@backendfoundry</code> scope. They cover request
        validation, rate limiting, retries, circuit breaking, caching, idempotency keys, webhook signatures, health
        checks, error handling, structured logging and a provider-agnostic AI client. A shared <code>core</code>{" "}
        package holds the error base class, request IDs, response envelopes and environment parsing.
      </p>
      <p>
        Every component has the same shape: a factory function with a typed configuration object, a framework-free core,
        and optional adapters for Express, Fastify and Next.js Route Handlers.
      </p>

      <h2 id="how-it-works">Package or source</h2>
      <p>
        You can consume a component in two ways. <strong>Package mode</strong> installs it from npm, so you get updates
        through your package manager. <strong>Source mode</strong> copies the TypeScript file into{" "}
        <code>src/lib/backendfoundry</code>, so you can read and change it like your own code. The CLI handles both.
      </p>
      <CommandLine command="npx @backendfoundry/cli add retry --source" />
      <p>
        Components that coordinate shared state across modules, such as the logger&apos;s{" "}
        <code>AsyncLocalStorage</code> store or the storage adapters in <code>rate-limit</code> and{" "}
        <code>cache</code>, are package-only. Each component page says which modes it supports and why.
      </p>

      <h2 id="what-it-is-not">What it is not</h2>
      <ul>
        <li>Not a framework. There is no app object, router or dependency injection container to adopt.</li>
        <li>Not a hosted service. Everything runs in your process and stores state where you configure it.</li>
        <li>
          Not distributed by default. Memory stores are process-local; use the Redis adapters when you run more than one
          replica. See <Link href="/docs/deployment">Deployment</Link>.
        </li>
      </ul>
      <Callout tone="tip" title="Try before you install">
        The <Link href="/playground">playground</Link> runs the real rate limiter, retry policy, circuit breaker and
        webhook verifier in the browser so you can see how each option changes behaviour.
      </Callout>

      <h2 id="next-steps">Next steps</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {DOCS_NAV.slice(0, 3)
          .flatMap((g) => g.items)
          .filter((i) => i.href !== "/docs")
          .slice(0, 6)
          .map((item) => (
            <Card key={item.href} href={item.href} padding="sm">
              <span className="block text-body-md font-semibold text-ink">{item.title}</span>
              <span className="mt-1 block text-body-sm text-steel">{item.description}</span>
            </Card>
          ))}
      </div>
    </DocsPage>
  );
}
