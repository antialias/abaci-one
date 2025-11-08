"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/queryClient";

/**
 * Query key for viewer ID
 */
export const viewerKeys = {
  all: ["viewer"] as const,
  id: () => [...viewerKeys.all, "id"] as const,
};

/**
 * Fetch the current viewer ID
 */
async function fetchViewerId(): Promise<string | null> {
  try {
    const res = await api("viewer");
    if (!res.ok) return null;
    const data = await res.json();
    return data.viewerId;
  } catch {
    return null;
  }
}

/**
 * Hook: Get the current viewer ID
 *
 * Returns the user ID for authenticated users or guest ID for guests.
 * Returns null if no valid viewer session exists.
 */
export function useViewerId() {
  return useQuery({
    queryKey: viewerKeys.id(),
    queryFn: fetchViewerId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: false,
  });
}
