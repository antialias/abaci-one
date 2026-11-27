'use client'

/**
 * Hook for real-time session time estimates via WebSocket
 *
 * Subscribes to session state updates and computes time estimates
 * using the shared calculation functions. Falls back to static data
 * when WebSocket isn't connected.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Socket } from 'socket.io-client'
import { countedTries } from '@/db/schema/session-plan-helpers'
import type { SessionPart, SlotResult } from '@/db/schema/session-plans'
import { useUserId } from '@/hooks/useUserId'
import type { SessionStatsEvent } from '@/lib/classroom/socket-events'
import { arithmeticSlotTotal } from '@/lib/curriculum/parts/arithmetic/session-view'
import { createSocket } from '@/lib/socket'
import {
  calculateEstimatedTimeRemainingMs,
  calculateTimingStats,
  formatEstimatedTimeRemaining,
  type SessionTimeEstimate,
} from './useSessionTimeEstimate'

// ============================================================================
// Types
// ============================================================================

export interface LiveSessionTimeEstimateOptions {
  /** Session ID to subscribe to */
  sessionId: string | undefined
  /** Initial results (used before WebSocket connects) */
  initialResults?: SlotResult[]
  /** Initial parts (used before WebSocket connects) */
  initialParts?: SessionPart[]
  /** Whether to enable the WebSocket subscription */
  enabled?: boolean
  /**
   * Items done of planned, from the session report (`position.progress`).
   * When given, the problem counts and the remaining-time estimate use it
   * instead of counting tries (Phase 4d); the live socket then supplies only
   * the timing samples.
   */
  progress?: { done: number; total: number } | null
}

export interface LiveSessionTimeEstimateResult extends SessionTimeEstimate {
  /** Number of correct answers */
  correctCount: number
  /** Accuracy as a decimal (0-1) */
  accuracy: number
  /** Whether connected to WebSocket */
  isConnected: boolean
  /** Whether receiving live updates */
  isLive: boolean
  /** Last activity timestamp from live updates */
  lastActivityAt: Date | null
  /** Error if connection failed */
  error: string | null
}

// ============================================================================
// Hook
// ============================================================================

// Stable defaults: a fresh `[]` per render would re-run the seeding effect forever
const NO_RESULTS: SlotResult[] = []
const NO_PARTS: SessionPart[] = []

/**
 * Hook to get real-time session time estimates via WebSocket
 *
 * Connects to the session's socket channel and receives practice state updates.
 * Computes time estimates using the same functions as the student's practice view.
 *
 * @example
 * ```tsx
 * const estimate = useLiveSessionTimeEstimate({
 *   sessionId: session.id,
 *   initialResults: session.results,
 *   initialParts: session.parts,
 * })
 *
 * return (
 *   <span>
 *     {estimate.isLive ? '🔴 Live: ' : ''}
 *     {estimate.estimatedTimeRemainingFormatted} left
 *   </span>
 * )
 * ```
 */
export function useLiveSessionTimeEstimate({
  sessionId,
  initialResults = NO_RESULTS,
  initialParts = NO_PARTS,
  enabled = true,
  progress = null,
}: LiveSessionTimeEstimateOptions): LiveSessionTimeEstimateResult {
  // State for live data
  const [liveResults, setLiveResults] = useState<SlotResult[]>(initialResults)
  const [liveParts, setLiveParts] = useState<SessionPart[]>(initialParts)
  const [lastActivityAt, setLastActivityAt] = useState<Date | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [isLive, setIsLive] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const socketRef = useRef<Socket | null>(null)
  // The credential for the (gated, Phase 4c) session room: the viewer's id
  const { data: viewerId } = useUserId()

  // Update initial data when props change (before WebSocket connects)
  useEffect(() => {
    if (!isLive) {
      setLiveResults(initialResults)
      setLiveParts(initialParts)
    }
  }, [initialResults, initialParts, isLive])

  // Cleanup function
  const cleanup = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect()
      socketRef.current = null
    }
    setIsConnected(false)
    setIsLive(false)
  }, [])

  // WebSocket subscription
  useEffect(() => {
    if (!sessionId || !enabled || !viewerId) {
      cleanup()
      return
    }

    // Create socket connection
    const socket = createSocket({
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    })
    socketRef.current = socket

    socket.on('connect', () => {
      console.log('[LiveSessionTimeEstimate] Connected, subscribing to session:', sessionId)
      setIsConnected(true)
      setError(null)

      // Subscribe to the stats feed; the server checks `view` on the
      // session's player for this viewer (session-room-access.ts)
      socket.emit('subscribe-session-stats', { sessionId, viewerId })
    })

    socket.on('disconnect', () => {
      console.log('[LiveSessionTimeEstimate] Disconnected')
      setIsConnected(false)
      setIsLive(false)
    })

    socket.on('connect_error', (err) => {
      console.error('[LiveSessionTimeEstimate] Connection error:', err)
      setError('Failed to connect')
      setIsConnected(false)
    })

    // A refused join of the stats feed (Phase 4c): say so; no retry
    socket.on('session-room-error', (data: { sessionId: string; error: string }) => {
      console.warn('[LiveSessionTimeEstimate] Stats feed refused:', data.sessionId, data.error)
    })

    // The stats feed (`session-stats:<id>`, joined at `view`): the kid's parts
    // and tries from each broadcast, without the live answer (Phase 4c)
    socket.on('session-stats', (data: SessionStatsEvent) => {
      console.log('[LiveSessionTimeEstimate] Received session-stats:', {
        resultsCount: (data.slotResults as SlotResult[] | undefined)?.length ?? 0,
      })

      // Update parts if provided
      if (data.sessionParts) {
        setLiveParts(data.sessionParts as SessionPart[])
      }

      // Update results if provided
      if (data.slotResults) {
        setLiveResults(data.slotResults as SlotResult[])
      }

      // Update last activity time
      setLastActivityAt(new Date())
      setIsLive(true)
    })

    // Listen for session ended
    socket.on('session-ended', () => {
      console.log('[LiveSessionTimeEstimate] Session ended')
      setIsLive(false)
    })

    return () => {
      console.log('[LiveSessionTimeEstimate] Cleaning up')
      socket.emit('unsubscribe-session-stats', { sessionId })
      socket.disconnect()
      socketRef.current = null
    }
  }, [sessionId, enabled, viewerId, cleanup])

  // Compute time estimates from current data
  // Practice-only do-overs count nowhere
  const results = countedTries(liveResults)
  const parts = liveParts

  const totalProblems = progress ? progress.total : arithmeticSlotTotal(parts)
  const completedProblems = progress ? progress.done : results.length
  const problemsRemaining = Math.max(0, totalProblems - completedProblems)

  // Calculate correctness stats
  const correctCount = results.filter((r) => r.isCorrect).length
  // Legacy readers only; report readers take accuracy from `report.totals`
  const accuracy = results.length > 0 ? correctCount / results.length : 0

  const timingStats = calculateTimingStats(results, parts)
  const estimatedTimeRemainingMs = calculateEstimatedTimeRemainingMs(timingStats, problemsRemaining)
  const estimatedTimeRemainingFormatted = formatEstimatedTimeRemaining(estimatedTimeRemainingMs)

  return {
    timingStats,
    problemsRemaining,
    totalProblems,
    completedProblems,
    correctCount,
    accuracy,
    estimatedTimeRemainingMs,
    estimatedTimeRemainingFormatted,
    isConnected,
    isLive,
    lastActivityAt,
    error,
  }
}
