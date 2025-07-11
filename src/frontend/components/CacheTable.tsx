import React from "react";
import type { CacheItem } from "../../types";

interface CacheTableProps {
  caches: CacheItem[];
  isLoading: boolean;
  sortBy: "newest" | "oldest" | "largest" | "smallest";
  onSortChange: (sortBy: "newest" | "oldest" | "largest" | "smallest") => void;
  onDeleteCache: (hash: string) => void;
  onCopyHash?: (hash: string) => void;
  theme: "light" | "dark";
}

export function CacheTable({
  caches,
  isLoading,
  sortBy,
  onSortChange,
  onDeleteCache,
  onCopyHash,
  theme,
}: CacheTableProps) {
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + " " + date.toLocaleTimeString();
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      onCopyHash?.(text);
    } catch (error) {
      console.error("Failed to copy to clipboard:", error);
    }
  };

  if (isLoading) {
    return (
      <div
        className={`rounded-lg shadow transition-colors ${
          theme === "dark" ? "bg-gray-800 border border-gray-700" : "bg-white"
        }`}
      >
        <div
          className={`p-6 border-b transition-colors ${
            theme === "dark" ? "border-gray-700" : "border-gray-200"
          }`}
        >
          <h2
            className={`text-xl font-semibold ${
              theme === "dark" ? "text-gray-200" : "text-gray-900"
            }`}
          >
            Cache Items
          </h2>
        </div>
        <div className="p-8 text-center">
          <div
            className={`loading ${
              theme === "dark" ? "text-gray-400" : "text-gray-500"
            }`}
          >
            Loading cache items...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`rounded-lg shadow transition-colors ${
        theme === "dark" ? "bg-gray-800 border border-gray-700" : "bg-white"
      }`}
    >
      <div
        className={`p-6 border-b transition-colors flex justify-between items-center ${
          theme === "dark" ? "border-gray-700" : "border-gray-200"
        }`}
      >
        <h2
          className={`text-xl font-semibold ${
            theme === "dark" ? "text-gray-200" : "text-gray-900"
          }`}
        >
          Cache Items
        </h2>
        <div className="flex items-center space-x-4">
          <span
            className={`text-sm ${
              theme === "dark" ? "text-gray-400" : "text-gray-500"
            }`}
          >
            {caches.length} items
          </span>
          <div className="flex items-center space-x-2">
            <label
              htmlFor="sort-select"
              className={`text-sm ${
                theme === "dark" ? "text-gray-300" : "text-gray-700"
              }`}
            >
              Sort by:
            </label>
            <select
              id="sort-select"
              value={sortBy}
              onChange={(e) => onSortChange(e.target.value as typeof sortBy)}
              className={`text-sm border rounded px-2 py-1 transition-colors ${
                theme === "dark"
                  ? "bg-gray-700 border-gray-600 text-gray-200"
                  : "border-gray-300 bg-white text-gray-900"
              }`}
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="largest">Largest First</option>
              <option value="smallest">Smallest First</option>
            </select>
          </div>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y transition-colors">
          <thead
            className={`transition-colors ${
              theme === "dark" ? "bg-gray-700" : "bg-gray-50"
            }`}
          >
            <tr>
              <th
                className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                  theme === "dark" ? "text-gray-300" : "text-gray-500"
                }`}
              >
                Hash
              </th>
              <th
                className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                  theme === "dark" ? "text-gray-300" : "text-gray-500"
                }`}
              >
                Size
              </th>
              <th
                className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                  theme === "dark" ? "text-gray-300" : "text-gray-500"
                }`}
              >
                Created
              </th>
              <th
                className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                  theme === "dark" ? "text-gray-300" : "text-gray-500"
                }`}
              >
                Last Accessed
              </th>
              <th
                className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                  theme === "dark" ? "text-gray-300" : "text-gray-500"
                }`}
              >
                Actions
              </th>
            </tr>
          </thead>
          <tbody
            className={`divide-y transition-colors ${
              theme === "dark" ? "divide-gray-700" : "divide-gray-200"
            }`}
          >
            {caches.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className={`px-6 py-8 text-center ${
                    theme === "dark" ? "text-gray-400" : "text-gray-500"
                  }`}
                >
                  No cache items found. Start using Nx with this cache server to
                  see items here.
                </td>
              </tr>
            ) : (
              caches.map((cache) => (
                <tr
                  key={cache.hash}
                  className={`transition-colors ${
                    theme === "dark" ? "hover:bg-gray-700" : "hover:bg-gray-50"
                  }`}
                >
                  <td
                    className={`px-6 py-4 whitespace-nowrap text-sm font-mono ${
                      theme === "dark" ? "text-gray-200" : "text-gray-900"
                    }`}
                  >
                    <div className="flex items-center">
                      <span title={cache.hash}>
                        {cache.hash.substring(0, 16)}...
                      </span>
                      <button
                        onClick={() => copyToClipboard(cache.hash)}
                        className={`ml-2 transition-colors ${
                          theme === "dark"
                            ? "text-gray-500 hover:text-gray-300"
                            : "text-gray-400 hover:text-gray-600"
                        }`}
                        title="Copy full hash"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z"></path>
                          <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z"></path>
                        </svg>
                      </button>
                    </div>
                  </td>
                  <td
                    className={`px-6 py-4 whitespace-nowrap text-sm ${
                      theme === "dark" ? "text-gray-200" : "text-gray-900"
                    }`}
                  >
                    {formatBytes(cache.size)}
                  </td>
                  <td
                    className={`px-6 py-4 whitespace-nowrap text-sm ${
                      theme === "dark" ? "text-gray-200" : "text-gray-900"
                    }`}
                  >
                    {formatDate(cache.createdAt)}
                  </td>
                  <td
                    className={`px-6 py-4 whitespace-nowrap text-sm ${
                      theme === "dark" ? "text-gray-200" : "text-gray-900"
                    }`}
                  >
                    {formatDate(cache.lastAccessed)}
                  </td>
                  <td
                    className={`px-6 py-4 whitespace-nowrap text-sm ${
                      theme === "dark" ? "text-gray-200" : "text-gray-900"
                    }`}
                  >
                    <button
                      onClick={() => onDeleteCache(cache.hash)}
                      className="text-red-600 hover:text-red-900 transition-colors"
                      title="Delete cache item"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
