'use client'

import { useEffect, useRef, useState } from 'react'
import { io, type Socket } from 'socket.io-client'
import { useQueryClient } from '@tanstack/react-query'
import { invalidateForEvent } from '@/lib/classroom/query-invalidations'
import type { EnrollmentApprovedEvent } from '@/lib/classroom/socket-events'

/**
 * Hook for real-time player enrollment updates via WebSocket
 *
 * When a student becomes fully enrolled in a classroom (both teacher and parent approved),
 * this hook receives the event and invalidates the enrolled classrooms query so the
 * dropdown updates without requiring a page reload.
 *
 * @param playerId - The player ID to subscribe to enrollment notifications for
 * @returns Whether the socket is connected
 */
export function usePlayerEnrollmentSocket(playerId: string | undefined): { connected: boolean } {
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
      console.log('[PlayerEnrollmentSocket] Connected')
      setConnected(true)
      // Join the player channel for enrollment notifications
      socket.emit('join-player', { playerId })
    })

    socket.on('disconnect', () => {
      console.log('[PlayerEnrollmentSocket] Disconnected')
      setConnected(false)
    })

    // Listen for enrollment completed event (student fully enrolled in a classroom)
    socket.on('enrollment-approved', (data: EnrollmentApprovedEvent) => {
      console.log(
        '[PlayerEnrollmentSocket] Enrollment completed for classroom:',
        data.classroomName
      )
      invalidateForEvent(queryClient, 'enrollmentCompleted', {
        classroomId: data.classroomId,
        playerId,
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
