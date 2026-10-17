import type { Metadata } from "next";
import { CatalogBrowser, type CatalogItem } from "../../components/component-page/catalog-browser";
import { getComponentsByCategory, packages, registry } from "../../lib/registry";

export const metadata: Metadata = {
  title: "Components",
  description: "Every BackendFoundry backend component, grouped by category. Install from npm or copy the source with the CLI."
};

export default function PackagesCatalogPage() {
  const groups = getComponentsByCategory();
  const items: CatalogItem[] = groups.flatMap((g) =>
    g.items.map((p) => ({
      slug: p.slug,
      name: p.name,
      displayName: p.displayName,
      packageName: p.packageName,
      description: p.description,
      category: p.category,
      sourceAdd: p.cli.sourceAddSupported,
      npm: p.cli.npmInstall,
      playgroundTitle: p.playground.title,
      apiCount: p.exportedApis.length
    }))
  );

  return (
    <main className="bg-canvas">
      <header className="border-b border-hairline-soft">
        <div className="mx-auto w-full max-w-[1280px] px-5 pb-10 pt-12 sm:px-8 lg:pb-12 lg:pt-16">
          <h1 className="max-w-3xl text-[36px] font-semibold leading-[1.1] tracking-[-1px] text-ink md:text-[48px]">Components</h1>
          <p className="mt-4 max-w-2xl text-[18px] leading-[1.5] text-steel">
            {packages.length} typed backend building blocks. Install a package from npm, or copy its TypeScript source into your
            project with the CLI and own every line.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-3 text-[14px] text-steel">
            <code className="inline-flex items-center gap-2 rounded-md border border-hairline bg-surface-soft px-3 py-1.5 font-mono text-[13px] text-charcoal">
              <span className="select-none text-stone">$</span>
              npx {registry.brand.cli.package} add &lt;component&gt;
            </code>
            <span>
              Version <span className="font-mono text-charcoal">{registry.brand.version}</span>
            </span>
            <span>{registry.brand.license} licensed</span>
          </div>
        </div>
      </header>
      <CatalogBrowser items={items} categories={groups.map((g) => g.category)} />
    </main>
  );
}
