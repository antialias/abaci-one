'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { io, type Socket } from 'socket.io-client'
import type { PracticeStateEvent } from '@/lib/classroom/socket-events'

/**
 * State of an observed practice session
 */
export interface ObservedSessionState {
  /** Current problem being worked on */
  currentProblem: {
    terms: number[]
    answer: number
  }
  /** Current phase of the interaction */
  phase: 'problem' | 'feedback' | 'tutorial'
  /** Student's current typed answer (digit by digit, empty string if not started) */
  studentAnswer: string
  /** Whether the answer is correct (null if not yet submitted) */
  isCorrect: boolean | null
  /** Timing information */
  timing: {
    startedAt: number
    elapsed: number
  }
  /** Purpose of this problem slot (why it was selected) */
  purpose: 'focus' | 'reinforce' | 'review' | 'challenge'
  /** When this state was received */
  receivedAt: number
}

interface UseSessionObserverResult {
  /** Current observed state (null if not yet received) */
  state: ObservedSessionState | null
  /** Whether connected to the session channel */
  isConnected: boolean
  /** Whether actively observing (connected and joined session) */
  isObserving: boolean
  /** Error message if connection failed */
  error: string | null
  /** Stop observing the session */
  stopObserving: () => void
}

/**
 * Hook to observe a student's practice session in real-time
 *
 * Connects to the session's socket channel and receives practice state updates.
 * Use this in a teacher's observation modal to see what the student is doing.
 *
 * @param sessionId - The session plan ID to observe
 * @param observerId - Unique identifier for this observer (e.g., teacher's user ID)
 * @param enabled - Whether to start observing (default: true)
 */
export function useSessionObserver(
  sessionId: string | undefined,
  observerId: string | undefined,
  enabled = true
): UseSessionObserverResult {
  const [state, setState] = useState<ObservedSessionState | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [isObserving, setIsObserving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const socketRef = useRef<Socket | null>(null)

  const stopObserving = useCallback(() => {
    if (socketRef.current && sessionId) {
      socketRef.current.emit('stop-observing', { sessionId })
      socketRef.current.disconnect()
      socketRef.current = null
      setIsConnected(false)
      setIsObserving(false)
      setState(null)
    }
  }, [sessionId])

  useEffect(() => {
    if (!sessionId || !observerId || !enabled) {
      // Clean up if disabled
      if (socketRef.current) {
        stopObserving()
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
      console.log('[SessionObserver] Connected, joining session:', sessionId)
      setIsConnected(true)
      setError(null)

      // Join the session channel as an observer
      socket.emit('observe-session', { sessionId, observerId })
      setIsObserving(true)
    })

    socket.on('disconnect', () => {
      console.log('[SessionObserver] Disconnected')
      setIsConnected(false)
      setIsObserving(false)
    })

    socket.on('connect_error', (err) => {
      console.error('[SessionObserver] Connection error:', err)
      setError('Failed to connect to session')
    })

    // Listen for practice state updates from the student
    socket.on('practice-state', (data: PracticeStateEvent) => {
      console.log('[SessionObserver] Received practice-state:', {
        phase: data.phase,
        answer: data.studentAnswer,
        isCorrect: data.isCorrect,
      })

      setState({
        currentProblem: data.currentProblem as { terms: number[]; answer: number },
        phase: data.phase,
        studentAnswer: data.studentAnswer,
        isCorrect: data.isCorrect,
        timing: data.timing,
        purpose: data.purpose,
        receivedAt: Date.now(),
      })
    })

    // Listen for session ended event
    socket.on('session-ended', () => {
      console.log('[SessionObserver] Session ended')
      stopObserving()
    })

    return () => {
      console.log('[SessionObserver] Cleaning up')
      socket.emit('stop-observing', { sessionId })
      socket.disconnect()
      socketRef.current = null
    }
  }, [sessionId, observerId, enabled, stopObserving])

  return {
    state,
    isConnected,
    isObserving,
    error,
    stopObserving,
  }
}
