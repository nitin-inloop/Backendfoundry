import type { Metadata } from "next";
import { Callout } from "../../../components/ui/callout";
import { CodeBlock } from "../../../components/ui/code-block";
import { DocsPage } from "../../../components/site/docs-shell";

const STATE_TABLE = [
  ["rate-limit", "MemoryRateLimitStore", "RedisRateLimitStore", "Limits multiply by replica count."],
  ["cache", "MemoryCacheStore", "RedisCacheStore", "Each replica warms its own cache."],
  ["idempotency", "MemoryIdempotencyStore", "Your store with SET NX PX or a unique constraint", "Duplicates on different replicas both execute."],
  ["circuit-breaker", "In process", "Usually keep it local", "Each replica trips on its own, which is often what you want."]
];

export const metadata: Metadata = {
  title: "Deployment",
  description: "Run BackendFoundry across multiple replicas: shared state, health probes, proxies and shutdown."
};

export default function DeploymentPage() {
  return (
    <DocsPage
      href="/docs/deployment"
      title="Deployment"
      description="Everything works on a single process out of the box. Before you scale out, decide which state needs to be shared."
      toc={[
        { id: "state", title: "Process-local state" },
        { id: "redis", title: "Running Redis" },
        { id: "probes", title: "Health probes" },
        { id: "proxies", title: "Proxies and client IPs" },
        { id: "checklist", title: "Pre-launch checklist" }
      ]}
    >
      <h2 id="state">Process-local state</h2>
      <div className="overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th scope="col">Component</th>
              <th scope="col">Default</th>
              <th scope="col">Shared option</th>
              <th scope="col">Without sharing</th>
            </tr>
          </thead>
          <tbody>
            {STATE_TABLE.map(([name, local, shared, effect]) => (
              <tr key={name}>
                <td><code>{name}</code></td>
                <td><code>{local}</code></td>
                <td>{shared}</td>
                <td>{effect}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        Retries are in-process timers and do not survive a crash. Use a persistent job queue for work that must be
        retried over minutes or hours.
      </p>

      <h2 id="redis">Running Redis</h2>
      <p>The repository includes a Docker Compose file with Redis for local development and integration tests.</p>
      <CodeBlock language="bash" code={`docker compose up -d redis
export REDIS_URL=redis://localhost:6379`} />
      <p>
        The Redis rate-limit store needs a client that supports <code>eval()</code>, because counters are incremented
        and expired atomically in one script. <code>ioredis</code> works out of the box.
      </p>

      <h2 id="probes">Health probes</h2>
      <p>
        Expose liveness and readiness separately. Liveness only says the process is running; readiness runs your
        probes. A failing critical probe returns <code>503 unhealthy</code>, and a failing non-critical one returns{" "}
        <code>200 degraded</code>, so a slow cache does not pull every pod out of rotation.
      </p>
      <CodeBlock
        language="text"
        filename="kubernetes probes"
        code={`livenessProbe:
  httpGet: { path: /health/live, port: 3000 }
  periodSeconds: 10
readinessProbe:
  httpGet: { path: /health/ready, port: 3000 }
  periodSeconds: 5
  timeoutSeconds: 3`}
      />
      <Callout tone="warning" title="Keep probes cheap">
        Orchestrators call readiness every few seconds. Use <code>SELECT 1</code>, not a table scan, and keep{" "}
        <code>defaultTimeoutMs</code> below the probe timeout.
      </Callout>

      <h2 id="proxies">Proxies and client IPs</h2>
      <p>
        Behind a load balancer, configure your framework to trust exactly the number of proxy hops in front of it.
        Otherwise rate limits key on the proxy address, or clients can forge <code>x-forwarded-for</code>.
      </p>

      <h2 id="checklist">Pre-launch checklist</h2>
      <ul>
        <li>Redis-backed stores for rate limiting, caching and idempotency when running more than one replica.</li>
        <li>Error handler registered last, with <code>includeInternalDetails</code> off in production.</li>
        <li>Body size limits set before validation.</li>
        <li>Trust proxy configured for your load balancer.</li>
        <li>Readiness probe wired to your orchestrator.</li>
        <li>Logger level set from the environment, with custom <code>redactFields</code> for domain secrets.</li>
      </ul>
    </DocsPage>
  );
}
