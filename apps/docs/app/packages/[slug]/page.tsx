import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Callout } from "@/components/ui";
import { ComponentSidebar, type SidebarGroup } from "../../../components/component-page/component-sidebar";
import { OnThisPage, type TocItem } from "../../../components/component-page/on-this-page";
import {
  ApiReference,
  ComponentHeader,
  ComponentPager,
  ConfigReference,
  DependencyTable,
  InstallTabs,
  PageSection,
  SecurityNotes,
  SubHeading,
  UsageTabs
} from "../../../components/component-page/sections";
import { ScenarioRunner } from "../../../components/playground/scenario-runner";
import { getComponentsByCategory, getPackageBySlug, packages, toPlaygroundSummary } from "../../../lib/registry";

export const dynamicParams = false;

export function generateStaticParams() {
  return packages.map((p) => ({ slug: p.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const pkg = getPackageBySlug(params.slug);
  if (!pkg) return { title: "Component not found" };
  return { title: `${pkg.displayName} (${pkg.packageName})`, description: pkg.description };
}

export default function PackageDetailPage({ params }: { params: { slug: string } }) {
  const pkg = getPackageBySlug(params.slug);
  if (!pkg) notFound();

  const groups = getComponentsByCategory();
  const sidebar: SidebarGroup[] = groups.map((g) => ({
    category: g.category,
    items: g.items.map((p) => ({ slug: p.slug, name: p.name }))
  }));
  const ordered = groups.flatMap((g) => g.items);
  const idx = ordered.findIndex((p) => p.slug === pkg.slug);
  const prev = idx > 0 ? ordered[idx - 1] : undefined;
  const next = idx >= 0 && idx < ordered.length - 1 ? ordered[idx + 1] : undefined;

  const hasConfig = pkg.configSchema.length > 0;
  const hasNotes = pkg.securityNotes.length > 0 || pkg.limitations.length > 0;
  const toc: TocItem[] = [
    { id: "installation", title: "Installation" },
    { id: "usage", title: "Usage" },
    { id: "api", title: "API reference" },
    ...(hasConfig ? [{ id: "configuration", title: "Configuration", depth: 2 as const }] : []),
    ...(pkg.hasPlayground ? [{ id: "playground", title: "Playground" }] : []),
    ...(hasNotes ? [{ id: "security", title: "Security & limitations" }] : []),
    { id: "dependencies", title: "Dependencies" }
  ];

  return (
    <main className="bg-canvas">
      <div className="mx-auto grid w-full max-w-[1440px] lg:grid-cols-[256px_minmax(0,1fr)] xl:grid-cols-[272px_minmax(0,1fr)_232px]">
        <ComponentSidebar groups={sidebar} activeSlug={pkg.slug} />

        <article className="min-w-0 px-5 pb-20 pt-8 sm:px-8 lg:border-l lg:border-hairline-soft lg:px-12 lg:pt-10">
          <div className="mx-auto max-w-[768px]">
            <ComponentHeader component={pkg} />

            <PageSection
              id="installation"
              title="Installation"
              description={
                pkg.cli.sourceAddSupported
                  ? "Copy the TypeScript source into your project with the CLI and own it, or install the package from npm."
                  : "Install the package from npm."
              }
            >
              <InstallTabs component={pkg} />
              {pkg.cli.sourceAddReason && <p className="mt-3 text-[14px] leading-[1.5] text-steel">{pkg.cli.sourceAddReason}</p>}
            </PageSection>

            <PageSection id="usage" title="Usage" description={`The same component wired into ${pkg.supportedFrameworks.join(", ")}.`}>
              <UsageTabs component={pkg} />
            </PageSection>

            <PageSection id="api" title="API reference" description={`Everything exported from ${pkg.packageName}.`}>
              <ApiReference apis={pkg.exportedApis} />
              {hasConfig && (
                <>
                  <SubHeading id="configuration">Configuration</SubHeading>
                  <p className="mt-2 text-[14px] leading-[1.5] text-steel">Options accepted by the factory function.</p>
                  <div className="mt-2">
                    <ConfigReference options={pkg.configSchema} />
                  </div>
                </>
              )}
              {pkg.errorBehavior && (
                <div className="mt-8">
                  <Callout tone="tip" title="Error behavior">
                    {pkg.errorBehavior}
                  </Callout>
                </div>
              )}
            </PageSection>

            {pkg.hasPlayground && (
              <PageSection
                id="playground"
                title="Playground"
                description="Edit the inputs and run the scenario. It executes the real package in a server route handler, with a simulated clock for anything time-based."
              >
                <ScenarioRunner component={toPlaygroundSummary(pkg)} variant="embedded" />
              </PageSection>
            )}

            {hasNotes && (
              <PageSection id="security" title="Security & limitations">
                <SecurityNotes component={pkg} />
              </PageSection>
            )}

            <PageSection id="dependencies" title="Dependencies">
              <DependencyTable component={pkg} />
            </PageSection>

            <ComponentPager prev={prev} next={next} />
          </div>
        </article>

        <aside className="hidden xl:block">
          <div className="sticky top-16 max-h-[calc(100vh-4rem)] overflow-y-auto py-10 pl-2 pr-8">
            <OnThisPage items={toc} />
          </div>
        </aside>
      </div>
    </main>
  );
}
