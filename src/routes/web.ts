import { Elysia } from "elysia";
import {
  getCacheKey,
  getMetadataKey,
  getTotalCacheSize,
  updateTotalCacheSize,
  resetTotalCacheSize,
  scanKeys,
} from "../lib/redis";
import type { CacheListItem, CacheStats } from "../types";

const webApp = new Elysia({ prefix: "/web" })
  .decorate("redis", {} as any) // Will be injected by parent app
  .decorate("config", {} as any) // Will be injected by parent app
  .get("/api/caches", async ({ redis }) => {
    try {
      const metadataKeys = await scanKeys(redis, "nx:meta:*");
      if (metadataKeys.length === 0) return [];

      const pipeline = redis.pipeline();
      for (const metaKey of metadataKeys) {
        pipeline.hgetall(metaKey);
      }
      const results = await pipeline.exec();

      const caches: CacheListItem[] = [];
      if (results) {
        for (const [err, metadata] of results) {
          if (!err && metadata && typeof metadata === "object" && "hash" in metadata) {
            const meta = metadata as Record<string, string>;
            caches.push({
              hash: meta.hash,
              size: parseInt(meta.size || "0"),
              createdAt: meta.createdAt || "",
              lastAccessed: meta.lastAccessed || "",
            });
          }
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
      const metadataKeys = await scanKeys(redis, "nx:meta:*");
      const totalSize = await getTotalCacheSize(redis);

      let oldestItem = "";
      let newestItem = "";

      if (metadataKeys.length > 0) {
        const pipeline = redis.pipeline();
        for (const metaKey of metadataKeys) {
          pipeline.hgetall(metaKey);
        }
        const results = await pipeline.exec();

        let oldestDate = new Date();
        let newestDate = new Date(0);

        if (results) {
          for (const [err, metadata] of results) {
            if (!err && metadata && typeof metadata === "object" && "hash" in metadata) {
              const meta = metadata as Record<string, string>;
              const createdAt = new Date(meta.createdAt || "");
              if (createdAt < oldestDate) {
                oldestDate = createdAt;
                oldestItem = meta.hash;
              }
              if (createdAt > newestDate) {
                newestDate = createdAt;
                newestItem = meta.hash;
              }
            }
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

      // Get the item size before deleting
      const metadata = await redis.hgetall(metadataKey);
      const itemSize = metadata && metadata.size ? parseInt(metadata.size, 10) : 0;

      await redis.del(cacheKey, metadataKey);

      // Update total cache size
      if (itemSize > 0) {
        await updateTotalCacheSize(redis, -itemSize);
      }

      return { success: true, message: "Cache deleted successfully" };
    } catch (error) {
      console.error("Error deleting cache:", error);
      set.status = 500;
      return { success: false, message: "Failed to delete cache" };
    }
  })
  .delete("/api/caches", async ({ redis, set }) => {
    try {
      const cacheKeys = await scanKeys(redis, "nx:cache:*");
      const metadataKeys = await scanKeys(redis, "nx:meta:*");

      // Use UNLINK for non-blocking deletion in batches
      const BATCH_SIZE = 1000;
      const allKeys = [...cacheKeys, ...metadataKeys];
      for (let i = 0; i < allKeys.length; i += BATCH_SIZE) {
        const batch = allKeys.slice(i, i + BATCH_SIZE);
        await redis.unlink(...batch);
      }

      // Reset total cache size
      await resetTotalCacheSize(redis);

      // Filter out the total_size key from the count
      const itemCount = cacheKeys.filter(k => k !== "nx:cache:total_size").length;

      return {
        success: true,
        message: `Purged ${itemCount} cache items successfully`,
      };
    } catch (error) {
      console.error("Error purging caches:", error);
      set.status = 500;
      return { success: false, message: "Failed to purge caches" };
    }
  });

export default webApp;
