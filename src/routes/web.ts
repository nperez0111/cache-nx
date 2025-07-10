import { Elysia } from "elysia";
import { getCacheKey, getMetadataKey } from "../lib/redis";
import type { CacheListItem, CacheStats } from "../types";

const webApp = new Elysia({ prefix: "/web" })
  .decorate("redis", {} as any) // Will be injected by parent app
  .decorate("config", {} as any) // Will be injected by parent app
  .get("/", () => {
    return new Response(webPageHTML, {
      headers: { "Content-Type": "text/html" },
    });
  })
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
      caches.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
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
        message: `Purged ${cacheKeys.length} cache items successfully` 
      };
    } catch (error) {
      console.error("Error purging caches:", error);
      set.status = 500;
      return { success: false, message: "Failed to purge caches" };
    }
  });

const webPageHTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Nx Cache Server</title>
    <script src="https://unpkg.com/htmx.org@1.9.10"></script>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        [x-cloak] { display: none !important; }
    </style>
</head>
<body class="bg-gray-100 min-h-screen">
    <div class="container mx-auto px-4 py-8">
        <header class="mb-8">
            <h1 class="text-3xl font-bold text-gray-900 mb-2">Nx Cache Server</h1>
            <p class="text-gray-600">Manage your Nx build cache</p>
        </header>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            <div class="bg-white p-6 rounded-lg shadow">
                <h3 class="text-lg font-semibold mb-2">Total Items</h3>
                <p class="text-3xl font-bold text-blue-600" id="total-items">-</p>
            </div>
            <div class="bg-white p-6 rounded-lg shadow">
                <h3 class="text-lg font-semibold mb-2">Total Size</h3>
                <p class="text-3xl font-bold text-green-600" id="total-size">-</p>
            </div>
            <div class="bg-white p-6 rounded-lg shadow">
                <h3 class="text-lg font-semibold mb-2">Actions</h3>
                <button 
                    onclick="purgeAll()"
                    class="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded"
                >
                    Purge All Caches
                </button>
            </div>
        </div>

        <div class="bg-white rounded-lg shadow">
            <div class="p-6 border-b border-gray-200">
                <h2 class="text-xl font-semibold">Cache Items</h2>
            </div>
            <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hash</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Size</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Accessed</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody id="cache-list" class="bg-white divide-y divide-gray-200">
                        <!-- Cache items will be loaded here -->
                    </tbody>
                </table>
            </div>
        </div>
    </div>

    <script>
        async function loadStats() {
            try {
                const response = await fetch('/web/api/stats');
                const stats = await response.json();
                
                document.getElementById('total-items').textContent = stats.totalItems;
                document.getElementById('total-size').textContent = formatBytes(stats.totalSize);
            } catch (error) {
                console.error('Error loading stats:', error);
            }
        }

        async function loadCaches() {
            try {
                const response = await fetch('/web/api/caches');
                const caches = await response.json();
                
                const tbody = document.getElementById('cache-list');
                tbody.innerHTML = '';
                
                caches.forEach(cache => {
                    const row = document.createElement('tr');
                    row.innerHTML = \`
                        <td class="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">\${cache.hash.substring(0, 16)}...</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">\${formatBytes(cache.size)}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">\${formatDate(cache.createdAt)}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">\${formatDate(cache.lastAccessed)}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            <button 
                                onclick="deleteCache('\${cache.hash}')"
                                class="text-red-600 hover:text-red-900"
                            >
                                Delete
                            </button>
                        </td>
                    \`;
                    tbody.appendChild(row);
                });
            } catch (error) {
                console.error('Error loading caches:', error);
            }
        }

        async function deleteCache(hash) {
            if (!confirm('Are you sure you want to delete this cache item?')) return;
            
            try {
                const response = await fetch(\`/web/api/caches/\${hash}\`, {
                    method: 'DELETE'
                });
                
                if (response.ok) {
                    loadStats();
                    loadCaches();
                } else {
                    alert('Failed to delete cache item');
                }
            } catch (error) {
                console.error('Error deleting cache:', error);
                alert('Error deleting cache item');
            }
        }

        async function purgeAll() {
            if (!confirm('Are you sure you want to purge all cache items? This action cannot be undone.')) return;
            
            try {
                const response = await fetch('/web/api/caches', {
                    method: 'DELETE'
                });
                
                if (response.ok) {
                    loadStats();
                    loadCaches();
                    alert('All caches purged successfully');
                } else {
                    alert('Failed to purge caches');
                }
            } catch (error) {
                console.error('Error purging caches:', error);
                alert('Error purging caches');
            }
        }

        function formatBytes(bytes) {
            if (bytes === 0) return '0 Bytes';
            const k = 1024;
            const sizes = ['Bytes', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        }

        function formatDate(dateString) {
            return new Date(dateString).toLocaleDateString() + ' ' + new Date(dateString).toLocaleTimeString();
        }

        // Load data on page load
        loadStats();
        loadCaches();
        
        // Auto-refresh every 30 seconds
        setInterval(() => {
            loadStats();
            loadCaches();
        }, 30000);
    </script>
</body>
</html>`;

export default webApp;