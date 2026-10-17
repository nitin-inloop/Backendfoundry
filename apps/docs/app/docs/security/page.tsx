import type { Metadata } from "next";
import Link from "next/link";
import { Callout } from "../../../components/ui/callout";
import { CodeBlock } from "../../../components/ui/code-block";
import { DocsPage } from "../../../components/site/docs-shell";

export const metadata: Metadata = {
  title: "Security",
  description: "How BackendFoundry handles secrets, error disclosure, signature checks and tenant isolation."
};

export default function SecurityPage() {
  return (
    <DocsPage
      href="/docs/security"
      title="Security"
      description="The components are built so the safe behaviour is the default. This page lists what they protect against and what you still need to configure."
      toc={[
        { id: "redaction", title: "Secret redaction" },
        { id: "errors", title: "Error disclosure" },
        { id: "webhooks", title: "Webhook signatures" },
        { id: "tenancy", title: "Tenant isolation" },
        { id: "your-side", title: "Your responsibilities" },
        { id: "reporting", title: "Reporting a vulnerability" }
      ]}
    >
      <h2 id="redaction">Secret redaction</h2>
      <p>
        The logger redacts <code>password</code>, <code>secret</code>, <code>token</code>, <code>apiKey</code>,{" "}
        <code>authorization</code>, <code>cookie</code>, <code>cvv</code>, <code>ssn</code>, <code>privateKey</code>{" "}
        and related keys at any nesting depth. Add your own with <code>redactFields</code>.
      </p>
      <CodeBlock
        code={`const logger = createLogger({ service: "billing", redactFields: ["iban", "taxId"] });

logger.info("Customer updated", { customerId: "cus_42", iban: "DE89370400440532013000" });
// {"level":"info","msg":"Customer updated","customerId":"cus_42","iban":"[REDACTED]",...}`}
      />
      <p>
        Validation errors on sensitive fields replace the message, so a rejected password is never echoed back to the
        client. Environment parsers never include the raw value in their error message.
      </p>

      <h2 id="errors">Error disclosure</h2>
      <ul>
        <li>Stack traces are never included in HTTP responses.</li>
        <li>
          Errors with a status of 500 or higher return a generic message unless they are created with{" "}
          <code>expose: true</code>.
        </li>
        <li>
          Database URLs, bearer tokens and <code>sk-</code> keys are scrubbed from messages by{" "}
          <code>scrubSensitiveMessage</code>.
        </li>
        <li>
          Health checks hide probe error messages unless you set <code>exposeErrorMessages: true</code>.
        </li>
      </ul>

      <h2 id="webhooks">Webhook signatures</h2>
      <p>
        <code>verifyWebhookSignature</code> compares HMAC-SHA256 digests with <code>crypto.timingSafeEqual</code>,
        rejects timestamps outside the tolerance window to stop replays, and accepts an array of secrets so you can
        rotate keys without downtime.
      </p>
      <Callout tone="warning" title="Verify the raw body">
        Parsing JSON and serialising it again changes whitespace and key order, which changes the HMAC. Always verify
        the exact bytes you received.
      </Callout>

      <h2 id="tenancy">Tenant isolation</h2>
      <p>
        Scope idempotency keys and cache entries by the authenticated tenant, so one tenant cannot replay or read
        another&apos;s responses. In multi-tenant apps, set <code>requireExplicitScope: true</code> on the cache so a
        missing scope is an error rather than a shared global key.
      </p>
      <CodeBlock
        code={`const cache = createCache({ namespace: "billing", requireExplicitScope: true });

await cache.getOrSet("active-plan", () => plans.forTenant(tenantId), { scope: \`tenant:\${tenantId}\` });`}
      />

      <h2 id="your-side">Your responsibilities</h2>
      <ul>
        <li>Set a request body size limit before validation runs.</li>
        <li>
          Configure <code>trust proxy</code> correctly before relying on client IPs for rate limiting.
        </li>
        <li>
          Use <code>.strict()</code> object schemas on any input that is written to a database.
        </li>
        <li>Keep provider API keys in server-side environment variables, never in source.</li>
        <li>
          Configure the circuit breaker&apos;s <code>isFailure</code> so client 4xx errors do not trip it.
        </li>
      </ul>

      <h2 id="reporting">Reporting a vulnerability</h2>
      <p>
        Do not open a public issue. Follow the private disclosure process in <code>SECURITY.md</code> at the root of the
        repository. See also <Link href="/docs/contributing">Contributing</Link>.
      </p>
    </DocsPage>
  );
}
