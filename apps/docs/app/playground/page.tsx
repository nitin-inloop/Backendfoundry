import type { Metadata } from "next";
import { PlaygroundExplorer } from "../../components/playground/playground-explorer";
import { categories, getPackageBySlug, packages, toPlaygroundSummary } from "../../lib/registry";

export const metadata: Metadata = {
  title: "Playground",
  description:
    "Run real BackendFoundry components (rate limiting, retries, circuit breakers, caching, idempotency, webhooks and more) with editable inputs."
};

export default function PlaygroundPage({ searchParams }: { searchParams?: { component?: string | string[] } }) {
  const requested = Array.isArray(searchParams?.component) ? searchParams?.component[0] : searchParams?.component;
  const initialSlug = requested && getPackageBySlug(requested) ? getPackageBySlug(requested)!.slug : "rate-limit";
  return (
    <main className="border-b border-hairline-soft bg-canvas">
      <h1 className="sr-only">BackendFoundry playground</h1>
      <PlaygroundExplorer components={packages.map(toPlaygroundSummary)} categories={categories} initialSlug={initialSlug} />
    </main>
  );
}
