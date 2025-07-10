import { Elysia, t } from "elysia";
import type Redis from "ioredis";
import {
  hasReadPermission,
  hasWritePermission,
  verifyToken,
} from "../lib/auth";
import { config } from "../lib/config";
import { getCacheKey, getMetadataKey } from "../lib/redis";
import type { CacheMetadata } from "../types";

const cacheApp = new Elysia({ prefix: "/v1" })
  .decorate("redis", {} as Redis) // Will be injected by parent app
  .decorate("config", config) // Will be injected by parent app
  .derive(({ headers }) => {
    const authorization = headers.authorization || "";
    const tokenType = verifyToken(authorization);
    return { tokenType };
  })
  .get("/cache/:hash", async ({ params: { hash }, tokenType, redis, set }) => {
    // Verify read permission
    if (!hasReadPermission(tokenType)) {
      set.status = 403;
      return "Access forbidden";
    }

    try {
      const cacheKey = getCacheKey(hash);
      const metadataKey = getMetadataKey(hash);

      // Check if cache exists
      const data = await redis.getBuffer(cacheKey);
      if (!data) {
        set.status = 404;
        return "Cache not found";
      }

      // Update last accessed time
      const metadata: CacheMetadata = {
        hash,
        size: data.length,
        createdAt: new Date().toISOString(),
        lastAccessed: new Date().toISOString(),
        contentType: "application/octet-stream",
      };

      await redis.hset(metadataKey, metadata);

      set.headers["Content-Type"] = "application/octet-stream";
      set.headers["Content-Length"] = data.length.toString();

      return new Response(data);
    } catch (error) {
      console.error("Error retrieving cache:", error);
      set.status = 500;
      return "Internal server error";
    }
  })
  .put(
    "/cache/:hash",
    async ({
      params: { hash },
      body,
      headers,
      tokenType,
      redis,
      config,
      set,
    }) => {
      // Verify write permission
      if (!hasWritePermission(tokenType)) {
        set.status = 403;
        return "Access forbidden. Read-only token used for write operation";
      }

      try {
        const cacheKey = getCacheKey(hash);
        const metadataKey = getMetadataKey(hash);

        // Check if cache already exists
        const exists = await redis.exists(cacheKey);
        if (exists) {
          set.status = 409;
          return "Cannot override an existing record";
        }

        // Validate content length
        const contentLength = parseInt(headers["content-length"] || "0");
        if (!contentLength) {
          set.status = 400;
          return "Content-Length header is required";
        }

        // Check max size limit
        if (contentLength > config.cache.maxSize) {
          set.status = 413;
          return "Cache item too large";
        }

        let data: Buffer;
        if (body instanceof ArrayBuffer) {
          data = Buffer.from(body);
        } else if (Buffer.isBuffer(body)) {
          data = body;
        } else if (typeof body === "string") {
          data = Buffer.from(body, "binary");
        } else {
          data = Buffer.from(JSON.stringify(body));
        }

        // Verify content length matches
        if (data.length !== contentLength) {
          set.status = 400;
          return "Content-Length does not match actual content size";
        }

        // Store cache data with TTL
        await redis.setex(cacheKey, config.redis.ttl, data);

        // Store metadata
        const metadata: CacheMetadata = {
          hash,
          size: data.length,
          createdAt: new Date().toISOString(),
          lastAccessed: new Date().toISOString(),
          contentType: "application/octet-stream",
        };

        await redis.hset(metadataKey, metadata);
        await redis.expire(metadataKey, config.redis.ttl);

        set.status = 202;
        return "Successfully uploaded the output";
      } catch (error) {
        console.error("Error storing cache:", error);
        set.status = 500;
        return "Internal server error";
      }
    },
    {
      body: t.Any(),
      type: "application/octet-stream",
    }
  );

export default cacheApp;
