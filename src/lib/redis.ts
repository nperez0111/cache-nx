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