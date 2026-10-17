/**
 * Docs page chrome (DESIGN: 3-column documentation layout).
 *   <DocsShell>  sidebar (240px) + content column. Used by app/docs/layout.tsx, /changelog and /license.
 *   <DocsPage>   breadcrumbs, title + lead, Prose body, prev/next cards, and a right-rail
 *                "On this page" TOC with scroll-spy and an "Edit this page" link.
 *                Props: title, description?, href (current route, for breadcrumbs/pager/edit link),
 *                       toc?: {id,title}[], children
 */
import { ChevronRight, SquarePen } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Container } from "../ui/section";
import { Prose } from "../ui/prose";
import { DocsSidebar } from "./docs-sidebar";
import { DocsToc } from "./docs-toc";
import { DOCS_FLAT, DOCS_NAV, GITHUB_URL } from "./site-config";

export function DocsShell({ children }: { children: ReactNode }) {
  return (
    <Container className="grid grid-cols-1 gap-6 pb-20 pt-6 lg:grid-cols-[232px_minmax(0,1fr)] lg:gap-12 lg:pt-10">
      <aside className="lg:sticky lg:top-[88px] lg:max-h-[calc(100vh-104px)] lg:self-start lg:overflow-y-auto lg:pb-10 lg:pr-2 lg:[scrollbar-width:thin]">
        <DocsSidebar />
      </aside>
      <div className="min-w-0">{children}</div>
    </Container>
  );
}

export interface DocsPageProps {
  title: string;
  description?: string;
  href: string;
  toc?: { id: string; title: string }[];
  children: ReactNode;
}

function editUrl(href: string) {
  const route = href === "/" ? "" : href;
  return `${GITHUB_URL}/edit/main/apps/docs/app${route}/page.tsx`;
}

export function DocsPage({ title, description, href, toc = [], children }: DocsPageProps) {
  const index = DOCS_FLAT.findIndex((i) => i.href === href);
  const prev = index > 0 ? DOCS_FLAT[index - 1] : undefined;
  const next = index >= 0 && index < DOCS_FLAT.length - 1 ? DOCS_FLAT[index + 1] : undefined;
  const group = DOCS_NAV.find((g) => g.items.some((i) => i.href === href));

  return (
    <div className="grid grid-cols-1 gap-12 xl:grid-cols-[minmax(0,1fr)_208px]">
      <article className="min-w-0">
        <header className="max-w-prose">
          <nav aria-label="Breadcrumb" className="hidden lg:block">
            <ol className="flex flex-wrap items-center gap-1 text-caption text-steel">
              <li>
                <Link href="/docs" className="rounded-xs transition-colors hover:text-ink">
                  Docs
                </Link>
              </li>
              {group && (
                <li className="flex items-center gap-1 font-medium text-ink">
                  <ChevronRight className="h-3.5 w-3.5 text-muted" aria-hidden="true" />
                  {group.title}
                </li>
              )}
            </ol>
          </nav>
          <h1 className="text-balance lg:mt-3 text-[32px] font-semibold leading-[1.15] tracking-[-0.8px] text-ink md:text-[40px] md:tracking-[-1px]">
            {title}
          </h1>
          {description && <p className="mt-4 text-pretty text-subtitle text-steel">{description}</p>}
        </header>

        <div className="mt-10 border-t border-hairline-soft pt-10">
          <Prose>{children}</Prose>
        </div>

        <footer className="mt-16 max-w-prose">
          {(prev || next) && (
            <nav aria-label="Pagination" className="grid gap-4 sm:grid-cols-2">
              {prev ? (
                <Link
                  href={prev.href}
                  className="group rounded-lg border border-hairline p-4 transition-[border-color,box-shadow] duration-200 hover:border-stone/40 hover:shadow-subtle"
                >
                  <span className="text-caption text-steel">Previous</span>
                  <span className="mt-1 flex items-center gap-1.5 text-body-md font-medium text-ink">
                    <ChevronRight className="h-4 w-4 rotate-180 text-stone transition-transform group-hover:-translate-x-0.5" aria-hidden="true" />
                    {prev.title}
                  </span>
                </Link>
              ) : (
                <span className="hidden sm:block" />
              )}
              {next && (
                <Link
                  href={next.href}
                  className="group rounded-lg border border-hairline p-4 text-right transition-[border-color,box-shadow] duration-200 hover:border-stone/40 hover:shadow-subtle"
                >
                  <span className="text-caption text-steel">Next</span>
                  <span className="mt-1 flex items-center justify-end gap-1.5 text-body-md font-medium text-ink">
                    {next.title}
                    <ChevronRight className="h-4 w-4 text-stone transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                  </span>
                </Link>
              )}
            </nav>
          )}
          <div className="mt-8 flex items-center justify-between border-t border-hairline-soft pt-6 text-caption text-steel xl:hidden">
            <a href={editUrl(href)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 transition-colors hover:text-ink">
              <SquarePen className="h-3.5 w-3.5" aria-hidden="true" /> Edit this page
            </a>
          </div>
        </footer>
      </article>

      <aside className="hidden xl:block">
        <div className="sticky top-[88px]">
          <DocsToc items={toc} editHref={editUrl(href)} />
        </div>
      </aside>
    </div>
  );
}
