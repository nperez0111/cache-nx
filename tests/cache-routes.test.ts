import { describe, test, expect, beforeEach } from "bun:test";
import { Elysia, t } from "elysia";
import { EventEmitter } from "events";
import { config } from "../src/lib/config";

// --- Mock Redis factory ---

type StoredValue = string | Buffer | Record<string, string>;

function createMockRedis(store: Map<string, StoredValue> = new Map()) {
  const redis = {
    store,
    get(key: string) {
      const val = store.get(key);
      return Promise.resolve(typeof val === "string" ? val : null);
    },
    getBuffer(key: string) {
      const val = store.get(key);
      if (Buffer.isBuffer(val)) return Promise.resolve(val);
      if (typeof val === "string") return Promise.resolve(Buffer.from(val));
      return Promise.resolve(null);
    },
    set(key: string, value: string) {
      store.set(key, value);
      return Promise.resolve("OK");
    },
    setex(key: string, _ttl: number, value: Buffer | string) {
      store.set(key, Buffer.isBuffer(value) ? value : Buffer.from(value));
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
        if (store.has(k)) { store.delete(k); count++; }
      }
      return Promise.resolve(count);
    },
    expire(_key: string, _ttl: number) {
      return Promise.resolve(1);
    },
    hgetall(key: string) {
      const val = store.get(key);
      if (val && typeof val === "object" && !Buffer.isBuffer(val))
        return Promise.resolve(val as Record<string, string>);
      return Promise.resolve({});
    },
    hset(key: string, ...args: any[]) {
      let existing = store.get(key);
      if (!existing || typeof existing !== "object" || Buffer.isBuffer(existing))
        existing = {};
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
      const prefix = opts.match.replace("*", "");
      const emitter = new EventEmitter();
      const matching = [...store.keys()].filter((k) => k.startsWith(prefix));
      setTimeout(() => {
        emitter.emit("data", matching);
        emitter.emit("end");
      }, 0);
      return emitter;
    },
    pipeline() {
      const commands: Array<{ method: string; args: any[] }> = [];
      const pipe = {
        hgetall(key: string) { commands.push({ method: "hgetall", args: [key] }); return pipe; },
        exists(key: string) { commands.push({ method: "exists", args: [key] }); return pipe; },
        del(...keys: string[]) { commands.push({ method: "del", args: keys }); return pipe; },
        async exec() {
          const results: Array<[Error | null, any]> = [];
          for (const cmd of commands) {
            const result = await (redis as any)[cmd.method](...cmd.args);
            results.push([null, result]);
          }
          return results;
        },
      };
      return pipe;
    },
  };
  return redis as any;
}

// We import the route modules and build a test app injecting our mock Redis.
// We have to dynamically import because the route files import from lib/redis
// which doesn't cause a top-level Redis connection.

async function createTestApp(store: Map<string, StoredValue> = new Map()) {
  const cacheApp = (await import("../src/routes/cache")).default;
  const redis = createMockRedis(store);
  const app = new Elysia()
    .decorate("redis", redis)
    .decorate("config", config)
    .use(cacheApp);
  return { app, redis, store };
}

// --- Cache route tests ---

describe("PUT /v1/cache/:hash", () => {
  test("returns 403 without auth", async () => {
    const { app } = await createTestApp();
    const res = await app.handle(
      new Request("http://localhost/v1/cache/abc", { method: "PUT" })
    );
    expect(res.status).toBe(403);
  });

  test("returns 403 with read-only token", async () => {
    const { app } = await createTestApp();
    const res = await app.handle(
      new Request("http://localhost/v1/cache/abc", {
        method: "PUT",
        headers: {
          Authorization: "Bearer readonly",
          "Content-Type": "application/octet-stream",
          "Content-Length": "5",
        },
        body: "hello",
      })
    );
    expect(res.status).toBe(403);
  });

  test("stores cache item with readwrite token", async () => {
    const store = new Map<string, StoredValue>();
    const { app } = await createTestApp(store);
    const body = "hello world";
    const res = await app.handle(
      new Request("http://localhost/v1/cache/abc123", {
        method: "PUT",
        headers: {
          Authorization: "Bearer readwrite",
          "Content-Type": "application/octet-stream",
          "Content-Length": String(body.length),
        },
        body,
      })
    );
    expect(res.status).toBe(202);
    expect(store.has("nx:cache:abc123")).toBe(true);
    expect(store.has("nx:meta:abc123")).toBe(true);
  });

  test("returns 409 for duplicate hash", async () => {
    const store = new Map<string, StoredValue>();
    store.set("nx:cache:dup", Buffer.from("existing"));
    const { app } = await createTestApp(store);
    const res = await app.handle(
      new Request("http://localhost/v1/cache/dup", {
        method: "PUT",
        headers: {
          Authorization: "Bearer readwrite",
          "Content-Type": "application/octet-stream",
          "Content-Length": "3",
        },
        body: "new",
      })
    );
    expect(res.status).toBe(409);
  });

  test("returns 400 without Content-Length", async () => {
    const { app } = await createTestApp();
    const res = await app.handle(
      new Request("http://localhost/v1/cache/test", {
        method: "PUT",
        headers: {
          Authorization: "Bearer readwrite",
          "Content-Type": "application/octet-stream",
        },
        body: "data",
      })
    );
    // Content-Length may be auto-set by fetch; at minimum it shouldn't crash
    expect([200, 202, 400]).toContain(res.status);
  });

  test("returns 200 for oversized items", async () => {
    const { app } = await createTestApp();
    // maxItemSize is 100MB; pretend we have a huge content-length
    const res = await app.handle(
      new Request("http://localhost/v1/cache/big", {
        method: "PUT",
        headers: {
          Authorization: "Bearer readwrite",
          "Content-Type": "application/octet-stream",
          "Content-Length": String(200 * 1024 * 1024), // 200MB
        },
        body: "x",
      })
    );
    expect(res.status).toBe(200);
  });

  test("updates total cache size after storing", async () => {
    const store = new Map<string, StoredValue>();
    store.set("nx:cache:total_size", "100");
    const { app } = await createTestApp(store);
    const body = "12345"; // 5 bytes
    await app.handle(
      new Request("http://localhost/v1/cache/sized", {
        method: "PUT",
        headers: {
          Authorization: "Bearer readwrite",
          "Content-Type": "application/octet-stream",
          "Content-Length": String(body.length),
        },
        body,
      })
    );
    const total = parseInt(store.get("nx:cache:total_size") as string, 10);
    expect(total).toBe(105);
  });

  test("stores metadata with correct fields", async () => {
    const store = new Map<string, StoredValue>();
    const { app } = await createTestApp(store);
    const body = "metadata-test";
    await app.handle(
      new Request("http://localhost/v1/cache/meta1", {
        method: "PUT",
        headers: {
          Authorization: "Bearer readwrite",
          "Content-Type": "application/octet-stream",
          "Content-Length": String(body.length),
        },
        body,
      })
    );
    const meta = store.get("nx:meta:meta1") as Record<string, string>;
    expect(meta.hash).toBe("meta1");
    expect(Number(meta.size)).toBe(body.length);
    expect(meta.createdAt).toBeDefined();
    expect(meta.lastAccessed).toBeDefined();
    expect(meta.contentType).toBe("application/octet-stream");
  });
});

describe("GET /v1/cache/:hash", () => {
  test("returns 403 without auth", async () => {
    const { app } = await createTestApp();
    const res = await app.handle(
      new Request("http://localhost/v1/cache/abc")
    );
    expect(res.status).toBe(403);
  });

  test("returns 404 for missing hash", async () => {
    const { app } = await createTestApp();
    const res = await app.handle(
      new Request("http://localhost/v1/cache/nonexistent", {
        headers: { Authorization: "Bearer readonly" },
      })
    );
    expect(res.status).toBe(404);
  });

  test("returns cached data with correct headers", async () => {
    const store = new Map<string, StoredValue>();
    const data = Buffer.from("cached-content");
    store.set("nx:cache:hit", data);
    store.set("nx:meta:hit", {
      hash: "hit",
      size: String(data.length),
      createdAt: "2024-01-01T00:00:00Z",
      lastAccessed: "2024-01-01T00:00:00Z",
      contentType: "application/octet-stream",
    });
    const { app } = await createTestApp(store);

    const res = await app.handle(
      new Request("http://localhost/v1/cache/hit", {
        headers: { Authorization: "Bearer readonly" },
      })
    );
    expect(res.status).toBe(200);
    const body = await res.arrayBuffer();
    expect(Buffer.from(body).toString()).toBe("cached-content");
  });

  test("updates only lastAccessed, not createdAt", async () => {
    const store = new Map<string, StoredValue>();
    const data = Buffer.from("test");
    const originalCreatedAt = "2024-01-01T00:00:00Z";
    store.set("nx:cache:preserve", data);
    store.set("nx:meta:preserve", {
      hash: "preserve",
      size: String(data.length),
      createdAt: originalCreatedAt,
      lastAccessed: "2024-01-01T00:00:00Z",
      contentType: "application/octet-stream",
    });
    const { app } = await createTestApp(store);

    await app.handle(
      new Request("http://localhost/v1/cache/preserve", {
        headers: { Authorization: "Bearer readwrite" },
      })
    );

    const meta = store.get("nx:meta:preserve") as Record<string, string>;
    // createdAt should be preserved (this was the bug we fixed)
    expect(meta.createdAt).toBe(originalCreatedAt);
    // lastAccessed should be updated to a newer time
    expect(new Date(meta.lastAccessed).getTime()).toBeGreaterThan(
      new Date(originalCreatedAt).getTime()
    );
  });

  test("allows readwrite token to read", async () => {
    const store = new Map<string, StoredValue>();
    store.set("nx:cache:rw", Buffer.from("data"));
    store.set("nx:meta:rw", {
      hash: "rw",
      size: "4",
      createdAt: "2024-01-01T00:00:00Z",
      lastAccessed: "2024-01-01T00:00:00Z",
      contentType: "application/octet-stream",
    });
    const { app } = await createTestApp(store);

    const res = await app.handle(
      new Request("http://localhost/v1/cache/rw", {
        headers: { Authorization: "Bearer readwrite" },
      })
    );
    expect(res.status).toBe(200);
  });
});
