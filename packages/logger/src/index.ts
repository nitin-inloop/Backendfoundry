import { AsyncLocalStorage } from "node:async_hooks";
import { LogLevel, generateRequestId, extractOrGenerateRequestId } from "@backendfoundry/core";
import { scrubSensitiveMessage } from "@backendfoundry/errors";

export interface RequestLogContext {
  requestId: string;
  traceId?: string;
  userId?: string;
  tenantId?: string;
  route?: string;
  method?: string;
  [key: string]: unknown;
}

const requestContextStorage = new AsyncLocalStorage<RequestLogContext>();

export function runWithRequestContext<T>(
  context: Partial<RequestLogContext>,
  callback: () => T
): T {
  const parent = requestContextStorage.getStore();
  const merged: RequestLogContext = {
    ...parent,
    ...context,
    requestId: context.requestId ?? parent?.requestId ?? generateRequestId("req")
  };
  return requestContextStorage.run(merged, callback);
}

export function getRequestContext(): RequestLogContext | undefined {
  return requestContextStorage.getStore();
}

export function setRequestContextFields(fields: Record<string, unknown>): void {
  const store = requestContextStorage.getStore();
  if (store) {
    Object.assign(store, fields);
  }
}

const LOG_LEVEL_WEIGHTS: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  fatal: 50
};

const DEFAULT_REDACT_KEYS = new Set([
  "password",
  "passphrase",
  "secret",
  "token",
  "accesstoken",
  "access_token",
  "refreshtoken",
  "refresh_token",
  "apikey",
  "api_key",
  "authorization",
  "cookie",
  "set-cookie",
  "creditcard",
  "credit_card",
  "cvv",
  "ssn",
  "privatekey",
  "private_key"
]);

export function redactSensitiveObject(
  input: unknown,
  customKeys: Set<string> = DEFAULT_REDACT_KEYS,
  seen = new WeakSet<object>()
): unknown {
  if (input === null || input === undefined) return input;
  if (typeof input === "string") {
    return scrubSensitiveMessage(input);
  }
  if (typeof input !== "object") return input;
  if (input instanceof Error) {
    return {
      name: input.name,
      message: scrubSensitiveMessage(input.message),
      ...("code" in input ? { code: (input as any).code } : {}),
      ...("statusCode" in input ? { statusCode: (input as any).statusCode } : {})
    };
  }
  if (seen.has(input as object)) return "[Circular]";
  seen.add(input as object);

  if (Array.isArray(input)) {
    return input.map((item) => redactSensitiveObject(item, customKeys, seen));
  }

  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    const normalizedKey = key.toLowerCase().replace(/[^a-z0-9_-]/g, "");
    if (customKeys.has(normalizedKey) || customKeys.has(key.toLowerCase())) {
      output[key] = "[REDACTED]";
    } else {
      output[key] = redactSensitiveObject(value, customKeys, seen);
    }
  }
  return output;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  service: string;
  message: string;
  requestId?: string;
  context?: Record<string, unknown>;
  meta?: Record<string, unknown>;
}

export interface LogTransport {
  write(entry: LogEntry): void;
}

export class MemoryLogTransport implements LogTransport {
  public readonly entries: LogEntry[] = [];
  public write(entry: LogEntry): void {
    this.entries.push(entry);
  }
  public clear(): void {
    this.entries.length = 0;
  }
}

export class ConsoleJsonTransport implements LogTransport {
  public write(entry: LogEntry): void {
    const line = JSON.stringify(entry);
    if (entry.level === "error" || entry.level === "fatal") {
      console.error(line);
    } else {
      console.log(line);
    }
  }
}

export interface LoggerConfig {
  service?: string;
  level?: LogLevel;
  redactFields?: string[];
  transport?: LogTransport;
  baseBindings?: Record<string, unknown>;
}

export function createLogger(config: LoggerConfig = {}) {
  const service = config.service ?? "backendfoundry-service";
  const minLevel: LogLevel = config.level ?? "info";
  const transport = config.transport ?? new ConsoleJsonTransport();
  const redactSet = new Set([
    ...DEFAULT_REDACT_KEYS,
    ...(config.redactFields ?? []).map((f) => f.toLowerCase())
  ]);
  const baseBindings = (redactSensitiveObject(config.baseBindings ?? {}, redactSet) as Record<string, unknown>) ?? {};

  function log(level: LogLevel, message: string, meta?: Record<string, unknown>) {
    if (LOG_LEVEL_WEIGHTS[level] < LOG_LEVEL_WEIGHTS[minLevel]) {
      return;
    }
    const asyncCtx = getRequestContext();
    const sanitizedMeta = meta
      ? (redactSensitiveObject(meta, redactSet) as Record<string, unknown>)
      : undefined;
    const sanitizedCtx = asyncCtx
      ? (redactSensitiveObject(asyncCtx, redactSet) as Record<string, unknown>)
      : undefined;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      service,
      message: scrubSensitiveMessage(message),
      ...(asyncCtx?.requestId ? { requestId: asyncCtx.requestId } : {}),
      ...(Object.keys(baseBindings).length || sanitizedCtx
        ? { context: { ...baseBindings, ...sanitizedCtx } }
        : {}),
      ...(sanitizedMeta && Object.keys(sanitizedMeta).length ? { meta: sanitizedMeta } : {})
    };

    transport.write(entry);
  }

  function child(bindings: Record<string, unknown>) {
    return createLogger({
      service,
      level: minLevel,
      redactFields: Array.from(redactSet),
      transport,
      baseBindings: { ...baseBindings, ...bindings }
    });
  }

  return {
    debug: (msg: string, meta?: Record<string, unknown>) => log("debug", msg, meta),
    info: (msg: string, meta?: Record<string, unknown>) => log("info", msg, meta),
    warn: (msg: string, meta?: Record<string, unknown>) => log("warn", msg, meta),
    error: (msg: string, meta?: Record<string, unknown>) => log("error", msg, meta),
    fatal: (msg: string, meta?: Record<string, unknown>) => log("fatal", msg, meta),
    child
  };
}

export function expressRequestLogger(logger: ReturnType<typeof createLogger>) {
  return function expressLoggerMiddleware(req: any, res: any, next: () => void) {
    const requestId = extractOrGenerateRequestId(req?.headers);
    req.requestId = requestId;
    if (typeof res?.setHeader === "function") {
      res.setHeader("x-request-id", requestId);
    }
    const startMs = Date.now();
    runWithRequestContext({ requestId, method: req?.method, route: req?.path ?? req?.url }, () => {
      if (typeof res?.on === "function") {
        res.on("finish", () => {
          const durationMs = Date.now() - startMs;
          const statusCode = res.statusCode ?? 200;
          logger.info("HTTP request completed", {
            method: req?.method,
            path: req?.path ?? req?.url,
            statusCode,
            outcome: statusCode >= 500 ? "error" : statusCode >= 400 ? "client_error" : "success",
            durationMs
          });
        });
      }
      next();
    });
  };
}
