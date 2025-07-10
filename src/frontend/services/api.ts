import type { CacheItem, CacheStats } from "../../types";

const API_BASE = "/web/api";

export const api = {
  // Fetch cache statistics
  async getStats(): Promise<CacheStats> {
    const response = await fetch(`${API_BASE}/stats`);
    if (!response.ok) {
      throw new Error(`Failed to fetch stats: ${response.status}`);
    }
    return response.json();
  },

  // Fetch all cache items
  async getCaches(): Promise<CacheItem[]> {
    const response = await fetch(`${API_BASE}/caches`);
    if (!response.ok) {
      throw new Error(`Failed to fetch caches: ${response.status}`);
    }
    return response.json();
  },

  // Delete a specific cache item
  async deleteCache(hash: string): Promise<void> {
    const response = await fetch(`${API_BASE}/caches/${hash}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      throw new Error(`Failed to delete cache: ${response.status}`);
    }
  },

  // Purge all cache items
  async purgeAllCaches(): Promise<{ message: string }> {
    const response = await fetch(`${API_BASE}/caches`, {
      method: "DELETE",
    });
    if (!response.ok) {
      throw new Error(`Failed to purge caches: ${response.status}`);
    }
    return response.json();
  },
};
