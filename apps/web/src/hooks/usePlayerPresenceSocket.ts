'use client'

import { useEffect, useRef, useState } from 'react'
import { io, type Socket } from 'socket.io-client'
import { useQueryClient } from '@tanstack/react-query'
import type { PresenceRemovedEvent } from '@/lib/classroom/socket-events'

/**
 * Hook for real-time player presence updates via WebSocket
 *
 * When a student is removed from a classroom (by teacher or parent),
 * this hook receives the event and invalidates the React Query cache
 * so the UI updates without requiring a page reload.
 *
 * @param playerId - The player to subscribe to
 * @returns Whether the socket is connected
 */
export function usePlayerPresenceSocket(playerId: string | undefined): { connected: boolean } {
  const [connected, setConnected] = useState(false)
  const socketRef = useRef<Socket | null>(null)
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!playerId) return

    // Create socket connection
    const socket = io({
      path: '/api/socket',
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    })
    socketRef.current = socket

    socket.on('connect', () => {
      console.log('[PlayerPresenceSocket] Connected')
      setConnected(true)
      // Join the player channel
      socket.emit('join-player', { playerId })
    })

    socket.on('disconnect', () => {
      console.log('[PlayerPresenceSocket] Disconnected')
      setConnected(false)
    })

    // Listen for presence removed event (when teacher or parent removes student from classroom)
    socket.on('presence-removed', (data: PresenceRemovedEvent) => {
      console.log('[PlayerPresenceSocket] Presence removed:', data)
      // Invalidate the student's presence query to refetch
      queryClient.invalidateQueries({
        queryKey: ['players', playerId, 'presence'],
      })
    })

    // Cleanup on unmount
    return () => {
      socket.emit('leave-player', { playerId })
      socket.disconnect()
      socketRef.current = null
    }
  }, [playerId, queryClient])

  return { connected }
}
