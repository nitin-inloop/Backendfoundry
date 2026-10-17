import { FoundryError } from "@backendfoundry/core";

export interface CacheEntry<T = unknown> {
  value: T;
  expiresAtMs: number;
  createdAtMs: number;
}

export interface CacheStore {
  get(key: string, nowMs?: number): Promise<string | null>;
  set(key: string, serializedValue: string, ttlMs: number, nowMs?: number): Promise<void>;
  delete(key: string): Promise<boolean>;
  deleteByPrefix(prefix: string): Promise<number>;
  clear(): Promise<void>;
  keys?(nowMs?: number): Promise<string[]>;
}

export class MemoryCacheStore implements CacheStore {
  private readonly store = new Map<string, { value: string; expiresAtMs: number }>();
  private readonly maxEntries: number;

  constructor(options: { maxEntries?: number } = {}) {
    this.maxEntries = options.maxEntries ?? 10_000;
  }

  public async get(key: string, nowMs = Date.now()): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (nowMs >= entry.expiresAtMs) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  public async set(key: string, serializedValue: string, ttlMs: number, nowMs = Date.now()): Promise<void> {
    if (ttlMs <= 0) {
      this.store.delete(key);
      return;
    }
    if (this.store.size >= this.maxEntries && !this.store.has(key)) {
      const oldestKey = this.store.keys().next().value;
      if (oldestKey !== undefined) this.store.delete(oldestKey);
    }
    this.store.set(key, {
      value: serializedValue,
      expiresAtMs: nowMs + ttlMs
    });
  }

  public async delete(key: string): Promise<boolean> {
    return this.store.delete(key);
  }

  public async deleteByPrefix(prefix: string): Promise<number> {
    let deleted = 0;
    for (const k of Array.from(this.store.keys())) {
      if (k.startsWith(prefix)) {
        this.store.delete(k);
        deleted++;
      }
    }
    return deleted;
  }

  public async clear(): Promise<void> {
    this.store.clear();
  }

  public async keys(nowMs = Date.now()): Promise<string[]> {
    const valid: string[] = [];
    for (const [k, v] of this.store.entries()) {
      if (nowMs < v.expiresAtMs) {
        valid.push(k);
      } else {
        this.store.delete(k);
      }
    }
    return valid;
  }
}

export interface RedisCacheClientLike {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode?: string, duration?: number): Promise<unknown>;
  del(...keys: string[]): Promise<number>;
  keys?(pattern: string): Promise<string[]>;
}

export class RedisCacheStore implements CacheStore {
  private readonly client: RedisCacheClientLike;

  constructor(options: { client: RedisCacheClientLike }) {
    if (!options?.client || typeof options.client.get !== "function") {
      throw new FoundryError({
        code: "INVALID_REDIS_CACHE_CLIENT",
        message: "RedisCacheStore requires a Redis client with get(), set(), and del()",
        statusCode: 500
      });
    }
    this.client = options.client;
  }

  public async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  public async set(key: string, serializedValue: string, ttlMs: number): Promise<void> {
    if (ttlMs <= 0) {
      await this.client.del(key);
      return;
    }
    await this.client.set(key, serializedValue, "PX", ttlMs);
  }

  public async delete(key: string): Promise<boolean> {
    const count = await this.client.del(key);
    return count > 0;
  }

  public async deleteByPrefix(prefix: string): Promise<number> {
    if (!this.client.keys) return 0;
    const matched = await this.client.keys(`${prefix}*`);
    if (!matched.length) return 0;
    return this.client.del(...matched);
  }

  public async clear(): Promise<void> {
    await this.deleteByPrefix("");
  }
}

export interface CacheSerializer {
  serialize(value: unknown): string;
  deserialize<T>(raw: string): T;
}

export const SafeJsonSerializer: CacheSerializer = {
  serialize(value: unknown): string {
    try {
      return JSON.stringify({ __bf_v: 1, data: value });
    } catch (err) {
      throw new FoundryError({
        code: "CACHE_SERIALIZATION_ERROR",
        message: `Failed to serialize cache value: ${err instanceof Error ? err.message : String(err)}`,
        statusCode: 500,
        cause: err
      });
    }
  },
  deserialize<T>(raw: string): T {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && "__bf_v" in parsed) {
      return parsed.data as T;
    }
    return parsed as T;
  }
};

export interface CacheConfig {
  namespace?: string;
  defaultTtlMs?: number;
  store?: CacheStore;
  serializer?: CacheSerializer;
  requireExplicitScope?: boolean;
  now?: () => number;
}

export interface CacheSetOptions {
  ttlMs?: number;
  scope?: string;
}

export interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  deserializationErrors: number;
}

export function createCache(config: CacheConfig = {}) {
  const namespace = (config.namespace ?? "app").trim();
  const defaultTtlMs = config.defaultTtlMs ?? 60_000;
  const store = config.store ?? new MemoryCacheStore();
  const serializer = config.serializer ?? SafeJsonSerializer;
  const requireExplicitScope = config.requireExplicitScope ?? false;
  const nowFn = config.now ?? (() => Date.now());

  if (!namespace || defaultTtlMs <= 0) {
    throw new FoundryError({
      code: "INVALID_CACHE_CONFIG",
      message: "CacheConfig requires a non-empty namespace and defaultTtlMs > 0",
      statusCode: 500
    });
  }

  const inflightLoaders = new Map<string, Promise<unknown>>();
  const stats: CacheStats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    deserializationErrors: 0
  };

  function buildKey(key: string, scope?: string): string {
    const trimmedKey = key.trim();
    if (!trimmedKey) {
      throw new FoundryError({
        code: "INVALID_CACHE_KEY",
        message: "Cache key must be a non-empty string",
        statusCode: 400
      });
    }
    if (requireExplicitScope && (!scope || !scope.trim())) {
      throw new FoundryError({
        code: "CACHE_SCOPE_REQUIRED",
        message: "Explicit cache scope (e.g. 'public' or 'tenant:123') is required when requireExplicitScope is enabled",
        statusCode: 400
      });
    }
    const cleanScope = scope ? scope.trim() : "global";
    return `${namespace}:${cleanScope}:${trimmedKey}`;
  }

  async function get<T = unknown>(key: string, options: { scope?: string } = {}): Promise<T | null> {
    const fullKey = buildKey(key, options.scope);
    const raw = await store.get(fullKey, nowFn());
    if (raw === null) {
      stats.misses++;
      return null;
    }
    try {
      const value = serializer.deserialize<T>(raw);
      stats.hits++;
      return value;
    } catch {
      stats.deserializationErrors++;
      stats.misses++;
      await store.delete(fullKey);
      return null;
    }
  }

  async function set<T = unknown>(key: string, value: T, options: CacheSetOptions = {}): Promise<void> {
    const fullKey = buildKey(key, options.scope);
    const ttlMs = options.ttlMs ?? defaultTtlMs;
    const raw = serializer.serialize(value);
    await store.set(fullKey, raw, ttlMs, nowFn());
    stats.sets++;
  }

  async function del(key: string, options: { scope?: string } = {}): Promise<boolean> {
    const fullKey = buildKey(key, options.scope);
    const removed = await store.delete(fullKey);
    if (removed) stats.deletes++;
    return removed;
  }

  async function invalidatePrefix(prefixKey: string, options: { scope?: string } = {}): Promise<number> {
    const fullPrefix = buildKey(prefixKey, options.scope);
    const count = await store.deleteByPrefix(fullPrefix);
    stats.deletes += count;
    return count;
  }

  async function getOrSet<T>(
    key: string,
    loader: () => Promise<T>,
    options: CacheSetOptions = {}
  ): Promise<{ value: T; hit: boolean }> {
    const cached = await get<T>(key, { scope: options.scope });
    if (cached !== null) {
      return { value: cached, hit: true };
    }

    const fullKey = buildKey(key, options.scope);
    const existingPromise = inflightLoaders.get(fullKey) as Promise<T> | undefined;
    if (existingPromise) {
      const value = await existingPromise;
      return { value, hit: true };
    }

    const loadPromise = (async () => {
      try {
        const fresh = await loader();
        await set(key, fresh, options);
        return fresh;
      } finally {
        inflightLoaders.delete(fullKey);
      }
    })();

    inflightLoaders.set(fullKey, loadPromise);
    const value = await loadPromise;
    return { value, hit: false };
  }

  async function clear(): Promise<void> {
    await store.clear();
  }

  function getStats(): CacheStats {
    return { ...stats };
  }

  return {
    buildKey,
    get,
    set,
    delete: del,
    invalidatePrefix,
    getOrSet,
    clear,
    getStats
  };
}
