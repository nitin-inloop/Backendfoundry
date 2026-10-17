/**
 * Building blocks for /packages/[slug] component pages. Server components; the
 * client islands are the install code group, Tabs, TOC, sidebar and playground.
 */
import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight, Play } from "lucide-react";
import { Badge, Button, Callout, CodeBlock, Tabs } from "@/components/ui";
import type { ConfigOption, ExportedApi, RegistryComponent } from "../../lib/registry";
import { cn } from "../../lib/cn";
import { ComponentIcon } from "./component-icon";
import { InstallBlock, type InstallOption } from "./install-block";

/* ------------------------------------------------------------------------- */
/* Layout                                                                     */
/* ------------------------------------------------------------------------- */

export function PageSection({
  id,
  title,
  description,
  children,
  className
}: {
  id: string;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className={cn("scroll-mt-28 pt-12", className)}>
      <h2 id={`${id}-title`} className="group text-[22px] font-semibold leading-[1.3] text-ink md:text-[24px]">
        <a href={`#${id}`} className="relative">
          {title}
          <span
            aria-hidden="true"
            className="ml-2 text-[18px] font-normal text-muted opacity-0 transition-opacity group-hover:opacity-100"
          >
            #
          </span>
        </a>
      </h2>
      {description && <p className="mt-2 max-w-[68ch] text-[16px] leading-[1.5] text-steel">{description}</p>}
      <div className="mt-6">{children}</div>
    </section>
  );
}

export function SubHeading({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h3 id={id} className="scroll-mt-28 pt-10 text-[18px] font-semibold leading-[1.4] text-ink">
      {children}
    </h3>
  );
}

/* ------------------------------------------------------------------------- */
/* Header                                                                     */
/* ------------------------------------------------------------------------- */

export function ComponentHeader({ component }: { component: RegistryComponent }) {
  const tests = component.status?.tests;
  return (
    <header>
      <nav aria-label="Breadcrumb" className="hidden lg:block">
        <ol className="flex flex-wrap items-center gap-1.5 text-[13px] text-steel">
          <li>
            <Link href="/packages" className="transition-colors hover:text-ink">
              Components
            </Link>
          </li>
          <li aria-hidden="true">
            <ChevronRight className="h-3.5 w-3.5 text-muted" />
          </li>
          <li>{component.category}</li>
          <li aria-hidden="true">
            <ChevronRight className="h-3.5 w-3.5 text-muted" />
          </li>
          <li aria-current="page" className="font-medium text-ink">
            {component.name}
          </li>
        </ol>
      </nav>

      <div className="flex items-start gap-4 lg:mt-6">
        <ComponentIcon slug={component.slug} size="lg" className="mt-1 hidden sm:inline-flex" />
        <div className="min-w-0">
          <h1 className="text-[32px] font-semibold leading-[1.15] tracking-[-0.75px] text-ink md:text-[40px] md:tracking-[-1px]">
            {component.displayName}
          </h1>
          <p className="mt-1.5 font-mono text-[14px] text-stone">{component.packageName}</p>
        </div>
      </div>

      <p className="mt-5 max-w-[68ch] text-[18px] leading-[1.5] text-steel">{component.description}</p>

      <div className="mt-5 flex flex-wrap items-center gap-1.5">
        <Badge tone="tag">{component.category}</Badge>
        <Badge tone="neutral">v{component.version}</Badge>
        {component.cli.npmInstall && <Badge tone="neutral">package</Badge>}
        {component.cli.sourceAddSupported && <Badge tone="neutral">source</Badge>}
        {tests && (
          <Badge tone={tests === "passing" ? "primary" : "warn"} dot>
            tests {tests}
          </Badge>
        )}
      </div>

      <div className="mt-7 flex flex-wrap gap-3">
        <Button href={`/playground?component=${component.slug}`} variant="primary" size="md">
          <Play className="h-3.5 w-3.5" aria-hidden="true" />
          Open in playground
        </Button>
        <Button href="#installation" variant="secondary" size="md">
          Install
        </Button>
      </div>
    </header>
  );
}

/* ------------------------------------------------------------------------- */
/* Install + usage                                                            */
/* ------------------------------------------------------------------------- */

export function InstallTabs({ component }: { component: RegistryComponent }) {
  const options: InstallOption[] = [];
  if (component.cli.sourceAddSupported) {
    options.push({
      id: "cli",
      label: "CLI (source)",
      command: component.install.cli,
      note: component.cli.targetFile ? `Copies the source to ${component.cli.targetFile}` : undefined
    });
  }
  options.push(
    { id: "npm", label: "npm", command: component.install.npm },
    { id: "pnpm", label: "pnpm", command: component.install.pnpm },
    { id: "yarn", label: "yarn", command: component.install.yarn }
  );
  return <InstallBlock options={options} />;
}

const FRAMEWORK_LABEL: Record<string, string> = {
  basic: "TypeScript",
  express: "Express",
  fastify: "Fastify",
  nextjs: "Next.js"
};

const FRAMEWORK_FILE: Record<string, string> = {
  basic: "index.ts",
  express: "server.ts",
  fastify: "server.ts",
  nextjs: "app/api/route.ts"
};

export function UsageTabs({ component }: { component: RegistryComponent }) {
  const entries = (Object.entries(component.examples) as [string, string | undefined][]).filter(
    (e): e is [string, string] => typeof e[1] === "string" && e[1].trim().length > 0
  );
  if (entries.length === 0) {
    return <CodeBlock code={component.usage} language="ts" filename="index.ts" />;
  }
  return (
    <Tabs
      variant="underline"
      label="Usage examples by framework"
      items={entries.map(([key, code]) => ({
        id: key,
        label: FRAMEWORK_LABEL[key] ?? key,
        content: <CodeBlock code={code} language="ts" filename={FRAMEWORK_FILE[key] ?? "index.ts"} showLineNumbers />
      }))}
    />
  );
}

/* ------------------------------------------------------------------------- */
/* API reference (Mintlify property rows)                                     */
/* ------------------------------------------------------------------------- */

function TypeBadge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex max-w-full items-center rounded-sm bg-surface px-1.5 py-0.5 font-mono text-[12px] leading-[1.4] text-steel">
      <span className="truncate">{children}</span>
    </span>
  );
}

function RequiredBadge() {
  return (
    <span className="inline-flex items-center rounded-sm bg-brand-error px-1.5 py-0.5 text-[11px] font-semibold uppercase leading-[1.4] tracking-[0.5px] text-on-dark">
      required
    </span>
  );
}

export function ParamField({
  name,
  type,
  required,
  defaultValue,
  children,
  id
}: {
  name: string;
  type?: string;
  required?: boolean;
  defaultValue?: string;
  children: ReactNode;
  id?: string;
}) {
  return (
    <div id={id} className="scroll-mt-28 border-b border-hairline-soft py-4 last:border-b-0">
      <div className="flex flex-wrap items-center gap-2">
        <code className="font-mono text-[14px] font-semibold text-ink">{name}</code>
        {type && <TypeBadge>{type}</TypeBadge>}
        {required && <RequiredBadge />}
        {defaultValue !== undefined && defaultValue !== "" && (
          <span className="text-[13px] text-stone">
            default: <code className="font-mono text-[12px] text-steel">{defaultValue}</code>
          </span>
        )}
      </div>
      <div className="mt-2 text-[14px] leading-[1.5] text-steel">{children}</div>
    </div>
  );
}

export function ApiReference({ apis }: { apis: ExportedApi[] }) {
  return (
    <div>
      {apis.map((api) => (
        <ParamField key={api.name} name={api.name} type={api.kind}>
          <p>{api.description}</p>
          <pre className="mt-2.5 overflow-x-auto rounded-md border border-hairline bg-surface-soft px-3 py-2 font-mono text-[13px] leading-[1.5] text-charcoal">
            {api.signature}
          </pre>
        </ParamField>
      ))}
    </div>
  );
}

export function ConfigReference({ options }: { options: ConfigOption[] }) {
  return (
    <div>
      {options.map((o) => (
        <ParamField key={o.option} name={o.option} type={o.type} required={o.required} defaultValue={o.default}>
          <p>{o.description}</p>
        </ParamField>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------------- */
/* Notes + dependencies                                                       */
/* ------------------------------------------------------------------------- */

export function SecurityNotes({ component }: { component: RegistryComponent }) {
  return (
    <div className="space-y-4">
      {component.securityNotes.length > 0 && (
        <Callout tone="warning" title="Security">
          <ul className="list-disc space-y-1.5 pl-4 marker:text-stone">
            {component.securityNotes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </Callout>
      )}
      {component.limitations.length > 0 && (
        <Callout tone="note" title="Limitations">
          <ul className="list-disc space-y-1.5 pl-4 marker:text-stone">
            {component.limitations.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </Callout>
      )}
    </div>
  );
}

export function DependencyTable({ component }: { component: RegistryComponent }) {
  const deps = Object.entries(component.dependencies ?? {});
  const optional = Object.entries(component.optionalDependencies ?? {});
  const rows: [string, ReactNode][] = [
    ["Runtime", component.runtimeRequirements],
    ["Frameworks", component.supportedFrameworks.join(", ")],
    [
      "Components",
      component.registryDependencies.length ? (
        <span className="flex flex-wrap gap-1.5">
          {component.registryDependencies.map((d) => (
            <Link
              key={d}
              href={`/packages/${d}`}
              className="rounded-xs border border-hairline bg-surface-soft px-1.5 py-0.5 font-mono text-[12px] text-charcoal transition-colors hover:border-stone/60"
            >
              {d}
            </Link>
          ))}
        </span>
      ) : (
        "None"
      )
    ],
    [
      "npm dependencies",
      deps.length ? (
        <span className="font-mono text-[13px]">{deps.map(([k, v]) => `${k}@${v}`).join(", ")}</span>
      ) : (
        "None, zero runtime dependencies"
      )
    ],
    [
      "Optional peers",
      optional.length ? <span className="font-mono text-[13px]">{optional.map(([k, v]) => `${k}@${v}`).join(", ")}</span> : "None"
    ],
    [
      "Entry points",
      <span key="ep" className="font-mono text-[13px]">
        {component.entryPoints.esm} (ESM), {component.entryPoints.cjs} (CJS), {component.entryPoints.types}
      </span>
    ]
  ];
  return (
    <div className="overflow-hidden rounded-md border border-hairline">
      <table className="w-full text-left text-[14px]">
        <tbody>
          {rows.map(([k, v]) => (
            <tr key={k} className="border-b border-hairline-soft last:border-b-0">
              <th scope="row" className="w-[34%] bg-surface-soft px-4 py-3 align-top text-[13px] font-medium text-steel sm:w-[28%]">
                {k}
              </th>
              <td className="break-words px-4 py-3 align-top text-charcoal">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------------- */
/* Prev / next                                                                */
/* ------------------------------------------------------------------------- */

export function ComponentPager({ prev, next }: { prev?: RegistryComponent; next?: RegistryComponent }) {
  if (!prev && !next) return null;
  const base =
    "group flex flex-col rounded-lg border border-hairline p-5 transition-[border-color,box-shadow] duration-200 hover:border-[#d4d4d4] dark:hover:border-[#3a3a3c] hover:shadow-[0_1px_2px_rgba(0,0,0,0.04)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green";
  return (
    <nav aria-label="Previous and next components" className="mt-16 grid gap-4 border-t border-hairline-soft pt-10 sm:grid-cols-2">
      {prev ? (
        <Link href={`/packages/${prev.slug}`} className={base}>
          <span className="flex items-center gap-1 text-[13px] text-stone">
            <ChevronLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" aria-hidden="true" />
            Previous
          </span>
          <span className="mt-1 text-[16px] font-medium text-ink">{prev.displayName}</span>
        </Link>
      ) : (
        <span className="hidden sm:block" />
      )}
      {next && (
        <Link href={`/packages/${next.slug}`} className={cn(base, "items-end text-right")}>
          <span className="flex items-center gap-1 text-[13px] text-stone">
            Next
            <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </span>
          <span className="mt-1 text-[16px] font-medium text-ink">{next.displayName}</span>
        </Link>
      )}
    </nav>
  );
}
