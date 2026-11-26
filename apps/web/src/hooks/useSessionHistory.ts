'use client'

/**
 * Hook for infinite-scroll session history
 *
 * Uses React Query's useInfiniteQuery for cursor-based pagination. Rows carry
 * the session report's numbers (`SessionHistoryEntry`, Phase 4d).
 *
 * Kept current by push, not polling: the hook joins the player's room and a
 * `session-ended` for this player (natural completion included, §10 P4a-4)
 * invalidates the list, so the session that just ended appears.
 */

import { type QueryClient, useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import type { SessionEndedEvent } from '@/lib/classroom/socket-events'
import type { SessionHistoryEntry } from '@/lib/curriculum/progress-manager'
import { api } from '@/lib/queryClient'
import { sessionHistoryKeys, sessionPlanKeys } from '@/lib/queryKeys'
import { createSocket } from '@/lib/socket'

// ============================================================================
// Types
// ============================================================================

interface SessionHistoryPage {
  sessions: SessionHistoryEntry[]
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

/**
 * When one of a player's sessions ends: refresh their session history, and
 * their active session (the dashboard's in-progress card), which would
 * otherwise keep showing the ended session until a reload.
 */
export function invalidateSessionHistoryOnEnd(
  queryClient: QueryClient,
  playerId: string,
  event: Pick<SessionEndedEvent, 'playerId'> | undefined
): void {
  if (event?.playerId !== playerId) return
  void queryClient.invalidateQueries({ queryKey: sessionHistoryKeys.list(playerId) })
  void queryClient.invalidateQueries({ queryKey: sessionPlanKeys.active(playerId) })
}

export function useSessionHistory(playerId: string, options: UseSessionHistoryOptions = {}) {
  const { pageSize = 20, enabled = true } = options
  const queryClient = useQueryClient()

  // Push: the player's room hears `session-ended` on every end
  useEffect(() => {
    if (!playerId || !enabled) return
    const socket = createSocket({ reconnection: true })
    socket.on('connect', () => {
      socket.emit('join-player', { playerId })
    })
    socket.on('session-ended', (event: SessionEndedEvent) =>
      invalidateSessionHistoryOnEnd(queryClient, playerId, event)
    )
    return () => {
      socket.emit('leave-player', { playerId })
      socket.disconnect()
    }
  }, [playerId, enabled, queryClient])

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
