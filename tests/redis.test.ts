import { describe, test, expect, beforeEach } from "bun:test";
import { EventEmitter } from "events";
import {
  getCacheKey,
  getMetadataKey,
  getTotalSizeKey,
  getTotalCacheSize,
  updateTotalCacheSize,
  resetTotalCacheSize,
  getAllCacheItemsSortedByAccess,
  evictCacheEntries,
  scanKeys,
} from "../src/lib/redis";

// --- Mock Redis ---

type StoredValue = string | Buffer | Record<string, string>;

function createMockRedis(store: Map<string, StoredValue> = new Map()) {
  const redis = {
    store,
    get(key: string) {
      const val = store.get(key);
      return Promise.resolve(typeof val === "string" ? val : null);
    },
    set(key: string, value: string) {
      store.set(key, value);
      return Promise.resolve("OK");
    },
    incrby(key: string, delta: number) {
      const cur = parseInt((store.get(key) as string) || "0", 10);
      const next = cur + delta;
      store.set(key, String(next));
      return Promise.resolve(next);
    },
    exists(key: string) {
      return Promise.resolve(store.has(key) ? 1 : 0);
    },
    del(...keys: string[]) {
      let count = 0;
      for (const k of keys) {
        if (store.has(k)) {
          store.delete(k);
          count++;
        }
      }
      return Promise.resolve(count);
    },
    hgetall(key: string) {
      const val = store.get(key);
      if (val && typeof val === "object" && !Buffer.isBuffer(val)) {
        return Promise.resolve(val as Record<string, string>);
      }
      return Promise.resolve({});
    },
    hset(key: string, ...args: any[]) {
      let existing = store.get(key);
      if (!existing || typeof existing !== "object" || Buffer.isBuffer(existing)) {
        existing = {};
      }
      const obj = existing as Record<string, string>;
      if (args.length === 1 && typeof args[0] === "object") {
        Object.assign(obj, args[0]);
      } else if (args.length === 2) {
        obj[args[0]] = args[1];
      }
      store.set(key, obj);
      return Promise.resolve(1);
    },
    scanStream(opts: { match: string; count?: number }) {
      const pattern = opts.match.replace("*", "");
      const emitter = new EventEmitter();
      const matchingKeys = [...store.keys()].filter((k) => k.startsWith(pattern));
      // Emit asynchronously to mimic real behavior
      setTimeout(() => {
        emitter.emit("data", matchingKeys);
        emitter.emit("end");
      }, 0);
      return emitter;
    },
    pipeline() {
      const commands: Array<{ method: string; args: any[] }> = [];
      const pipe = {
        hgetall(key: string) {
          commands.push({ method: "hgetall", args: [key] });
          return pipe;
        },
        exists(key: string) {
          commands.push({ method: "exists", args: [key] });
          return pipe;
        },
        del(...keys: string[]) {
          commands.push({ method: "del", args: keys });
          return pipe;
        },
        async exec() {
          const results: Array<[Error | null, any]> = [];
          for (const cmd of commands) {
            try {
              const result = await (redis as any)[cmd.method](...cmd.args);
              results.push([null, result]);
            } catch (err) {
              results.push([err as Error, null]);
            }
          }
          return results;
        },
      };
      return pipe;
    },
  };
  return redis as any;
}

// --- Helper to seed cache items ---

function seedCacheItem(
  store: Map<string, StoredValue>,
  hash: string,
  size: number,
  lastAccessed: string,
  createdAt?: string
) {
  store.set(`nx:cache:${hash}`, Buffer.alloc(size));
  store.set(`nx:meta:${hash}`, {
    hash,
    size: String(size),
    createdAt: createdAt || lastAccessed,
    lastAccessed,
    contentType: "application/octet-stream",
  });
}

// --- Tests ---

describe("Key helpers", () => {
  test("getCacheKey", () => {
    expect(getCacheKey("abc123")).toBe("nx:cache:abc123");
  });

  test("getMetadataKey", () => {
    expect(getMetadataKey("abc123")).toBe("nx:meta:abc123");
  });

  test("getTotalSizeKey", () => {
    expect(getTotalSizeKey()).toBe("nx:cache:total_size");
  });
});

describe("Total cache size tracking", () => {
  let redis: ReturnType<typeof createMockRedis>;

  beforeEach(() => {
    redis = createMockRedis();
  });

  test("getTotalCacheSize returns 0 when unset", async () => {
    expect(await getTotalCacheSize(redis)).toBe(0);
  });

  test("getTotalCacheSize returns stored value", async () => {
    redis.store.set("nx:cache:total_size", "12345");
    expect(await getTotalCacheSize(redis)).toBe(12345);
  });

  test("updateTotalCacheSize increments correctly", async () => {
    redis.store.set("nx:cache:total_size", "100");
    const result = await updateTotalCacheSize(redis, 50);
    expect(result).toBe(150);
    expect(redis.store.get("nx:cache:total_size")).toBe("150");
  });

  test("updateTotalCacheSize handles negative delta", async () => {
    redis.store.set("nx:cache:total_size", "100");
    const result = await updateTotalCacheSize(redis, -30);
    expect(result).toBe(70);
  });

  test("updateTotalCacheSize resets to 0 if goes negative", async () => {
    redis.store.set("nx:cache:total_size", "10");
    const result = await updateTotalCacheSize(redis, -50);
    expect(result).toBe(0);
    expect(redis.store.get("nx:cache:total_size")).toBe("0");
  });

  test("resetTotalCacheSize sets to 0", async () => {
    redis.store.set("nx:cache:total_size", "99999");
    await resetTotalCacheSize(redis);
    expect(redis.store.get("nx:cache:total_size")).toBe("0");
  });
});

describe("scanKeys", () => {
  test("returns matching keys only", async () => {
    const store = new Map<string, StoredValue>();
    store.set("nx:meta:aaa", { hash: "aaa" });
    store.set("nx:meta:bbb", { hash: "bbb" });
    store.set("nx:cache:aaa", "data");
    store.set("other:key", "data");
    const redis = createMockRedis(store);

    const metaKeys = await scanKeys(redis, "nx:meta:*");
    expect(metaKeys).toHaveLength(2);
    expect(metaKeys).toContain("nx:meta:aaa");
    expect(metaKeys).toContain("nx:meta:bbb");

    const cacheKeys = await scanKeys(redis, "nx:cache:*");
    expect(cacheKeys).toHaveLength(1);
    expect(cacheKeys).toContain("nx:cache:aaa");
  });

  test("returns empty array when no matches", async () => {
    const redis = createMockRedis();
    const keys = await scanKeys(redis, "nx:meta:*");
    expect(keys).toEqual([]);
  });
});

describe("getAllCacheItemsSortedByAccess", () => {
  test("returns empty array when no items", async () => {
    const redis = createMockRedis();
    const items = await getAllCacheItemsSortedByAccess(redis);
    expect(items).toEqual([]);
  });

  test("returns items sorted oldest-first by lastAccessed", async () => {
    const store = new Map<string, StoredValue>();
    seedCacheItem(store, "newest", 100, "2024-03-01T00:00:00Z");
    seedCacheItem(store, "oldest", 200, "2024-01-01T00:00:00Z");
    seedCacheItem(store, "middle", 150, "2024-02-01T00:00:00Z");
    const redis = createMockRedis(store);

    const items = await getAllCacheItemsSortedByAccess(redis);
    expect(items).toHaveLength(3);
    expect(items[0].hash).toBe("oldest");
    expect(items[1].hash).toBe("middle");
    expect(items[2].hash).toBe("newest");
  });

  test("uses pipeline (not N+1 calls)", async () => {
    const store = new Map<string, StoredValue>();
    seedCacheItem(store, "a", 10, "2024-01-01T00:00:00Z");
    seedCacheItem(store, "b", 20, "2024-02-01T00:00:00Z");
    const redis = createMockRedis(store);

    let pipelineCalls = 0;
    const origPipeline = redis.pipeline.bind(redis);
    redis.pipeline = () => {
      pipelineCalls++;
      return origPipeline();
    };

    await getAllCacheItemsSortedByAccess(redis);
    expect(pipelineCalls).toBeGreaterThanOrEqual(1);
  });

  test("parses size correctly", async () => {
    const store = new Map<string, StoredValue>();
    seedCacheItem(store, "item", 4096, "2024-01-01T00:00:00Z");
    const redis = createMockRedis(store);

    const items = await getAllCacheItemsSortedByAccess(redis);
    expect(items[0].size).toBe(4096);
  });
});

describe("evictCacheEntries", () => {
  test("no eviction when under limit", async () => {
    const store = new Map<string, StoredValue>();
    store.set("nx:cache:total_size", "500");
    const redis = createMockRedis(store);

    const freed = await evictCacheEntries(redis, 1000, 100);
    expect(freed).toBe(0);
  });

  test("evicts oldest items first to make room", async () => {
    const store = new Map<string, StoredValue>();
    // Total size is 600, max is 700, new item is 200 => need to free 100
    store.set("nx:cache:total_size", "600");
    seedCacheItem(store, "old", 150, "2024-01-01T00:00:00Z");
    seedCacheItem(store, "new", 450, "2024-03-01T00:00:00Z");
    const redis = createMockRedis(store);

    const freed = await evictCacheEntries(redis, 700, 200);
    expect(freed).toBe(150); // evicted the old item (150 bytes)

    // old item should be gone
    expect(store.has("nx:cache:old")).toBe(false);
    expect(store.has("nx:meta:old")).toBe(false);

    // new item should remain
    expect(store.has("nx:cache:new")).toBe(true);
    expect(store.has("nx:meta:new")).toBe(true);
  });

  test("evicts multiple items if needed", async () => {
    const store = new Map<string, StoredValue>();
    store.set("nx:cache:total_size", "900");
    seedCacheItem(store, "a", 100, "2024-01-01T00:00:00Z");
    seedCacheItem(store, "b", 200, "2024-02-01T00:00:00Z");
    seedCacheItem(store, "c", 300, "2024-03-01T00:00:00Z");
    seedCacheItem(store, "d", 300, "2024-04-01T00:00:00Z");
    const redis = createMockRedis(store);

    // max=900, new=400 => target=500, need to free 400
    const freed = await evictCacheEntries(redis, 900, 400);
    // Should evict a(100) + b(200) + c(300) = 600 to exceed 400 needed
    expect(freed).toBeGreaterThanOrEqual(400);

    // a and b should be gone at minimum
    expect(store.has("nx:cache:a")).toBe(false);
    expect(store.has("nx:cache:b")).toBe(false);

    // d (newest) should remain
    expect(store.has("nx:cache:d")).toBe(true);
  });

  test("updates total size after eviction", async () => {
    const store = new Map<string, StoredValue>();
    store.set("nx:cache:total_size", "500");
    seedCacheItem(store, "old", 200, "2024-01-01T00:00:00Z");
    seedCacheItem(store, "new", 300, "2024-03-01T00:00:00Z");
    const redis = createMockRedis(store);

    // max=500, new=100 => target=400, need to free 100 => evict old(200)
    await evictCacheEntries(redis, 500, 100);

    const total = parseInt(store.get("nx:cache:total_size") as string, 10);
    expect(total).toBe(300); // 500 - 200
  });

  test("skips items that no longer exist (TTL expired)", async () => {
    const store = new Map<string, StoredValue>();
    store.set("nx:cache:total_size", "400");
    // Metadata exists but cache data is gone (simulating TTL expiry)
    store.set("nx:meta:expired", {
      hash: "expired",
      size: "200",
      createdAt: "2024-01-01T00:00:00Z",
      lastAccessed: "2024-01-01T00:00:00Z",
      contentType: "application/octet-stream",
    });
    // This one has both metadata and data
    seedCacheItem(store, "valid", 200, "2024-02-01T00:00:00Z");
    const redis = createMockRedis(store);

    // max=400, new=300 => target=100, need to free 300
    const freed = await evictCacheEntries(redis, 400, 300);

    // Should have evicted the valid item (skipped expired since cache key missing)
    expect(freed).toBe(200);
    expect(store.has("nx:cache:valid")).toBe(false);
  });

  test("uses pipelines for exists checks and deletes", async () => {
    const store = new Map<string, StoredValue>();
    store.set("nx:cache:total_size", "300");
    seedCacheItem(store, "a", 100, "2024-01-01T00:00:00Z");
    seedCacheItem(store, "b", 100, "2024-02-01T00:00:00Z");
    seedCacheItem(store, "c", 100, "2024-03-01T00:00:00Z");
    const redis = createMockRedis(store);

    let pipelineCalls = 0;
    const origPipeline = redis.pipeline.bind(redis);
    redis.pipeline = () => {
      pipelineCalls++;
      return origPipeline();
    };

    await evictCacheEntries(redis, 300, 200);

    // Should use at least 3 pipelines: hgetall, exists, del
    expect(pipelineCalls).toBeGreaterThanOrEqual(3);
  });
});
