'use client'

import { useCallback, useEffect, useRef } from 'react'
import { io, type Socket } from 'socket.io-client'
import type { BroadcastState } from '@/components/practice'
import type {
  AbacusControlEvent,
  PracticeStateEvent,
  SessionPausedEvent,
  SessionResumedEvent,
} from '@/lib/classroom/socket-events'

/**
 * Abacus control action received from teacher
 */
export type ReceivedAbacusControl =
  | { type: 'show-abacus' }
  | { type: 'hide-abacus' }
  | { type: 'set-value'; value: number }

/**
 * Pause request from teacher
 */
export interface TeacherPauseRequest {
  /** Optional message from teacher to display on pause screen */
  message?: string
}

/**
 * Options for useSessionBroadcast hook
 */
export interface UseSessionBroadcastOptions {
  /** Callback when an abacus control event is received from teacher */
  onAbacusControl?: (control: ReceivedAbacusControl) => void
  /** Callback when teacher pauses the session */
  onTeacherPause?: (request: TeacherPauseRequest) => void
  /** Callback when teacher resumes the session */
  onTeacherResume?: () => void
}

/**
 * Hook to broadcast practice session state to observers via WebSocket
 *
 * Broadcasts to any observer (teacher in classroom or parent at home).
 * Always connects when there's an active session - observers join the channel.
 *
 * @param sessionId - The session plan ID
 * @param playerId - The student's player ID
 * @param state - Current practice state (or null if not in active practice)
 * @param options - Optional callbacks for receiving observer control events
 */
export function useSessionBroadcast(
  sessionId: string | undefined,
  playerId: string | undefined,
  state: BroadcastState | null,
  options?: UseSessionBroadcastOptions
): { isConnected: boolean; isBroadcasting: boolean } {
  const socketRef = useRef<Socket | null>(null)
  const isConnectedRef = useRef(false)
  // Keep state in a ref so socket event handlers can access current state
  const stateRef = useRef<BroadcastState | null>(null)
  stateRef.current = state

  // Keep options in a ref so socket event handlers can access current callbacks
  const optionsRef = useRef(options)
  optionsRef.current = options

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
      currentProblemNumber: currentState.currentProblemNumber,
      totalProblems: currentState.totalProblems,
      // Session structure for progress indicator
      sessionParts: currentState.sessionParts,
      currentPartIndex: currentState.currentPartIndex,
      currentSlotIndex: currentState.currentSlotIndex,
      slotResults: currentState.slotResults,
    }

    socketRef.current.emit('practice-state', event)
    console.log('[SessionBroadcast] Emitted practice-state:', {
      phase: currentState.phase,
      answer: currentState.studentAnswer,
      isCorrect: currentState.isCorrect,
    })
  }, [sessionId])

  // Connect to socket and join session channel when there's an active session
  // This enables both teachers (classroom) and parents (home) to observe
  useEffect(() => {
    // Only connect if we have a session
    if (!sessionId || !playerId) {
      // Clean up if we were connected
      if (socketRef.current) {
        console.log('[SessionBroadcast] Disconnecting - session ended')
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

    // Listen for abacus control events from teacher
    socket.on('abacus-control', (data: AbacusControlEvent) => {
      console.log('[SessionBroadcast] Received abacus-control:', data)
      // Only handle controls for our session and the main practice abacus ('hero')
      if (data.sessionId !== sessionId || data.target !== 'hero') {
        return
      }

      // Map the socket event to our ReceivedAbacusControl type
      let control: ReceivedAbacusControl
      switch (data.action) {
        case 'show':
          control = { type: 'show-abacus' }
          break
        case 'hide':
          control = { type: 'hide-abacus' }
          break
        case 'set-value':
          if (data.value === undefined) return // Invalid event
          control = { type: 'set-value', value: data.value }
          break
        default:
          return // Unknown action
      }

      // Call the callback if provided
      optionsRef.current?.onAbacusControl?.(control)
    })

    // Listen for pause events from teacher
    socket.on('session-paused', (data: SessionPausedEvent) => {
      console.log('[SessionBroadcast] Received session-paused:', data)
      if (data.sessionId !== sessionId) return

      optionsRef.current?.onTeacherPause?.({ message: data.message })
    })

    // Listen for resume events from teacher
    socket.on('session-resumed', (data: SessionResumedEvent) => {
      console.log('[SessionBroadcast] Received session-resumed:', data)
      if (data.sessionId !== sessionId) return

      optionsRef.current?.onTeacherResume?.()
    })

    return () => {
      console.log('[SessionBroadcast] Cleaning up socket connection')
      socket.disconnect()
      socketRef.current = null
      isConnectedRef.current = false
    }
  }, [sessionId, playerId, broadcastState])

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
    isBroadcasting: isConnectedRef.current && !!state,
  }
}
