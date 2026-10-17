import type { Metadata } from "next";
import { CodeBlock } from "../../../components/ui/code-block";
import { DocsPage } from "../../../components/site/docs-shell";
import { GITHUB_URL } from "../../../components/site/site-config";

export const metadata: Metadata = {
  title: "Contributing",
  description: "Set up the BackendFoundry monorepo, run the checks and add or change a component."
};

export default function ContributingPage() {
  return (
    <DocsPage
      href="/docs/contributing"
      title="Contributing"
      description="Fixes, framework adapters and documentation improvements are welcome. This page covers the repository layout and what a change needs before review."
      toc={[
        { id: "layout", title: "Repository layout" },
        { id: "setup", title: "Set up" },
        { id: "standards", title: "Package standards" },
        { id: "new-component", title: "Adding a component" }
      ]}
    >
      <h2 id="layout">Repository layout</h2>
      <CodeBlock
        language="text"
        code={`packages/          one directory per component (core, rate-limit, retry, ...)
registry/          registry.json: the source of truth for the CLI and this site
apps/docs/         this documentation site and playground (Next.js)
examples/          Express, Fastify and Next.js example APIs
tests/             cross-package integration tests
scripts/           build, test and lint entry points`}
      />

      <h2 id="setup">Set up</h2>
      <CodeBlock
        language="bash"
        code={`pnpm install
node scripts/build-packages.mjs   # ESM, CommonJS and .d.ts for every package
node scripts/run-tests.mjs        # unit and integration tests
node scripts/lint-check.mjs       # lint, type and registry checks
pnpm dev:docs                     # run this site on localhost:3000`}
      />

      <h2 id="standards">Package standards</h2>
      <ul>
        <li>
          Keep <code>@backendfoundry/core</code> free of framework and database dependencies.
        </li>
        <li>Export ESM, CommonJS and type declarations from every package.</li>
        <li>Document process-local versus distributed behaviour honestly.</li>
        <li>
          Test normal behaviour, invalid configuration, boundary conditions, concurrency and secret redaction.
        </li>
        <li>Never echo secrets in error messages, logs or validation output.</li>
      </ul>

      <h2 id="new-component">Adding a component</h2>
      <ol>
        <li>
          Create <code>packages/&lt;name&gt;</code> with <code>src/index.ts</code>, tests and a{" "}
          <code>package.json</code> following an existing package.
        </li>
        <li>
          Add an entry to <code>registry/registry.json</code> with exports, configuration, limitations and examples.
          The CLI and component pages read from it.
        </li>
        <li>Run all three scripts and confirm they pass.</li>
        <li>
          Open a pull request on <a href={GITHUB_URL}>GitHub</a> describing the problem the component solves and its
          limits.
        </li>
      </ol>
    </DocsPage>
  );
}
