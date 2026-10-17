import type { Metadata } from "next";
import Link from "next/link";
import { Callout } from "../../../components/ui/callout";
import { CodeBlock } from "../../../components/ui/code-block";
import { CommandLine } from "../../../components/ui/command-line";
import { Tabs } from "../../../components/ui/tabs";
import { DocsPage } from "../../../components/site/docs-shell";

export const metadata: Metadata = {
  title: "Installation",
  description: "Install BackendFoundry components from npm, or copy their source into your project with the CLI."
};

const SOURCE_TABLE = [
  ["core", "Source or package", "Zero dependencies; safe to vendor."],
  ["validation", "Source or package", "Depends only on core."],
  ["retry", "Source or package", "Self-contained reliability helper."],
  ["circuit-breaker", "Source or package", "State machine with no external dependencies."],
  ["webhooks", "Source or package", "Uses node:crypto and core."],
  ["health", "Source or package", "Lightweight probe runner."],
  ["errors", "Source or package", "Error catalog on top of core."],
  ["rate-limit", "Package", "Memory and Redis stores must stay in step."],
  ["cache", "Package", "Ships multiple storage adapters."],
  ["idempotency", "Package", "Needs atomic storage and shared error contracts."],
  ["logger", "Package", "One AsyncLocalStorage store must be shared across modules."],
  ["ai", "Package", "Coordinates validation and retry with provider adapters."]
];

export default function InstallationPage() {
  return (
    <DocsPage
      href="/docs/installation"
      title="Installation"
      description="Every component can be installed as an npm package. Most can also be copied into your codebase as plain TypeScript."
      toc={[
        { id: "packages", title: "Install packages" },
        { id: "cli", title: "Use the CLI" },
        { id: "source", title: "Source mode" },
        { id: "support", title: "Which mode per component" },
        { id: "tsconfig", title: "TypeScript settings" }
      ]}
    >
      <h2 id="packages">Install packages</h2>
      <p>Each component is published separately, so you only ship what you use.</p>
      <Tabs
        label="Package manager"
        items={[
          { id: "pnpm", label: "pnpm", content: <CodeBlock language="bash" code="pnpm add @backendfoundry/rate-limit" /> },
          { id: "npm", label: "npm", content: <CodeBlock language="bash" code="npm install @backendfoundry/rate-limit" /> },
          { id: "yarn", label: "yarn", content: <CodeBlock language="bash" code="yarn add @backendfoundry/rate-limit" /> },
          { id: "bun", label: "bun", content: <CodeBlock language="bash" code="bun add @backendfoundry/rate-limit" /> }
        ]}
        panelClassName="pt-4"
      />
      <p>
        Packages ship ESM (<code>dist/index.js</code>), CommonJS (<code>dist/index.cjs</code>) and type declarations,
        so both <code>import</code> and <code>require</code> work.
      </p>

      <h2 id="cli">Use the CLI</h2>
      <p>The CLI reads the component registry and picks your package manager from the lockfile.</p>
      <CommandLine command="npx @backendfoundry/cli list" />
      <CommandLine command="npx @backendfoundry/cli info idempotency" />
      <CommandLine command="npx @backendfoundry/cli add rate-limit errors" />
      <p>
        <code>add</code> resolves dependencies between components. Adding <code>rate-limit</code> also installs{" "}
        <code>core</code> and <code>errors</code>.
      </p>

      <h2 id="source">Source mode</h2>
      <p>
        Pass <code>--source</code> to copy the TypeScript into <code>src/lib/backendfoundry</code> instead of
        installing a package. The CLI checks every target path first and stops without writing anything if a file
        already exists.
      </p>
      <CommandLine command="npx @backendfoundry/cli add retry webhooks --source" />
      <CodeBlock
        language="text"
        filename="Result"
        code={`src/lib/backendfoundry/
  core.ts
  errors.ts
  retry.ts
  webhooks.ts`}
      />
      <Callout tone="note" title="You own copied code">
        Source files do not receive updates. Check the <Link href="/changelog">changelog</Link> and re-run{" "}
        <code>add --source</code> into a clean branch when you want to pick up fixes.
      </Callout>

      <h2 id="support">Which mode per component</h2>
      <div className="overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th scope="col">Component</th>
              <th scope="col">Modes</th>
              <th scope="col">Reason</th>
            </tr>
          </thead>
          <tbody>
            {SOURCE_TABLE.map(([name, mode, reason]) => (
              <tr key={name}>
                <td>
                  <Link href={`/packages/${name}`} className="font-mono text-[13px] font-medium text-ink underline decoration-hairline underline-offset-4 hover:decoration-brand-green">
                    {name}
                  </Link>
                </td>
                <td className="whitespace-nowrap">{mode}</td>
                <td>{reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 id="tsconfig">TypeScript settings</h2>
      <p>
        Components are written against <code>strict</code> TypeScript 5. A modern module resolution setting is
        recommended so the package <code>exports</code> map resolves correctly.
      </p>
      <CodeBlock
        language="json"
        filename="tsconfig.json"
        code={`{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true
  }
}`}
      />
    </DocsPage>
  );
}
