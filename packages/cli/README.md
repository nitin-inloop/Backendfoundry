# @backendfoundry/cli

shadcn-style CLI for [BackendFoundry](https://backendfoundry.dev). List, inspect and add backend components — rate limiting, retries, circuit breakers, caching, idempotency, webhooks, health checks, errors, logging, validation and AI utilities — to any Node.js / TypeScript project.

Components are added either as **source you own** (copied into your project, with `@backendfoundry/*` imports rewritten to relative imports and dependencies copied alongside) or as **npm packages**.

## Install

```bash
npx @backendfoundry/cli --help
# or install globally
npm install -g @backendfoundry/cli
backendfoundry --help
```

## Commands

```bash
backendfoundry list                         # all components grouped by category
backendfoundry list --category reliability  # filter by category
backendfoundry list --json                  # machine-readable

backendfoundry info rate-limit              # API, install command, usage, security notes
backendfoundry info rate-limit --json

backendfoundry init                         # writes backendfoundry.json (targetDir, mode, packageManager)
backendfoundry init --dir server/lib/bf --mode npm --force

backendfoundry add rate-limit               # copies rate-limit.ts + core.ts + errors.ts into src/lib/backendfoundry
backendfoundry add retry circuit-breaker --dir lib/resilience
backendfoundry add webhooks --dry-run       # show what would be written
backendfoundry add cache --overwrite        # replace locally modified files
backendfoundry add ai --npm                 # print `pnpm add @backendfoundry/ai` (detected package manager)
backendfoundry add ai --npm --install       # run the install command
```

### `backendfoundry.json`

```json
{
  "targetDir": "src/lib/backendfoundry",
  "mode": "source",
  "packageManager": "pnpm"
}
```

`add` never silently overwrites local edits: files that differ from the registry version are reported as `skipped` (exit code 2) unless `--overwrite` is passed. Re-running `add` with identical files is a no-op.

## Registry

The CLI is driven by `registry.json` (bundled into the package at build time together with every component's source, so it works offline). Set `BACKENDFOUNDRY_REGISTRY=/path/to/registry.json` to use a custom registry.

## Programmatic API

```ts
const { runCli, loadRegistry, resolveDependencyOrder } = require("@backendfoundry/cli");

runCli(["add", "retry", "--dry-run"], { cwd: process.cwd() });
const order = resolveDependencyOrder(loadRegistry({ cwd: process.cwd() }), ["ai"]);
// -> core, validation, errors, retry, ai
```

## License

MIT
