/**
 * <Footer> — DESIGN: footer-region. White canvas, hairline top edge, brand column + 4 link columns.
 */
import { Github } from "lucide-react";
import Link from "next/link";
import { Logo } from "./logo";
import { GITHUB_URL } from "./site-config";

const columns: { title: string; links: { label: string; href: string; external?: boolean }[] }[] = [
  {
    title: "Product",
    links: [
      { label: "Components", href: "/packages" },
      { label: "Playground", href: "/playground" },
      { label: "CLI", href: "/docs/installation" },
      { label: "Changelog", href: "/changelog" }
    ]
  },
  {
    title: "Guides",
    links: [
      { label: "Quick start", href: "/docs/getting-started" },
      { label: "Express", href: "/docs/express" },
      { label: "Fastify", href: "/docs/fastify" },
      { label: "Next.js", href: "/docs/nextjs" }
    ]
  },
  {
    title: "Production",
    links: [
      { label: "Security", href: "/docs/security" },
      { label: "Testing", href: "/docs/testing" },
      { label: "Deployment", href: "/docs/deployment" },
      { label: "Configuration", href: "/docs/configuration" }
    ]
  },
  {
    title: "Project",
    links: [
      { label: "GitHub", href: GITHUB_URL, external: true },
      { label: "Contributing", href: "/docs/contributing" },
      { label: "License", href: "/license" }
    ]
  }
];

const linkClass = "rounded-xs text-steel transition-colors hover:text-ink";

export function Footer() {
  return (
    <footer className="border-t border-hairline bg-canvas text-body-sm">
      <div className="mx-auto grid w-full max-w-container grid-cols-2 gap-x-6 gap-y-10 px-5 py-14 sm:px-8 md:grid-cols-[1.6fr_repeat(4,1fr)] md:py-16">
        <div className="col-span-2 max-w-xs md:col-span-1">
          <Link href="/" className="inline-block rounded-sm" aria-label="BackendFoundry home">
            <Logo />
          </Link>
          <p className="mt-4 text-steel">
            Typed TypeScript components for the parts of an API you should not rewrite on every project.
          </p>
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            className="mt-5 inline-flex h-8 items-center gap-2 rounded-full border border-hairline px-3 text-caption font-medium text-ink transition-colors hover:bg-surface"
          >
            <Github className="h-3.5 w-3.5" aria-hidden="true" /> Star on GitHub
          </a>
        </div>
        {columns.map((col) => (
          <nav key={col.title} aria-label={col.title}>
            <h2 className="text-body-sm font-medium text-ink">{col.title}</h2>
            <ul className="mt-4 space-y-2.5">
              {col.links.map((link) => (
                <li key={link.label}>
                  {link.external ? (
                    <a href={link.href} target="_blank" rel="noreferrer" className={linkClass}>
                      {link.label}
                    </a>
                  ) : (
                    <Link href={link.href} className={linkClass}>
                      {link.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-hairline-soft">
        <div className="mx-auto flex w-full max-w-container flex-col gap-2 px-5 py-6 text-caption text-stone sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p>MIT licensed. Copyright 2026 BackendFoundry contributors.</p>
          <p>Requires Node.js 18.18+ and TypeScript 5.0+</p>
        </div>
      </div>
    </footer>
  );
}
