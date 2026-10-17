# @backendfoundry/validation

> Request Validation — part of [BackendFoundry](https://backendfoundry.dev), backend components you own.

Typed schema validation for request bodies, query strings, and route parameters with built-in fluent validators, external Zod compatibility, and automatic sensitive-field redaction.

## Install

```bash
npm install @backendfoundry/validation
# or
pnpm add @backendfoundry/validation
```

Prefer to own the code? Copy the TypeScript source (plus its dependencies) into your project:

```bash
npx @backendfoundry/cli add validation
```

Ships ESM, CommonJS and TypeScript declarations. Requires Node.js >= 18.18.0, TypeScript >= 5.0.
Depends on `@backendfoundry/core`.

## Usage

```ts
import { v, validateBody } from "@backendfoundry/validation";

const CreateUserSchema = v.object({
  email: v.string().trim().email(),
  password: v.string().min(12),
  role: v.enum(["admin", "developer", "viewer"]).default("developer")
}).strict();

const payload = validateBody(CreateUserSchema, req.body);
```

### Express

```ts
import { v, expressValidate } from "@backendfoundry/validation";

app.post(
  "/v1/users",
  expressValidate({ body: v.object({ email: v.string().email() }).strict() }),
  (req, res) => res.status(201).json({ email: req.body.email })
);
```

### Fastify

```ts
import { v, fastifyValidate } from "@backendfoundry/validation";

fastify.post(
  "/v1/users",
  { preHandler: fastifyValidate({ body: v.object({ email: v.string().email() }).strict() }) },
  async (request) => ({ email: request.body.email })
);
```

### Next.js Route Handler

```ts
import { v, validateBody } from "@backendfoundry/validation";
import { toSafeErrorResponse } from "@backendfoundry/errors";

const Schema = v.object({ email: v.string().email() }).strict();

export async function POST(req: Request) {
  try {
    const data = validateBody(Schema, await req.json());
    return Response.json({ ok: true, data }, { status: 201 });
  } catch (err) {
    const safe = toSafeErrorResponse(err);
    return Response.json(safe.body, { status: safe.statusCode });
  }
}
```

## API

| Export | Kind | Signature | Description |
| --- | --- | --- | --- |
| `v` | object | `v.object(...) \| v.string() \| v.number() \| v.boolean() \| v.enum() \| v.array()` | Zero-dependency fluent schema builder compatible with safeParse() and parse(). |
| `validateBody / validateQuery / validateParams` | function | `validateBody<T>(schema: SchemaLike<T>, body: unknown, requestId?: string): T` | Validates untrusted request input against any BackendFoundry or Zod schema. |
| `expressValidate / fastifyValidate` | function | `expressValidate({ body?, query?, params? })` | Framework middleware and preHandler hooks that populate req.validated and return 400 on failure. |
| `ValidationError` | class | `new ValidationError(issues, target, requestId?)` | Structured HTTP 400 error containing field-level issues with redacted sensitive field messages. |

## Configuration

| Option | Type | Default | Required | Description |
| --- | --- | --- | --- | --- |
| `body` | `SchemaLike<B>` | undefined | no | Schema used to validate and transform request.body. |
| `query` | `SchemaLike<Q>` | undefined | no | Schema used to validate and coerce request.query parameters. |
| `params` | `SchemaLike<P>` | undefined | no | Schema used to validate route parameters. |

## Error behavior

Throws ValidationError (HTTP 400, code: VALIDATION_FAILED) with structured path/code/message issues.

## Security notes

- Sensitive fields matching password, secret, token, apiKey, authorization, cvv, or ssn have their error descriptions replaced so rejected secret values are never echoed back.
- Use .strict() on object schemas to reject unexpected prototype-pollution or mass-assignment properties.

## Limitations

- Does not parse raw multipart/form-data streams; pair with a body parser with strict byte-size limits before validation.

## Playground

Try **Validate a signup request body** live at https://backendfoundry.dev/packages/validation — Runs a real v.object() schema (email, password >= 12 chars, integer age >= 18, enum plan, up to 3 tags) against your JSON. Sensitive field messages are redacted automatically.

## License

MIT
