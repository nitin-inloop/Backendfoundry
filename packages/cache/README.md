# @backendfoundry/cache

> Cache & Stampede Protection — part of [BackendFoundry](https://backendfoundry.dev), backend components you own.

Explicitly scoped key-value caching with TTL management, in-memory and Redis adapters, safe JSON serialization boundaries, prefix invalidation, and stampede-coalesced getOrSet().

## Install

```bash
npm install @backendfoundry/cache
# or
pnpm add @backendfoundry/cache
```

Prefer to own the code? Copy the TypeScript source (plus its dependencies) into your project:

```bash
npx @backendfoundry/cli add cache
```

Ships ESM, CommonJS and TypeScript declarations. Requires Node.js >= 18.18.0, optional Redis >= 6.0.
Depends on `@backendfoundry/core`.

## Usage

```ts
import { createCache } from "@backendfoundry/cache";

const cache = createCache({
  namespace: "billing",
  defaultTtlMs: 30_000,
  requireExplicitScope: true
});

const { value, hit } = await cache.getOrSet(
  "active-plan",
  () => db.plans.findByTenant(tenantId),
  { scope: `tenant:${tenantId}`, ttlMs: 60_000 }
);
```

### Express

```ts
import { createCache } from "@backendfoundry/cache";

const cache = createCache({ namespace: "catalog", defaultTtlMs: 30_000 });

app.get("/v1/products/:id", async (req, res) => {
  const { value, hit } = await cache.getOrSet(`prod:${req.params.id}`, () => loadProduct(req.params.id), { scope: "public" });
  res.setHeader("X-Cache", hit ? "HIT" : "MISS");
  res.json(value);
});
```

### Fastify

```ts
import { createCache } from "@backendfoundry/cache";

const cache = createCache({ namespace: "catalog", defaultTtlMs: 30_000 });

fastify.get("/v1/products/:id", async (request, reply) => {
  const { id } = request.params as { id: string };
  const { value, hit } = await cache.getOrSet(`prod:${id}`, () => loadProduct(id), { scope: "public" });
  reply.header("X-Cache", hit ? "HIT" : "MISS");
  return value;
});
```

### Next.js Route Handler

```ts
import { createCache } from "@backendfoundry/cache";

const cache = createCache({ namespace: "nextjs-api", defaultTtlMs: 15_000 });

export async function GET() {
  const { value, hit } = await cache.getOrSet("stats", async () => ({ users: 420 }), { scope: "public" });
  return Response.json({ ...value, cached: hit });
}
```

## API

| Export | Kind | Signature | Description |
| --- | --- | --- | --- |
| `createCache` | function | `createCache(config?: CacheConfig)` | Creates a scoped cache instance supporting get, set, delete, invalidatePrefix, and getOrSet. |
| `MemoryCacheStore` | class | `new MemoryCacheStore({ maxEntries? })` | Bounded in-memory cache store with lazy and active TTL eviction. |
| `RedisCacheStore` | class | `new RedisCacheStore({ client })` | Redis adapter using PX millisecond expiration. |

## Configuration

| Option | Type | Default | Required | Description |
| --- | --- | --- | --- | --- |
| `namespace` | `string` | "app" | no | Top-level key prefix isolating this service's keys. |
| `defaultTtlMs` | `number` | 60000 | no | Default time-to-live in milliseconds when not specified per call. |
| `requireExplicitScope` | `boolean` | false | no | Forces callers to pass an explicit scope (e.g. 'tenant:acme' or 'public') on every operation. |

## Error behavior

Throws CACHE_SCOPE_REQUIRED (HTTP 400) if requireExplicitScope is true and scope is omitted; corrupt stored JSON is evicted and treated as a cache miss.

## Security notes

- Enable requireExplicitScope: true in multi-tenant applications so developers cannot accidentally cache tenant-specific data under a global key.
- Never cache raw authentication tokens or session secrets in unencrypted shared caches.

## Limitations

- In-flight stampede coalescing in getOrSet() coalesces concurrent misses within the same Node.js process.

## Playground

Try **Cache hits, misses & TTL expiry** live at https://backendfoundry.dev/packages/cache — Runs getOrSet() for each key in the sequence against createCache() with a simulated clock. The loader only runs on a miss. Use wait:<ms> to let entries expire and del:<key> to invalidate.

## License

MIT
