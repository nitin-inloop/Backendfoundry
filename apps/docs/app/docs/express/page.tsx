import type { Metadata } from "next";
import { Callout } from "../../../components/ui/callout";
import { CodeBlock } from "../../../components/ui/code-block";
import { CommandLine } from "../../../components/ui/command-line";
import { DocsPage } from "../../../components/site/docs-shell";

export const metadata: Metadata = {
  title: "Express",
  description: "Use BackendFoundry middleware, validators and the error handler in an Express 4 or 5 app."
};

export default function ExpressPage() {
  return (
    <DocsPage
      href="/docs/express"
      title="Express"
      description="Express adapters are ordinary middleware. Mount them globally, per router or per route, and finish with the error handler."
      toc={[
        { id: "install", title: "Install" },
        { id: "app", title: "A complete app" },
        { id: "order", title: "Middleware order" },
        { id: "proxy", title: "Behind a proxy" },
        { id: "webhooks", title: "Raw bodies for webhooks" }
      ]}
    >
      <h2 id="install">Install</h2>
      <CommandLine command="npx @backendfoundry/cli add logger rate-limit validation errors health" />

      <h2 id="app">A complete app</h2>
      <CodeBlock
        filename="src/app.ts"
        showLineNumbers
        code={`import express from "express";
import { createLogger, expressRequestLogger } from "@backendfoundry/logger";
import { expressRateLimit } from "@backendfoundry/rate-limit";
import { v, expressValidate } from "@backendfoundry/validation";
import { createExpressErrorHandler, NotFoundError } from "@backendfoundry/errors";
import { createHealthRegistry } from "@backendfoundry/health";

const app = express();
const logger = createLogger({ service: "orders-api" });
const health = createHealthRegistry({ version: process.env.APP_VERSION });

health.registerProbe({ name: "postgres", critical: true, check: () => db.query("SELECT 1") });

app.set("trust proxy", 1);
app.use(express.json({ limit: "100kb" }));
app.use(expressRequestLogger(logger));

const { liveness, readiness } = health.expressHandlers();
app.get("/health/live", liveness);
app.get("/health/ready", readiness);

app.use("/v1", expressRateLimit({ limit: 100, windowMs: 60_000, routeId: "v1" }));

app.get(
  "/v1/orders/:id",
  expressValidate({ params: v.object({ id: v.string().regex(/^ord_[a-z0-9]+$/) }) }),
  async (req, res) => {
    const order = await orders.find(req.params.id);
    if (!order) throw new NotFoundError(\`Order \${req.params.id} not found\`);
    res.json(order);
  }
);

app.use(createExpressErrorHandler({
  onError: (err) => logger.error(err.message, { code: err.code })
}));

app.listen(3000);`}
      />
      <Callout tone="note" title="Async errors">
        Express 5 forwards rejected promises to the error handler automatically. On Express 4, wrap async handlers in{" "}
        <code>try</code>/<code>catch</code> and call <code>next(err)</code>.
      </Callout>

      <h2 id="order">Middleware order</h2>
      <ol>
        <li>Body parser with a size limit, so validation never sees an unbounded payload.</li>
        <li>
          <code>expressRequestLogger</code>, so every later log line carries the request ID.
        </li>
        <li>
          <code>expressRateLimit</code>, so rejected clients cost as little as possible.
        </li>
        <li>
          <code>expressValidate</code> and your handlers.
        </li>
        <li>
          <code>createExpressErrorHandler</code>, always last.
        </li>
      </ol>

      <h2 id="proxy">Behind a proxy</h2>
      <p>
        Rate limiting keys on the client IP by default. Behind Cloudflare, an ALB or Nginx, set Express&apos;s{" "}
        <code>trust proxy</code> to the number of proxy hops. Without it, every request appears to come from the
        proxy; with too high a value, clients can spoof <code>x-forwarded-for</code> and bypass limits.
      </p>

      <h2 id="webhooks">Raw bodies for webhooks</h2>
      <p>
        Signatures are computed over the exact bytes received. Mount <code>express.raw</code> on the webhook route
        before any JSON parser touches it.
      </p>
      <CodeBlock
        code={`import { verifyWebhookOrThrow } from "@backendfoundry/webhooks";

app.post("/v1/webhooks/incoming", express.raw({ type: "application/json" }), (req, res) => {
  verifyWebhookOrThrow({
    payload: req.body,
    signatureHeader: req.get("x-foundry-signature") ?? "",
    secret: [process.env.WEBHOOK_SECRET!, process.env.WEBHOOK_SECRET_PREV!].filter(Boolean),
    toleranceSeconds: 300
  });
  const event = JSON.parse(req.body.toString("utf8"));
  queue.publish(event);
  res.sendStatus(200);
});`}
      />
    </DocsPage>
  );
}
