import { FoundryError } from "@backendfoundry/core";

export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

export interface CircuitStateChangeEvent {
  name: string;
  from: CircuitState;
  to: CircuitState;
  reason: string;
  timestamp: number;
}

export interface CircuitBreakerStats {
  name: string;
  state: CircuitState;
  failures: number;
  successes: number;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  rejectedCount: number;
  activeHalfOpenProbes: number;
  lastStateChangeAt: number;
  nextAttemptAt?: number;
  lastErrorMessage?: string;
}

export interface CircuitBreakerConfig {
  name?: string;
  failureThreshold?: number;
  successThreshold?: number;
  resetTimeoutMs?: number;
  halfOpenMaxAttempts?: number;
  isFailure?: (error: unknown) => boolean;
  onStateChange?: (event: CircuitStateChangeEvent) => void;
  onSuccess?: (durationMs: number, state: CircuitState) => void;
  onFailure?: (error: unknown, durationMs: number, state: CircuitState) => void;
  onRejected?: (state: CircuitState) => void;
  now?: () => number;
}

export class CircuitOpenError extends FoundryError {
  public readonly circuitName: string;
  public readonly retryAfterMs: number;

  constructor(circuitName: string, retryAfterMs: number) {
    super({
      code: "CIRCUIT_OPEN",
      message: `Circuit breaker '${circuitName}' is OPEN; upstream dependency temporarily isolated`,
      statusCode: 503,
      category: "dependency_error",
      expose: false,
      details: { circuitName, retryAfterMs }
    });
    this.circuitName = circuitName;
    this.retryAfterMs = retryAfterMs;
  }
}

/**
 * Process-local circuit breaker state machine.
 * Transitions:
 * - CLOSED -> OPEN when consecutiveFailures >= failureThreshold
 * - OPEN -> HALF_OPEN after resetTimeoutMs has elapsed
 * - HALF_OPEN -> CLOSED when consecutiveSuccesses >= successThreshold
 * - HALF_OPEN -> OPEN immediately if any probe fails
 */
export function createCircuitBreaker(config: CircuitBreakerConfig = {}) {
  const name = config.name ?? "default-circuit";
  const failureThreshold = config.failureThreshold ?? 5;
  const successThreshold = config.successThreshold ?? 2;
  const resetTimeoutMs = config.resetTimeoutMs ?? 15_000;
  const halfOpenMaxAttempts = config.halfOpenMaxAttempts ?? 1;
  const isFailure = config.isFailure ?? (() => true);
  const nowFn = config.now ?? (() => Date.now());

  if (failureThreshold < 1 || successThreshold < 1 || resetTimeoutMs < 50 || halfOpenMaxAttempts < 1) {
    throw new FoundryError({
      code: "INVALID_CIRCUIT_CONFIG",
      message: "CircuitBreakerConfig thresholds must be >= 1 and resetTimeoutMs >= 50",
      statusCode: 500
    });
  }

  let state: CircuitState = "CLOSED";
  let failures = 0;
  let successes = 0;
  let consecutiveFailures = 0;
  let consecutiveSuccesses = 0;
  let rejectedCount = 0;
  let activeHalfOpenProbes = 0;
  let lastStateChangeAt = nowFn();
  let openedAt = 0;
  let lastErrorMessage: string | undefined;

  function transitionTo(nextState: CircuitState, reason: string) {
    if (state === nextState) return;
    const prev = state;
    state = nextState;
    lastStateChangeAt = nowFn();
    if (nextState === "OPEN") {
      openedAt = lastStateChangeAt;
      consecutiveSuccesses = 0;
      activeHalfOpenProbes = 0;
    } else if (nextState === "CLOSED") {
      consecutiveFailures = 0;
      consecutiveSuccesses = 0;
      activeHalfOpenProbes = 0;
    } else if (nextState === "HALF_OPEN") {
      consecutiveSuccesses = 0;
      activeHalfOpenProbes = 0;
    }
    if (config.onStateChange) {
      config.onStateChange({
        name,
        from: prev,
        to: nextState,
        reason,
        timestamp: lastStateChangeAt
      });
    }
  }

  function evaluateTimeTransition() {
    const now = nowFn();
    if (state === "OPEN" && now - openedAt >= resetTimeoutMs) {
      transitionTo("HALF_OPEN", "Reset timeout elapsed; probing upstream health");
    }
  }

  function recordSuccess(durationMs = 0) {
    successes++;
    consecutiveSuccesses++;
    consecutiveFailures = 0;
    if (config.onSuccess) config.onSuccess(durationMs, state);

    if (state === "HALF_OPEN") {
      if (consecutiveSuccesses >= successThreshold) {
        transitionTo("CLOSED", `Probe succeeded ${consecutiveSuccesses} consecutive times`);
      }
    }
  }

  function recordFailure(err: unknown, durationMs = 0) {
    failures++;
    consecutiveFailures++;
    consecutiveSuccesses = 0;
    lastErrorMessage = err instanceof Error ? err.message : String(err);
    if (config.onFailure) config.onFailure(err, durationMs, state);

    if (state === "HALF_OPEN") {
      transitionTo("OPEN", "Recovery probe failed in HALF_OPEN state");
    } else if (state === "CLOSED" && consecutiveFailures >= failureThreshold) {
      transitionTo("OPEN", `Consecutive failures reached threshold (${failureThreshold})`);
    }
  }

  async function execute<T>(operation: () => Promise<T>): Promise<T> {
    evaluateTimeTransition();

    const now = nowFn();
    if (state === "OPEN") {
      rejectedCount++;
      if (config.onRejected) config.onRejected(state);
      const retryAfterMs = Math.max(0, resetTimeoutMs - (now - openedAt));
      throw new CircuitOpenError(name, retryAfterMs);
    }

    if (state === "HALF_OPEN") {
      if (activeHalfOpenProbes >= halfOpenMaxAttempts) {
        rejectedCount++;
        if (config.onRejected) config.onRejected(state);
        throw new CircuitOpenError(name, 1000);
      }
      activeHalfOpenProbes++;
    }

    const start = nowFn();
    try {
      const result = await operation();
      if (state === "HALF_OPEN") {
        activeHalfOpenProbes = Math.max(0, activeHalfOpenProbes - 1);
      }
      recordSuccess(nowFn() - start);
      return result;
    } catch (err) {
      if (state === "HALF_OPEN") {
        activeHalfOpenProbes = Math.max(0, activeHalfOpenProbes - 1);
      }
      if (isFailure(err)) {
        recordFailure(err, nowFn() - start);
      }
      throw err;
    }
  }

  function getStats(): CircuitBreakerStats {
    evaluateTimeTransition();
    return {
      name,
      state,
      failures,
      successes,
      consecutiveFailures,
      consecutiveSuccesses,
      rejectedCount,
      activeHalfOpenProbes,
      lastStateChangeAt,
      ...(state === "OPEN" ? { nextAttemptAt: openedAt + resetTimeoutMs } : {}),
      ...(lastErrorMessage ? { lastErrorMessage } : {})
    };
  }

  function reset() {
    failures = 0;
    successes = 0;
    consecutiveFailures = 0;
    consecutiveSuccesses = 0;
    rejectedCount = 0;
    activeHalfOpenProbes = 0;
    lastErrorMessage = undefined;
    transitionTo("CLOSED", "Manual reset");
  }

  return {
    execute,
    getStats,
    reset,
    recordSuccess,
    recordFailure
  };
}
