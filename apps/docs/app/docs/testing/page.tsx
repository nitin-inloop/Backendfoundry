import type { Metadata } from "next";
import { Callout } from "../../../components/ui/callout";
import { CodeBlock } from "../../../components/ui/code-block";
import { DocsPage } from "../../../components/site/docs-shell";

export const metadata: Metadata = {
  title: "Testing",
  description: "Test code that uses BackendFoundry with memory stores, injected clocks and the mock AI provider."
};

export default function TestingPage() {
  return (
    <DocsPage
      href="/docs/testing"
      title="Testing"
      description="Every stateful component accepts its clock and storage as options, so tests run fast and deterministically without Redis or real timers."
      toc={[
        { id: "clocks", title: "Inject a clock" },
        { id: "retry", title: "Retries without waiting" },
        { id: "ai", title: "Mock AI provider" },
        { id: "errors", title: "Asserting errors" }
      ]}
    >
      <h2 id="clocks">Inject a clock</h2>
      <p>
        The rate limiter, cache, circuit breaker and idempotency guard accept <code>now: () =&gt; number</code>.
        Advance a variable instead of sleeping.
      </p>
      <CodeBlock
        filename="rate-limit.test.ts"
        code={`import { test } from "node:test";
import assert from "node:assert/strict";
import { createRateLimiter, MemoryRateLimitStore } from "@backendfoundry/rate-limit";

test("blocks the 4th request and recovers after the window", async () => {
  let now = 0;
  const limiter = createRateLimiter({
    limit: 3,
    windowMs: 1_000,
    algorithm: "fixed-window",
    store: new MemoryRateLimitStore({ algorithm: "fixed-window" }),
    now: () => now
  });

  for (let i = 0; i < 3; i++) assert.equal((await limiter.check({ key: "u1" })).allowed, true);
  assert.equal((await limiter.check({ key: "u1" })).allowed, false);

  now += 1_000;
  assert.equal((await limiter.check({ key: "u1" })).allowed, true);
});`}
      />

      <h2 id="retry">Retries without waiting</h2>
      <p>
        <code>createRetry</code> accepts a <code>sleep</code> function and a <code>random</code> source. Replace them
        to record the computed delays and keep jitter deterministic.
      </p>
      <CodeBlock
        code={`const delays: number[] = [];
const retry = createRetry({
  maxAttempts: 3,
  initialDelayMs: 100,
  sleep: async (ms) => { delays.push(ms); },
  random: () => 0.5
});

let calls = 0;
await retry(async () => {
  if (++calls < 3) throw new Error("flaky");
  return "ok";
});

assert.equal(calls, 3);
assert.equal(delays.length, 2);`}
      />

      <h2 id="ai">Mock AI provider</h2>
      <p>
        <code>MockAiProvider</code> implements the same adapter interface as real providers. Make it fail a set number
        of times to test fallback, or return fixed output.
      </p>
      <CodeBlock
        code={`import { createAiClient, MockAiProvider } from "@backendfoundry/ai";

const primary = new MockAiProvider({ name: "primary", failAttempts: 5 });
const fallback = new MockAiProvider({ name: "fallback", responseGenerator: () => "Summary: all systems normal" });

const ai = createAiClient({ primary, fallbacks: [fallback], maxRetriesPerProvider: 1 });
const result = await ai.generateText({ prompt: "Summarise the incident" });

assert.equal(result.provider, "fallback");
assert.equal(result.fallbackUsed, true);`}
      />

      <h2 id="errors">Asserting errors</h2>
      <p>
        Errors are classes with stable <code>code</code> and <code>statusCode</code> fields. Assert on those rather than
        on message text, which may change.
      </p>
      <CodeBlock
        code={`await assert.rejects(
  () => guard.execute({ key: "k1", method: "POST", path: "/v1/pay", body: { amount: 2 } }, handler),
  (err: any) => err.code === "IDEMPOTENCY_FINGERPRINT_MISMATCH" && err.statusCode === 422
);`}
      />
      <Callout tone="tip">
        The repository uses Node&apos;s built-in <code>node:test</code> runner. The same patterns work in Vitest and
        Jest.
      </Callout>
    </DocsPage>
  );
}
