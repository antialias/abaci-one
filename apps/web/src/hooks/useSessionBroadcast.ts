'use client'

import { useEffect, useRef } from 'react'
import { io, type Socket } from 'socket.io-client'
import { useStudentPresence } from './useClassroom'
import type { PracticeStateEvent } from '@/lib/classroom/socket-events'

/**
 * Practice state to broadcast to observers
 */
export interface BroadcastPracticeState {
  /** Current problem being worked on */
  currentProblem: {
    terms: number[]
    answer: number
  }
  /** Current phase of the interaction */
  phase: 'problem' | 'feedback' | 'tutorial'
  /** Student's current answer (null if not yet answered) */
  studentAnswer: number | null
  /** Whether the answer is correct (null if not yet answered) */
  isCorrect: boolean | null
  /** When the current attempt started (timestamp) */
  startedAt: number
}

/**
 * Hook to broadcast practice session state to observers via WebSocket
 *
 * Only broadcasts if the student is currently present in a classroom.
 * This enables teachers to observe student practice in real-time.
 *
 * @param sessionId - The session plan ID
 * @param playerId - The student's player ID
 * @param state - Current practice state (or null if not in active practice)
 */
export function useSessionBroadcast(
  sessionId: string | undefined,
  playerId: string | undefined,
  state: BroadcastPracticeState | null
): { isConnected: boolean; isBroadcasting: boolean } {
  const socketRef = useRef<Socket | null>(null)
  const isConnectedRef = useRef(false)

  // Check if student is present in a classroom
  const { data: presence } = useStudentPresence(playerId)
  const isInClassroom = !!presence?.classroomId

  // Connect to socket and join session channel when in classroom with active session
  useEffect(() => {
    // Only connect if we have a session and the student is in a classroom
    if (!sessionId || !playerId || !isInClassroom) {
      // Clean up if we were connected
      if (socketRef.current) {
        console.log('[SessionBroadcast] Disconnecting - no longer in classroom or session ended')
        socketRef.current.disconnect()
        socketRef.current = null
        isConnectedRef.current = false
      }
      return
    }

    // Create socket connection
    const socket = io({
      path: '/api/socket',
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    })
    socketRef.current = socket

    socket.on('connect', () => {
      console.log('[SessionBroadcast] Connected, joining session channel:', sessionId)
      isConnectedRef.current = true
      // No need to explicitly join a channel - we just emit to the session channel
      // The server will broadcast to observers who have joined `session:${sessionId}`
    })

    socket.on('disconnect', () => {
      console.log('[SessionBroadcast] Disconnected')
      isConnectedRef.current = false
    })

    // Listen for observer joined events (optional - for debugging/notification)
    socket.on('observer-joined', (data: { observerId: string }) => {
      console.log('[SessionBroadcast] Observer joined:', data.observerId)
    })

    return () => {
      console.log('[SessionBroadcast] Cleaning up socket connection')
      socket.disconnect()
      socketRef.current = null
      isConnectedRef.current = false
    }
  }, [sessionId, playerId, isInClassroom])

  // Broadcast state changes
  useEffect(() => {
    if (!socketRef.current || !isConnectedRef.current || !sessionId || !state) {
      return
    }

    const event: PracticeStateEvent = {
      sessionId,
      currentProblem: state.currentProblem,
      phase: state.phase,
      studentAnswer: state.studentAnswer,
      isCorrect: state.isCorrect,
      timing: {
        startedAt: state.startedAt,
        elapsed: Date.now() - state.startedAt,
      },
    }

    socketRef.current.emit('practice-state', event)
    console.log('[SessionBroadcast] Emitted practice-state:', {
      phase: state.phase,
      answer: state.studentAnswer,
      isCorrect: state.isCorrect,
    })
  }, [
    sessionId,
    state?.currentProblem?.answer, // New problem
    state?.phase, // Phase change
    state?.studentAnswer, // Answer submitted
    state?.isCorrect, // Result received
  ])

  return {
    isConnected: isConnectedRef.current,
    isBroadcasting: isConnectedRef.current && isInClassroom && !!state,
  }
}
