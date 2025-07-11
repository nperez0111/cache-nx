import React, { useState, useCallback, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StatsCard } from "./components/StatsCard";
import { CacheTable } from "./components/CacheTable";
import { Toast } from "./components/Toast";
import { StatusIndicator } from "./components/StatusIndicator";
import { ThemeToggle } from "./components/ThemeToggle";
import {
  useStats,
  useCaches,
  useDeleteCache,
  usePurgeAllCaches,
} from "./hooks/useCacheQueries";
import { useTheme } from "./hooks/useTheme";
import "./App.css";

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
  },
});

function AppContent() {
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "info";
  } | null>(null);
  const [sortBy, setSortBy] = useState<
    "newest" | "oldest" | "largest" | "smallest"
  >("newest");
  const { theme, toggleTheme } = useTheme();

  // TanStack Query hooks
  const statsQuery = useStats();
  const cachesQuery = useCaches();
  const deleteCacheMutation = useDeleteCache();
  const purgeAllMutation = usePurgeAllCaches();

  const showToast = useCallback(
    (message: string, type: "success" | "error" | "info" = "info") => {
      setToast({ message, type });
      setTimeout(() => setToast(null), 3000);
    },
    []
  );

  // Determine connection status based on query states
  const getConnectionStatus = (): "online" | "offline" | "loading" => {
    if (statsQuery.isLoading || cachesQuery.isLoading) return "loading";
    if (statsQuery.isError || cachesQuery.isError) return "offline";
    return "online";
  };

  const handleRefresh = useCallback(() => {
    statsQuery.refetch();
    cachesQuery.refetch();
  }, [statsQuery, cachesQuery]);

  const handleDeleteCache = useCallback(
    async (hash: string) => {
      if (!confirm("Are you sure you want to delete this cache item?")) return;

      try {
        await deleteCacheMutation.mutateAsync(hash);
        showToast("Cache item deleted successfully", "success");
      } catch (error) {
        console.error("Error deleting cache:", error);
        showToast("Failed to delete cache item", "error");
      }
    },
    [deleteCacheMutation, showToast]
  );

  const handlePurgeAll = useCallback(async () => {
    if (
      !confirm(
        "Are you sure you want to purge all cache items? This action cannot be undone."
      )
    )
      return;

    try {
      await purgeAllMutation.mutateAsync();
      showToast("All caches purged successfully", "success");
    } catch (error) {
      console.error("Error purging caches:", error);
      showToast("Failed to purge caches", "error");
    }
  }, [purgeAllMutation, showToast]);

  const handleSortChange = useCallback((newSortBy: typeof sortBy) => {
    setSortBy(newSortBy);
  }, []);

  const sortedCaches = React.useMemo(() => {
    const caches = cachesQuery.data || [];
    const sorted = [...caches];
    switch (sortBy) {
      case "newest":
        return sorted.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      case "oldest":
        return sorted.sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
      case "largest":
        return sorted.sort((a, b) => b.size - a.size);
      case "smallest":
        return sorted.sort((a, b) => a.size - b.size);
      default:
        return sorted;
    }
  }, [cachesQuery.data, sortBy]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "r" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleRefresh();
      }
      if (e.key === "d" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        toggleTheme();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleRefresh, toggleTheme]);

  const status = getConnectionStatus();
  const isLoading = cachesQuery.isLoading;
  const stats = statsQuery.data;

  return (
    <div
      className={`min-h-screen transition-colors duration-200 ${
        theme === "dark"
          ? "bg-gray-900 text-gray-100"
          : "bg-gray-100 text-gray-900"
      }`}
    >
      <div className="container mx-auto px-4 py-8">
        <header className="mb-8">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h1 className="text-3xl font-bold mb-2">Nx Cache Server</h1>
              <p
                className={`${
                  theme === "dark" ? "text-gray-400" : "text-gray-600"
                }`}
              >
                Manage your Nx build cache
              </p>
            </div>
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
          </div>
          <div className="flex items-center space-x-4">
            <StatusIndicator status={status} theme={theme} />
            <button
              onClick={handleRefresh}
              className={`text-sm underline transition-colors ${
                theme === "dark"
                  ? "text-blue-400 hover:text-blue-300"
                  : "text-blue-600 hover:text-blue-800"
              }`}
              disabled={isLoading}
            >
              Refresh
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <StatsCard
            title="Total Items"
            value={stats?.totalItems ?? "-"}
            color="blue"
            loading={status === "loading"}
            theme={theme}
          />
          <StatsCard
            title="Total Size"
            value={stats?.totalSize ? formatBytes(stats.totalSize) : "-"}
            color="green"
            loading={status === "loading"}
            theme={theme}
          />
          <div
            className={`p-6 rounded-lg shadow transition-colors ${
              theme === "dark"
                ? "bg-gray-800 border border-gray-700"
                : "bg-white"
            }`}
          >
            <h3 className="text-lg font-semibold mb-2">Actions</h3>
            <button
              onClick={handlePurgeAll}
              disabled={purgeAllMutation.isPending}
              className="bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white px-4 py-2 rounded transition-colors"
            >
              {purgeAllMutation.isPending ? "Purging..." : "Purge All Caches"}
            </button>
          </div>
        </div>

        <CacheTable
          caches={sortedCaches}
          isLoading={isLoading}
          sortBy={sortBy}
          onSortChange={handleSortChange}
          onDeleteCache={handleDeleteCache}
          onCopyHash={(hash) =>
            showToast("Hash copied to clipboard", "success")
          }
          theme={theme}
        />
      </div>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
          theme={theme}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}
