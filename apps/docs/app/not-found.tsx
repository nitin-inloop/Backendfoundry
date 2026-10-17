import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "../components/ui/button";
import { CodeBlock } from "../components/ui/code-block";
import { Container } from "../components/ui/section";

export const metadata: Metadata = {
  title: "Page not found"
};

const SUGGESTIONS = [
  { title: "Quick start", href: "/docs/getting-started", text: "Protect your first route in five minutes." },
  { title: "Components", href: "/packages", text: "Browse all twelve components by category." },
  { title: "Playground", href: "/playground", text: "Run the real components in your browser." }
];

export default function NotFound() {
  return (
    <main className="relative overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-[linear-gradient(180deg,rgba(135,168,200,0.28),rgba(245,233,216,0.2)_60%,transparent)]"
      />
      <Container className="relative grid items-center gap-12 py-20 md:py-28 lg:grid-cols-2">
        <div>
          <p className="font-mono text-caption text-steel">404 NOT_FOUND</p>
          <h1 className="mt-4 text-balance text-[36px] font-semibold leading-[1.1] tracking-[-1px] text-ink md:text-heading-1">
            This page is not in the registry
          </h1>
          <p className="mt-4 max-w-md text-subtitle text-steel">
            The link may be out of date, or the page moved when the docs were reorganised. Search with{" "}
            <kbd className="rounded-xs border border-hairline bg-surface px-1.5 py-0.5 font-mono text-[13px] text-ink">⌘K</kbd> or
            start from one of these.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button href="/">Back to home</Button>
            <Button href="/docs" variant="secondary">
              Read the docs
            </Button>
          </div>
        </div>
        <div className="space-y-4">
          <CodeBlock
            language="json"
            filename="Response 404"
            copy={false}
            code={`{
  "error": {
    "code": "NOT_FOUND",
    "message": "Resource not found",
    "category": "client_error",
    "statusCode": 404
  }
}`}
          />
          <ul className="divide-y divide-hairline overflow-hidden rounded-lg border border-hairline">
            {SUGGESTIONS.map((s) => (
              <li key={s.href}>
                <Link href={s.href} className="group flex items-center justify-between gap-4 px-4 py-3.5 transition-colors hover:bg-surface-soft">
                  <span>
                    <span className="block text-body-sm font-medium text-ink">{s.title}</span>
                    <span className="block text-caption text-steel">{s.text}</span>
                  </span>
                  <ArrowRight className="h-4 w-4 text-muted transition-[transform,color] group-hover:translate-x-0.5 group-hover:text-ink" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </Container>
    </main>
  );
}
