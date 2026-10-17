import { FoundryError } from "@backendfoundry/core";
import { GatewayTimeoutError } from "@backendfoundry/errors";

export type JitterStrategy = "none" | "full" | "equal";

export interface RetryAttemptMetadata {
  attempt: number;
  maxAttempts: number;
  delayMs: number;
  elapsedMs: number;
  error?: unknown;
}

export interface RetryConfig {
  maxAttempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffFactor?: number;
  jitter?: JitterStrategy;
  attemptTimeoutMs?: number;
  shouldRetry?: (error: unknown, attempt: number) => boolean | Promise<boolean>;
  onRetry?: (metadata: RetryAttemptMetadata) => void | Promise<void>;
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
  random?: () => number;
}

export interface RetryCallOptions {
  signal?: AbortSignal;
  idempotent?: boolean;
}

export interface RetryExecutionReport<T> {
  result: T;
  attempts: number;
  totalDurationMs: number;
  delaysMs: number[];
}

export class RetryExhaustedError extends FoundryError {
  public readonly attempts: number;
  public readonly delaysMs: number[];
  public readonly lastError: unknown;

  constructor(attempts: number, delaysMs: number[], lastError: unknown) {
    const baseMsg = lastError instanceof Error ? lastError.message : String(lastError);
    super({
      code: "RETRY_EXHAUSTED",
      message: `Operation failed after ${attempts} attempt${attempts === 1 ? "" : "s"}: ${baseMsg}`,
      statusCode: 502,
      category: "dependency_error",
      expose: false,
      details: { attempts, delaysMs },
      cause: lastError
    });
    this.attempts = attempts;
    this.delaysMs = delaysMs;
    this.lastError = lastError;
  }
}

export class RetryAbortedError extends FoundryError {
  constructor(message = "Retry operation was aborted via AbortSignal") {
    super({
      code: "RETRY_ABORTED",
      message,
      statusCode: 499,
      category: "client_error",
      expose: true
    });
  }
}

export function defaultShouldRetry(error: unknown): boolean {
  if (!error) return false;
  if (error instanceof RetryAbortedError) return false;
  if (typeof error === "object" && "name" in error && (error as any).name === "AbortError") {
    return false;
  }
  if (error instanceof FoundryError) {
    if (error.statusCode === 429 || error.statusCode === 408 || error.statusCode >= 500) {
      return true;
    }
    return false;
  }
  return true;
}

export function computeBackoffDelay(
  attempt: number,
  options: {
    initialDelayMs: number;
    maxDelayMs: number;
    backoffFactor: number;
    jitter: JitterStrategy;
    random?: () => number;
  }
): number {
  const rand = options.random ?? Math.random;
  const exponential = options.initialDelayMs * Math.pow(options.backoffFactor, Math.max(0, attempt - 1));
  const capped = Math.min(options.maxDelayMs, exponential);

  if (options.jitter === "none") {
    return Math.round(capped);
  }
  if (options.jitter === "full") {
    return Math.round(rand() * capped);
  }
  // "equal" jitter: half deterministic + half random
  const half = capped / 2;
  return Math.round(half + rand() * half);
}

function defaultSleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      return reject(new RetryAbortedError());
    }
    const timer = setTimeout(() => {
      if (signal) signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    function onAbort() {
      clearTimeout(timer);
      reject(new RetryAbortedError());
    }
    if (signal) {
      signal.addEventListener("abort", onAbort, { once: true });
    }
  });
}

async function runWithTimeout<T>(
  operation: (attempt: number, signal?: AbortSignal) => Promise<T>,
  attempt: number,
  timeoutMs?: number,
  externalSignal?: AbortSignal
): Promise<T> {
  if (externalSignal?.aborted) {
    throw new RetryAbortedError();
  }
  if (!timeoutMs || timeoutMs <= 0) {
    return operation(attempt, externalSignal);
  }

  const controller = new AbortController();
  const onExternalAbort = () => controller.abort();
  if (externalSignal) {
    externalSignal.addEventListener("abort", onExternalAbort, { once: true });
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new GatewayTimeoutError(`Attempt ${attempt} timed out after ${timeoutMs}ms`, { attempt, timeoutMs }));
    }, timeoutMs);
  });

  try {
    return await Promise.race([operation(attempt, controller.signal), timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
    if (externalSignal) {
      externalSignal.removeEventListener("abort", onExternalAbort);
    }
  }
}

export function createRetry(config: RetryConfig = {}) {
  const maxAttempts = config.maxAttempts ?? 3;
  const initialDelayMs = config.initialDelayMs ?? 200;
  const maxDelayMs = config.maxDelayMs ?? 5000;
  const backoffFactor = config.backoffFactor ?? 2;
  const jitter: JitterStrategy = config.jitter ?? "equal";
  const attemptTimeoutMs = config.attemptTimeoutMs;
  const shouldRetry = config.shouldRetry ?? defaultShouldRetry;
  const sleep = config.sleep ?? defaultSleep;
  const random = config.random ?? Math.random;

  if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 20) {
    throw new FoundryError({
      code: "INVALID_RETRY_CONFIG",
      message: "RetryConfig.maxAttempts must be an integer between 1 and 20",
      statusCode: 500
    });
  }
  if (initialDelayMs < 0 || maxDelayMs < initialDelayMs || backoffFactor < 1) {
    throw new FoundryError({
      code: "INVALID_RETRY_CONFIG",
      message: "RetryConfig delays must satisfy 0 <= initialDelayMs <= maxDelayMs and backoffFactor >= 1",
      statusCode: 500
    });
  }

  async function executeWithMetadata<T>(
    operation: (attempt: number, signal?: AbortSignal) => Promise<T>,
    callOptions: RetryCallOptions = {}
  ): Promise<RetryExecutionReport<T>> {
    if (callOptions.idempotent === false) {
      throw new FoundryError({
        code: "NON_IDEMPOTENT_RETRY_BLOCKED",
        message: "Refusing to wrap explicitly non-idempotent operation in automatic retry policy",
        statusCode: 400,
        expose: true
      });
    }

    const startMs = Date.now();
    const delaysMs: number[] = [];
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      if (callOptions.signal?.aborted) {
        throw new RetryAbortedError();
      }
      try {
        const result = await runWithTimeout(operation, attempt, attemptTimeoutMs, callOptions.signal);
        return {
          result,
          attempts: attempt,
          totalDurationMs: Date.now() - startMs,
          delaysMs
        };
      } catch (err) {
        lastError = err;
        if (err instanceof RetryAbortedError || callOptions.signal?.aborted) {
          throw err instanceof RetryAbortedError ? err : new RetryAbortedError();
        }
        const canRetry = attempt < maxAttempts && (await shouldRetry(err, attempt));
        if (!canRetry) {
          if (attempt === 1) throw err;
          throw new RetryExhaustedError(attempt, delaysMs, err);
        }

        const delayMs = computeBackoffDelay(attempt, {
          initialDelayMs,
          maxDelayMs,
          backoffFactor,
          jitter,
          random
        });
        delaysMs.push(delayMs);

        if (config.onRetry) {
          await config.onRetry({
            attempt,
            maxAttempts,
            delayMs,
            elapsedMs: Date.now() - startMs,
            error: err
          });
        }

        await sleep(delayMs, callOptions.signal);
      }
    }

    throw new RetryExhaustedError(maxAttempts, delaysMs, lastError);
  }

  async function retry<T>(
    operation: (attempt: number, signal?: AbortSignal) => Promise<T>,
    callOptions: RetryCallOptions = {}
  ): Promise<T> {
    const report = await executeWithMetadata(operation, callOptions);
    return report.result;
  }

  retry.executeWithMetadata = executeWithMetadata;
  retry.config = { maxAttempts, initialDelayMs, maxDelayMs, backoffFactor, jitter, attemptTimeoutMs };

  return retry;
}
