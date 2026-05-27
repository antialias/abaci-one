'use client'

/**
 * React Query hook for session song status.
 *
 * Sync model (post #154): socket-only.
 *
 * - One fetch on initial mount (React Query default).
 * - The server emits `session-song:phase:<planId>` on every status transition
 *   and `session-song:ready:<planId>` on completion. Either event invalidates
 *   the query so we refetch the current truth.
 * - On socket (re)connect, invalidate once to reconcile anything we missed
 *   while disconnected. NOT a polling safety net — a bounded sync.
 * - `connectionState` is exposed so the UI can show "reconnecting" /
 *   "lost" states rather than silently masking a broken channel.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createSocket } from '@/lib/socket'
import { sessionSongKeys } from '@/lib/queryKeys'
import { api } from '@/lib/queryClient'
import { useElapsedMs } from '@/hooks/useElapsedMs'

import type { SessionSongFailureKind } from '@/db/schema/session-songs'
import type { SongLyricsSection } from '@/lib/song/alignment'

interface SessionSongData {
  id: string
  status: string
  title: string | null
  durationSeconds: number | null
  audioPath: string | null
  /** URL for the word-alignment JSON. May 404 for legacy songs without timestamps. */
  alignmentPath: string | null
  /** Per-section lyrics for the synced-lyrics player. Null until completed. */
  lyrics: SongLyricsSection[] | null
  triggerSource: string | null
  failureKind: SessionSongFailureKind | null
  /** Raw error string — server only includes for owners/admins; null otherwise. */
  errorDetail: string | null
  /** True when the requesting viewer is the player's account owner or an admin. */
  viewerIsOwner: boolean
  /** Last worker heartbeat (server time, ms). Null for legacy songs without a task row. */
  lastHeartbeatAt: number | null
  /** Background task status, or null when no task row exists. */
  taskStatus: string | null
  createdAt: number | null
  completedAt: number | null
}

interface SessionSongResponse {
  song: SessionSongData | null
  /** Server's `Date.now()` at response time — used to skew-correct heartbeat seed. */
  serverNow: number
}

export type SessionSongConnectionState = 'connected' | 'reconnecting' | 'lost'

/** Worker-liveness signal derived from heartbeat freshness. */
export type SessionSongLiveness = 'fresh' | 'stale' | 'unknown'

/**
 * Time since the last `session-song:alive:` event (or seeded heartbeat) before
 * the UI flips to 'stale'. 3× the worker's HEARTBEAT_INTERVAL_MS (10s) — enough
 * headroom to absorb network jitter without spurious alarms.
 */
const STALE_THRESHOLD_MS = 30_000

interface UseSessionSongOptions {
  playerId: string
  planId: string | undefined
  enabled?: boolean
}

/** Time disconnected before we surface 'lost' to the UI. */
const CONNECTION_LOST_THRESHOLD_MS = 30_000

export function useSessionSong({ playerId, planId, enabled = true }: UseSessionSongOptions) {
  const queryClient = useQueryClient()
  const [connectionState, setConnectionState] = useState<SessionSongConnectionState>('connected')
  const [lastAliveAt, setLastAliveAt] = useState<number | null>(null)
  const socketRef = useRef<ReturnType<typeof createSocket> | null>(null)

  const query = useQuery({
    queryKey: sessionSongKeys.forPlan(planId ?? ''),
    queryFn: async (): Promise<SessionSongResponse> => {
      const res = await api(`curriculum/${playerId}/sessions/plans/${planId}/song`)
      if (!res.ok) return { song: null, serverNow: Date.now() }
      return res.json() as Promise<SessionSongResponse>
    },
    enabled: enabled && !!planId,
  })

  // Seed `lastAliveAt` from the GET response. We translate the server-time
  // heartbeat into a client-time-equivalent timestamp so the staleness ticker
  // can compare against `Date.now()` directly without per-tick skew math.
  // Always take the max with what we already have — socket alive events may
  // race ahead of a slow refetch and we don't want to walk back in time.
  useEffect(() => {
    const data = query.data
    if (!data?.song?.lastHeartbeatAt) return
    const ageMs = data.serverNow - data.song.lastHeartbeatAt
    const clientEquivalent = Date.now() - ageMs
    setLastAliveAt((prev) => (prev == null || clientEquivalent > prev ? clientEquivalent : prev))
  }, [query.data])

  useEffect(() => {
    if (!planId || !enabled) return

    const socket = createSocket()
    socketRef.current = socket

    let lostTimer: ReturnType<typeof setTimeout> | null = null
    const clearLostTimer = () => {
      if (lostTimer) {
        clearTimeout(lostTimer)
        lostTimer = null
      }
    }

    const invalidate = () => {
      queryClient.invalidateQueries({ queryKey: sessionSongKeys.forPlan(planId) })
    }

    const handleConnect = () => {
      clearLostTimer()
      setConnectionState('connected')
      // Reconciliation fetch — catches up on any phase/ready events that
      // fired while we were offline.
      invalidate()
    }

    const handleDisconnect = () => {
      clearLostTimer()
      setConnectionState('reconnecting')
      lostTimer = setTimeout(() => setConnectionState('lost'), CONNECTION_LOST_THRESHOLD_MS)
    }

    // Pure liveness ping — does NOT invalidate the query. The cache stays
    // canonical for status; this event only refreshes our "still alive" clock.
    const handleAlive = () => {
      const now = Date.now()
      setLastAliveAt((prev) => (prev == null || now > prev ? now : prev))
    }

    const phaseEvent = `session-song:phase:${planId}`
    const readyEvent = `session-song:ready:${planId}`
    const aliveEvent = `session-song:alive:${planId}`

    socket.on('connect', handleConnect)
    socket.on('disconnect', handleDisconnect)
    socket.on(phaseEvent, invalidate)
    socket.on(readyEvent, invalidate)
    socket.on(aliveEvent, handleAlive)

    if (socket.connected) setConnectionState('connected')

    return () => {
      clearLostTimer()
      socket.off('connect', handleConnect)
      socket.off('disconnect', handleDisconnect)
      socket.off(phaseEvent, invalidate)
      socket.off(readyEvent, invalidate)
      socket.off(aliveEvent, handleAlive)
      socket.disconnect()
      socketRef.current = null
    }
  }, [planId, enabled, queryClient])

  const reconnect = useCallback(() => {
    const socket = socketRef.current
    if (!socket) return
    setConnectionState('reconnecting')
    socket.connect()
  }, [])

  const song = query.data?.song ?? null
  const isGenerating = !!song && song.status !== 'completed' && song.status !== 'failed'
  const isReady = song?.status === 'completed'
  const hasFailed = song?.status === 'failed'

  // Re-evaluate liveness on a 1s ticker so the UI flips to 'stale' on the
  // clock — not just on incoming events.
  const aliveAgeMs = useElapsedMs(lastAliveAt)
  const liveness: SessionSongLiveness =
    lastAliveAt == null
      ? 'unknown'
      : aliveAgeMs != null && aliveAgeMs > STALE_THRESHOLD_MS
        ? 'stale'
        : 'fresh'

  return {
    song,
    isGenerating,
    isReady,
    hasFailed,
    failureKind: song?.failureKind ?? null,
    errorDetail: song?.errorDetail ?? null,
    viewerIsOwner: song?.viewerIsOwner ?? false,
    isLoading: query.isLoading,
    connectionState,
    reconnect,
    liveness,
    lastAliveAt,
  }
}
