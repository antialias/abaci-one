'use client'

import { type QueryClient, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import type { Socket } from 'socket.io-client'
import type { ActiveSessionInfo } from '@/hooks/useClassroom'
import { invalidateForEvent } from '@/lib/classroom/query-invalidations'
import type {
  ClassroomSessionSummaryEvent,
  EnrollmentApprovedEvent,
  EnrollmentRequestApprovedEvent,
  EnrollmentRequestCreatedEvent,
  EnrollmentRequestDeniedEvent,
  SessionEndedEvent,
  SessionStartedEvent,
  StudentEnteredEvent,
  StudentLeftEvent,
  StudentUnenrolledEvent,
} from '@/lib/classroom/socket-events'
import { classroomKeys } from '@/lib/queryKeys'
import { createSocket } from '@/lib/socket'

/**
 * Apply a pushed teacher-card summary (Phase 4d, §10 P4d-8) to the classroom's
 * active sessions: a held in-progress session takes the newer numbers; a
 * session the list does not hold yet, or one that is no longer in progress,
 * refetches the list. An older or equal row version is ignored.
 */
export function applyClassroomSessionSummary(
  queryClient: QueryClient,
  classroomId: string,
  summary: ClassroomSessionSummaryEvent
): void {
  const key = classroomKeys.activeSessions(classroomId)
  const held = queryClient.getQueryData<ActiveSessionInfo[]>(key)
  const card = held?.find((s) => s.sessionId === summary.sessionId)
  if (!held || !card || summary.outcome !== 'in_progress') {
    queryClient.invalidateQueries({ queryKey: key })
    return
  }
  if (card.rowVersion !== undefined && summary.rowVersion <= card.rowVersion) return
  queryClient.setQueryData<ActiveSessionInfo[]>(
    key,
    held.map((s) =>
      s.sessionId === summary.sessionId
        ? {
            ...s,
            completedProblems: summary.completedProblems,
            totalProblems: summary.totalProblems,
            totals: summary.totals,
            outcome: summary.outcome,
            rowVersion: summary.rowVersion,
          }
        : s
    )
  )
}

/**
 * Hook for real-time classroom presence updates via WebSocket
 *
 * When a student enters or leaves the classroom, this hook receives the event
 * and automatically invalidates the React Query cache so the UI updates.
 *
 * `classroom:<id>` is the teacher-only room (§10 P4d-8, P4d-9): the server
 * admits only the classroom's teacher, checked against the socket's verified
 * viewer, and sends it every enrolled student's session starts, summaries
 * after each committed write (`classroom-session-summary`) and ends, plus
 * presence, enrollment and the students' skill tutorial states. No timers:
 * every accepted join (`channel-joined`, the first one included) refetches
 * the cards, so whatever was pushed before the socket was in the room is not
 * lost.
 *
 * @param classroomId - The classroom to subscribe to
 * @returns Whether the socket is connected
 */
export function useClassroomSocket(classroomId: string | undefined): {
  connected: boolean
} {
  const [connected, setConnected] = useState(false)
  const socketRef = useRef<Socket | null>(null)
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!classroomId) return
    // Create socket connection
    const socket = createSocket({
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

    // In the teacher room from now on: refetch what was pushed before the join
    // (on the first join as on every reconnect)
    socket.on('channel-joined', (ack: { channel?: string; id?: string }) => {
      if (ack?.channel !== 'classroom' || ack.id !== classroomId) return
      queryClient.invalidateQueries({ queryKey: classroomKeys.activeSessions(classroomId) })
      queryClient.invalidateQueries({ queryKey: classroomKeys.presence(classroomId) })
    })

    socket.on('classroom-session-summary', (summary: ClassroomSessionSummaryEvent) => {
      applyClassroomSessionSummary(queryClient, classroomId, summary)
    })

    socket.on('disconnect', () => {
      console.log('[ClassroomSocket] Disconnected')
      setConnected(false)
    })

    // Listen for student entered event
    socket.on('student-entered', (data: StudentEnteredEvent) => {
      console.log('[ClassroomSocket] Student entered:', data.playerName)
      invalidateForEvent(queryClient, 'studentEntered', { classroomId })
    })

    // Listen for student left event
    socket.on('student-left', (data: StudentLeftEvent) => {
      console.log('[ClassroomSocket] Student left:', data.playerName)
      invalidateForEvent(queryClient, 'studentLeft', { classroomId })
    })

    // Listen for enrollment request created event
    socket.on('enrollment-request-created', (data: EnrollmentRequestCreatedEvent) => {
      console.log('[ClassroomSocket] Enrollment request created for:', data.request.playerName)
      invalidateForEvent(queryClient, 'requestCreated', {
        classroomId,
        playerId: data.request.playerId,
      })
    })

    // Listen for enrollment request approved event (one side approved)
    socket.on('enrollment-request-approved', (data: EnrollmentRequestApprovedEvent) => {
      console.log('[ClassroomSocket] Enrollment request approved by:', data.approvedBy)
      invalidateForEvent(queryClient, 'requestApproved', {
        classroomId,
        playerId: data.playerId,
      })
    })

    // Listen for enrollment request denied event (parent denied teacher's request)
    socket.on('enrollment-request-denied', (data: EnrollmentRequestDeniedEvent) => {
      console.log('[ClassroomSocket] Enrollment request denied by:', data.deniedBy)
      invalidateForEvent(queryClient, 'requestDenied', {
        classroomId,
        playerId: data.playerId,
      })
    })

    // Listen for enrollment approved event (student fully enrolled)
    socket.on('enrollment-approved', (data: EnrollmentApprovedEvent) => {
      console.log('[ClassroomSocket] Student enrolled:', data.playerName)
      invalidateForEvent(queryClient, 'enrollmentCompleted', {
        classroomId,
        playerId: data.playerId,
      })
    })

    // Listen for student unenrolled event
    socket.on('student-unenrolled', (data: StudentUnenrolledEvent) => {
      console.log(
        '[ClassroomSocket] Student unenrolled:',
        data.playerName,
        'by:',
        data.unenrolledBy
      )
      invalidateForEvent(queryClient, 'studentUnenrolled', {
        classroomId,
        playerId: data.playerId,
      })
    })

    // Listen for session started event
    socket.on('session-started', (data: SessionStartedEvent) => {
      console.log('[ClassroomSocket] Session started:', data.playerName, 'session:', data.sessionId)
      invalidateForEvent(queryClient, 'sessionStarted', { classroomId })
    })

    // Listen for session ended event
    socket.on('session-ended', (data: SessionEndedEvent) => {
      console.log(
        '[ClassroomSocket] Session ended:',
        data.playerName,
        'reason:',
        data.reason,
        'session:',
        data.sessionId
      )
      invalidateForEvent(queryClient, 'sessionEnded', { classroomId })
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
