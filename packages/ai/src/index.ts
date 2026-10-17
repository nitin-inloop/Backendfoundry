import { FoundryError } from "@backendfoundry/core";
import { SchemaLike, executeSchema } from "@backendfoundry/validation";
import { createRetry } from "@backendfoundry/retry";

export interface AiUsageMetadata {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface AiGenerateRequest {
  prompt: string;
  systemPrompt?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}

export interface AiGenerateResponse {
  text: string;
  provider: string;
  model: string;
  usage: AiUsageMetadata;
  latencyMs: number;
  finishReason: "stop" | "length" | "error";
  simulated?: boolean;
}

export interface AiStreamChunk {
  delta: string;
  done: boolean;
  provider: string;
  model: string;
  usage?: AiUsageMetadata;
}

export interface AiProviderAdapter {
  readonly name: string;
  readonly defaultModel: string;
  generateText(request: AiGenerateRequest): Promise<AiGenerateResponse>;
  streamText?(request: AiGenerateRequest): AsyncIterable<AiStreamChunk>;
}

export class AiProviderError extends FoundryError {
  public readonly provider: string;
  constructor(
    provider: string,
    code: "AI_TIMEOUT" | "AI_RATE_LIMITED" | "AI_AUTH_ERROR" | "AI_UPSTREAM_ERROR" | "AI_INVALID_OUTPUT",
    message: string,
    statusCode = 502,
    cause?: unknown
  ) {
    super({
      code,
      message,
      statusCode,
      category: statusCode === 504 ? "timeout" : statusCode === 429 ? "rate_limit" : "dependency_error",
      expose: false,
      details: { provider },
      cause
    });
    this.provider = provider;
  }
}

export interface MockAiProviderOptions {
  name?: string;
  defaultModel?: string;
  latencyMs?: number;
  failAttempts?: number;
  alwaysFailWith?: "timeout" | "rate_limit" | "upstream_error";
  responseGenerator?: (req: AiGenerateRequest) => string;
}

export class MockAiProvider implements AiProviderAdapter {
  public readonly name: string;
  public readonly defaultModel: string;
  private readonly latencyMs: number;
  private remainingFailures: number;
  private readonly alwaysFailWith?: "timeout" | "rate_limit" | "upstream_error";
  private readonly responseGenerator?: (req: AiGenerateRequest) => string;
  public callCount = 0;

  constructor(options: MockAiProviderOptions = {}) {
    this.name = options.name ?? "mock-ai";
    this.defaultModel = options.defaultModel ?? "mock-gpt-4o-mini";
    this.latencyMs = options.latencyMs ?? 10;
    this.remainingFailures = options.failAttempts ?? 0;
    this.alwaysFailWith = options.alwaysFailWith;
    this.responseGenerator = options.responseGenerator;
  }

  public async generateText(request: AiGenerateRequest): Promise<AiGenerateResponse> {
    this.callCount++;
    const start = Date.now();

    if (request.signal?.aborted) {
      throw new AiProviderError(this.name, "AI_TIMEOUT", "Request aborted via AbortSignal", 499);
    }

    if (this.latencyMs > 0) {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(resolve, this.latencyMs);
        request.signal?.addEventListener(
          "abort",
          () => {
            clearTimeout(timer);
            reject(new AiProviderError(this.name, "AI_TIMEOUT", "Request aborted during execution", 499));
          },
          { once: true }
        );
      });
    }

    if (this.alwaysFailWith === "timeout") {
      throw new AiProviderError(this.name, "AI_TIMEOUT", `Provider ${this.name} timed out`, 504);
    }
    if (this.alwaysFailWith === "rate_limit") {
      throw new AiProviderError(this.name, "AI_RATE_LIMITED", `Provider ${this.name} rate limit exceeded`, 429);
    }
    if (this.alwaysFailWith === "upstream_error" || this.remainingFailures > 0) {
      if (this.remainingFailures > 0) this.remainingFailures--;
      throw new AiProviderError(this.name, "AI_UPSTREAM_ERROR", `Provider ${this.name} upstream 503 failure`, 503);
    }

    const text = this.responseGenerator
      ? this.responseGenerator(request)
      : `Simulated response from ${this.name} (${request.model ?? this.defaultModel}) for: ${request.prompt.slice(0, 80)}`;

    const promptTokens = Math.max(1, Math.ceil(request.prompt.length / 4));
    const completionTokens = Math.max(1, Math.ceil(text.length / 4));

    return {
      text,
      provider: this.name,
      model: request.model ?? this.defaultModel,
      usage: {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens
      },
      latencyMs: Date.now() - start,
      finishReason: "stop",
      simulated: true
    };
  }

  public async *streamText(request: AiGenerateRequest): AsyncIterable<AiStreamChunk> {
    const full = await this.generateText(request);
    const words = full.text.split(/(?=\s)/);
    for (let i = 0; i < words.length; i++) {
      if (request.signal?.aborted) {
        throw new AiProviderError(this.name, "AI_TIMEOUT", "Stream aborted via AbortSignal", 499);
      }
      yield {
        delta: words[i]!,
        done: false,
        provider: this.name,
        model: full.model
      };
    }
    yield {
      delta: "",
      done: true,
      provider: this.name,
      model: full.model,
      usage: full.usage
    };
  }
}

export interface OpenAiCompatibleConfig {
  apiKey?: string;
  baseUrl?: string;
  defaultModel?: string;
  fetchImpl?: typeof fetch;
}

/**
 * Optional OpenAI-compatible HTTP adapter.
 * Reads API key from configuration or OPENAI_API_KEY env var only when generateText() is invoked.
 */
export class OpenAiCompatibleProvider implements AiProviderAdapter {
  public readonly name = "openai-compatible";
  public readonly defaultModel: string;
  private readonly config: OpenAiCompatibleConfig;

  constructor(config: OpenAiCompatibleConfig = {}) {
    this.config = config;
    this.defaultModel = config.defaultModel ?? "gpt-4o-mini";
  }

  public async generateText(request: AiGenerateRequest): Promise<AiGenerateResponse> {
    const apiKey = this.config.apiKey ?? process.env.OPENAI_API_KEY;
    if (!apiKey || apiKey.trim().length < 8) {
      throw new AiProviderError(
        this.name,
        "AI_AUTH_ERROR",
        "Missing OPENAI_API_KEY configuration for OpenAiCompatibleProvider",
        401
      );
    }
    const baseUrl = (this.config.baseUrl ?? "https://api.openai.com/v1").replace(/\/$/, "");
    const fetchFn = this.config.fetchImpl ?? globalThis.fetch;
    const model = request.model ?? this.defaultModel;
    const start = Date.now();

    const res = await fetchFn(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [
          ...(request.systemPrompt ? [{ role: "system", content: request.systemPrompt }] : []),
          { role: "user", content: request.prompt }
        ],
        temperature: request.temperature ?? 0.2,
        ...(request.maxTokens ? { max_tokens: request.maxTokens } : {})
      }),
      signal: request.signal
    });

    if (!res.ok) {
      const code = res.status === 429 ? "AI_RATE_LIMITED" : res.status === 401 ? "AI_AUTH_ERROR" : "AI_UPSTREAM_ERROR";
      throw new AiProviderError(this.name, code, `Upstream AI provider returned HTTP ${res.status}`, res.status);
    }

    const json: any = await res.json();
    const text = String(json?.choices?.[0]?.message?.content ?? "");
    const promptTokens = Number(json?.usage?.prompt_tokens ?? 0);
    const completionTokens = Number(json?.usage?.completion_tokens ?? 0);

    return {
      text,
      provider: this.name,
      model,
      usage: {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens
      },
      latencyMs: Date.now() - start,
      finishReason: "stop",
      simulated: false
    };
  }
}

export interface AiClientConfig {
  primary: AiProviderAdapter;
  fallbacks?: AiProviderAdapter[];
  maxRetriesPerProvider?: number;
  timeoutMs?: number;
}

export interface AiClientGenerateResult extends AiGenerateResponse {
  fallbackUsed: boolean;
  attemptedProviders: string[];
}

export function createAiClient(config: AiClientConfig) {
  if (!config?.primary) {
    throw new FoundryError({
      code: "INVALID_AI_CLIENT_CONFIG",
      message: "createAiClient requires a primary AiProviderAdapter",
      statusCode: 500
    });
  }

  const providers = [config.primary, ...(config.fallbacks ?? [])];
  const maxRetriesPerProvider = config.maxRetriesPerProvider ?? 2;
  const timeoutMs = config.timeoutMs ?? 10_000;

  async function generateText(request: AiGenerateRequest): Promise<AiClientGenerateResult> {
    const attemptedProviders: string[] = [];
    let lastError: unknown;

    for (let idx = 0; idx < providers.length; idx++) {
      const provider = providers[idx]!;
      attemptedProviders.push(provider.name);

      const retryRunner = createRetry({
        maxAttempts: maxRetriesPerProvider,
        initialDelayMs: 30,
        maxDelayMs: 250,
        jitter: "none",
        attemptTimeoutMs: timeoutMs,
        shouldRetry: (err) => {
          if (err instanceof AiProviderError && err.code === "AI_AUTH_ERROR") {
            return false;
          }
          return true;
        }
      });

      try {
        const res = await retryRunner(
          (_attempt, attemptSignal) => provider.generateText({ ...request, signal: attemptSignal }),
          { signal: request.signal }
        );
        return {
          ...res,
          fallbackUsed: idx > 0,
          attemptedProviders
        };
      } catch (err) {
        lastError = err;
        if (request.signal?.aborted) {
          throw err;
        }
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new AiProviderError("all", "AI_UPSTREAM_ERROR", "All configured AI providers failed", 502);
  }

  async function generateObject<T>(
    request: AiGenerateRequest & { schema: SchemaLike<T> }
  ): Promise<{ object: T; meta: AiClientGenerateResult }> {
    const rawResult = await generateText(request);
    let parsedJson: unknown;
    try {
      const cleaned = rawResult.text.trim().replace(/^```json\s*|\s*```$/g, "");
      parsedJson = JSON.parse(cleaned);
    } catch (err) {
      throw new AiProviderError(
        rawResult.provider,
        "AI_INVALID_OUTPUT",
        "Model output was not valid JSON",
        502,
        err
      );
    }

    try {
      const validated = executeSchema(request.schema, parsedJson, "body");
      return {
        object: validated,
        meta: rawResult
      };
    } catch (err) {
      throw new AiProviderError(
        rawResult.provider,
        "AI_INVALID_OUTPUT",
        `Model JSON output failed schema validation: ${err instanceof Error ? err.message : String(err)}`,
        502,
        err
      );
    }
  }

  return {
    generateText,
    generateObject
  };
}
