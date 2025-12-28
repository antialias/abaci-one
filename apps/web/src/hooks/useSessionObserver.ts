'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { io, type Socket } from 'socket.io-client'
import type { SessionPart, SlotResult } from '@/db/schema/session-plans'
import type {
  AbacusControlEvent,
  PracticeStateEvent,
  SessionPausedEvent,
  SessionResumedEvent,
} from '@/lib/classroom/socket-events'

/**
 * Control actions a teacher can send to a student's practice session abacus
 */
export type SessionAbacusControlAction =
  | { type: 'show-abacus' }
  | { type: 'hide-abacus' }
  | { type: 'set-abacus-value'; value: number }

/**
 * Complexity data from broadcast
 */
export interface ObservedComplexity {
  /** Complexity bounds from slot constraints */
  bounds?: { min?: number; max?: number }
  /** Total complexity cost from generation trace */
  totalCost?: number
  /** Number of steps (for per-term average) */
  stepCount?: number
  /** Pre-formatted target skill name */
  targetSkillName?: string
}

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
  /** Complexity data for tooltip display */
  complexity?: ObservedComplexity
  /** When this state was received */
  receivedAt: number
  /** Current problem number (1-indexed for display) */
  currentProblemNumber: number
  /** Total problems in the session */
  totalProblems: number
  /** Session structure for progress indicator */
  sessionParts?: SessionPart[]
  /** Current part index for progress indicator */
  currentPartIndex?: number
  /** Current slot index within the part */
  currentSlotIndex?: number
  /** Accumulated results for progress indicator */
  slotResults?: SlotResult[]
}

/**
 * A recorded result from a completed problem during observation
 */
export interface ObservedResult {
  /** Problem number (1-indexed) */
  problemNumber: number
  /** The problem terms */
  terms: number[]
  /** Correct answer */
  answer: number
  /** Student's submitted answer */
  studentAnswer: string
  /** Whether correct */
  isCorrect: boolean
  /** Purpose of this problem slot */
  purpose: 'focus' | 'reinforce' | 'review' | 'challenge'
  /** Response time in ms */
  responseTimeMs: number
  /** When recorded */
  recordedAt: number
}

interface UseSessionObserverResult {
  /** Current observed state (null if not yet received) */
  state: ObservedSessionState | null
  /** Accumulated results from completed problems */
  results: ObservedResult[]
  /** Whether connected to the session channel */
  isConnected: boolean
  /** Whether actively observing (connected and joined session) */
  isObserving: boolean
  /** Error message if connection failed */
  error: string | null
  /** Stop observing the session */
  stopObserving: () => void
  /** Send a control action to the student's abacus */
  sendControl: (action: SessionAbacusControlAction) => void
  /** Pause the student's session with optional message */
  sendPause: (message?: string) => void
  /** Resume the student's session */
  sendResume: () => void
}

/**
 * Hook to observe a student's practice session in real-time
 *
 * Connects to the session's socket channel and receives practice state updates.
 * Use this in a teacher's or parent's observation modal to see what the student is doing.
 *
 * @param sessionId - The session plan ID to observe
 * @param observerId - Unique identifier for this observer (e.g., teacher's/parent's user ID)
 * @param playerId - The player ID being observed (for authorization check)
 * @param enabled - Whether to start observing (default: true)
 * @param shareToken - Optional share token for public/guest observation (bypasses user auth)
 */
export function useSessionObserver(
  sessionId: string | undefined,
  observerId: string | undefined,
  playerId: string | undefined,
  enabled = true,
  shareToken?: string
): UseSessionObserverResult {
  const [state, setState] = useState<ObservedSessionState | null>(null)
  const [results, setResults] = useState<ObservedResult[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [isObserving, setIsObserving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const socketRef = useRef<Socket | null>(null)
  // Track which problem numbers we've already recorded to avoid duplicates
  const recordedProblemsRef = useRef<Set<number>>(new Set())

  const stopObserving = useCallback(() => {
    if (socketRef.current && sessionId) {
      socketRef.current.emit('stop-observing', { sessionId })
      socketRef.current.disconnect()
      socketRef.current = null
      setIsConnected(false)
      setIsObserving(false)
      setState(null)
      setResults([])
      recordedProblemsRef.current.clear()
    }
  }, [sessionId])

  useEffect(() => {
    // Need sessionId and either (observerId + playerId) or shareToken
    const hasAuthCredentials = observerId && playerId
    const hasShareToken = !!shareToken
    if (!sessionId || (!hasAuthCredentials && !hasShareToken) || !enabled) {
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

      // Join the session channel - use shareToken if available, otherwise authenticated flow
      if (shareToken) {
        socket.emit('observe-session', { sessionId, shareToken })
      } else {
        socket.emit('observe-session', { sessionId, observerId, playerId })
      }
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

    // Handle authorization errors from server
    socket.on('observe-error', (data: { error: string }) => {
      console.error('[SessionObserver] Observation error:', data.error)
      setError(data.error)
      setIsObserving(false)
    })

    // Listen for practice state updates from the student
    socket.on('practice-state', (data: PracticeStateEvent) => {
      console.log('[SessionObserver] Received practice-state:', {
        phase: data.phase,
        answer: data.studentAnswer,
        isCorrect: data.isCorrect,
        problemNumber: data.currentProblemNumber,
      })

      const currentProblem = data.currentProblem as { terms: number[]; answer: number }

      // Record result when problem is completed (feedback phase with definite answer)
      if (
        data.phase === 'feedback' &&
        data.isCorrect !== null &&
        !recordedProblemsRef.current.has(data.currentProblemNumber)
      ) {
        recordedProblemsRef.current.add(data.currentProblemNumber)
        const newResult: ObservedResult = {
          problemNumber: data.currentProblemNumber,
          terms: currentProblem.terms,
          answer: currentProblem.answer,
          studentAnswer: data.studentAnswer,
          isCorrect: data.isCorrect,
          purpose: data.purpose,
          responseTimeMs: data.timing.elapsed,
          recordedAt: Date.now(),
        }
        setResults((prev) => [...prev, newResult])
        console.log('[SessionObserver] Recorded result:', newResult)
      }

      setState({
        currentProblem,
        phase: data.phase,
        studentAnswer: data.studentAnswer,
        isCorrect: data.isCorrect,
        timing: data.timing,
        purpose: data.purpose,
        complexity: data.complexity,
        receivedAt: Date.now(),
        currentProblemNumber: data.currentProblemNumber,
        totalProblems: data.totalProblems,
        // Session structure for progress indicator
        sessionParts: data.sessionParts as SessionPart[] | undefined,
        currentPartIndex: data.currentPartIndex,
        currentSlotIndex: data.currentSlotIndex,
        slotResults: data.slotResults as SlotResult[] | undefined,
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
  }, [sessionId, observerId, playerId, enabled, stopObserving, shareToken])

  // Send control action to student's abacus
  const sendControl = useCallback(
    (action: SessionAbacusControlAction) => {
      if (!socketRef.current || !isConnected || !sessionId) {
        console.warn('[SessionObserver] Cannot send control - not connected or no sessionId')
        return
      }

      // Map our action types to the AbacusControlEvent format
      let eventAction: 'show' | 'hide' | 'set-value'
      let value: number | undefined

      switch (action.type) {
        case 'show-abacus':
          eventAction = 'show'
          break
        case 'hide-abacus':
          eventAction = 'hide'
          break
        case 'set-abacus-value':
          eventAction = 'set-value'
          value = action.value
          break
      }

      const event: AbacusControlEvent = {
        sessionId,
        target: 'hero', // The main practice abacus
        action: eventAction,
        value,
      }

      socketRef.current.emit('abacus-control', event)
      console.log('[SessionObserver] Sent abacus-control:', action)
    },
    [isConnected, sessionId]
  )

  // Send pause command to student's session
  const sendPause = useCallback(
    (message?: string) => {
      if (!socketRef.current || !isConnected || !sessionId) {
        console.warn('[SessionObserver] Cannot send pause - not connected or no sessionId')
        return
      }

      const event: SessionPausedEvent = {
        sessionId,
        reason: 'teacher',
        message,
      }

      socketRef.current.emit('session-pause', event)
      console.log('[SessionObserver] Sent session-pause:', { message })
    },
    [isConnected, sessionId]
  )

  // Send resume command to student's session
  const sendResume = useCallback(() => {
    if (!socketRef.current || !isConnected || !sessionId) {
      console.warn('[SessionObserver] Cannot send resume - not connected or no sessionId')
      return
    }

    const event: SessionResumedEvent = {
      sessionId,
    }

    socketRef.current.emit('session-resume', event)
    console.log('[SessionObserver] Sent session-resume')
  }, [isConnected, sessionId])

  return {
    state,
    results,
    isConnected,
    isObserving,
    error,
    stopObserving,
    sendControl,
    sendPause,
    sendResume,
  }
}
