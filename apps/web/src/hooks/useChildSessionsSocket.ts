'use client'

import { useCallback, useEffect, useRef, useState, useMemo } from 'react'
import { io, type Socket } from 'socket.io-client'
import { api } from '@/lib/queryClient'
import type { SessionStartedEvent, SessionEndedEvent } from '@/lib/classroom/socket-events'

/**
 * Active session information for a child
 */
export interface ChildActiveSession {
  /** Session plan ID */
  planId: string
  /** Session status */
  status: string
  /** Number of completed problems */
  completedSlots: number
  /** Total number of problems */
  totalSlots: number
  /** When the session started (ISO string) */
  startedAt: string
}

/**
 * Hook: Subscribe to real-time session updates for children via WebSocket
 *
 * Instead of polling every 10 seconds, this hook:
 * 1. Fetches initial session state for all children
 * 2. Subscribes to real-time session-started/session-ended events
 * 3. Maintains a Map of playerId -> session info that updates instantly
 *
 * @param userId - The parent's user ID (for socket subscription)
 * @param childIds - Array of player IDs to subscribe to
 * @returns sessionMap (playerId -> session), isLoading, connected
 */
export function useChildSessionsSocket(userId: string | undefined, childIds: string[]) {
  // Session state maintained from socket events
  const [sessions, setSessions] = useState<Map<string, ChildActiveSession>>(new Map())
  const [isLoading, setIsLoading] = useState(true)
  const [connected, setConnected] = useState(false)

  const socketRef = useRef<Socket | null>(null)
  const subscribedIdsRef = useRef<Set<string>>(new Set())

  // Fetch initial session state for a child
  const fetchSession = useCallback(async (playerId: string): Promise<ChildActiveSession | null> => {
    try {
      const res = await api(`players/${playerId}/active-session`)
      if (!res.ok) {
        if (res.status === 403) return null // Not authorized
        throw new Error('Failed to fetch session')
      }
      const data = await res.json()
      if (!data.session) return null

      // Convert API response to ChildActiveSession format
      return {
        planId: data.session.sessionId,
        status: data.session.status,
        completedSlots: data.session.completedProblems,
        totalSlots: data.session.totalProblems,
        startedAt: new Date().toISOString(), // API doesn't return startedAt, use now as fallback
      }
    } catch (error) {
      console.error(`[ChildSessionsSocket] Failed to fetch session for ${playerId}:`, error)
      return null
    }
  }, [])

  // Fetch initial state for all children
  useEffect(() => {
    if (childIds.length === 0) {
      setIsLoading(false)
      setSessions(new Map())
      return
    }

    let cancelled = false

    async function fetchAll() {
      setIsLoading(true)
      const newSessions = new Map<string, ChildActiveSession>()

      await Promise.all(
        childIds.map(async (playerId) => {
          const session = await fetchSession(playerId)
          if (session && !cancelled) {
            newSessions.set(playerId, session)
          }
        })
      )

      if (!cancelled) {
        setSessions(newSessions)
        setIsLoading(false)
      }
    }

    fetchAll()

    return () => {
      cancelled = true
    }
  }, [childIds, fetchSession])

  // Setup socket connection and subscriptions
  useEffect(() => {
    if (!userId || childIds.length === 0) return

    // Create socket connection
    const socket = io({
      path: '/api/socket',
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    })
    socketRef.current = socket

    socket.on('connect', () => {
      console.log('[ChildSessionsSocket] Connected')
      setConnected(true)

      // Subscribe to child sessions
      socket.emit('subscribe-child-sessions', { userId, childIds })
      subscribedIdsRef.current = new Set(childIds)
    })

    socket.on('disconnect', () => {
      console.log('[ChildSessionsSocket] Disconnected')
      setConnected(false)
    })

    // Handle session started
    socket.on('session-started', (data: SessionStartedEvent) => {
      console.log(
        '[ChildSessionsSocket] Session started:',
        data.playerName,
        'session:',
        data.sessionId
      )

      // Fetch the full session details (including progress)
      fetchSession(data.playerId).then((session) => {
        if (session) {
          setSessions((prev) => {
            const next = new Map(prev)
            next.set(data.playerId, session)
            return next
          })
        }
      })
    })

    // Handle session ended
    socket.on('session-ended', (data: SessionEndedEvent) => {
      console.log('[ChildSessionsSocket] Session ended:', data.playerName, 'reason:', data.reason)

      setSessions((prev) => {
        const next = new Map(prev)
        next.delete(data.playerId)
        return next
      })
    })

    // Cleanup on unmount
    return () => {
      if (subscribedIdsRef.current.size > 0) {
        socket.emit('unsubscribe-child-sessions', {
          userId,
          childIds: Array.from(subscribedIdsRef.current),
        })
      }
      socket.disconnect()
      socketRef.current = null
      subscribedIdsRef.current.clear()
    }
  }, [userId, childIds, fetchSession])

  // Handle changes to childIds (subscribe to new, unsubscribe from removed)
  useEffect(() => {
    const socket = socketRef.current
    if (!socket || !connected || !userId) return

    const currentIds = new Set(childIds)
    const subscribedIds = subscribedIdsRef.current

    // Find new IDs to subscribe
    const toSubscribe = childIds.filter((id) => !subscribedIds.has(id))
    // Find removed IDs to unsubscribe
    const toUnsubscribe = Array.from(subscribedIds).filter((id) => !currentIds.has(id))

    if (toSubscribe.length > 0) {
      socket.emit('subscribe-child-sessions', { userId, childIds: toSubscribe })
      toSubscribe.forEach((id) => subscribedIds.add(id))
    }

    if (toUnsubscribe.length > 0) {
      socket.emit('unsubscribe-child-sessions', { userId, childIds: toUnsubscribe })
      toUnsubscribe.forEach((id) => subscribedIds.delete(id))

      // Remove sessions for unsubscribed children
      setSessions((prev) => {
        const next = new Map(prev)
        toUnsubscribe.forEach((id) => next.delete(id))
        return next
      })
    }
  }, [childIds, connected, userId])

  // Memoize the return value to avoid unnecessary re-renders
  const result = useMemo(
    () => ({
      sessionMap: sessions,
      isLoading,
      connected,
    }),
    [sessions, isLoading, connected]
  )

  return result
}
