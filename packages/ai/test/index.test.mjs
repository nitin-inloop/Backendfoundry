import test from "node:test";
import assert from "node:assert/strict";
import {
  MockAiProvider,
  OpenAiCompatibleProvider,
  createAiClient,
  AiProviderError
} from "../dist/index.js";
import { v } from "@backendfoundry/validation";

test("@backendfoundry/ai - retries transient failures and falls back to secondary provider", async () => {
  const failingPrimary = new MockAiProvider({
    name: "openai-primary",
    alwaysFailWith: "upstream_error",
    latencyMs: 2
  });
  const backupAnthropic = new MockAiProvider({
    name: "anthropic-fallback",
    defaultModel: "claude-3-5-haiku",
    failAttempts: 1,
    latencyMs: 2,
    responseGenerator: () => JSON.stringify({ classification: "urgent", confidence: 0.94 })
  });

  const client = createAiClient({
    primary: failingPrimary,
    fallbacks: [backupAnthropic],
    maxRetriesPerProvider: 2
  });

  const schema = v.object({
    classification: v.enum(["urgent", "normal", "low"]),
    confidence: v.number().min(0).max(1)
  });

  const { object, meta } = await client.generateObject({
    prompt: "Classify ticket #402: Production database CPU at 99%",
    schema
  });

  assert.equal(object.classification, "urgent");
  assert.equal(object.confidence, 0.94);
  assert.equal(meta.fallbackUsed, true);
  assert.deepEqual(meta.attemptedProviders, ["openai-primary", "anthropic-fallback"]);
  assert.equal(failingPrimary.callCount, 2);
  assert.equal(backupAnthropic.callCount, 2);
});

test("@backendfoundry/ai - streaming support and missing API key protection on real adapter", async () => {
  const mock = new MockAiProvider({
    latencyMs: 1,
    responseGenerator: () => "Hello modular backend world"
  });

  const chunks = [];
  for await (const chunk of mock.streamText({ prompt: "Greet" })) {
    if (!chunk.done) chunks.push(chunk.delta);
  }
  assert.equal(chunks.join(""), "Hello modular backend world");

  // Real provider adapter without credentials fails cleanly without making external calls
  const unconfiguredOpenAi = new OpenAiCompatibleProvider({ apiKey: "" });
  await assert.rejects(
    () => unconfiguredOpenAi.generateText({ prompt: "Test" }),
    (err) => err instanceof AiProviderError && err.code === "AI_AUTH_ERROR"
  );
});
