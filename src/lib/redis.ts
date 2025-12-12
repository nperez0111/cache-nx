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
  const metadataKeys = await redis.keys("nx:meta:*");
  const items: Array<{ hash: string; size: number; lastAccessed: string }> = [];

  for (const metaKey of metadataKeys) {
    const metadata = await redis.hgetall(metaKey);
    if (metadata && metadata.hash) {
      items.push({
        hash: metadata.hash,
        size: parseInt(metadata.size || "0", 10),
        lastAccessed: metadata.lastAccessed || metadata.createdAt || new Date(0).toISOString(),
      });
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
  
  let freedSize = 0;
  const itemsToDelete: string[] = [];

  for (const item of allItems) {
    if (freedSize >= itemsToEvict) {
      break;
    }
    // Verify the cache item still exists (might have expired via TTL)
    const cacheKey = getCacheKey(item.hash);
    const exists = await redis.exists(cacheKey);
    if (exists) {
      freedSize += item.size;
      itemsToDelete.push(item.hash);
    }
  }

  // Delete the selected items
  for (const hash of itemsToDelete) {
    const cacheKey = getCacheKey(hash);
    const metadataKey = getMetadataKey(hash);
    await redis.del(cacheKey);
    await redis.del(metadataKey);
  }

  // Update total size
  if (freedSize > 0) {
    await updateTotalCacheSize(redis, -freedSize);
  }

  return freedSize;
}
