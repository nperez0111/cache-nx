// Nx Cache Server Web Interface
// This TypeScript file handles all frontend functionality

interface CacheItem {
  hash: string;
  size: number;
  createdAt: string;
  lastAccessed: string;
}

interface CacheStats {
  totalItems: number;
  totalSize: number;
  oldestItem?: string;
  newestItem?: string;
}

// Global state
let currentCaches: CacheItem[] = [];
let isLoading = false;

// Utility functions
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
}

function showToast(message: string, type: 'success' | 'error' | 'info' = 'info'): void {
  const toast = document.getElementById('toast')!;
  const toastMessage = document.getElementById('toast-message')!;
  const toastIcon = document.getElementById('toast-icon')!;
  
  toastMessage.textContent = message;
  
  // Set icon based on type
  if (type === 'success') {
    toastIcon.innerHTML = '<svg class="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path></svg>';
  } else if (type === 'error') {
    toastIcon.innerHTML = '<svg class="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"></path></svg>';
  } else {
    toastIcon.innerHTML = '<svg class="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"></path></svg>';
  }
  
  toast.classList.remove('hidden');
  
  // Auto-hide after 3 seconds
  setTimeout(() => {
    hideToast();
  }, 3000);
}

function hideToast(): void {
  const toast = document.getElementById('toast')!;
  toast.classList.add('hidden');
}

function updateStatus(status: 'online' | 'offline' | 'loading'): void {
  const indicator = document.getElementById('status-indicator')!;
  const text = document.getElementById('status-text')!;
  
  switch (status) {
    case 'online':
      indicator.className = 'w-3 h-3 rounded-full bg-green-500 mr-2';
      text.textContent = 'Connected';
      break;
    case 'offline':
      indicator.className = 'w-3 h-3 rounded-full bg-red-500 mr-2';
      text.textContent = 'Disconnected';
      break;
    case 'loading':
      indicator.className = 'w-3 h-3 rounded-full bg-yellow-500 mr-2 animate-pulse';
      text.textContent = 'Loading...';
      break;
  }
}

// API functions
async function loadStats(): Promise<void> {
  try {
    updateStatus('loading');
    const response = await fetch('/web/api/stats');
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const stats: CacheStats = await response.json();
    
    document.getElementById('total-items')!.textContent = stats.totalItems.toString();
    document.getElementById('total-size')!.textContent = formatBytes(stats.totalSize);
    
    updateStatus('online');
  } catch (error) {
    console.error('Error loading stats:', error);
    updateStatus('offline');
    showToast('Failed to load statistics', 'error');
  }
}

async function loadCaches(): Promise<void> {
  if (isLoading) return;
  
  try {
    isLoading = true;
    const response = await fetch('/web/api/caches');
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    currentCaches = await response.json();
    renderCaches();
    
  } catch (error) {
    console.error('Error loading caches:', error);
    showToast('Failed to load cache items', 'error');
    
    // Show error state in table
    const tbody = document.getElementById('cache-list')!;
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="px-6 py-8 text-center text-red-500">
          Failed to load cache items. <button onclick="loadCaches()" class="text-blue-600 underline">Retry</button>
        </td>
      </tr>
    `;
  } finally {
    isLoading = false;
  }
}

function renderCaches(): void {
  const tbody = document.getElementById('cache-list')!;
  const countElement = document.getElementById('cache-count')!;
  
  countElement.textContent = `${currentCaches.length} items`;
  
  if (currentCaches.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="px-6 py-8 text-center text-gray-500">
          No cache items found. Start using Nx with this cache server to see items here.
        </td>
      </tr>
    `;
    return;
  }
  
  tbody.innerHTML = '';
  
  currentCaches.forEach(cache => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td class="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
        <div class="flex items-center">
          <span title="${cache.hash}">${cache.hash.substring(0, 16)}...</span>
          <button onclick="copyToClipboard('${cache.hash}')" class="ml-2 text-gray-400 hover:text-gray-600" title="Copy full hash">
            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z"></path>
              <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z"></path>
            </svg>
          </button>
        </div>
      </td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${formatBytes(cache.size)}</td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${formatDate(cache.createdAt)}</td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${formatDate(cache.lastAccessed)}</td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
        <button 
          onclick="deleteCache('${cache.hash}')"
          class="text-red-600 hover:text-red-900 transition-colors"
          title="Delete cache item"
        >
          Delete
        </button>
      </td>
    `;
    tbody.appendChild(row);
  });
}

async function deleteCache(hash: string): Promise<void> {
  if (!confirm('Are you sure you want to delete this cache item?')) return;
  
  try {
    const response = await fetch(`/web/api/caches/${hash}`, {
      method: 'DELETE'
    });
    
    if (response.ok) {
      showToast('Cache item deleted successfully', 'success');
      await refreshData();
    } else {
      throw new Error(`HTTP ${response.status}`);
    }
  } catch (error) {
    console.error('Error deleting cache:', error);
    showToast('Failed to delete cache item', 'error');
  }
}

async function purgeAll(): Promise<void> {
  if (!confirm('Are you sure you want to purge all cache items? This action cannot be undone.')) return;
  
  try {
    const response = await fetch('/web/api/caches', {
      method: 'DELETE'
    });
    
    if (response.ok) {
      const result = await response.json();
      showToast(result.message || 'All caches purged successfully', 'success');
      await refreshData();
    } else {
      throw new Error(`HTTP ${response.status}`);
    }
  } catch (error) {
    console.error('Error purging caches:', error);
    showToast('Failed to purge caches', 'error');
  }
}

function sortCaches(): void {
  const sortSelect = document.getElementById('sort-select') as HTMLSelectElement;
  const sortValue = sortSelect.value;
  
  switch (sortValue) {
    case 'newest':
      currentCaches.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      break;
    case 'oldest':
      currentCaches.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      break;
    case 'largest':
      currentCaches.sort((a, b) => b.size - a.size);
      break;
    case 'smallest':
      currentCaches.sort((a, b) => a.size - b.size);
      break;
  }
  
  renderCaches();
}

async function copyToClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    showToast('Hash copied to clipboard', 'success');
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    showToast('Failed to copy to clipboard', 'error');
  }
}

async function refreshData(): Promise<void> {
  await Promise.all([loadStats(), loadCaches()]);
}

// Global functions (called from HTML)
declare global {
  interface Window {
    refreshData: () => Promise<void>;
    purgeAll: () => Promise<void>;
    deleteCache: (hash: string) => Promise<void>;
    sortCaches: () => void;
    copyToClipboard: (text: string) => Promise<void>;
    hideToast: () => void;
  }
}

// Make this a module
export {};

// Expose functions globally
window.refreshData = refreshData;
window.purgeAll = purgeAll;
window.deleteCache = deleteCache;
window.sortCaches = sortCaches;
window.copyToClipboard = copyToClipboard;
window.hideToast = hideToast;

// Initialize the application
document.addEventListener('DOMContentLoaded', async () => {
  console.log('🚀 Nx Cache Server Web Interface loaded');
  
  // Initial data load
  await refreshData();
  
  // Auto-refresh every 30 seconds
  setInterval(refreshData, 30000);
  
  // Add keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.key === 'r' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      refreshData();
    }
  });
  
  console.log('✅ Application initialized');
});