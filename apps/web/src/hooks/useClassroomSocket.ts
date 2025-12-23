'use client'

import { useEffect, useRef, useState } from 'react'
import { io, type Socket } from 'socket.io-client'
import { useQueryClient } from '@tanstack/react-query'
import { classroomKeys } from '@/lib/queryKeys'
import type {
  EnrollmentApprovedEvent,
  EnrollmentRequestApprovedEvent,
  EnrollmentRequestCreatedEvent,
  StudentEnteredEvent,
  StudentLeftEvent,
} from '@/lib/classroom/socket-events'

/**
 * Hook for real-time classroom presence updates via WebSocket
 *
 * When a student enters or leaves the classroom, this hook receives the event
 * and automatically invalidates the React Query cache so the UI updates.
 *
 * @param classroomId - The classroom to subscribe to
 * @returns Whether the socket is connected
 */
export function useClassroomSocket(classroomId: string | undefined): { connected: boolean } {
  const [connected, setConnected] = useState(false)
  const socketRef = useRef<Socket | null>(null)
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!classroomId) return

    // Create socket connection
    const socket = io({
      path: '/api/socket',
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    })
    socketRef.current = socket

    socket.on('connect', () => {
      console.log('[ClassroomSocket] Connected')
      setConnected(true)
      // Join the classroom channel
      socket.emit('join-classroom', { classroomId })
    })

    socket.on('disconnect', () => {
      console.log('[ClassroomSocket] Disconnected')
      setConnected(false)
    })

    // Listen for student entered event
    socket.on('student-entered', (data: StudentEnteredEvent) => {
      console.log('[ClassroomSocket] Student entered:', data.playerName)
      // Invalidate the presence query to refetch
      queryClient.invalidateQueries({
        queryKey: classroomKeys.presence(classroomId),
      })
    })

    // Listen for student left event
    socket.on('student-left', (data: StudentLeftEvent) => {
      console.log('[ClassroomSocket] Student left:', data.playerName)
      // Invalidate the presence query to refetch
      queryClient.invalidateQueries({
        queryKey: classroomKeys.presence(classroomId),
      })
    })

    // Listen for enrollment request created event
    socket.on('enrollment-request-created', (data: EnrollmentRequestCreatedEvent) => {
      console.log('[ClassroomSocket] Enrollment request created for:', data.request.playerName)
      // Invalidate both pending request queries to refetch
      queryClient.invalidateQueries({
        queryKey: classroomKeys.pendingRequests(classroomId),
      })
      queryClient.invalidateQueries({
        queryKey: classroomKeys.awaitingParentApproval(classroomId),
      })
    })

    // Listen for enrollment request approved event (removes from pending)
    socket.on('enrollment-request-approved', (data: EnrollmentRequestApprovedEvent) => {
      console.log('[ClassroomSocket] Enrollment request approved:', data.requestId)
      // Invalidate both pending request queries to refetch
      queryClient.invalidateQueries({
        queryKey: classroomKeys.pendingRequests(classroomId),
      })
      queryClient.invalidateQueries({
        queryKey: classroomKeys.awaitingParentApproval(classroomId),
      })
    })

    // Listen for enrollment approved event (student fully enrolled)
    socket.on('enrollment-approved', (data: EnrollmentApprovedEvent) => {
      console.log('[ClassroomSocket] Student enrolled:', data.playerName)
      // Invalidate enrollments and remove from awaiting parent approval
      queryClient.invalidateQueries({
        queryKey: classroomKeys.enrollments(classroomId),
      })
      queryClient.invalidateQueries({
        queryKey: classroomKeys.awaitingParentApproval(classroomId),
      })
    })

    // Cleanup on unmount
    return () => {
      socket.emit('leave-classroom', { classroomId })
      socket.disconnect()
      socketRef.current = null
    }
  }, [classroomId, queryClient])

  return { connected }
}
