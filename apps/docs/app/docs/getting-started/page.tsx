import type { Metadata } from "next";
import Link from "next/link";
import { Callout } from "../../../components/ui/callout";
import { CodeBlock } from "../../../components/ui/code-block";
import { CommandLine } from "../../../components/ui/command-line";
import { DocsPage } from "../../../components/site/docs-shell";

export const metadata: Metadata = {
  title: "Quick start",
  description: "Add rate limiting, validation and safe errors to an Express route in five minutes."
};

export default function GettingStartedPage() {
  return (
    <DocsPage
      href="/docs/getting-started"
      title="Quick start"
      description="Protect one route with rate limiting, request validation and safe error responses. The example uses Express; the Fastify and Next.js guides follow the same steps."
      toc={[
        { id: "requirements", title: "Requirements" },
        { id: "install", title: "1. Install" },
        { id: "validate", title: "2. Validate the body" },
        { id: "limit", title: "3. Rate limit the route" },
        { id: "errors", title: "4. Return safe errors" },
        { id: "try-it", title: "5. Try it" }
      ]}
    >
      <h2 id="requirements">Requirements</h2>
      <ul>
        <li>Node.js 18.18 or later</li>
        <li>TypeScript 5.0 or later, with <code>strict</code> enabled</li>
        <li>An existing Express, Fastify or Next.js project</li>
      </ul>

      <h2 id="install">1. Install</h2>
      <p>Add the three components. The CLI detects pnpm, npm, yarn or bun from your lockfile.</p>
      <CommandLine command="npx @backendfoundry/cli add validation rate-limit errors" />
      <p>Or install the packages directly:</p>
      <CommandLine command="pnpm add @backendfoundry/validation @backendfoundry/rate-limit @backendfoundry/errors" />

      <h2 id="validate">2. Validate the body</h2>
      <p>
        Describe the payload with the <code>v</code> schema builder. <code>.strict()</code> rejects unknown keys, which
        closes off mass-assignment bugs. Inside the handler, <code>req.body</code> is typed from the schema.
      </p>
      <CodeBlock
        filename="src/schemas/user.ts"
        code={`import { v } from "@backendfoundry/validation";

export const CreateUser = v.object({
  email: v.string().trim().email(),
  password: v.string().min(12),
  role: v.enum(["admin", "developer", "viewer"]).default("developer")
}).strict();`}
      />

      <h2 id="limit">3. Rate limit the route</h2>
      <p>
        <code>expressRateLimit</code> counts requests per client in a sliding window and responds with{" "}
        <code>429</code> and a <code>Retry-After</code> header when the limit is reached.
      </p>
      <CodeBlock
        filename="src/app.ts"
        highlightLines={[9, 10]}
        code={`import express from "express";
import { expressRateLimit } from "@backendfoundry/rate-limit";
import { expressValidate } from "@backendfoundry/validation";
import { CreateUser } from "./schemas/user";

const app = express();
app.use(express.json({ limit: "100kb" }));

app.post("/v1/users",
  expressRateLimit({ limit: 10, windowMs: 60_000, routeId: "signup" }),
  expressValidate({ body: CreateUser }),
  async (req, res) => {
    const user = await users.create(req.body);
    res.status(201).json({ id: user.id });
  }
);`}
      />

      <h2 id="errors">4. Return safe errors</h2>
      <p>
        Register the error handler after your routes. It converts validation failures, rate-limit rejections and
        unexpected exceptions into one JSON shape, and strips stack traces and credentials from the response.
      </p>
      <CodeBlock
        filename="src/app.ts"
        code={`import { createExpressErrorHandler } from "@backendfoundry/errors";

app.use(createExpressErrorHandler({
  includeInternalDetails: process.env.NODE_ENV === "development"
}));`}
      />
      <Callout tone="warning" title="Order matters">
        Express only routes errors to handlers registered after the routes that throw. Keep{" "}
        <code>createExpressErrorHandler()</code> as the last <code>app.use</code> call.
      </Callout>

      <h2 id="try-it">5. Try it</h2>
      <p>Send an invalid payload. The response names the field without echoing the rejected password back.</p>
      <CodeBlock
        language="bash"
        code={`curl -s -X POST localhost:3000/v1/users \\
  -H "content-type: application/json" \\
  -d '{"email":"not-an-email","password":"short"}'`}
      />
      <CodeBlock
        language="json"
        filename="Response 400"
        code={`{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Validation failed on body (2 issues)",
    "category": "validation",
    "statusCode": 400,
    "timestamp": "2026-10-17T09:24:11.402Z",
    "details": {
      "target": "body",
      "issues": [
        { "path": "email", "code": "invalid_email", "message": "Must be a valid email address" },
        { "path": "password", "code": "too_small", "message": "Invalid value provided for sensitive field 'password'" }
      ]
    }
  }
}`}
      />
      <p>
        From here, add <Link href="/packages/idempotency">idempotency keys</Link> to routes that create resources, or{" "}
        <Link href="/packages/logger">request logging</Link> so every log line carries the request ID.
      </p>
    </DocsPage>
  );
}
