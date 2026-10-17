# Contributing to BackendFoundry

We welcome contributions that improve reliability, type safety, framework compatibility, and documentation clarity.

## Development Workflow

1. **Build all packages**:
   ```bash
   node scripts/build-packages.mjs
   ```
2. **Run the full test suite**:
   ```bash
   node scripts/run-tests.mjs
   ```
3. **Run lint & registry verification**:
   ```bash
   node scripts/lint-check.mjs
   ```

## Package Standards

- Keep `@backendfoundry/core` free of framework or database dependencies.
- Every package must export both ESM (`dist/index.js`) and CommonJS (`dist/index.cjs`) entry points alongside `.d.ts` declarations.
- Document process-local vs. distributed behavior honestly.
- Include unit tests covering normal behavior, invalid configuration, boundary conditions, concurrency, and security redaction.
