'use client'

import { useEffect, useRef, useState } from 'react'
import { io, type Socket } from 'socket.io-client'
import { useQueryClient } from '@tanstack/react-query'
import { invalidateForEvent } from '@/lib/classroom/query-invalidations'
import type {
  EnrollmentApprovedEvent,
  EnrollmentRequestApprovedEvent,
  EnrollmentRequestCreatedEvent,
  EnrollmentRequestDeniedEvent,
} from '@/lib/classroom/socket-events'

/**
 * Hook for real-time parent notifications via WebSocket
 *
 * When a teacher adds a student (that the parent is linked to) to their classroom,
 * this hook receives the event and automatically invalidates the React Query cache
 * so the UI updates to show the new pending approval.
 *
 * @param userId - The parent's user ID to subscribe to notifications for
 * @returns Whether the socket is connected
 */
export function useParentSocket(userId: string | undefined): { connected: boolean } {
  const [connected, setConnected] = useState(false)
  const socketRef = useRef<Socket | null>(null)
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!userId) return

    // Create socket connection
    const socket = io({
      path: '/api/socket',
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    })
    socketRef.current = socket

    socket.on('connect', () => {
      console.log('[ParentSocket] Connected')
      setConnected(true)
      // Join the user channel for parent notifications
      socket.emit('join-user-channel', { userId })
    })

    socket.on('disconnect', () => {
      console.log('[ParentSocket] Disconnected')
      setConnected(false)
    })

    // Listen for enrollment request created event (teacher added student to classroom)
    socket.on('enrollment-request-created', (data: EnrollmentRequestCreatedEvent) => {
      console.log(
        '[ParentSocket] Enrollment request created for:',
        data.request.playerName,
        'in classroom:',
        data.request.classroomName
      )
      invalidateForEvent(queryClient, 'requestCreated', {
        classroomId: data.request.classroomId,
        playerId: data.request.playerId,
      })
    })

    // Listen for enrollment request approved event (teacher approved parent's request)
    socket.on('enrollment-request-approved', (data: EnrollmentRequestApprovedEvent) => {
      console.log(
        '[ParentSocket] Enrollment request approved for:',
        data.playerName,
        'by:',
        data.approvedBy
      )
      invalidateForEvent(queryClient, 'requestApproved', {
        classroomId: data.classroomId,
        playerId: data.playerId,
      })
    })

    // Listen for enrollment request denied event (teacher denied parent's request)
    socket.on('enrollment-request-denied', (data: EnrollmentRequestDeniedEvent) => {
      console.log(
        '[ParentSocket] Enrollment request denied for:',
        data.playerName,
        'by:',
        data.deniedBy
      )
      invalidateForEvent(queryClient, 'requestDenied', {
        classroomId: data.classroomId,
        playerId: data.playerId,
      })
    })

    // Listen for enrollment completed event (student fully enrolled)
    socket.on('enrollment-approved', (data: EnrollmentApprovedEvent) => {
      console.log('[ParentSocket] Enrollment completed for:', data.playerName)
      invalidateForEvent(queryClient, 'enrollmentCompleted', {
        classroomId: data.classroomId,
        playerId: data.playerId,
      })
    })

    // Cleanup on unmount
    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [userId, queryClient])

  return { connected }
}
