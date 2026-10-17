import { FoundryError, extractOrGenerateRequestId } from "@backendfoundry/core";

export interface ValidationIssue {
  path: string;
  code: string;
  message: string;
}

export type SafeParseSuccess<T> = { success: true; data: T };
export type SafeParseFailure = {
  success: false;
  error: {
    issues: Array<{
      path: Array<string | number> | string;
      code?: string;
      message: string;
    }>;
  };
};
export type SafeParseResult<T> = SafeParseSuccess<T> | SafeParseFailure;

export interface SchemaLike<T = unknown> {
  safeParse?: (input: unknown) => SafeParseResult<T>;
  parse?: (input: unknown) => T;
}

const SENSITIVE_FIELD_PATTERNS = /password|passphrase|secret|token|apikey|api_key|authorization|cookie|credit_card|cvv|ssn/i;

export function isSensitiveFieldPath(path: string): boolean {
  return SENSITIVE_FIELD_PATTERNS.test(path);
}

export class ValidationError extends FoundryError {
  public readonly issues: ValidationIssue[];
  public readonly target: "body" | "query" | "params" | "headers" | "input";

  constructor(
    issues: ValidationIssue[],
    target: "body" | "query" | "params" | "headers" | "input" = "input",
    requestId?: string
  ) {
    const sanitizedIssues = issues.map((issue) => ({
      path: issue.path || "(root)",
      code: issue.code || "invalid_value",
      message: isSensitiveFieldPath(issue.path)
        ? `Invalid value provided for sensitive field '${issue.path}'`
        : issue.message
    }));
    super({
      code: "VALIDATION_FAILED",
      message: `Validation failed on ${target} (${sanitizedIssues.length} issue${sanitizedIssues.length === 1 ? "" : "s"})`,
      statusCode: 400,
      category: "validation",
      expose: true,
      requestId,
      details: {
        target,
        issues: sanitizedIssues
      }
    });
    this.issues = sanitizedIssues;
    this.target = target;
  }
}

// Built-in lightweight, composable, Zod-compatible Schema implementation
export abstract class BaseSchema<T> implements SchemaLike<T> {
  protected checks: Array<(val: T, path: string) => ValidationIssue | null> = [];
  protected isOptionalFlag = false;
  protected defaultValue?: T;
  protected hasDefault = false;
  protected coerceFlag = false;

  public abstract _parseInternal(input: unknown, path: string): { ok: true; value: T } | { ok: false; issues: ValidationIssue[] };

  public optional(): BaseSchema<T | undefined> {
    const clone = Object.create(Object.getPrototypeOf(this));
    Object.assign(clone, this);
    clone.checks = [...this.checks];
    clone.isOptionalFlag = true;
    return clone;
  }

  public default(val: T): BaseSchema<T> {
    const clone = Object.create(Object.getPrototypeOf(this));
    Object.assign(clone, this);
    clone.checks = [...this.checks];
    clone.defaultValue = val;
    clone.hasDefault = true;
    return clone;
  }

  public refine(predicate: (val: T) => boolean, message = "Custom refinement failed", code = "custom"): this {
    this.checks.push((val, path) => (predicate(val) ? null : { path, code, message }));
    return this;
  }

  public safeParse(input: unknown, path = ""): SafeParseResult<T> {
    if (input === undefined) {
      if (this.hasDefault) {
        return { success: true, data: this.defaultValue as T };
      }
      if (this.isOptionalFlag) {
        return { success: true, data: undefined as unknown as T };
      }
      return {
        success: false,
        error: {
          issues: [{ path: path ? [path] : [], code: "required", message: `Field '${path || "value"}' is required` }]
        }
      };
    }
    const res = this._parseInternal(input, path);
    if (!res.ok) {
      return {
        success: false,
        error: {
          issues: res.issues.map((i) => ({ path: i.path ? i.path.split(".") : [], code: i.code, message: i.message }))
        }
      };
    }
    const issues: ValidationIssue[] = [];
    for (const check of this.checks) {
      const issue = check(res.value, path);
      if (issue) issues.push(issue);
    }
    if (issues.length > 0) {
      return {
        success: false,
        error: {
          issues: issues.map((i) => ({ path: i.path ? i.path.split(".") : [], code: i.code, message: i.message }))
        }
      };
    }
    return { success: true, data: res.value };
  }

  public parse(input: unknown): T {
    const result = this.safeParse(input);
    if (!result.success) {
      const normalizedIssues: ValidationIssue[] = result.error.issues.map((i) => ({
        path: Array.isArray(i.path) ? i.path.join(".") : String(i.path || ""),
        code: i.code ?? "invalid_value",
        message: i.message
      }));
      throw new ValidationError(normalizedIssues, "input");
    }
    return result.data;
  }
}

export class StringSchema extends BaseSchema<string> {
  private trimFlag = false;

  public trim(): this {
    this.trimFlag = true;
    return this;
  }

  public min(length: number, message?: string): this {
    this.checks.push((val, path) =>
      val.length >= length
        ? null
        : { path, code: "too_small", message: message ?? `Must be at least ${length} characters` }
    );
    return this;
  }

  public max(length: number, message?: string): this {
    this.checks.push((val, path) =>
      val.length <= length
        ? null
        : { path, code: "too_big", message: message ?? `Must be at most ${length} characters` }
    );
    return this;
  }

  public email(message = "Must be a valid email address"): this {
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    this.checks.push((val, path) => (emailRe.test(val) ? null : { path, code: "invalid_email", message }));
    return this;
  }

  public regex(pattern: RegExp, message = "Does not match required pattern"): this {
    this.checks.push((val, path) => (pattern.test(val) ? null : { path, code: "invalid_pattern", message }));
    return this;
  }

  public _parseInternal(input: unknown, path: string): { ok: true; value: string } | { ok: false; issues: ValidationIssue[] } {
    if (typeof input !== "string") {
      return {
        ok: false,
        issues: [{ path, code: "invalid_type", message: `Expected string at '${path || "root"}'` }]
      };
    }
    return { ok: true, value: this.trimFlag ? input.trim() : input };
  }
}

export class NumberSchema extends BaseSchema<number> {
  public coerce(): this {
    this.coerceFlag = true;
    return this;
  }

  public int(message = "Must be an integer"): this {
    this.checks.push((val, path) => (Number.isInteger(val) ? null : { path, code: "not_integer", message }));
    return this;
  }

  public min(minVal: number, message?: string): this {
    this.checks.push((val, path) =>
      val >= minVal ? null : { path, code: "too_small", message: message ?? `Must be >= ${minVal}` }
    );
    return this;
  }

  public max(maxVal: number, message?: string): this {
    this.checks.push((val, path) =>
      val <= maxVal ? null : { path, code: "too_big", message: message ?? `Must be <= ${maxVal}` }
    );
    return this;
  }

  public _parseInternal(input: unknown, path: string): { ok: true; value: number } | { ok: false; issues: ValidationIssue[] } {
    let val = input;
    if (this.coerceFlag && typeof input === "string" && input.trim() !== "") {
      val = Number(input);
    }
    if (typeof val !== "number" || Number.isNaN(val) || !Number.isFinite(val)) {
      return {
        ok: false,
        issues: [{ path, code: "invalid_type", message: `Expected finite number at '${path || "root"}'` }]
      };
    }
    return { ok: true, value: val };
  }
}

export class BooleanSchema extends BaseSchema<boolean> {
  public coerce(): this {
    this.coerceFlag = true;
    return this;
  }

  public _parseInternal(input: unknown, path: string): { ok: true; value: boolean } | { ok: false; issues: ValidationIssue[] } {
    if (this.coerceFlag && typeof input === "string") {
      const lower = input.trim().toLowerCase();
      if (lower === "true" || lower === "1") return { ok: true, value: true };
      if (lower === "false" || lower === "0") return { ok: true, value: false };
    }
    if (typeof input !== "boolean") {
      return {
        ok: false,
        issues: [{ path, code: "invalid_type", message: `Expected boolean at '${path || "root"}'` }]
      };
    }
    return { ok: true, value: input };
  }
}

export class EnumSchema<T extends string> extends BaseSchema<T> {
  private readonly values: readonly T[];
  constructor(values: readonly T[]) {
    super();
    this.values = values;
  }

  public _parseInternal(input: unknown, path: string): { ok: true; value: T } | { ok: false; issues: ValidationIssue[] } {
    if (typeof input !== "string" || !this.values.includes(input as T)) {
      return {
        ok: false,
        issues: [
          {
            path,
            code: "invalid_enum",
            message: `Expected one of [${this.values.join(", ")}] at '${path || "root"}'`
          }
        ]
      };
    }
    return { ok: true, value: input as T };
  }
}

export class ArraySchema<T> extends BaseSchema<T[]> {
  private readonly itemSchema: BaseSchema<T>;
  constructor(itemSchema: BaseSchema<T>) {
    super();
    this.itemSchema = itemSchema;
  }

  public min(len: number): this {
    this.checks.push((val, path) =>
      val.length >= len ? null : { path, code: "too_small", message: `Array must contain at least ${len} items` }
    );
    return this;
  }

  public max(len: number): this {
    this.checks.push((val, path) =>
      val.length <= len ? null : { path, code: "too_big", message: `Array must contain at most ${len} items` }
    );
    return this;
  }

  public _parseInternal(input: unknown, path: string): { ok: true; value: T[] } | { ok: false; issues: ValidationIssue[] } {
    if (!Array.isArray(input)) {
      return {
        ok: false,
        issues: [{ path, code: "invalid_type", message: `Expected array at '${path || "root"}'` }]
      };
    }
    const out: T[] = [];
    const issues: ValidationIssue[] = [];
    for (let idx = 0; idx < input.length; idx++) {
      const childPath = path ? `${path}.${idx}` : String(idx);
      const res = this.itemSchema.safeParse(input[idx], childPath);
      if (!res.success) {
        for (const issue of res.error.issues) {
          issues.push({
            path: Array.isArray(issue.path) && issue.path.length ? issue.path.join(".") : childPath,
            code: issue.code ?? "invalid_value",
            message: issue.message
          });
        }
      } else {
        out.push(res.data);
      }
    }
    if (issues.length > 0) return { ok: false, issues };
    return { ok: true, value: out };
  }
}

export class ObjectSchema<Shape extends Record<string, BaseSchema<any>>> extends BaseSchema<{
  [K in keyof Shape]: Shape[K] extends BaseSchema<infer U> ? U : never;
}> {
  private readonly shape: Shape;
  private strictFlag = false;

  constructor(shape: Shape) {
    super();
    this.shape = shape;
  }

  public strict(): this {
    this.strictFlag = true;
    return this;
  }

  public _parseInternal(
    input: unknown,
    path: string
  ): { ok: true; value: any } | { ok: false; issues: ValidationIssue[] } {
    if (typeof input !== "object" || input === null || Array.isArray(input)) {
      return {
        ok: false,
        issues: [{ path, code: "invalid_type", message: `Expected object at '${path || "root"}'` }]
      };
    }
    const record = input as Record<string, unknown>;
    const output: Record<string, unknown> = {};
    const issues: ValidationIssue[] = [];

    for (const [key, fieldSchema] of Object.entries(this.shape)) {
      const childPath = path ? `${path}.${key}` : key;
      const res = fieldSchema.safeParse(record[key], childPath);
      if (!res.success) {
        for (const issue of res.error.issues) {
          issues.push({
            path: Array.isArray(issue.path) && issue.path.length ? issue.path.join(".") : childPath,
            code: issue.code ?? "invalid_value",
            message: issue.message
          });
        }
      } else if (res.data !== undefined || key in record) {
        output[key] = res.data;
      }
    }

    if (this.strictFlag) {
      const allowedKeys = new Set(Object.keys(this.shape));
      for (const extraKey of Object.keys(record)) {
        if (!allowedKeys.has(extraKey)) {
          const childPath = path ? `${path}.${extraKey}` : extraKey;
          issues.push({
            path: childPath,
            code: "unrecognized_key",
            message: `Unrecognized field '${extraKey}' is not permitted`
          });
        }
      }
    }

    if (issues.length > 0) return { ok: false, issues };
    return { ok: true, value: output };
  }
}

export const v = {
  string: () => new StringSchema(),
  number: () => new NumberSchema(),
  boolean: () => new BooleanSchema(),
  enum: <T extends string>(values: readonly T[]) => new EnumSchema<T>(values),
  array: <T>(itemSchema: BaseSchema<T>) => new ArraySchema<T>(itemSchema),
  object: <Shape extends Record<string, BaseSchema<any>>>(shape: Shape) => new ObjectSchema<Shape>(shape)
};

export function executeSchema<T>(
  schema: SchemaLike<T>,
  input: unknown,
  target: "body" | "query" | "params" | "headers" | "input" = "input",
  requestId?: string
): T {
  if (typeof schema.safeParse === "function") {
    const res = schema.safeParse(input);
    if (res.success) return res.data;
    const issues: ValidationIssue[] = (res.error?.issues ?? []).map((issue) => ({
      path: Array.isArray(issue.path) ? issue.path.join(".") : String(issue.path || target),
      code: issue.code ?? "invalid_value",
      message: issue.message
    }));
    throw new ValidationError(issues, target, requestId);
  }
  if (typeof schema.parse === "function") {
    try {
      return schema.parse(input);
    } catch (err: any) {
      if (err instanceof ValidationError) throw err;
      const rawIssues = Array.isArray(err?.issues) ? err.issues : [{ path: [target], message: err?.message ?? "Invalid input" }];
      const issues: ValidationIssue[] = rawIssues.map((i: any) => ({
        path: Array.isArray(i.path) ? i.path.join(".") : String(i.path || target),
        code: i.code ?? "invalid_value",
        message: String(i.message || "Invalid value")
      }));
      throw new ValidationError(issues, target, requestId);
    }
  }
  throw new Error("Invalid schema provided to @backendfoundry/validation: must implement safeParse() or parse()");
}

export function validateBody<T>(schema: SchemaLike<T>, body: unknown, requestId?: string): T {
  return executeSchema(schema, body, "body", requestId);
}

export function validateQuery<T>(schema: SchemaLike<T>, query: unknown, requestId?: string): T {
  return executeSchema(schema, query, "query", requestId);
}

export function validateParams<T>(schema: SchemaLike<T>, params: unknown, requestId?: string): T {
  return executeSchema(schema, params, "params", requestId);
}

export interface RequestValidationSchemas<B = unknown, Q = unknown, P = unknown> {
  body?: SchemaLike<B>;
  query?: SchemaLike<Q>;
  params?: SchemaLike<P>;
}

export function createValidator<B = unknown, Q = unknown, P = unknown>(
  schemas: RequestValidationSchemas<B, Q, P>
) {
  return function validateRequest(req: {
    body?: unknown;
    query?: unknown;
    params?: unknown;
    headers?: Record<string, string | string[] | undefined>;
  }): { body: B; query: Q; params: P; requestId: string } {
    const requestId = extractOrGenerateRequestId(req.headers);
    const body = schemas.body ? validateBody(schemas.body, req.body, requestId) : (req.body as B);
    const query = schemas.query ? validateQuery(schemas.query, req.query, requestId) : (req.query as Q);
    const params = schemas.params ? validateParams(schemas.params, req.params, requestId) : (req.params as P);
    return { body, query, params, requestId };
  };
}

// Express Middleware Adapter
export function expressValidate<B = unknown, Q = unknown, P = unknown>(
  schemas: RequestValidationSchemas<B, Q, P>
) {
  const validator = createValidator(schemas);
  return function expressValidationMiddleware(req: any, res: any, next: (err?: unknown) => void) {
    try {
      const validated = validator(req);
      req.validated = validated;
      req.body = validated.body;
      req.query = validated.query;
      req.params = validated.params;
      next();
    } catch (err) {
      next(err);
    }
  };
}

// Fastify preHandler Hook Adapter
export function fastifyValidate<B = unknown, Q = unknown, P = unknown>(
  schemas: RequestValidationSchemas<B, Q, P>
) {
  const validator = createValidator(schemas);
  return async function fastifyValidationPreHandler(request: any, reply: any) {
    try {
      const validated = validator(request);
      request.validated = validated;
      request.body = validated.body;
      request.query = validated.query;
      request.params = validated.params;
    } catch (err) {
      if (err instanceof ValidationError) {
        return reply.code(err.statusCode).send(err.toJSON(false));
      }
      throw err;
    }
  };
}
