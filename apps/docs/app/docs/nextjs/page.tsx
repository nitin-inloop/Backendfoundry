import type { Metadata } from "next";
import { Callout } from "../../../components/ui/callout";
import { CodeBlock } from "../../../components/ui/code-block";
import { CommandLine } from "../../../components/ui/command-line";
import { DocsPage } from "../../../components/site/docs-shell";

export const metadata: Metadata = {
  title: "Next.js",
  description: "Use BackendFoundry in Next.js App Router Route Handlers."
};

export default function NextjsPage() {
  return (
    <DocsPage
      href="/docs/nextjs"
      title="Next.js"
      description="Route Handlers take a Request and return a Response, so you call the framework-free core APIs directly. No adapter layer is needed."
      toc={[
        { id: "install", title: "Install" },
        { id: "runtime", title: "Use the Node.js runtime" },
        { id: "shared", title: "Share instances" },
        { id: "route", title: "A protected route" },
        { id: "health", title: "Health endpoint" }
      ]}
    >
      <h2 id="install">Install</h2>
      <CommandLine command="npx @backendfoundry/cli add rate-limit validation errors" />

      <h2 id="runtime">Use the Node.js runtime</h2>
      <p>
        Several components rely on <code>node:crypto</code> and <code>AsyncLocalStorage</code>. Declare the Node.js
        runtime in any route that imports them.
      </p>
      <CodeBlock code={`export const runtime = "nodejs";`} />
      <Callout tone="warning" title="Serverless state">
        Serverless functions run many short-lived instances, so memory stores reset often and are not shared. Use{" "}
        <code>RedisRateLimitStore</code> and <code>RedisCacheStore</code> on Vercel and similar platforms.
      </Callout>

      <h2 id="shared">Share instances</h2>
      <p>Create instances in a module outside the handler so they persist between requests in the same instance.</p>
      <CodeBlock
        filename="lib/backend.ts"
        code={`import { createRateLimiter } from "@backendfoundry/rate-limit";
import { createLogger } from "@backendfoundry/logger";

export const limiter = createRateLimiter({ limit: 20, windowMs: 60_000 });
export const logger = createLogger({ service: "web-api" });`}
      />

      <h2 id="route">A protected route</h2>
      <CodeBlock
        filename="app/api/users/route.ts"
        showLineNumbers
        code={`import { v, validateBody } from "@backendfoundry/validation";
import { RateLimitExceededError, toSafeErrorResponse } from "@backendfoundry/errors";
import { limiter, logger } from "@/lib/backend";

export const runtime = "nodejs";

const CreateUser = v.object({ email: v.string().trim().email() }).strict();

export async function POST(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
    const decision = await limiter.check({ key: \`users:\${ip}\` });
    if (!decision.allowed) throw new RateLimitExceededError(decision.retryAfterSeconds);

    const body = validateBody(CreateUser, await req.json());
    const user = await users.create(body);
    return Response.json(user, { status: 201, headers: decision.headers });
  } catch (err) {
    const safe = toSafeErrorResponse(err, {
      onError: (e) => logger.error(e.message, { code: e.code })
    });
    return Response.json(safe.body, { status: safe.statusCode, headers: safe.headers });
  }
}`}
      />

      <h2 id="health">Health endpoint</h2>
      <CodeBlock
        filename="app/api/health/route.ts"
        code={`import { createHealthRegistry } from "@backendfoundry/health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const health = createHealthRegistry({ version: process.env.APP_VERSION, defaultTimeoutMs: 1500 });
health.registerProbe({ name: "database", critical: true, check: () => db.query("SELECT 1") });

export async function GET() {
  const report = await health.checkReadiness();
  return Response.json(report, { status: report.status === "unhealthy" ? 503 : 200 });
}`}
      />
    </DocsPage>
  );
}
