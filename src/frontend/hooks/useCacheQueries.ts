import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../services/api";

// Query keys
export const queryKeys = {
  stats: ["cache", "stats"] as const,
  caches: ["cache", "caches"] as const,
};

// Hook for fetching cache statistics
export function useStats() {
  return useQuery({
    queryKey: queryKeys.stats,
    queryFn: api.getStats,
    refetchInterval: 30000, // Auto-refresh every 30 seconds
    staleTime: 10000, // Consider data stale after 10 seconds
  });
}

// Hook for fetching cache items
export function useCaches() {
  return useQuery({
    queryKey: queryKeys.caches,
    queryFn: api.getCaches,
    refetchInterval: 30000, // Auto-refresh every 30 seconds
    staleTime: 10000, // Consider data stale after 10 seconds
  });
}

// Hook for deleting a cache item
export function useDeleteCache() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.deleteCache,
    onSuccess: () => {
      // Invalidate and refetch both stats and caches
      queryClient.invalidateQueries({ queryKey: queryKeys.stats });
      queryClient.invalidateQueries({ queryKey: queryKeys.caches });
    },
  });
}

// Hook for purging all caches
export function usePurgeAllCaches() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.purgeAllCaches,
    onSuccess: () => {
      // Invalidate and refetch both stats and caches
      queryClient.invalidateQueries({ queryKey: queryKeys.stats });
      queryClient.invalidateQueries({ queryKey: queryKeys.caches });
    },
  });
}
