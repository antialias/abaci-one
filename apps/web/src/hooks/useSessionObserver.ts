'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Socket } from 'socket.io-client'
import type { SessionFlowState, SessionPart, SlotResult } from '@/db/schema/session-plans'
import type {
  AbacusControlEvent,
  PartTransitionCompleteEvent,
  PartTransitionEvent,
  PartTransitionSide,
  PracticeItemRef,
  PracticeStateEvent,
  SessionEndedEvent,
  SessionFlowStateEvent,
  SessionPausedEvent,
  SessionResumedEvent,
  VisionFrameEvent,
} from '@/lib/classroom/socket-events'
import { arithmeticObserverDotsOf } from '@/lib/curriculum/parts/arithmetic/result-view'
import { createSocket } from '@/lib/socket'

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
  /** The item on the kid's screen (absent from kid screens older than Phase 5b) */
  currentItem?: PracticeItemRef
  /** Session structure for progress indicator */
  sessionParts?: SessionPart[]
  /** The current dot's part: `currentItem`'s */
  currentPartIndex?: number
  /** The current dot's slot within the part: `currentItem`'s */
  currentSlotIndex?: number
  /** Accumulated results for progress indicator */
  slotResults?: SlotResult[]
}

/**
 * State of a part transition being observed
 */
export interface ObservedTransitionState {
  /** The part transitioning FROM, as its kind names it (null at session start) */
  previous: PartTransitionSide | null
  /** The part transitioning TO (null from a kid screen older than Phase 5b) */
  next: PartTransitionSide | null
  /** Timestamp when countdown started (for sync) */
  countdownStartTime: number
  /** Countdown duration in ms */
  countdownDurationMs: number
}

/**
 * A try as the observer lists it. Built from the session report's tries
 * (`observedResultsFromReport`), not from the broadcast (Phase 4c).
 */
export type { ObservedResult } from '@/lib/curriculum/observer-report'

/**
 * Vision frame received from student's abacus camera
 */
export interface ObservedVisionFrame {
  /** Base64-encoded JPEG image data */
  imageData: string
  /** Detected abacus value (null if not yet detected) */
  detectedValue: number | null
  /** Detection confidence (0-1) */
  confidence: number
  /** When this frame was received by observer */
  receivedAt: number
}

/**
 * DVR buffer info for live scrub-back (per-problem scope)
 */
export interface DvrBufferInfo {
  /** Start of available buffer (ms from recording start) */
  availableFromMs: number
  /** End of available buffer (ms from recording start) */
  availableToMs: number
  /** When the current problem started (ms from recording start), null if not yet shown */
  currentProblemStartMs: number | null
  /** Current problem number (1-indexed), null if not yet shown */
  currentProblemNumber: number | null
}

/**
 * State of a game break being observed
 */
export interface ObservedGameBreakState {
  /** Arcade room ID */
  roomId: string
  /** Display name of the game */
  gameName: string
  /** Game registry ID */
  gameId: string
  /** Current phase of the game break */
  phase: 'selecting' | 'playing' | 'completed'
  /** End reason and summary, if break has ended */
  endReason?: 'gameFinished' | 'timeout' | 'skipped'
  endSummary?: { gameName: string; headline?: string }
}

interface UseSessionObserverResult {
  /** Current observed state (null if not yet received); kept after the session ends */
  state: ObservedSessionState | null
  /** Current part transition state (null if not in transition) */
  transitionState: ObservedTransitionState | null
  /**
   * Authoritative flow state from the server-side state machine.
   * This is the primary signal for what to render — use this over breakState.
   * null until first session-flow-state event is received.
   */
  flowState: SessionFlowState | null
  /** Current game break state (null if no break in progress) */
  breakState: ObservedGameBreakState | null
  /** Latest vision frame from student's camera (null if vision not enabled) */
  visionFrame: ObservedVisionFrame | null
  /** Whether connected to the session channel */
  isConnected: boolean
  /** Whether actively observing (connected and joined session) */
  isObserving: boolean
  /** Error message if connection failed */
  error: string | null
  /**
   * The session's end, once the server said so (`session-ended` on the
   * session room, Phase 4c). The hook then stops listening and keeps what is
   * on screen; the view shows the ended report.
   */
  ended: SessionEndedEvent | null
  /** Stop observing the session */
  stopObserving: () => void
  /** Send a control action to the student's abacus */
  sendControl: (action: SessionAbacusControlAction) => void
  /** Pause the student's session with optional message */
  sendPause: (message?: string) => void
  /** Resume the student's session */
  sendResume: () => void
  /** DVR buffer info (null if DVR not available) */
  dvrBufferInfo: DvrBufferInfo | null
  /** Whether currently viewing live feed (vs scrubbing) */
  isLive: boolean
  /** Request a scrub frame at specific offset */
  scrubTo: (offsetMs: number) => void
  /** Return to live feed */
  goLive: () => void
  /** Signal readiness to join game breaks as a participant */
  sendCoPlayReady: (player: { name: string; emoji: string; color: string }) => void
  /** Signal no longer available for co-play */
  sendCoPlayLeave: () => void
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
  const [transitionState, setTransitionState] = useState<ObservedTransitionState | null>(null)
  const [visionFrame, setVisionFrame] = useState<ObservedVisionFrame | null>(null)
  const [observedFlowState, setObservedFlowState] = useState<SessionFlowState | null>(null)
  const [breakState, setBreakState] = useState<ObservedGameBreakState | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [isObserving, setIsObserving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dvrBufferInfo, setDvrBufferInfo] = useState<DvrBufferInfo | null>(null)
  const [isLive, setIsLive] = useState(true)
  const [ended, setEnded] = useState<SessionEndedEvent | null>(null)

  const socketRef = useRef<Socket | null>(null)

  const stopObserving = useCallback(() => {
    if (socketRef.current && sessionId) {
      socketRef.current.emit('stop-observing', { sessionId })
      socketRef.current.disconnect()
      socketRef.current = null
      setIsConnected(false)
      setIsObserving(false)
      setState(null)
      setTransitionState(null)
      setObservedFlowState(null)
      setBreakState(null)
      setVisionFrame(null)
      setDvrBufferInfo(null)
      setIsLive(true)
      setEnded(null)
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
    const socket = createSocket({
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    })
    socketRef.current = socket
    setEnded(null)

    // Handler for when socket connects
    const handleConnect = () => {
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
    }

    socket.on('connect', handleConnect)

    // IMPORTANT: If socket is already connected (shared Manager), the 'connect' event
    // won't fire. We need to manually trigger the connect logic in this case.
    if (socket.connected) {
      console.log('[SessionObserver] Socket already connected, triggering connect logic')
      handleConnect()
    }

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

    // A refused join of a session room (Phase 4c): say so; no retry
    socket.on('session-room-error', (data: { sessionId: string; error: string }) => {
      console.warn('[SessionObserver] Session room join refused:', data.sessionId, data.error)
    })

    // Listen for practice state updates from the student
    socket.on('practice-state', (data: PracticeStateEvent) => {
      console.log('[SessionObserver] Received practice-state:', {
        phase: data.phase,
        answer: data.studentAnswer,
        isCorrect: data.isCorrect,
        currentItem: data.currentItem,
      })

      const currentProblem = data.currentProblem as {
        terms: number[]
        answer: number
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
        currentItem: data.currentItem,
        // The dots: the plan's parts and tries, the current dot at `currentItem`
        ...arithmeticObserverDotsOf(data),
      })
    })

    // Listen for part transition events
    socket.on('part-transition', (data: PartTransitionEvent) => {
      console.log('[SessionObserver] Received part-transition:', {
        previous: data.previous?.label ?? null,
        next: data.next?.label ?? null,
        countdownDurationMs: data.countdownDurationMs,
      })

      setTransitionState({
        previous: data.previous ?? null,
        next: data.next ?? null,
        countdownStartTime: data.countdownStartTime,
        countdownDurationMs: data.countdownDurationMs,
      })
    })

    // Listen for part transition complete events
    socket.on('part-transition-complete', (_data: PartTransitionCompleteEvent) => {
      console.log('[SessionObserver] Part transition complete')
      setTransitionState(null)
    })

    // Listen for vision frames from student's camera (only update if in live mode)
    socket.on('vision-frame', (data: VisionFrameEvent) => {
      // When in live mode, update the vision frame
      // When scrubbing, we'll get frames from vision-scrub-frame events
      setIsLive((currentIsLive) => {
        if (currentIsLive) {
          setVisionFrame({
            imageData: data.imageData,
            detectedValue: data.detectedValue,
            confidence: data.confidence,
            receivedAt: Date.now(),
          })
        }
        return currentIsLive
      })
    })

    // Listen for scrub frame responses (DVR playback)
    socket.on('vision-scrub-frame', (data: { imageData: string; timestamp: number }) => {
      console.log('[SessionObserver] Received scrub frame')
      setVisionFrame({
        imageData: data.imageData,
        detectedValue: null,
        confidence: 0,
        receivedAt: Date.now(),
      })
    })

    // Listen for DVR buffer info updates
    socket.on(
      'vision-buffer-info',
      (data: {
        sessionId: string
        availableFromMs: number
        availableToMs: number
        currentProblemStartMs: number | null
        currentProblemNumber: number | null
      }) => {
        // Only process buffer info for our session
        if (data.sessionId !== sessionId) return

        console.log('[SessionObserver] Received DVR buffer info:', data)

        // Check if problem changed - auto-reset to live when new problem starts
        setDvrBufferInfo((prevInfo) => {
          const problemChanged =
            prevInfo !== null &&
            data.currentProblemNumber !== null &&
            prevInfo.currentProblemNumber !== data.currentProblemNumber

          if (problemChanged) {
            console.log(
              `[SessionObserver] Problem changed: ${prevInfo?.currentProblemNumber} → ${data.currentProblemNumber}, resetting to live`
            )
            setIsLive(true)
          }

          return {
            availableFromMs: data.availableFromMs,
            availableToMs: data.availableToMs,
            currentProblemStartMs: data.currentProblemStartMs,
            currentProblemNumber: data.currentProblemNumber,
          }
        })
      }
    )

    // Listen for authoritative flow state updates
    // This is the primary signal for what the observer should render
    socket.on('session-flow-state', (data: SessionFlowStateEvent) => {
      if (data.sessionId !== sessionId) return
      console.log('[SessionObserver] Received session-flow-state:', {
        flowState: data.flowState,
        hasBreakContext: !!data.breakContext,
      })

      setObservedFlowState(data.flowState)

      // Sync breakState from the authoritative flow state
      if (
        data.breakContext &&
        (data.flowState === 'break_pending' || data.flowState === 'break_active')
      ) {
        setBreakState({
          roomId: data.breakContext.roomId,
          gameName: data.breakContext.gameName,
          gameId: data.breakContext.gameId,
          phase: data.breakContext.phase,
        })
      } else if (
        data.flowState === 'practicing' ||
        data.flowState === 'break_results' ||
        data.flowState === 'completed'
      ) {
        // Break is over or we're in results — clear break state
        setBreakState(null)
      }
    })

    // The session ended (natural completion, end early, abandon; Phase 4c):
    // stop listening, but keep what is on screen. The view shows the final
    // report (useSessionReport refetches it on the same event).
    socket.on('session-ended', (event: SessionEndedEvent) => {
      if (event?.sessionId !== sessionId) return
      console.log('[SessionObserver] Session ended:', event.reason)
      setEnded(event)
      socket.emit('stop-observing', { sessionId })
      socket.disconnect()
      if (socketRef.current === socket) socketRef.current = null
      setIsConnected(false)
      setIsObserving(false)
      setTransitionState(null)
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

  // Scrub to a specific offset in the DVR buffer
  const scrubTo = useCallback(
    (offsetMs: number) => {
      if (!socketRef.current || !isConnected || !sessionId) {
        console.warn('[SessionObserver] Cannot scrub - not connected or no sessionId')
        return
      }

      setIsLive(false)
      socketRef.current.emit('vision-scrub', { sessionId, offsetMs })
      console.log('[SessionObserver] Requested scrub to:', offsetMs)
    },
    [isConnected, sessionId]
  )

  // Return to live feed
  const goLive = useCallback(() => {
    console.log('[SessionObserver] Going back to live feed')
    setIsLive(true)
  }, [])

  const sendCoPlayReady = useCallback(
    (player: { name: string; emoji: string; color: string }) => {
      if (!socketRef.current || !sessionId || !observerId) return
      socketRef.current.emit('observer-coplay-ready', { sessionId, observerId, player })
    },
    [sessionId, observerId]
  )

  const sendCoPlayLeave = useCallback(() => {
    if (!socketRef.current || !sessionId || !observerId) return
    socketRef.current.emit('observer-coplay-leave', { sessionId, observerId })
  }, [sessionId, observerId])

  return {
    state,
    transitionState,
    flowState: observedFlowState,
    breakState,
    visionFrame,
    isConnected,
    isObserving,
    error,
    ended,
    stopObserving,
    sendControl,
    sendPause,
    sendResume,
    dvrBufferInfo,
    isLive,
    scrubTo,
    goLive,
    sendCoPlayReady,
    sendCoPlayLeave,
  }
}
