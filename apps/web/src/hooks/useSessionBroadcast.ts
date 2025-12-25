'use client'

import { useCallback, useEffect, useRef } from 'react'
import { io, type Socket } from 'socket.io-client'
import type { BroadcastState } from '@/components/practice'
import { useStudentPresence } from './useClassroom'
import type { PracticeStateEvent } from '@/lib/classroom/socket-events'

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
  state: BroadcastState | null
): { isConnected: boolean; isBroadcasting: boolean } {
  const socketRef = useRef<Socket | null>(null)
  const isConnectedRef = useRef(false)
  // Keep state in a ref so socket event handlers can access current state
  const stateRef = useRef<BroadcastState | null>(null)
  stateRef.current = state

  // Check if student is present in a classroom
  const { data: presence } = useStudentPresence(playerId)
  const isInClassroom = !!presence?.classroomId

  // Helper to broadcast current state
  const broadcastState = useCallback(() => {
    const currentState = stateRef.current
    if (!socketRef.current || !isConnectedRef.current || !sessionId || !currentState) {
      return
    }

    const event: PracticeStateEvent = {
      sessionId,
      currentProblem: currentState.currentProblem,
      phase: currentState.phase,
      studentAnswer: currentState.studentAnswer,
      isCorrect: currentState.isCorrect,
      timing: {
        startedAt: currentState.startedAt,
        elapsed: Date.now() - currentState.startedAt,
      },
      purpose: currentState.purpose,
      complexity: currentState.complexity,
    }

    socketRef.current.emit('practice-state', event)
    console.log('[SessionBroadcast] Emitted practice-state:', {
      phase: currentState.phase,
      answer: currentState.studentAnswer,
      isCorrect: currentState.isCorrect,
    })
  }, [sessionId])

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
      // Join the session channel so we can receive 'observer-joined' events
      socket.emit('join-session', { sessionId })
      // Broadcast current state immediately so any waiting observers get it
      broadcastState()
    })

    socket.on('disconnect', () => {
      console.log('[SessionBroadcast] Disconnected')
      isConnectedRef.current = false
    })

    // When an observer joins, re-broadcast current state so they see it immediately
    socket.on('observer-joined', (data: { observerId: string }) => {
      console.log('[SessionBroadcast] Observer joined:', data.observerId, '- re-broadcasting state')
      broadcastState()
    })

    return () => {
      console.log('[SessionBroadcast] Cleaning up socket connection')
      socket.disconnect()
      socketRef.current = null
      isConnectedRef.current = false
    }
  }, [sessionId, playerId, isInClassroom, broadcastState])

  // Broadcast state changes
  useEffect(() => {
    broadcastState()
  }, [
    broadcastState,
    state?.currentProblem?.answer, // New problem
    state?.phase, // Phase change
    state?.studentAnswer, // Answer submitted
    state?.isCorrect, // Result received
    state?.purpose, // Purpose change
  ])

  return {
    isConnected: isConnectedRef.current,
    isBroadcasting: isConnectedRef.current && isInClassroom && !!state,
  }
}
