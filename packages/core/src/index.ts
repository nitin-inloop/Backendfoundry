import crypto from "node:crypto";

export type LogLevel = "debug" | "info" | "warn" | "error" | "fatal";

export type ErrorCategory =
  | "validation"
  | "client_error"
  | "auth_error"
  | "rate_limit"
  | "conflict"
  | "dependency_error"
  | "timeout"
  | "internal_error";

export interface BrandConfig {
  name: string;
  namespace: string;
  requestIdHeader: string;
  docsUrl: string;
}

export const DEFAULT_BRAND_CONFIG: BrandConfig = Object.freeze({
  name: "BackendFoundry",
  namespace: "@backendfoundry",
  requestIdHeader: "x-request-id",
  docsUrl: "https://backendfoundry.dev/docs"
});

export function createBrandConfig(overrides: Partial<BrandConfig> = {}): BrandConfig {
  const name = (overrides.name ?? DEFAULT_BRAND_CONFIG.name).trim();
  const namespace = (overrides.namespace ?? DEFAULT_BRAND_CONFIG.namespace).trim();
  const requestIdHeader = (overrides.requestIdHeader ?? DEFAULT_BRAND_CONFIG.requestIdHeader).toLowerCase().trim();
  const docsUrl = (overrides.docsUrl ?? DEFAULT_BRAND_CONFIG.docsUrl).trim();
  if (!name || !namespace || !requestIdHeader) {
    throw new Error("BrandConfig requires non-empty name, namespace, and requestIdHeader");
  }
  return Object.freeze({ name, namespace, requestIdHeader, docsUrl });
}

export const REQUEST_ID_HEADER = "x-request-id";
const SAFE_REQUEST_ID_REGEX = /^[a-zA-Z0-9._:-]{6,128}$/;

export interface RequestIdOptions {
  prefix?: string;
  headerName?: string;
  trustIncoming?: boolean;
}

export function generateRequestId(prefix = "req"): string {
  const cleanPrefix = prefix.replace(/[^a-zA-Z0-9_-]/g, "") || "req";
  const randomPart = crypto.randomUUID().replace(/-/g, "");
  return `${cleanPrefix}_${randomPart.slice(0, 24)}`;
}

export function isValidRequestId(value: unknown): value is string {
  return typeof value === "string" && SAFE_REQUEST_ID_REGEX.test(value);
}

export function extractOrGenerateRequestId(
  headers: Record<string, string | string[] | undefined> | undefined,
  options: RequestIdOptions = {}
): string {
  const headerName = (options.headerName ?? REQUEST_ID_HEADER).toLowerCase();
  const trustIncoming = options.trustIncoming ?? true;
  if (trustIncoming && headers) {
    const normalized = normalizeHeaders(headers);
    const candidate = normalized[headerName];
    if (candidate && isValidRequestId(candidate)) {
      return candidate;
    }
  }
  return generateRequestId(options.prefix ?? "req");
}

export function normalizeHeaders(
  headers: Record<string, string | string[] | number | undefined> | undefined
): Record<string, string> {
  const result: Record<string, string> = {};
  if (!headers || typeof headers !== "object") return result;
  for (const [key, val] of Object.entries(headers)) {
    if (val === undefined || val === null) continue;
    const lower = key.toLowerCase();
    if (Array.isArray(val)) {
      result[lower] = val.join(", ");
    } else {
      result[lower] = String(val);
    }
  }
  return result;
}

export interface FoundryErrorOptions {
  code: string;
  message: string;
  statusCode?: number;
  category?: ErrorCategory;
  expose?: boolean;
  requestId?: string;
  details?: Record<string, unknown>;
  cause?: unknown;
}

export class FoundryError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly category: ErrorCategory;
  public readonly expose: boolean;
  public readonly requestId?: string;
  public readonly details?: Record<string, unknown>;
  public override readonly cause?: unknown;
  public readonly timestamp: string;

  constructor(options: FoundryErrorOptions) {
    super(options.message);
    this.name = this.constructor.name;
    this.code = options.code;
    this.statusCode = options.statusCode ?? 500;
    this.category = options.category ?? (this.statusCode >= 500 ? "internal_error" : "client_error");
    this.expose = options.expose ?? (this.statusCode < 500);
    this.requestId = options.requestId;
    this.details = options.details;
    this.cause = options.cause;
    this.timestamp = new Date().toISOString();
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  public toJSON(includeInternalDetails = false): Record<string, unknown> {
    const safeMessage = this.expose || includeInternalDetails
      ? this.message
      : "An unexpected internal error occurred.";
    const payload: Record<string, unknown> = {
      error: {
        code: this.code,
        message: safeMessage,
        category: this.category,
        statusCode: this.statusCode,
        timestamp: this.timestamp,
        ...(this.requestId ? { requestId: this.requestId } : {}),
        ...((this.expose || includeInternalDetails) && this.details ? { details: this.details } : {})
      }
    };
    return payload;
  }
}

export interface ApiMeta {
  requestId?: string;
  timestamp: string;
  durationMs?: number;
  pagination?: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasNextPage: boolean;
  };
}

export interface ApiSuccessResponse<T> {
  ok: true;
  statusCode: number;
  data: T;
  meta: ApiMeta;
}

export interface ApiErrorResponse {
  ok: false;
  statusCode: number;
  error: {
    code: string;
    message: string;
    category: ErrorCategory;
    requestId?: string;
    details?: Record<string, unknown>;
  };
  meta: ApiMeta;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

export function ok<T>(data: T, meta: Partial<ApiMeta> = {}, statusCode = 200): ApiSuccessResponse<T> {
  return {
    ok: true,
    statusCode,
    data,
    meta: {
      timestamp: meta.timestamp ?? new Date().toISOString(),
      ...(meta.requestId ? { requestId: meta.requestId } : {}),
      ...(meta.durationMs !== undefined ? { durationMs: meta.durationMs } : {}),
      ...(meta.pagination ? { pagination: meta.pagination } : {})
    }
  };
}

export function created<T>(data: T, meta: Partial<ApiMeta> = {}): ApiSuccessResponse<T> {
  return ok(data, meta, 201);
}

export function paginated<T>(
  items: T[],
  pagination: { page: number; pageSize: number; totalItems: number },
  meta: Partial<ApiMeta> = {}
): ApiSuccessResponse<T[]> {
  const page = Math.max(1, Math.floor(pagination.page));
  const pageSize = Math.max(1, Math.floor(pagination.pageSize));
  const totalItems = Math.max(0, Math.floor(pagination.totalItems));
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  return ok(items, {
    ...meta,
    pagination: {
      page,
      pageSize,
      totalItems,
      totalPages,
      hasNextPage: page < totalPages
    }
  });
}

export function fail(
  error: FoundryError | { code: string; message: string; statusCode?: number; category?: ErrorCategory; details?: Record<string, unknown> },
  meta: Partial<ApiMeta> = {}
): ApiErrorResponse {
  const statusCode = error.statusCode ?? 500;
  const category = error.category ?? (statusCode >= 500 ? "internal_error" : "client_error");
  const requestId = meta.requestId ?? ("requestId" in error ? error.requestId : undefined);
  return {
    ok: false,
    statusCode,
    error: {
      code: error.code,
      message: error.message,
      category,
      ...(requestId ? { requestId } : {}),
      ...(error.details ? { details: error.details } : {})
    },
    meta: {
      timestamp: meta.timestamp ?? new Date().toISOString(),
      ...(requestId ? { requestId } : {}),
      ...(meta.durationMs !== undefined ? { durationMs: meta.durationMs } : {})
    }
  };
}

// Environment Parsing Utilities (never leaks raw values in error messages)
export interface EnvParserOptions<T> {
  defaultValue?: T;
  required?: boolean;
  secret?: boolean;
}

export function parseEnvString(
  key: string,
  env: Record<string, string | undefined> = process.env,
  options: EnvParserOptions<string> & { minLength?: number; pattern?: RegExp } = {}
): string {
  const raw = env[key];
  if (raw === undefined || raw.trim() === "") {
    if (options.defaultValue !== undefined) return options.defaultValue;
    throw new FoundryError({
      code: "ENV_CONFIG_INVALID",
      message: `Missing required environment variable: ${key}`,
      statusCode: 500,
      category: "internal_error",
      expose: false
    });
  }
  const trimmed = raw.trim();
  if (options.minLength !== undefined && trimmed.length < options.minLength) {
    throw new FoundryError({
      code: "ENV_CONFIG_INVALID",
      message: `Environment variable ${key} must be at least ${options.minLength} characters long`,
      statusCode: 500,
      category: "internal_error",
      expose: false
    });
  }
  if (options.pattern && !options.pattern.test(trimmed)) {
    throw new FoundryError({
      code: "ENV_CONFIG_INVALID",
      message: `Environment variable ${key} does not match required format`,
      statusCode: 500,
      category: "internal_error",
      expose: false
    });
  }
  return trimmed;
}

export function parseEnvInt(
  key: string,
  env: Record<string, string | undefined> = process.env,
  options: EnvParserOptions<number> & { min?: number; max?: number } = {}
): number {
  const raw = env[key];
  if (raw === undefined || raw.trim() === "") {
    if (options.defaultValue !== undefined) return options.defaultValue;
    throw new FoundryError({
      code: "ENV_CONFIG_INVALID",
      message: `Missing required integer environment variable: ${key}`,
      statusCode: 500,
      category: "internal_error",
      expose: false
    });
  }
  const parsed = Number(raw.trim());
  if (!Number.isInteger(parsed)) {
    throw new FoundryError({
      code: "ENV_CONFIG_INVALID",
      message: `Environment variable ${key} must be a valid integer`,
      statusCode: 500,
      category: "internal_error",
      expose: false
    });
  }
  if (options.min !== undefined && parsed < options.min) {
    throw new FoundryError({
      code: "ENV_CONFIG_INVALID",
      message: `Environment variable ${key} must be >= ${options.min}`,
      statusCode: 500,
      category: "internal_error",
      expose: false
    });
  }
  if (options.max !== undefined && parsed > options.max) {
    throw new FoundryError({
      code: "ENV_CONFIG_INVALID",
      message: `Environment variable ${key} must be <= ${options.max}`,
      statusCode: 500,
      category: "internal_error",
      expose: false
    });
  }
  return parsed;
}

export function parseEnvBoolean(
  key: string,
  env: Record<string, string | undefined> = process.env,
  options: EnvParserOptions<boolean> = {}
): boolean {
  const raw = env[key];
  if (raw === undefined || raw.trim() === "") {
    if (options.defaultValue !== undefined) return options.defaultValue;
    throw new FoundryError({
      code: "ENV_CONFIG_INVALID",
      message: `Missing required boolean environment variable: ${key}`,
      statusCode: 500,
      category: "internal_error",
      expose: false
    });
  }
  const normalized = raw.trim().toLowerCase();
  if (["true", "1", "yes", "on"].includes(normalized)) return true;
  if (["false", "0", "no", "off"].includes(normalized)) return false;
  throw new FoundryError({
    code: "ENV_CONFIG_INVALID",
    message: `Environment variable ${key} must be a boolean (true/false/1/0)`,
    statusCode: 500,
    category: "internal_error",
    expose: false
  });
}

export function parseEnvEnum<T extends string>(
  key: string,
  allowedValues: readonly T[],
  env: Record<string, string | undefined> = process.env,
  options: EnvParserOptions<T> = {}
): T {
  const raw = env[key];
  if (raw === undefined || raw.trim() === "") {
    if (options.defaultValue !== undefined) return options.defaultValue;
    throw new FoundryError({
      code: "ENV_CONFIG_INVALID",
      message: `Missing required environment variable ${key}. Allowed: ${allowedValues.join(", ")}`,
      statusCode: 500,
      category: "internal_error",
      expose: false
    });
  }
  const val = raw.trim() as T;
  if (!allowedValues.includes(val)) {
    throw new FoundryError({
      code: "ENV_CONFIG_INVALID",
      message: `Environment variable ${key} must be one of: ${allowedValues.join(", ")}`,
      statusCode: 500,
      category: "internal_error",
      expose: false
    });
  }
  return val;
}
