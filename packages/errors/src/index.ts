import { FoundryError, ErrorCategory, extractOrGenerateRequestId } from "@backendfoundry/core";

export interface AppErrorOptions {
  code?: string;
  message: string;
  statusCode?: number;
  category?: ErrorCategory;
  expose?: boolean;
  requestId?: string;
  details?: Record<string, unknown>;
  cause?: unknown;
}

export class AppError extends FoundryError {
  constructor(options: AppErrorOptions) {
    super({
      code: options.code ?? "APP_ERROR",
      message: options.message,
      statusCode: options.statusCode ?? 500,
      category: options.category,
      expose: options.expose,
      requestId: options.requestId,
      details: options.details,
      cause: options.cause
    });
  }
}

export class BadRequestError extends AppError {
  constructor(message = "Bad request", details?: Record<string, unknown>, code = "BAD_REQUEST") {
    super({ code, message, statusCode: 400, category: "client_error", expose: true, details });
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Authentication required", details?: Record<string, unknown>, code = "UNAUTHORIZED") {
    super({ code, message, statusCode: 401, category: "auth_error", expose: true, details });
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Access denied", details?: Record<string, unknown>, code = "FORBIDDEN") {
    super({ code, message, statusCode: 403, category: "auth_error", expose: true, details });
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Resource not found", details?: Record<string, unknown>, code = "NOT_FOUND") {
    super({ code, message, statusCode: 404, category: "client_error", expose: true, details });
  }
}

export class ConflictError extends AppError {
  constructor(message = "Resource state conflict", details?: Record<string, unknown>, code = "CONFLICT") {
    super({ code, message, statusCode: 409, category: "conflict", expose: true, details });
  }
}

export class RateLimitExceededError extends AppError {
  public readonly retryAfterSeconds: number;
  constructor(retryAfterSeconds: number, message = "Too many requests", details?: Record<string, unknown>) {
    super({
      code: "RATE_LIMIT_EXCEEDED",
      message,
      statusCode: 429,
      category: "rate_limit",
      expose: true,
      details: { retryAfterSeconds, ...details }
    });
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export class DependencyFailedError extends AppError {
  constructor(dependencyName: string, cause?: unknown, message = "Upstream dependency failure") {
    super({
      code: "DEPENDENCY_FAILED",
      message,
      statusCode: 502,
      category: "dependency_error",
      expose: false,
      details: { dependency: dependencyName },
      cause
    });
  }
}

export class GatewayTimeoutError extends AppError {
  constructor(message = "Operation timed out", details?: Record<string, unknown>) {
    super({
      code: "OPERATION_TIMEOUT",
      message,
      statusCode: 504,
      category: "timeout",
      expose: true,
      details
    });
  }
}

const SENSITIVE_PATTERN = /(postgres|mysql|mongodb|redis):\/\/[^\s"']+|Bearer\s+[A-Za-z0-9._-]+|sk-[A-Za-z0-9]{16,}/gi;

export function scrubSensitiveMessage(text: string): string {
  return text.replace(SENSITIVE_PATTERN, "[REDACTED_CREDENTIAL]");
}

export function normalizeError(err: unknown, requestId?: string): FoundryError {
  if (err instanceof FoundryError) {
    if (requestId && !err.requestId) {
      return new FoundryError({
        code: err.code,
        message: scrubSensitiveMessage(err.message),
        statusCode: err.statusCode,
        category: err.category,
        expose: err.expose,
        requestId,
        details: err.details,
        cause: err.cause
      });
    }
    return err;
  }

  // Handle Zod-like validation errors automatically
  if (err && typeof err === "object" && "issues" in err && Array.isArray((err as any).issues)) {
    const issues = (err as any).issues.map((i: any) => ({
      path: Array.isArray(i.path) ? i.path.join(".") : String(i.path ?? ""),
      code: i.code ?? "invalid_value",
      message: scrubSensitiveMessage(String(i.message ?? "Invalid input"))
    }));
    return new FoundryError({
      code: "VALIDATION_FAILED",
      message: "Request validation failed",
      statusCode: 400,
      category: "validation",
      expose: true,
      requestId,
      details: { issues }
    });
  }

  if (err instanceof Error) {
    return new FoundryError({
      code: "INTERNAL_SERVER_ERROR",
      message: scrubSensitiveMessage(err.message),
      statusCode: 500,
      category: "internal_error",
      expose: false,
      requestId,
      cause: err
    });
  }

  return new FoundryError({
    code: "INTERNAL_SERVER_ERROR",
    message: "An unexpected internal error occurred.",
    statusCode: 500,
    category: "internal_error",
    expose: false,
    requestId
  });
}

export interface ErrorHandlerOptions {
  includeInternalDetails?: boolean;
  onError?: (normalizedError: FoundryError, originalError: unknown) => void;
}

export function toSafeErrorResponse(
  err: unknown,
  options: ErrorHandlerOptions & { requestId?: string } = {}
): { statusCode: number; headers: Record<string, string>; body: Record<string, unknown> } {
  const normalized = normalizeError(err, options.requestId);
  if (options.onError) {
    try {
      options.onError(normalized, err);
    } catch {
      // Never allow logger callback failure to crash error serialization
    }
  }
  const headers: Record<string, string> = {
    "content-type": "application/json; charset=utf-8"
  };
  if (normalized.requestId) {
    headers["x-request-id"] = normalized.requestId;
  }
  if (normalized.statusCode === 429 && normalized.details?.retryAfterSeconds) {
    headers["retry-after"] = String(normalized.details.retryAfterSeconds);
  }
  return {
    statusCode: normalized.statusCode,
    headers,
    body: normalized.toJSON(Boolean(options.includeInternalDetails))
  };
}

export function createExpressErrorHandler(options: ErrorHandlerOptions = {}) {
  return function expressErrorHandler(err: unknown, req: any, res: any, _next: any) {
    const requestId = req?.requestId ?? extractOrGenerateRequestId(req?.headers);
    const response = toSafeErrorResponse(err, { ...options, requestId });
    for (const [k, v] of Object.entries(response.headers)) {
      if (typeof res.setHeader === "function") res.setHeader(k, v);
    }
    if (typeof res.status === "function") {
      return res.status(response.statusCode).json(response.body);
    }
    res.statusCode = response.statusCode;
    res.end(JSON.stringify(response.body));
  };
}

export function createFastifyErrorHandler(options: ErrorHandlerOptions = {}) {
  return function fastifyErrorHandler(err: unknown, request: any, reply: any) {
    const requestId = request?.id ?? extractOrGenerateRequestId(request?.headers);
    const response = toSafeErrorResponse(err, { ...options, requestId });
    for (const [k, v] of Object.entries(response.headers)) {
      reply.header(k, v);
    }
    return reply.code(response.statusCode).send(response.body);
  };
}
