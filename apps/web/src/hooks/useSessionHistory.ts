'use client'

/**
 * Hook for infinite-scroll session history
 *
 * Uses React Query's useInfiniteQuery for cursor-based pagination.
 */

import { useInfiniteQuery } from '@tanstack/react-query'
import type { PracticeSession } from '@/db/schema/practice-sessions'
import { api } from '@/lib/queryClient'
import { sessionHistoryKeys } from '@/lib/queryKeys'

// ============================================================================
// Types
// ============================================================================

interface SessionHistoryPage {
  sessions: PracticeSession[]
  nextCursor: string | null
  hasMore: boolean
}

// ============================================================================
// API Functions
// ============================================================================

async function fetchSessionHistory(
  playerId: string,
  cursor?: string,
  limit: number = 20
): Promise<SessionHistoryPage> {
  const params = new URLSearchParams()
  if (cursor) params.set('cursor', cursor)
  params.set('limit', limit.toString())

  console.log(
    `[useSessionHistory] Fetching: playerId=${playerId}, cursor=${cursor}, limit=${limit}`
  )

  const response = await api(`curriculum/${playerId}/sessions?${params.toString()}`)

  if (!response.ok) {
    console.error(`[useSessionHistory] Fetch failed: ${response.status} ${response.statusText}`)
    throw new Error(`Failed to fetch session history: ${response.statusText}`)
  }

  const data = await response.json()
  console.log(
    `[useSessionHistory] Received: ${data.sessions?.length} sessions, hasMore=${data.hasMore}, nextCursor=${data.nextCursor}`
  )
  return data
}

// ============================================================================
// Hook
// ============================================================================

interface UseSessionHistoryOptions {
  /** Number of sessions per page (default: 20) */
  pageSize?: number
  /** Whether to enable the query (default: true) */
  enabled?: boolean
}

export function useSessionHistory(playerId: string, options: UseSessionHistoryOptions = {}) {
  const { pageSize = 20, enabled = true } = options

  const query = useInfiniteQuery({
    queryKey: sessionHistoryKeys.list(playerId),
    queryFn: ({ pageParam }) => fetchSessionHistory(playerId, pageParam, pageSize),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.nextCursor : undefined),
    enabled: !!playerId && enabled,
  })

  // Flatten all pages into a single array of sessions
  const allSessions = query.data?.pages.flatMap((page) => page.sessions) ?? []

  return {
    /** All loaded sessions (flattened from all pages) */
    sessions: allSessions,
    /** Total number of sessions loaded so far */
    totalLoaded: allSessions.length,
    /** Whether more sessions are available to load */
    hasNextPage: query.hasNextPage,
    /** Whether we're currently fetching the next page */
    isFetchingNextPage: query.isFetchingNextPage,
    /** Function to load the next page */
    fetchNextPage: query.fetchNextPage,
    /** Whether the initial load is in progress */
    isLoading: query.isLoading,
    /** Whether there was an error */
    isError: query.isError,
    /** The error if any */
    error: query.error,
    /** Refetch all pages */
    refetch: query.refetch,
  }
}
