import { Elysia } from "elysia";
import { getCacheKey, getMetadataKey } from "../lib/redis";
import type { CacheListItem, CacheStats } from "../types";

const webApp = new Elysia({ prefix: "/web" })
  .decorate("redis", {} as any) // Will be injected by parent app
  .decorate("config", {} as any) // Will be injected by parent app
  .get("/api/caches", async ({ redis }) => {
    try {
      // Get all cache keys
      const cacheKeys = await redis.keys("nx:cache:*");
      const metadataKeys = await redis.keys("nx:meta:*");

      const caches: CacheListItem[] = [];

      for (const metaKey of metadataKeys) {
        const metadata = await redis.hgetall(metaKey);
        if (metadata && metadata.hash) {
          caches.push({
            hash: metadata.hash,
            size: parseInt(metadata.size || "0"),
            createdAt: metadata.createdAt || "",
            lastAccessed: metadata.lastAccessed || "",
          });
        }
      }

      // Sort by creation date (newest first)
      caches.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      return caches;
    } catch (error) {
      console.error("Error fetching caches:", error);
      return [];
    }
  })
  .get("/api/stats", async ({ redis }) => {
    try {
      const metadataKeys = await redis.keys("nx:meta:*");
      let totalSize = 0;
      let oldestItem = "";
      let newestItem = "";
      let oldestDate = new Date();
      let newestDate = new Date(0);

      for (const metaKey of metadataKeys) {
        const metadata = await redis.hgetall(metaKey);
        if (metadata && metadata.hash) {
          totalSize += parseInt(metadata.size || "0");

          const createdAt = new Date(metadata.createdAt || "");
          if (createdAt < oldestDate) {
            oldestDate = createdAt;
            oldestItem = metadata.hash;
          }
          if (createdAt > newestDate) {
            newestDate = createdAt;
            newestItem = metadata.hash;
          }
        }
      }

      const stats: CacheStats = {
        totalItems: metadataKeys.length,
        totalSize,
        oldestItem: oldestItem || undefined,
        newestItem: newestItem || undefined,
      };

      return stats;
    } catch (error) {
      console.error("Error fetching stats:", error);
      return {
        totalItems: 0,
        totalSize: 0,
      };
    }
  })
  .delete("/api/caches/:hash", async ({ params: { hash }, redis, set }) => {
    try {
      const cacheKey = getCacheKey(hash);
      const metadataKey = getMetadataKey(hash);

      await redis.del(cacheKey);
      await redis.del(metadataKey);

      return { success: true, message: "Cache deleted successfully" };
    } catch (error) {
      console.error("Error deleting cache:", error);
      set.status = 500;
      return { success: false, message: "Failed to delete cache" };
    }
  })
  .delete("/api/caches", async ({ redis, set }) => {
    try {
      const cacheKeys = await redis.keys("nx:cache:*");
      const metadataKeys = await redis.keys("nx:meta:*");

      if (cacheKeys.length > 0) {
        await redis.del(...cacheKeys);
      }
      if (metadataKeys.length > 0) {
        await redis.del(...metadataKeys);
      }

      return {
        success: true,
        message: `Purged ${cacheKeys.length} cache items successfully`,
      };
    } catch (error) {
      console.error("Error purging caches:", error);
      set.status = 500;
      return { success: false, message: "Failed to purge caches" };
    }
  });

export default webApp;
