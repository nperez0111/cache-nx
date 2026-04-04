import Redis from "ioredis";
import { config } from "./config";

export async function setupRedis() {
  try {
    const client = new Redis(config.redis.url);

    // Test connection
    await client.ping();
    console.log("✅ Redis connection established");

    return client;
  } catch (error) {
    console.error("❌ Failed to connect to Redis:", error);
    throw error;
  }
}

export function getCacheKey(hash: string): string {
  return `nx:cache:${hash}`;
}

export function getMetadataKey(hash: string): string {
  return `nx:meta:${hash}`;
}

export function getTotalSizeKey(): string {
  return `nx:cache:total_size`;
}

/**
 * Scan for keys matching a pattern using non-blocking SCAN instead of KEYS
 */
async function scanKeys(redis: Redis, pattern: string): Promise<string[]> {
  const keys: string[] = [];
  const stream = redis.scanStream({ match: pattern, count: 200 });
  return new Promise((resolve, reject) => {
    stream.on("data", (batch: string[]) => {
      keys.push(...batch);
    });
    stream.on("end", () => resolve(keys));
    stream.on("error", reject);
  });
}

/**
 * Get the current total cache size from Redis
 */
export async function getTotalCacheSize(redis: Redis): Promise<number> {
  const totalSize = await redis.get(getTotalSizeKey());
  return totalSize ? parseInt(totalSize, 10) : 0;
}

/**
 * Update the total cache size by adding or subtracting a value
 */
export async function updateTotalCacheSize(
  redis: Redis,
  delta: number
): Promise<number> {
  const newTotal = await redis.incrby(getTotalSizeKey(), delta);
  // Ensure it doesn't go negative (shouldn't happen, but safety check)
  if (newTotal < 0) {
    await redis.set(getTotalSizeKey(), "0");
    return 0;
  }
  return newTotal;
}

/**
 * Reset the total cache size to 0
 */
export async function resetTotalCacheSize(redis: Redis): Promise<void> {
  await redis.set(getTotalSizeKey(), "0");
}

/**
 * Get all cache items sorted by lastAccessed (oldest first) for LRU eviction
 */
export async function getAllCacheItemsSortedByAccess(
  redis: Redis
): Promise<Array<{ hash: string; size: number; lastAccessed: string }>> {
  const metadataKeys = await scanKeys(redis, "nx:meta:*");
  if (metadataKeys.length === 0) return [];

  const pipeline = redis.pipeline();
  for (const metaKey of metadataKeys) {
    pipeline.hgetall(metaKey);
  }
  const results = await pipeline.exec();

  const items: Array<{ hash: string; size: number; lastAccessed: string }> = [];
  if (results) {
    for (const [err, metadata] of results) {
      if (!err && metadata && typeof metadata === "object" && "hash" in metadata) {
        const meta = metadata as Record<string, string>;
        items.push({
          hash: meta.hash,
          size: parseInt(meta.size || "0", 10),
          lastAccessed: meta.lastAccessed || meta.createdAt || new Date(0).toISOString(),
        });
      }
    }
  }

  // Sort by lastAccessed (oldest first) for LRU eviction
  items.sort(
    (a, b) =>
      new Date(a.lastAccessed).getTime() - new Date(b.lastAccessed).getTime()
  );

  return items;
}

/**
 * Evict cache entries until the total size is below the limit
 * Returns the total size freed
 */
export async function evictCacheEntries(
  redis: Redis,
  maxTotalSize: number,
  newItemSize: number
): Promise<number> {
  const currentTotal = await getTotalCacheSize(redis);
  const targetSize = maxTotalSize - newItemSize;

  if (currentTotal <= targetSize) {
    return 0; // No eviction needed
  }

  const itemsToEvict = currentTotal - targetSize;
  const allItems = await getAllCacheItemsSortedByAccess(redis);

  // Batch-check existence of candidate items via pipeline
  const candidateHashes: string[] = [];
  const existsPipeline = redis.pipeline();
  for (const item of allItems) {
    existsPipeline.exists(getCacheKey(item.hash));
    candidateHashes.push(item.hash);
  }
  const existsResults = await existsPipeline.exec();

  let freedSize = 0;
  const itemsToDelete: string[] = [];

  for (let i = 0; i < allItems.length; i++) {
    if (freedSize >= itemsToEvict) break;
    const [err, exists] = existsResults![i];
    if (!err && exists) {
      freedSize += allItems[i].size;
      itemsToDelete.push(allItems[i].hash);
    }
  }

  // Batch-delete all selected items in a single pipeline
  if (itemsToDelete.length > 0) {
    const delPipeline = redis.pipeline();
    for (const hash of itemsToDelete) {
      delPipeline.del(getCacheKey(hash), getMetadataKey(hash));
    }
    await delPipeline.exec();
  }

  // Update total size
  if (freedSize > 0) {
    await updateTotalCacheSize(redis, -freedSize);
  }

  return freedSize;
}

export { scanKeys };
