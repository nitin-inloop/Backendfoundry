import {
  ArrowRight,
  BadgeCheck,
  Check,
  ChevronRight,
  FileCode2,
  FlaskConical,
  Package,
  ScrollText,
  ShieldCheck,
  Workflow
} from "lucide-react";
import Link from "next/link";
import { Button } from "../components/ui/button";
import { CodeBlock } from "../components/ui/code-block";
import { CommandLine } from "../components/ui/command-line";
import { FadeIn, Stagger, StaggerItem } from "../components/ui/motion";
import { Container, Section, SectionHeading } from "../components/ui/section";
import { CliTerminal } from "../components/site/landing/cli-terminal";
import { ComponentsBento } from "../components/site/landing/components-bento";
import { FrameworkStrip } from "../components/site/landing/framework-strip";
import { PipelineDemo } from "../components/site/landing/pipeline-demo";
import { HeroBackdrop } from "../components/site/landing/hero-backdrop";
import { getSiteComponents } from "../components/site/registry-items";
import { INSTALL_COMMAND } from "../components/site/site-config";

const FEATURES = [
  {
    icon: Package,
    title: "Zero runtime dependencies",
    body: "Built on Node.js primitives: node:crypto, AsyncLocalStorage and AbortSignal. Redis and Zod stay optional and are passed in by you."
  },
  {
    icon: FileCode2,
    title: "Fully typed",
    body: "Strict TypeScript with ESM, CommonJS and .d.ts output. Schemas infer request types and every error carries a typed code."
  },
  {
    icon: Workflow,
    title: "Framework-agnostic",
    body: "The logic is plain functions. Thin adapters for Express, Fastify and Next.js Route Handlers sit on top and stay optional."
  },
  {
    icon: FlaskConical,
    title: "Tested alone and together",
    body: "Each package ships unit tests, and an ecosystem suite checks that the blocks compose correctly inside one request."
  },
  {
    icon: ShieldCheck,
    title: "Secure defaults",
    body: "Strict schemas reject unknown keys, errors never leak stack traces, logs redact secrets and signatures compare in constant time."
  },
  {
    icon: ScrollText,
    title: "Limits written down",
    body: "Every component says what it does not do. Memory stores are process-local, and the docs say when to switch to Redis."
  }
];

const SOURCE_POINTS = [
  "Read, debug and change every line",
  "Dependencies between blocks are copied too",
  "Refuses to overwrite files you have edited",
  "No packages added to package.json"
];

const PACKAGE_POINTS = [
  "Updates arrive through your package manager",
  "ESM, CommonJS and type declarations included",
  "Nothing extra to review in your repository",
  "Pin and upgrade with semver"
];

export default function HomePage() {
  const count = getSiteComponents().length || 12;

  return (
    <main>
      {/* Hero */}
      <section aria-labelledby="hero-title" className="relative -mt-16 overflow-hidden pt-16">
        <HeroBackdrop />
        <Container className="relative pb-16 pt-14 md:pb-24 md:pt-24">
          <div className="dark mx-auto max-w-[920px] text-center">
            <div className="bf-rise">
              <Link
                href="/changelog"
                className="group inline-flex items-center gap-2 rounded-full border border-white/60 bg-white/55 py-1 pl-1 pr-3 text-caption text-slate shadow-subtle backdrop-blur-md transition-colors hover:bg-white/75 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
              >
                <span className="rounded-full bg-primary px-2 py-0.5 text-micro font-medium text-on-primary">v1.0.0</span>
                {count} components, MIT licensed
                <ChevronRight className="h-3.5 w-3.5 text-steel transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </Link>
            </div>
            <div className="bf-rise [animation-delay:60ms]">
              <h1
                id="hero-title"
                className="mt-7 text-balance text-[40px] font-semibold leading-[1.05] tracking-[-1.2px] text-ink sm:text-[56px] sm:tracking-[-1.5px] lg:text-hero-display"
              >
                Production backend blocks, as code you own.
              </h1>
            </div>
            <div className="bf-rise [animation-delay:120ms]">
              <p className="mx-auto mt-6 max-w-[640px] text-pretty text-subtitle text-slate">
                Rate limiting, validation, idempotency, retries and eight more typed TypeScript components. Install them
                from npm, or copy the source into your repo with one command.
              </p>
            </div>
            <div className="bf-rise [animation-delay:180ms]">
              <div className="mx-auto mt-9 flex max-w-[760px] flex-col items-stretch gap-3 md:flex-row md:items-center md:justify-center">
                <CommandLine
                  command={INSTALL_COMMAND}
                  className="border-white/70 bg-white/70 shadow-subtle backdrop-blur-md dark:border-white/10 dark:bg-white/5 md:w-[420px]"
                />
                <div className="flex gap-3">
                  <Button href="/packages" className="h-11 flex-1 px-5 sm:flex-none">
                    Browse components
                  </Button>
                  <Button href="/docs/getting-started" variant="secondary" className="h-11 flex-1 border-white/70 bg-white/50 px-5 dark:border-white/15 dark:bg-white/5 sm:flex-none">
                    Quick start
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="bf-rise mx-auto mt-14 max-w-[1080px] [animation-delay:300ms] [animation-duration:900ms] md:mt-20">
            <PipelineDemo />
          </div>
        </Container>
      </section>

      {/* Frameworks */}
      <section aria-label="Supported frameworks" className="border-b border-hairline-soft bg-canvas">
        <Container className="py-10 md:py-12">
          <FrameworkStrip />
        </Container>
      </section>

      {/* Components */}
      <Section id="components" labelledBy="components-title">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <FadeIn>
            <SectionHeading
              id="components-title"
              title={`${count} components, one consistent shape`}
              description="Each one is a factory with a typed config, a framework-free core and optional adapters. Every page has the API reference, framework examples and a playground."
            />
          </FadeIn>
          <Button href="/packages" variant="secondary" className="self-start md:self-auto">
            All components <ArrowRight aria-hidden="true" />
          </Button>
        </div>
        <div className="mt-12">
          <ComponentsBento />
        </div>
      </Section>

      {/* Copy or install */}
      <Section labelledBy="modes-title" divider="hairline">
        <FadeIn>
          <SectionHeading
            id="modes-title"
            align="center"
            title="Copy the source, or install the package"
            description="Same code, same API. Pick per component, and switch later without rewriting your routes."
          />
        </FadeIn>
        <Stagger className="mx-auto mt-12 grid max-w-[1080px] gap-4 lg:grid-cols-2" stagger={0.1}>
          <StaggerItem className="flex flex-col rounded-xl border-2 border-brand-green bg-canvas p-6 shadow-brand md:p-8">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-heading-4 text-ink">Copy the source</h3>
              <span className="rounded-full bg-brand-green px-2.5 py-0.5 text-micro font-semibold text-primary">Default</span>
            </div>
            <p className="mt-2 text-body-sm text-steel">
              The CLI writes TypeScript files into <code className="font-mono text-[13px] text-charcoal">src/lib/backendfoundry</code> with
              imports rewritten to relative paths. The code is yours from then on.
            </p>
            <CommandLine command="npx @backendfoundry/cli add retry" size="sm" className="mt-5" />
            <CodeBlock
              className="mt-3"
              language="text"
              copy={false}
              code={`src/lib/backendfoundry/
├─ core.ts      (dependency)
├─ errors.ts    (dependency)
└─ retry.ts`}
            />
            <ul className="mt-6 space-y-2.5">
              {SOURCE_POINTS.map((p) => (
                <li key={p} className="flex gap-2.5 text-body-sm text-slate">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-green-deep" aria-hidden="true" />
                  {p}
                </li>
              ))}
            </ul>
          </StaggerItem>
          <StaggerItem className="flex flex-col rounded-xl border border-hairline bg-canvas p-6 md:p-8">
            <h3 className="text-heading-4 text-ink">Install the package</h3>
            <p className="mt-2 text-body-sm text-steel">
              Pass <code className="font-mono text-[13px] text-charcoal">--npm --install</code> and the CLI runs the install
              with the package manager your lockfile uses.
            </p>
            <CommandLine command="npx @backendfoundry/cli add retry --npm --install" size="sm" className="mt-5" />
            <CodeBlock
              className="mt-3"
              language="json"
              copy={false}
              code={`"dependencies": {
  "@backendfoundry/retry": "^1.0.0"
}`}
            />
            <ul className="mt-6 space-y-2.5">
              {PACKAGE_POINTS.map((p) => (
                <li key={p} className="flex gap-2.5 text-body-sm text-slate">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-green-deep" aria-hidden="true" />
                  {p}
                </li>
              ))}
            </ul>
          </StaggerItem>
        </Stagger>
        <FadeIn className="mx-auto mt-4 max-w-[1080px]">
          <div className="grid items-center gap-3 rounded-xl border border-hairline bg-surface-soft p-4 md:grid-cols-[auto_1fr_1fr] md:gap-6 md:px-6">
            <p className="text-body-sm font-medium text-ink">Only the import changes</p>
            <code className="truncate rounded-md border border-hairline bg-canvas px-3 py-2 font-mono text-[12.5px] text-slate">
              import {"{ createRetry }"} from &quot;./lib/backendfoundry/retry&quot;;
            </code>
            <code className="truncate rounded-md border border-hairline bg-canvas px-3 py-2 font-mono text-[12.5px] text-slate">
              import {"{ createRetry }"} from &quot;@backendfoundry/retry&quot;;
            </code>
          </div>
        </FadeIn>
      </Section>

      {/* Features */}
      <Section labelledBy="why-title" tone="surface" divider="hairline">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,2fr)] lg:gap-16">
          <FadeIn>
            <SectionHeading
              id="why-title"
              title="The plumbing you would write anyway, done once"
              description="Edge cases handled, trade-offs documented, and nothing hidden behind a framework."
            />
            <div className="mt-8 flex items-center gap-2 text-body-sm text-steel">
              <BadgeCheck className="h-4 w-4 text-brand-green-deep" aria-hidden="true" />
              Node.js 18.18+ and TypeScript 5.0+
            </div>
          </FadeIn>
          <Stagger as="ul" className="grid overflow-hidden rounded-xl border border-hairline bg-canvas sm:grid-cols-2" stagger={0.05}>
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <StaggerItem as="li" key={title} className="-mb-px -mr-px border-b border-r border-hairline p-6 md:p-7">
                <Icon className="h-5 w-5 text-ink" aria-hidden="true" />
                <h3 className="mt-4 text-body-md font-semibold text-ink">{title}</h3>
                <p className="mt-1.5 text-body-sm text-steel">{body}</p>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </Section>

      {/* CLI */}
      <Section labelledBy="cli-title" divider="hairline">
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16">
          <FadeIn>
            <SectionHeading
              id="cli-title"
              title="One command per block"
              description="The CLI reads the registry, resolves dependencies between blocks and checks for file conflicts before it writes anything."
            />
            <dl className="mt-8 space-y-4 text-body-sm">
              {[
                ["add <component...>", "Copy source, or install with --npm --install"],
                ["list", "Every component and its category"],
                ["info <component>", "Exports, options, dependencies and limits"]
              ].map(([cmd, what]) => (
                <div key={cmd} className="flex flex-col gap-0.5 border-l-2 border-hairline pl-4">
                  <dt className="font-mono text-[13px] text-ink">{cmd}</dt>
                  <dd className="text-steel">{what}</dd>
                </div>
              ))}
            </dl>
            <Button href="/docs/installation" variant="secondary" className="mt-8">
              Installation guide <ArrowRight aria-hidden="true" />
            </Button>
          </FadeIn>
          <FadeIn delay={0.1}>
            <CliTerminal />
          </FadeIn>
        </div>
      </Section>

      {/* CTA band */}
      <section aria-labelledby="cta-title" className="px-3 pb-3 sm:px-4 sm:pb-4">
        <div className="bf-hero-dark relative overflow-hidden rounded-2xl">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-24 -top-24 h-[420px] w-[420px] animate-drift-a rounded-full bg-[radial-gradient(closest-side,rgba(0,212,164,0.28),transparent)]"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:radial-gradient(#ffffff_1px,transparent_1px)] [background-size:22px_22px]"
          />
          <Container className="relative flex flex-col items-start gap-10 py-16 md:py-24 lg:flex-row lg:items-center lg:justify-between">
            <FadeIn className="max-w-xl">
              <h2 id="cta-title" className="text-balance text-[32px] font-semibold leading-[1.1] tracking-[-0.8px] text-on-dark md:text-heading-1">
                Start with the block you need today
              </h2>
              <p className="mt-4 text-subtitle text-on-dark-muted">
                Most teams begin with rate limiting and error handling, then add the rest as the API grows.
              </p>
            </FadeIn>
            <FadeIn delay={0.1} className="flex w-full flex-col gap-4 lg:w-auto">
              <CommandLine command="npx @backendfoundry/cli add rate-limit errors" tone="dark" className="border-white/10 bg-black/25 lg:min-w-[420px]" />
              <div className="flex flex-wrap gap-3">
                <Button href="/docs/getting-started" variant="on-dark">
                  Read the quick start
                </Button>
                <Button href="/playground" variant="ghost" className="h-10 rounded-full px-5 text-on-dark hover:bg-white/10">
                  Open the playground <ArrowRight aria-hidden="true" />
                </Button>
              </div>
            </FadeIn>
          </Container>
        </div>
      </section>
    </main>
  );
}
