import type { Metadata } from "next";
import Link from "next/link";
import { Callout } from "../../../components/ui/callout";
import { CodeBlock } from "../../../components/ui/code-block";
import { DocsPage } from "../../../components/site/docs-shell";

export const metadata: Metadata = {
  title: "Configuration",
  description: "Parse environment variables safely, choose storage backends and share instances across routes."
};

export default function ConfigurationPage() {
  return (
    <DocsPage
      href="/docs/configuration"
      title="Configuration"
      description="Every component is configured with a plain typed object passed to its factory. There are no global singletons and no config files."
      toc={[
        { id: "factories", title: "Factories" },
        { id: "env", title: "Environment variables" },
        { id: "stores", title: "Storage backends" },
        { id: "request-ids", title: "Request IDs" },
        { id: "module", title: "Where to create instances" }
      ]}
    >
      <h2 id="factories">Factories</h2>
      <p>
        Components expose a <code>create*</code> function that validates its options when called. Invalid options fail
        at startup, not on the first request.
      </p>
      <CodeBlock
        code={`import { createRetry } from "@backendfoundry/retry";
import { createCircuitBreaker } from "@backendfoundry/circuit-breaker";

const retry = createRetry({ maxAttempts: 3, initialDelayMs: 200, jitter: "equal" });
const breaker = createCircuitBreaker({ name: "payments", failureThreshold: 5, resetTimeoutMs: 15_000 });`}
      />
      <p>
        Defaults are documented on each <Link href="/packages">component page</Link> in the configuration table.
      </p>

      <h2 id="env">Environment variables</h2>
      <p>
        <code>@backendfoundry/core</code> includes parsers that validate variables once at boot. When a value is missing
        or malformed they throw <code>ENV_CONFIG_INVALID</code> without printing the raw value, so secrets do not end up
        in crash logs.
      </p>
      <CodeBlock
        filename="src/config.ts"
        code={`import { parseEnvString, parseEnvInt, parseEnvBoolean, parseEnvEnum } from "@backendfoundry/core";

export const config = {
  port: parseEnvInt("PORT", process.env, { defaultValue: 3000, min: 1024, max: 65535 }),
  logLevel: parseEnvEnum("LOG_LEVEL", ["debug", "info", "warn", "error"] as const, process.env, { defaultValue: "info" }),
  redisUrl: parseEnvString("REDIS_URL", process.env, { required: true, secret: true }),
  trustProxy: parseEnvBoolean("TRUST_PROXY", process.env, { defaultValue: false })
};`}
      />

      <h2 id="stores">Storage backends</h2>
      <p>
        Stateful components accept a <code>store</code>. Memory stores are the default and are right for tests and
        single-process services. Redis stores take a client you construct, so BackendFoundry never bundles a driver.
      </p>
      <CodeBlock
        code={`import Redis from "ioredis";
import { createRateLimiter, RedisRateLimitStore } from "@backendfoundry/rate-limit";
import { createCache, RedisCacheStore } from "@backendfoundry/cache";

const redis = new Redis(config.redisUrl);

export const limiter = createRateLimiter({
  limit: 100,
  windowMs: 60_000,
  store: new RedisRateLimitStore({ client: redis, prefix: "rl:" })
});

export const cache = createCache({
  namespace: "catalog",
  defaultTtlMs: 30_000,
  store: new RedisCacheStore({ client: redis })
});`}
      />
      <Callout tone="warning" title="Memory stores do not share state">
        With two replicas behind a load balancer, a memory-backed limit of 100 per minute becomes 200. Use the Redis
        stores for any state that must hold across processes.
      </Callout>

      <h2 id="request-ids">Request IDs</h2>
      <p>
        <code>extractOrGenerateRequestId</code> reuses an incoming <code>x-request-id</code> header when it matches a
        safe pattern and generates a new one otherwise. Set <code>trustIncoming: false</code> on public edges where
        clients should not choose their own IDs.
      </p>
      <CodeBlock
        code={`import { extractOrGenerateRequestId } from "@backendfoundry/core";

const requestId = extractOrGenerateRequestId(req.headers, {
  headerName: "x-request-id",
  prefix: "req",
  trustIncoming: false
});`}
      />

      <h2 id="module">Where to create instances</h2>
      <p>
        Create each limiter, cache, breaker and guard once per process, in a module, and import it where needed.
        Creating them inside a request handler resets their state on every call.
      </p>
    </DocsPage>
  );
}
