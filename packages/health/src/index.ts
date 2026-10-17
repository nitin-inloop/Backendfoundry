import { scrubSensitiveMessage } from "@backendfoundry/errors";

export type HealthStatus = "healthy" | "degraded" | "unhealthy";

export interface HealthProbeDefinition {
  name: string;
  critical?: boolean;
  timeoutMs?: number;
  check: (signal: AbortSignal) => Promise<{ healthy?: boolean; message?: string } | boolean | void>;
}

export interface ProbeResult {
  name: string;
  status: "healthy" | "unhealthy";
  critical: boolean;
  latencyMs: number;
  message?: string;
}

export interface HealthReport {
  status: HealthStatus;
  statusCode: 200 | 503;
  timestamp: string;
  uptimeSeconds: number;
  version?: string;
  checks: Record<string, Omit<ProbeResult, "name">>;
}

export interface HealthRegistryConfig {
  serviceName?: string;
  version?: string;
  defaultTimeoutMs?: number;
  exposeErrorMessages?: boolean;
}

async function executeProbe(
  probe: HealthProbeDefinition,
  defaultTimeoutMs: number,
  exposeErrorMessages: boolean
): Promise<ProbeResult> {
  const critical = probe.critical ?? true;
  const timeoutMs = probe.timeoutMs ?? defaultTimeoutMs;
  const start = Date.now();
  const controller = new AbortController();

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error(`Health probe timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    const raw = await Promise.race([probe.check(controller.signal), timeoutPromise]);
    const latencyMs = Date.now() - start;
    if (typeof raw === "boolean") {
      return {
        name: probe.name,
        status: raw ? "healthy" : "unhealthy",
        critical,
        latencyMs,
        ...(raw ? {} : { message: "Probe returned unhealthy state" })
      };
    }
    if (raw && typeof raw === "object") {
      const healthy = raw.healthy ?? true;
      return {
        name: probe.name,
        status: healthy ? "healthy" : "unhealthy",
        critical,
        latencyMs,
        ...(raw.message ? { message: scrubSensitiveMessage(raw.message) } : {})
      };
    }
    return {
      name: probe.name,
      status: "healthy",
      critical,
      latencyMs
    };
  } catch (err) {
    const latencyMs = Date.now() - start;
    const rawMsg = err instanceof Error ? err.message : "Probe failed";
    return {
      name: probe.name,
      status: "unhealthy",
      critical,
      latencyMs,
      message: exposeErrorMessages ? scrubSensitiveMessage(rawMsg) : "Dependency check failed"
    };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function createHealthRegistry(config: HealthRegistryConfig = {}) {
  const defaultTimeoutMs = config.defaultTimeoutMs ?? 2_000;
  const exposeErrorMessages = config.exposeErrorMessages ?? false;
  const probes = new Map<string, HealthProbeDefinition>();
  const startedAtMs = Date.now();

  function registerProbe(probe: HealthProbeDefinition) {
    if (!probe.name || typeof probe.check !== "function") {
      throw new Error("Health probe requires a valid name and check function");
    }
    probes.set(probe.name, probe);
    return () => probes.delete(probe.name);
  }

  async function checkLiveness(): Promise<HealthReport> {
    return {
      status: "healthy",
      statusCode: 200,
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor((Date.now() - startedAtMs) / 1000),
      ...(config.version ? { version: config.version } : {}),
      checks: {
        process: {
          status: "healthy",
          critical: true,
          latencyMs: 0
        }
      }
    };
  }

  async function checkReadiness(): Promise<HealthReport> {
    const definitions = Array.from(probes.values());
    const results = await Promise.all(
      definitions.map((p) => executeProbe(p, defaultTimeoutMs, exposeErrorMessages))
    );

    let hasCriticalFailure = false;
    let hasNonCriticalFailure = false;
    const checks: Record<string, Omit<ProbeResult, "name">> = {};

    for (const r of results) {
      checks[r.name] = {
        status: r.status,
        critical: r.critical,
        latencyMs: r.latencyMs,
        ...(r.message ? { message: r.message } : {})
      };
      if (r.status === "unhealthy") {
        if (r.critical) hasCriticalFailure = true;
        else hasNonCriticalFailure = true;
      }
    }

    const status: HealthStatus = hasCriticalFailure
      ? "unhealthy"
      : hasNonCriticalFailure
      ? "degraded"
      : "healthy";

    return {
      status,
      statusCode: hasCriticalFailure ? 503 : 200,
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor((Date.now() - startedAtMs) / 1000),
      ...(config.version ? { version: config.version } : {}),
      checks
    };
  }

  function expressHandlers() {
    return {
      liveness: async (_req: any, res: any) => {
        const report = await checkLiveness();
        res.status(report.statusCode).json(report);
      },
      readiness: async (_req: any, res: any) => {
        const report = await checkReadiness();
        res.status(report.statusCode).json(report);
      }
    };
  }

  return {
    registerProbe,
    checkLiveness,
    checkReadiness,
    expressHandlers
  };
}
