import type { Metadata } from "next";
import { Callout } from "../../../components/ui/callout";
import { CodeBlock } from "../../../components/ui/code-block";
import { CommandLine } from "../../../components/ui/command-line";
import { DocsPage } from "../../../components/site/docs-shell";

export const metadata: Metadata = {
  title: "Fastify",
  description: "Use BackendFoundry preHandler hooks, request context and the error handler with Fastify 4."
};

export default function FastifyPage() {
  return (
    <DocsPage
      href="/docs/fastify"
      title="Fastify"
      description="Fastify adapters plug into the hooks you already use: preHandler for limits and validation, onRequest for context, setErrorHandler for responses."
      toc={[
        { id: "install", title: "Install" },
        { id: "server", title: "A complete server" },
        { id: "hooks", title: "Which hook does what" },
        { id: "schemas", title: "Fastify schemas and v" }
      ]}
    >
      <h2 id="install">Install</h2>
      <CommandLine command="npx @backendfoundry/cli add logger rate-limit validation errors health" />

      <h2 id="server">A complete server</h2>
      <CodeBlock
        filename="src/server.ts"
        showLineNumbers
        code={`import Fastify from "fastify";
import { createLogger, runWithRequestContext } from "@backendfoundry/logger";
import { fastifyRateLimit } from "@backendfoundry/rate-limit";
import { v, fastifyValidate } from "@backendfoundry/validation";
import { createFastifyErrorHandler } from "@backendfoundry/errors";
import { createHealthRegistry } from "@backendfoundry/health";

const fastify = Fastify({ trustProxy: true, bodyLimit: 102_400 });
const logger = createLogger({ service: "orders-api" });
const health = createHealthRegistry({ version: process.env.APP_VERSION });

fastify.addHook("onRequest", (req, _reply, done) => {
  runWithRequestContext({ requestId: req.id, method: req.method, route: req.url }, done);
});

fastify.get("/health/ready", async (_req, reply) => {
  const report = await health.checkReadiness();
  return reply.code(report.status === "unhealthy" ? 503 : 200).send(report);
});

const CreateOrder = v.object({
  sku: v.string().min(1),
  quantity: v.number().int().min(1).max(100)
}).strict();

fastify.post(
  "/v1/orders",
  {
    preHandler: [
      fastifyRateLimit({ limit: 30, windowMs: 60_000, routeId: "orders" }),
      fastifyValidate({ body: CreateOrder })
    ]
  },
  async (request, reply) => {
    const order = await orders.create(request.body);
    logger.info("Order created", { orderId: order.id });
    return reply.code(201).send(order);
  }
);

fastify.setErrorHandler(createFastifyErrorHandler({
  onError: (err) => logger.error(err.message, { code: err.code })
}));

await fastify.listen({ port: 3000 });`}
      />

      <h2 id="hooks">Which hook does what</h2>
      <div className="overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th scope="col">Hook</th>
              <th scope="col">BackendFoundry API</th>
              <th scope="col">Purpose</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><code>onRequest</code></td>
              <td><code>runWithRequestContext</code></td>
              <td>Binds request ID and route to every log line in the request.</td>
            </tr>
            <tr>
              <td><code>preHandler</code></td>
              <td><code>fastifyRateLimit</code></td>
              <td>Rejects with 429 and rate-limit headers before your handler runs.</td>
            </tr>
            <tr>
              <td><code>preHandler</code></td>
              <td><code>fastifyValidate</code></td>
              <td>Validates body, query or params and replaces them with parsed values.</td>
            </tr>
            <tr>
              <td><code>setErrorHandler</code></td>
              <td><code>createFastifyErrorHandler</code></td>
              <td>Serialises any thrown error to the shared safe JSON shape.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 id="schemas">Fastify schemas and v</h2>
      <p>
        Fastify&apos;s JSON Schema validation and <code>fastifyValidate</code> can coexist. Use JSON Schema when you want
        serialisation speed-ups and OpenAPI generation; use <code>v</code> when you want the same schema to run in
        Express, Next.js and background workers, or need sensitive-field redaction in error messages.
      </p>
      <Callout tone="tip">
        Set <code>trustProxy</code> in the Fastify constructor when running behind a load balancer so rate limits key
        on the real client IP.
      </Callout>
    </DocsPage>
  );
}
