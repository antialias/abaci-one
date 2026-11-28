'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useToast } from '@/components/common/ToastContext'
import { PageWithNav } from '@/components/PageWithNav'
import {
  ActiveSession,
  type AttemptTimingData,
  type BroadcastState,
  type GameBreakHudData,
  PracticeErrorBoundary,
  PracticeSubNav,
  type SessionHudData,
} from '@/components/practice'
import { AbacusNoticeGate } from '@/components/practice/AbacusNoticeGate'
import type { ActiveRedo, RecordRedoParams } from '@/components/practice/ActiveSession'
import { GameBreakResultsScreen } from '@/components/practice/GameBreakResultsScreen'
import { GameBreakScreen } from '@/components/practice/GameBreakScreen'
import {
  PartTransitionScreen,
  partTransitionViewOf,
  TRANSITION_COUNTDOWN_MS,
} from '@/components/practice/PartTransitionScreen'
import {
  nextCompletionRequest,
  partTransitionKey,
  type TransitionCompletionRequest,
  transitionCompletionToSend,
} from '@/components/practice/partTransitionFlow'
import type { RedoTarget } from '@/components/practice/SessionProgressIndicator'
import { createWriteQueue } from '@/components/practice/writeQueue'
import { useMyAbacus } from '@/contexts/MyAbacusContext'
import type { Player } from '@/db/schema/players'
import { currentBreakOf } from '@/db/schema/session-plan-normalize'
import type {
  GameBreakSettings,
  SessionHealth,
  SessionPart,
  SessionPlan,
  SlotResult,
  SlotResultSubmission,
} from '@/db/schema/session-plans'
import type { GameResultsReport } from '@/lib/arcade/game-sdk/types'
import { abacusNoticeOnTransition } from '@/lib/curriculum/abacus-notice'
import {
  arithmeticCursorLinearIndex,
  arithmeticDotsPosition,
  arithmeticItemNumber,
  arithmeticLinearIndex,
  arithmeticObserverPosition,
  arithmeticSlotOf,
  arithmeticTryCount,
} from '@/lib/curriculum/parts/arithmetic/session-view'
import type { SessionReport } from '@/lib/curriculum/session-report'

/**
 * State for redoing a previously completed problem: the item the kid tapped,
 * by its id (Phase 5b). Where the session goes after it is the server's plan;
 * nothing remembers where the kid was.
 */
export type RedoState = ActiveRedo

/**
 * The HUD's counts, read from the session report alone: its progress, and
 * the planned items of the parts after the report's own part (both from one
 * report, so a push that lands before or after the answer's reply never mixes
 * two positions). An ended report has no position: the HUD shows its final
 * count (nothing left, no later part) for the frame before the summary.
 * Nothing until a report has loaded.
 */
export function hudCountsOf(
  report: SessionReport | null | undefined
): Pick<SessionHudData, 'progress' | 'laterPartItems'> {
  if (!report) return {}
  const position = report.position
  if (!position) {
    if (report.outcome === 'in_progress') return {}
    const planned = report.totals.plannedProblems
    return { progress: { done: planned, total: planned }, laterPartItems: 0 }
  }
  const segment = position.segment
  const laterPartItems =
    segment.kind === 'part'
      ? report.parts
          .filter((row) => row.partIndex > segment.partIndex)
          .reduce((sum, row) => sum + row.plannedProblems, 0)
      : 0
  return { progress: position.progress, laterPartItems }
}

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { BroadcastDebugPanel } from '@/components/debug/BroadcastDebugPanel'
import { useSaveGameResult } from '@/hooks/useGameResults'
import {
  type BreakContext,
  type ReceivedAbacusControl,
  type TeacherPauseRequest,
  useSessionBroadcast,
} from '@/hooks/useSessionBroadcast'
import { useSessionMode } from '@/hooks/useSessionMode'
import {
  isQuietFlowEventFailure,
  isQuietTryWriteFailure,
  sessionPlanKeys,
  useAcknowledgeGameBreakResults,
  useActiveSessionPlan,
  useCompletePartTransition,
  useEndSessionEarly,
  useFinishGameBreak,
  useRecordRedoResult,
  useRecordSlotResult,
  useStartGameBreak,
} from '@/hooks/useSessionPlan'
import { useSessionReport } from '@/hooks/useSessionReport'
import { useSessionSongTrigger } from '@/hooks/useSessionSongTrigger'
import { useUserId } from '@/hooks/useUserId'
import { css } from '../../../../styled-system/css'

interface PracticeClientProps {
  studentId: string
  player: Player
  initialSession: SessionPlan
  /** Whether session song generation is available (feature flag + family tier) */
  songEnabled?: boolean
}

/**
 * Practice Client Component
 *
 * This component ONLY shows the current problem.
 * It assumes the session is in_progress (server guards ensure this).
 *
 * When the session completes, it redirects to /summary.
 */
export function PracticeClient({
  studentId,
  player,
  initialSession,
  songEnabled = false,
}: PracticeClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { showError } = useToast()
  const { setVisionFrameCallback } = useMyAbacus()
  const queryClient = useQueryClient()

  // Track pause state for HUD display (ActiveSession owns the modal and actual pause logic)
  const [isPaused, setIsPaused] = useState(false)
  // Track timing data from ActiveSession for the sub-nav HUD
  const [timingData, setTimingData] = useState<AttemptTimingData | null>(null)
  // Track broadcast state for session observation (digit-by-digit updates from ActiveSession)
  const [broadcastState, setBroadcastState] = useState<BroadcastState | null>(null)
  // Browse mode state - lifted here so PracticeSubNav can trigger it
  const [isBrowseMode, setIsBrowseMode] = useState(false)
  // Browse index - lifted for navigation from SessionProgressIndicator
  const [browseIndex, setBrowseIndex] = useState(0)
  // Teacher abacus control - receives commands from observing teacher
  const [teacherControl, setTeacherControl] = useState<ReceivedAbacusControl | null>(null)
  // Teacher-initiated pause/resume requests from observing teacher
  const [teacherPauseRequest, setTeacherPauseRequest] = useState<TeacherPauseRequest | null>(null)
  const [teacherResumeRequest, setTeacherResumeRequest] = useState(false)
  // Manual pause request from HUD
  const [manualPauseRequest, setManualPauseRequest] = useState(false)
  // Local fallback start time for game break HUD while persisted state catches up
  const [gameBreakStartTime, setGameBreakStartTime] = useState<number>(Date.now())
  // Game break results - captured when game completes to show on interstitial screen
  const [gameBreakResults, setGameBreakResults] = useState<GameResultsReport | null>(null)
  // Ref to store stopVisionRecording - populated later when useSessionBroadcast is called
  // This allows early-defined callbacks to access the function
  const stopRecordingRef = useRef<(() => void) | undefined>(undefined)
  // Ref to store sendProblemMarker for timeline sync
  const sendProblemMarkerRef = useRef<
    | ((
        problemNumber: number,
        partIndex: number,
        eventType: 'problem-shown' | 'answer-submitted' | 'feedback-shown',
        isCorrect?: boolean,
        retryContext?: {
          epochNumber: number
          attemptNumber: number
          isRetry: boolean
          isManualRedo: boolean
        },
        slotId?: string,
        problem?: { terms: number[]; answer: number }
      ) => void)
    | undefined
  >(undefined)
  // Redo state - allows students to re-attempt any completed problem
  const [redoState, setRedoState] = useState<RedoState | null>(null)
  // Break context for observer broadcast — updated by GameBreakScreen callbacks
  const [breakContext, setBreakContext] = useState<BreakContext | null>(null)

  const gameBreakTraceEnabled = searchParams.get('debugGameBreakTrace') === '1'

  // Session plan mutations
  const recordResult = useRecordSlotResult()
  const recordRedo = useRecordRedoResult()
  const endEarly = useEndSessionEarly()
  const completePartTransition = useCompletePartTransition()
  const startGameBreak = useStartGameBreak()
  const finishGameBreak = useFinishGameBreak()
  const acknowledgeGameBreakResults = useAcknowledgeGameBreakResults()

  // Game results mutation - saves to scoreboard when game break completes
  const saveGameResult = useSaveGameResult()

  // Fetch active session plan from cache or API with server data as initial
  const { data: fetchedPlan } = useActiveSessionPlan(studentId, initialSession)

  // Current plan should come from the active-session query cache.
  // Each mutation writes back to this cache on success.
  // Do not prioritize mutation-local `data`, which can become stale and mask newer flow updates.
  const currentPlan = fetchedPlan ?? initialSession

  // Fetch historical results from prior completed sessions for threshold calculation.
  // This enables complexity-scaled auto-pause thresholds from session start.
  const { data: historicalResults } = useQuery({
    queryKey: ['problem-history', studentId],
    queryFn: async () => {
      const res = await fetch(`/api/curriculum/${studentId}/problem-history`)
      if (!res.ok) return []
      const data = await res.json()
      return (data.history ?? []) as SlotResult[]
    },
    staleTime: 5 * 60 * 1000, // 5 minutes — historical data doesn't change during a session
  })
  const logGameBreakTrace = useCallback(
    (event: string, details: Record<string, unknown> = {}) => {
      if (!gameBreakTraceEnabled) return
      console.log('[GBTRACE][client]', event, {
        ts: new Date().toISOString(),
        studentId,
        planId: currentPlan.id,
        ...details,
      })
    },
    [gameBreakTraceEnabled, studentId, currentPlan.id]
  )

  // Game break settings from the session plan
  const gameBreakSettings = currentPlan.gameBreakSettings as GameBreakSettings | null
  const flowState = currentPlan.flowState ?? 'practicing'
  const showGameBreak = flowState === 'break_pending' || flowState === 'break_active'
  const showGameBreakResults = flowState === 'break_results'

  // The break the kid is in, from the plan's break list (its start while
  // pending is when the flow entered the break, §10 P6b-3); the legacy break
  // columns are not read since Phase 6b-0
  const currentBreak = currentBreakOf(currentPlan)
  const currentBreakStartMs =
    currentBreak?.startedAt != null ? new Date(currentBreak.startedAt).getTime() : null
  const persistedBreakResults = currentBreak?.results ?? null

  useEffect(() => {
    if (showGameBreak && currentBreakStartMs != null && !Number.isNaN(currentBreakStartMs)) {
      setGameBreakStartTime(currentBreakStartMs)
    }
  }, [showGameBreak, currentBreakStartMs])

  useEffect(() => {
    if (!showGameBreakResults) return

    const persistedResults = persistedBreakResults
    if (persistedResults && !gameBreakResults) {
      setGameBreakResults(persistedResults)
      return
    }

    if (gameBreakResults || persistedResults) return

    acknowledgeGameBreakResults.mutate({
      playerId: studentId,
      planId: currentPlan.id,
      expectedFlowVersion: currentPlan.flowVersion,
    })
  }, [
    showGameBreakResults,
    gameBreakResults,
    persistedBreakResults,
    currentPlan.flowVersion,
    acknowledgeGameBreakResults,
    studentId,
    currentPlan.id,
  ])

  // Build game config with skipSetupPhase merged into each game's config
  // This allows games to start immediately without showing their setup screen
  const gameBreakGameConfig = useMemo(() => {
    const baseConfig = gameBreakSettings?.gameConfig ?? {}
    const skipSetup = gameBreakSettings?.skipSetupPhase ?? true // Default to true for practice breaks

    if (!skipSetup) {
      return baseConfig
    }

    // Merge skipSetupPhase + practice-break metadata into each game's config
    const practiceBreakMeta = {
      skipSetupPhase: true,
      maxDurationMinutes: gameBreakSettings?.maxDurationMinutes ?? 5,
      playerName: player.name,
    }
    const mergedConfig: Record<string, Record<string, unknown>> = {}
    for (const [gameName, config] of Object.entries(baseConfig)) {
      mergedConfig[gameName] = { ...config, ...practiceBreakMeta }
    }

    // Also add metadata for the selected game if not already in config
    const selectedGame = gameBreakSettings?.selectedGame
    if (selectedGame && selectedGame !== 'random' && !mergedConfig[selectedGame]) {
      mergedConfig[selectedGame] = { ...practiceBreakMeta }
    }

    return mergedConfig
  }, [
    gameBreakSettings?.gameConfig,
    gameBreakSettings?.skipSetupPhase,
    gameBreakSettings?.selectedGame,
    gameBreakSettings?.maxDurationMinutes,
    player.name,
  ])

  // Compute HUD data from current plan
  const currentPart = currentPlan.parts[currentPlan.currentPartIndex] as SessionPart | undefined
  const sessionHealth = currentPlan.sessionHealth as SessionHealth | null

  // The session report: the counts the HUD shows and the song trigger reads
  // (`position.progress`, §4), kept current by its pushes. It shares its
  // cache entry with the paused modal's.
  // The fetch needs only the cookie; the viewer id joins the push room
  const { data: viewerId } = useUserId()
  const { data: report } = useSessionReport({
    playerId: studentId,
    planId: currentPlan.id,
    viewerId: viewerId ?? null,
  })

  // Retry context for the video timeline, from the item itself: its round,
  // whether it is a do-over, and the tries it already has
  const getRetryContext = useCallback(
    (item: { partIndex: number; itemId: string; round: number; doOver: boolean }) => {
      const attemptNumber = arithmeticTryCount(currentPlan, item.partIndex, item.itemId) + 1
      return {
        epochNumber: item.round,
        attemptNumber,
        isRetry: item.round > 0,
        isManualRedo: item.doOver,
      }
    },
    [currentPlan]
  )

  // Pause handler - triggers manual pause in ActiveSession
  const handlePause = useCallback(() => {
    setManualPauseRequest(true)
  }, [])

  const handleResume = useCallback(() => {
    setIsPaused(false)
  }, [])

  // Write queue: answers and do-overs reach the server in submit order while the
  // UI advances optimistically. When one fails, the writes queued behind it are
  // dropped and ActiveSession re-shows the server's current problem (the hook
  // has already refetched the plan by the time the failure reaches here).
  const [resyncRequest, setResyncRequest] = useState(0)
  const [writeQueue] = useState(() => createWriteQueue(() => setResyncRequest((n) => n + 1)))

  // A write that failed (after its one resend) has already refetched the plan and
  // the screen resyncs. What the kid reads carries no technical text; the cause
  // goes to the console. A stale answer (409 SLOT_MISMATCH), a try while a
  // transition or break owns the next step (409 not_practicing, whose plan is
  // already applied) and a write lost to contention (503) resync with no
  // message at all.
  const reportTryWriteFailure = useCallback(
    (err: unknown) => {
      if (isQuietTryWriteFailure(err)) {
        console.warn('[PracticeClient] answer not taken; resyncing to the server:', err)
        return
      }
      const message = err instanceof Error ? err.message : 'Unknown error'
      if (message.includes('Not authorized')) {
        showError(
          'Not authorized',
          'Only parents or teachers with the student present in their classroom can record answers.'
        )
        return
      }
      console.error('[PracticeClient] answer not saved:', err)
      showError("That one didn't save", "No problem, let's keep going!")
    },
    [showError]
  )

  // Handle recording an answer. Resolves to the plan the server returned (the
  // screen derives its next item from it), or null when the write was dropped
  // behind a failure or failed (the screen resyncs)
  const handleAnswer = useCallback(
    (
      result: SlotResultSubmission & { partIndex: number; tryId: string }
    ): Promise<SessionPlan | null> => {
      // Synchronous work: problem markers + trace logging happen immediately.
      // The marker names the answered item (its own part, id and round), not
      // the plan's cursor, which lags an optimistic advance
      const item = {
        partIndex: result.partIndex,
        itemId: result.slotId,
        round: result.epochNumber ?? 0,
        doOver: false,
      }
      // (an item the plan does not name still gets its marker, numbered by its slot)
      const problemNumber =
        arithmeticItemNumber(currentPlan.parts, item.partIndex, item.itemId) ??
        arithmeticLinearIndex(currentPlan.parts, item.partIndex, result.slotIndex) + 1
      sendProblemMarkerRef.current?.(
        problemNumber,
        item.partIndex,
        'answer-submitted',
        result.isCorrect,
        getRetryContext(item)
      )
      logGameBreakTrace('answer-submit-start', {
        problemNumber,
        partIndex: item.partIndex,
        itemId: item.itemId,
        isCorrect: result.isCorrect,
      })

      // Chain this mutation onto the queue so mutations execute in order
      const mutationPromise = (async (): Promise<SessionPlan | null> => {
        try {
          const updatedPlan = await writeQueue.enqueue(() =>
            recordResult.mutateAsync({
              playerId: studentId,
              planId: currentPlan.id,
              // The envelope names the answered item's part (K4)
              result: { ...result, partIndex: item.partIndex },
            })
          )
          // Dropped: an answer queued before this one failed; the screen resyncs
          if (!updatedPlan) return null
          // The server's flow says where the session went (a transition, a
          // break, the end); the screens follow it from the plan
          logGameBreakTrace('answer-submit-resolved', {
            updatedFlowState: updatedPlan.flowState,
            updatedPartIndex: updatedPlan.currentPartIndex,
            updatedStatus: updatedPlan.status,
            completedAt: updatedPlan.completedAt ? String(updatedPlan.completedAt) : null,
          })

          // If session just completed, redirect to summary with completed flag
          if (updatedPlan.completedAt) {
            stopRecordingRef.current?.()
            router.push(`/practice/${studentId}/summary?completed=1`, {
              scroll: false,
            })
          }
          return updatedPlan
        } catch (err) {
          reportTryWriteFailure(err)
          return null
        }
      })()

      return mutationPromise
    },
    [
      studentId,
      currentPlan.id,
      currentPlan.currentPartIndex,
      currentPlan.parts,
      recordResult,
      writeQueue,
      router,
      reportTryWriteFailure,
      logGameBreakTrace,
      getRetryContext,
    ]
  )

  // Handle ending session early
  const handleEndEarly = useCallback(
    async (reason?: string) => {
      try {
        await endEarly.mutateAsync({
          playerId: studentId,
          planId: currentPlan.id,
          reason,
        })
        // Stop vision recording if it was started
        stopRecordingRef.current?.()
        // Redirect to summary after ending early with completed flag
        router.push(`/practice/${studentId}/summary?completed=1`, {
          scroll: false,
        })
      } catch (err) {
        // Check if it's an authorization error
        const message = err instanceof Error ? err.message : 'Unknown error'
        if (message.includes('Not authorized')) {
          showError(
            'Not authorized',
            'Only parents or teachers with the student present in their classroom can end sessions.'
          )
        } else {
          showError('Failed to end session', message)
        }
      }
    },
    [studentId, currentPlan.id, endEarly, router, showError]
  )

  // Session completion: the planEnded effect below leaves for the summary when
  // the server's plan ends (Phase 5b removed the screen's own completion call)

  // Handle redoing a previously completed problem
  // Called when student taps a completed problem dot in the progress indicator
  const handleRedoProblem = useCallback(
    ({ linearIndex, partIndex, itemId, originalResult }: RedoTarget) => {
      // Exit browse mode if active
      if (isBrowseMode) {
        setIsBrowseMode(false)
      }
      setRedoState({ isActive: true, partIndex, itemId, linearIndex, originalResult })
    },
    [isBrowseMode]
  )

  // Handle canceling a redo - exit without recording
  const handleCancelRedo = useCallback(() => {
    setRedoState(null)
  }, [])

  // Handle redo result recording - wraps recordRedo to send answer-submitted marker
  const handleRecordRedo = useCallback(
    async (params: RecordRedoParams): Promise<SessionPlan | null> => {
      // Send the answer-submitted marker for the redo, naming its item
      const { redoContext, result } = params
      const item = {
        partIndex: redoContext.originalPartIndex,
        itemId: redoContext.itemId,
        round: 0,
        doOver: true,
      }
      const problemNumber =
        arithmeticItemNumber(currentPlan.parts, item.partIndex, item.itemId) ??
        arithmeticLinearIndex(currentPlan.parts, item.partIndex, redoContext.originalSlotIndex) + 1
      sendProblemMarkerRef.current?.(
        problemNumber,
        item.partIndex,
        'answer-submitted',
        result.isCorrect,
        getRetryContext(item)
      )

      // Queued behind any pending answers: a do-over can move the session on
      try {
        return (await writeQueue.enqueue(() => recordRedo.mutateAsync(params))) ?? null
      } catch (err) {
        reportTryWriteFailure(err)
        return null
      }
    },
    [currentPlan.parts, getRetryContext, recordRedo, writeQueue, reportTryWriteFailure]
  )

  // Handle game break end - show results screen if game finished normally
  const handleGameBreakEnd = useCallback(
    (reason: 'timeout' | 'gameFinished' | 'skipped', results?: GameResultsReport) => {
      // If game finished normally with results, save to scoreboard and show interstitial
      if (reason === 'gameFinished' && results) {
        // Save result to database for scoreboard
        const savePayload = {
          playerId: player.id,
          sessionType: 'practice-break' as const,
          sessionId: currentPlan.id,
          report: results,
        }
        console.info('[handleGameBreakEnd] Saving game result:', {
          playerId: savePayload.playerId,
          sessionType: savePayload.sessionType,
          sessionId: savePayload.sessionId,
          gameName: results.gameName,
        })
        saveGameResult.mutate(savePayload)

        setGameBreakResults(results)
      } else {
        // Timeout or skip - no results to show, return to practice immediately
        setGameBreakResults(null)
      }

      void finishGameBreak
        .mutateAsync({
          playerId: studentId,
          planId: currentPlan.id,
          breakFinishReason: reason,
          breakResults: results ?? null,
          expectedFlowVersion: currentPlan.flowVersion,
        })
        .then((updatedPlan) => {
          logGameBreakTrace('game-break-finish-resolved', {
            reason,
            updatedFlowState: updatedPlan.flowState,
          })
        })
        .catch((err) => {
          // The fresh plan drives the screen; nothing for the kid to read
          if (isQuietFlowEventFailure(err)) return
          showError(
            'Failed to finish game break',
            err instanceof Error ? err.message : 'Unknown error'
          )
        })
    },
    [
      saveGameResult,
      player.id,
      currentPlan.id,
      currentPlan.flowVersion,
      finishGameBreak,
      studentId,
      logGameBreakTrace,
      showError,
    ]
  )

  const handleGameBreakStarted = useCallback(
    (gameName: string) => {
      void startGameBreak
        .mutateAsync({
          playerId: studentId,
          planId: currentPlan.id,
          game: gameName,
          expectedFlowVersion: currentPlan.flowVersion,
        })
        .catch((err) => {
          logGameBreakTrace('game-break-start-failed', {
            gameName,
            error: err instanceof Error ? err.message : String(err),
          })
        })
    },
    [startGameBreak, studentId, currentPlan.id, currentPlan.flowVersion, logGameBreakTrace]
  )

  // Handle results screen completion - return to practice
  const handleGameBreakResultsComplete = useCallback(() => {
    setGameBreakResults(null)
    void acknowledgeGameBreakResults
      .mutateAsync({
        playerId: studentId,
        planId: currentPlan.id,
        expectedFlowVersion: currentPlan.flowVersion,
      })
      .then((updatedPlan) => {
        logGameBreakTrace('game-break-results-acked', {
          updatedFlowState: updatedPlan.flowState,
        })
      })
      .catch((err) => {
        // The fresh plan drives the screen; nothing for the kid to read
        if (isQuietFlowEventFailure(err)) return
        showError(
          'Failed to return to practice',
          err instanceof Error ? err.message : 'Unknown error'
        )
      })
  }, [
    acknowledgeGameBreakResults,
    studentId,
    currentPlan.id,
    currentPlan.flowVersion,
    logGameBreakTrace,
    showError,
  ])

  // What observers are told: the screen's live problem and answer, with the
  // position fields computed from the server's plan and the item on screen
  // (Phase 5b), never from copies the screen keeps
  const broadcastPosition = useMemo(
    () => (broadcastState ? arithmeticObserverPosition(currentPlan, broadcastState.item) : null),
    [broadcastState, currentPlan]
  )
  const practiceBroadcast = useMemo(
    () =>
      broadcastState && broadcastPosition
        ? { ...broadcastState, position: broadcastPosition }
        : null,
    [broadcastState, broadcastPosition]
  )

  // Broadcast session state if student is in a classroom
  // broadcastState is updated by ActiveSession via the onBroadcastStateChange callback
  // onAbacusControl receives control events from observing teacher
  // onTeacherPause/onTeacherResume receive pause/resume commands from teacher
  const {
    isConnected: broadcastConnected,
    isBroadcasting,
    sendPartTransition,
    sendPartTransitionComplete,
    sendVisionFrame,
    isRecording,
    recordingId,
    startVisionRecording,
    stopVisionRecording,
    sendProblemMarker,
    readyObservers,
  } = useSessionBroadcast(currentPlan.id, studentId, practiceBroadcast, flowState, breakContext, {
    onAbacusControl: setTeacherControl,
    onTeacherPause: setTeacherPauseRequest,
    onTeacherResume: () => setTeacherResumeRequest(true),
  })

  // Session song smart trigger — fires when conditions are met mid-session
  useSessionSongTrigger({
    studentId,
    planId: currentPlan.id,
    report,
    avgSecondsPerProblem: currentPlan.avgTimePerProblemSeconds,
    songEnabled,
  })

  // Focus skill banner — show the math rule(s) the student is working on
  const { data: sessionModeData } = useSessionMode(studentId)
  const focusSkills = useMemo((): string[] | undefined => {
    if (!sessionModeData) return undefined
    const mode = sessionModeData.sessionMode
    switch (mode.type) {
      case 'progression':
        return mode.nextSkill.hasMathSentence ? [mode.nextSkill.displayName] : undefined
      case 'remediation': {
        const mathSkills = mode.weakSkills
          .filter((s) => s.hasMathSentence)
          .map((s) => s.displayName)
        return mathSkills.length > 0 ? mathSkills : undefined
      }
      case 'maintenance':
        return undefined
    }
  }, [sessionModeData])

  // Track whether we've started vision recording for this session
  const hasStartedRecordingRef = useRef(false)
  // Track previous problem number to detect when new problems appear
  const previousProblemNumberRef = useRef<number | null>(null)
  // Track previous isRecording state to detect when recording starts
  const wasRecordingRef = useRef(false)
  // Update the refs so callbacks defined earlier can access these functions
  stopRecordingRef.current = stopVisionRecording
  sendProblemMarkerRef.current = sendProblemMarker
  // The problem number the DVR markers key on: the plan's cursor (a do-over
  // does not move it, and has its own marker below)
  const shownProblemNumber = broadcastState ? arithmeticCursorLinearIndex(currentPlan) + 1 : null

  // When recording starts, emit problem-shown marker for the current problem
  // This handles the case where recording starts mid-session after the first problem-shown was dropped
  useEffect(() => {
    const wasRecording = wasRecordingRef.current
    wasRecordingRef.current = isRecording

    // Detect transition from not-recording to recording
    if (!wasRecording && isRecording && broadcastState && shownProblemNumber !== null) {
      sendProblemMarker(
        shownProblemNumber,
        broadcastState.item.partIndex,
        'problem-shown',
        undefined,
        getRetryContext(broadcastState.item),
        broadcastState.slotId,
        broadcastState.currentProblem
      )
    }
  }, [isRecording, broadcastState, shownProblemNumber, sendProblemMarker, getRetryContext])

  // Emit 'problem-shown' marker when a new problem appears (including first problem).
  useEffect(() => {
    if (!broadcastState || shownProblemNumber === null) return

    const previousProblemNumber = previousProblemNumberRef.current

    // Emit if this is a new problem OR the first problem (previousProblemNumber is null)
    if (shownProblemNumber !== previousProblemNumber) {
      sendProblemMarker(
        shownProblemNumber,
        broadcastState.item.partIndex,
        'problem-shown',
        undefined,
        getRetryContext(broadcastState.item),
        broadcastState.slotId,
        broadcastState.currentProblem
      )
    }

    // Update ref for next comparison
    previousProblemNumberRef.current = shownProblemNumber
  }, [
    shownProblemNumber,
    broadcastState?.item.partIndex,
    broadcastState?.item.itemId,
    sendProblemMarker,
    getRetryContext,
  ])

  // Emit 'problem-shown' marker when entering redo mode
  // The regular problem-shown effect won't fire because the problem number doesn't change during a redo
  const wasInRedoModeRef = useRef(false)
  useEffect(() => {
    const wasInRedoMode = wasInRedoModeRef.current
    const isNowInRedoMode = redoState?.isActive ?? false
    wasInRedoModeRef.current = isNowInRedoMode

    // Detect entering redo mode
    if (!wasInRedoMode && isNowInRedoMode && redoState) {
      const item = {
        partIndex: redoState.partIndex,
        itemId: redoState.itemId,
        round: 0,
        doOver: true,
      }
      const redoSlot = arithmeticSlotOf(currentPlan.parts[item.partIndex], item.itemId)?.slot
      sendProblemMarker(
        redoState.linearIndex + 1, // the dot's number (linearIndex is 0-based)
        item.partIndex,
        'problem-shown',
        undefined,
        getRetryContext(item),
        item.itemId,
        redoSlot?.problem
      )
    }
  }, [redoState, sendProblemMarker, getRetryContext, currentPlan.parts])

  // The part-transition screen renders from the server's flowState (Phase 3c):
  // a tab reloaded during a transition shows it too, and completes it.
  const transitionKey = partTransitionKey(currentPlan)
  const [transitionShown, setTransitionShown] = useState<{
    key: string
    countdownStartTime: number
  } | null>(null)
  const [completionRequest, setCompletionRequest] = useState<TransitionCompletionRequest | null>(
    null
  )
  const sentCompletionRef = useRef<string | null>(null)
  // The two parts as their kinds show them, asked of the kinds (the plan's
  // parts on either side of the server's part index)
  const transitionParts = useMemo(() => {
    if (!transitionKey) return null
    const previousPart = currentPlan.parts[currentPlan.currentPartIndex - 1]
    const nextPart = currentPlan.parts[currentPlan.currentPartIndex]
    if (!nextPart) return null
    return {
      previous: previousPart ? partTransitionViewOf(previousPart) : null,
      next: partTransitionViewOf(nextPart),
      // The abacus notice only when no break follows: after a break it
      // comes right before the part (AbacusNoticeGate, plan §8 A19)
      abacusNotice: abacusNoticeOnTransition(currentPlan, currentPlan.currentPartIndex),
    }
  }, [transitionKey, currentPlan])

  // Entering a transition starts its countdown during render (React's
  // "adjust state when a prop changes"): the render is redone before any
  // paint, so the screen is in the first frame of the server's
  // part_transition, never a frame of the next part's problem first
  if (transitionKey && transitionParts && transitionShown?.key !== transitionKey) {
    setTransitionShown({ key: transitionKey, countdownStartTime: Date.now() })
  }

  // ...and observers are told once per transition
  const announcedTransitionRef = useRef<string | null>(null)
  useEffect(() => {
    if (!transitionShown || !transitionParts || transitionShown.key !== transitionKey) return
    if (announcedTransitionRef.current === transitionShown.key) return
    announcedTransitionRef.current = transitionShown.key
    logGameBreakTrace('part-transition-start', {
      previous: transitionParts.previous?.label ?? null,
      next: transitionParts.next.label,
      countdownStartTime: transitionShown.countdownStartTime,
    })
    sendPartTransition(
      transitionParts.previous,
      transitionParts.next,
      transitionShown.countdownStartTime,
      TRANSITION_COUNTDOWN_MS
    )
  }, [transitionKey, transitionParts, transitionShown, sendPartTransition, logGameBreakTrace])

  // The abacus notice after a break: observers see it as a transition, with
  // its countdown, until it goes (the gate tells both)
  const handleAbacusNoticeShown = useCallback(
    (
      previous: Parameters<typeof sendPartTransition>[0],
      next: Parameters<typeof sendPartTransition>[1],
      countdownStartTime: number
    ) => {
      logGameBreakTrace('abacus-notice-start', { next: next.label, countdownStartTime })
      sendPartTransition(previous, next, countdownStartTime, TRANSITION_COUNTDOWN_MS)
    },
    [sendPartTransition, logGameBreakTrace]
  )

  // The screen's countdown ran out, or the kid tapped to go on
  const handleTransitionScreenDone = useCallback(() => {
    if (!transitionKey) return
    logGameBreakTrace('part-transition-complete-callback', {
      flowStateBefore: flowState,
      currentPartIndex: currentPlan.currentPartIndex,
    })
    setCompletionRequest((previous) => nextCompletionRequest(previous, transitionKey))
  }, [transitionKey, flowState, currentPlan.currentPartIndex, logGameBreakTrace])

  // Observers close their transition view when the server's plan leaves the
  // transition, not when the kid's screen asks to: an ask can fail
  const lastTransitionKeyRef = useRef(transitionKey)
  useEffect(() => {
    const previous = lastTransitionKeyRef.current
    lastTransitionKeyRef.current = transitionKey
    if (previous && previous !== transitionKey) sendPartTransitionComplete()
  }, [transitionKey, sendPartTransitionComplete])

  // A plan that ended outside this tab (an adult ended it, learned from a
  // resync): leave for the summary, as this tab's own completion does
  const planEnded =
    currentPlan.status === 'completed' ||
    currentPlan.status === 'abandoned' ||
    currentPlan.completedAt != null
  const endedRedirectRef = useRef(false)
  useEffect(() => {
    if (!planEnded || endedRedirectRef.current) return
    endedRedirectRef.current = true
    stopRecordingRef.current?.()
    router.push(
      `/practice/${studentId}/summary${currentPlan.status === 'completed' ? '?completed=1' : ''}`,
      { scroll: false }
    )
  }, [planEnded, currentPlan.status, studentId, router])

  // Complete the transition with the plan's current token. A stale token
  // refetches the plan (in the mutation); if the fresh plan is still in this
  // transition at a newer version, this runs again and sends with it.
  const sendCompletePartTransition = completePartTransition.mutateAsync
  const completionInFlight = completePartTransition.isPending
  useEffect(() => {
    const flowVersion = currentPlan.flowVersion ?? 0
    const token = transitionCompletionToSend({
      key: transitionKey,
      flowVersion,
      request: completionRequest,
      inFlight: completionInFlight,
      sent: sentCompletionRef.current,
    })
    if (!token) return
    sentCompletionRef.current = token
    sendCompletePartTransition({
      playerId: studentId,
      planId: currentPlan.id,
      expectedFlowVersion: flowVersion,
      // Ignored since Phase 3a (the plan's break setting decides); kept for one
      // release for a server from before it, which reads undefined as false
      shouldRunBreak: (gameBreakSettings?.enabled ?? false) && transitionKey !== null,
    })
      .then((updatedPlan) => {
        logGameBreakTrace('part-transition-complete-resolved', {
          updatedFlowState: updatedPlan.flowState,
          updatedFlowUpdatedAt: updatedPlan.flowUpdatedAt,
        })
      })
      .catch((err) => {
        // A stale token, or a plan that moved on (an adult ended the session
        // during the countdown): the fresh plan drives the screen, quietly.
        // Still in this transition: a real failure; the kid can tap again.
        if (isQuietFlowEventFailure(err)) return
        showError(
          'Failed to transition session',
          err instanceof Error ? err.message : 'Unknown transition error'
        )
      })
  }, [
    transitionKey,
    currentPlan.flowVersion,
    currentPlan.id,
    completionRequest,
    completionInFlight,
    sendCompletePartTransition,
    studentId,
    gameBreakSettings?.enabled,
    logGameBreakTrace,
    showError,
  ])

  // Wire vision frame callback to broadcast vision frames to observers
  // Also auto-start recording when vision frames start flowing
  useEffect(() => {
    setVisionFrameCallback((frame) => {
      // Start recording on first vision frame (if not already recording)
      if (!hasStartedRecordingRef.current && !isRecording) {
        hasStartedRecordingRef.current = true
        startVisionRecording()
      }

      sendVisionFrame(frame.imageData, frame.detectedValue, frame.confidence)
    })

    return () => {
      setVisionFrameCallback(null)
    }
  }, [setVisionFrameCallback, sendVisionFrame, isRecording, startVisionRecording])

  useEffect(() => {
    logGameBreakTrace('flow-state', { flowState, showGameBreak, showGameBreakResults })
  }, [flowState, showGameBreak, showGameBreakResults, logGameBreakTrace])

  // Build session HUD data for PracticeSubNav
  const sessionHud: SessionHudData | undefined = currentPart
    ? {
        isPaused,
        parts: currentPlan.parts,
        currentPartIndex: currentPlan.currentPartIndex,
        currentPart: {
          type: currentPart.type,
          partNumber: currentPart.partNumber,
        },
        results: currentPlan.results,
        // Counts from the report alone (none until it loads)
        ...hudCountsOf(report),
        dots: arithmeticDotsPosition(currentPlan),
        sessionHealth: sessionHealth
          ? {
              overall: sessionHealth.overall,
              accuracy: sessionHealth.accuracy,
            }
          : undefined,
        // Pass timing data for the current problem
        timing: timingData
          ? {
              startTime: timingData.startTime,
              accumulatedPauseMs: timingData.accumulatedPauseMs,
              results: currentPlan.results,
              parts: currentPlan.parts,
            }
          : undefined,
        onPause: handlePause,
        onResume: handleResume,
        onEndEarly: () => handleEndEarly('Session ended'),
        isEndingSession: endEarly.isPending,
        isBrowseMode,
        onToggleBrowse: () => setIsBrowseMode((prev) => !prev),
        onBrowseNavigate: setBrowseIndex,
        onRedoProblem: handleRedoProblem, // Allow navigating to other problems during redo
        onCancelRedo: handleCancelRedo, // Return to current session position from redo
        redoLinearIndex: redoState?.linearIndex,
        plan: currentPlan,
      }
    : undefined

  // Build game break HUD data for PracticeSubNav (when on game break)
  const gameBreakHud: GameBreakHudData | undefined = showGameBreak
    ? {
        startTime: gameBreakStartTime,
        maxDurationMs: (gameBreakSettings?.maxDurationMinutes ?? 5) * 60 * 1000,
        onSkip: () => handleGameBreakEnd('skipped'),
      }
    : undefined

  return (
    <PageWithNav>
      {/* Practice Sub-Navigation with Session HUD or Game Break HUD */}
      <PracticeSubNav
        student={player}
        pageContext="session"
        sessionHud={sessionHud}
        gameBreakHud={gameBreakHud}
        focusSkills={focusSkills}
      />

      <main
        data-component="practice-page"
        className={`${css({
          userSelect: 'none',
          // Fixed positioning to precisely control bounds
          position: 'fixed',
          // Top: main nav (80px) + sub-nav height (~52px mobile, ~60px desktop) + optional focus banner (~24px)
          top: focusSkills ? { base: '156px', md: '164px' } : { base: '132px', md: '140px' },
          left: 0,
          // Right: 0 by default, landscape mobile handled via media query below
          right: 0,
          // Bottom: keypad height on mobile portrait (48px), 0 on desktop
          // Landscape mobile handled via media query below
          bottom: { base: '48px', md: 0 },
          overflow: 'hidden', // Prevent scrolling during practice
        })} no-text-select`}
      >
        {/* Landscape mobile: keypad is on right (100px) instead of bottom */}
        <style
          dangerouslySetInnerHTML={{
            __html: `
              @media (orientation: landscape) and (max-height: 500px) {
                [data-component="practice-page"] {
                  bottom: 0 !important;
                  right: 100px !important;
                }
              }
            `,
          }}
        />
        <PracticeErrorBoundary studentName={player.name}>
          {showGameBreakResults && gameBreakResults ? (
            <GameBreakResultsScreen
              isVisible={showGameBreakResults}
              results={gameBreakResults}
              student={{ name: player.name, emoji: player.emoji }}
              onComplete={handleGameBreakResultsComplete}
            />
          ) : showGameBreak ? (
            <GameBreakScreen
              isVisible={showGameBreak}
              student={{
                id: player.id,
                name: player.name,
                emoji: player.emoji,
                color: player.color,
              }}
              maxDurationMinutes={gameBreakSettings?.maxDurationMinutes ?? 5}
              startTime={gameBreakStartTime}
              onComplete={handleGameBreakEnd}
              selectionMode={gameBreakSettings?.selectionMode ?? 'kid-chooses'}
              selectedGame={gameBreakSettings?.selectedGame ?? null}
              gameConfig={gameBreakGameConfig}
              enabledGames={gameBreakSettings?.enabledGames}
              onGameSelected={handleGameBreakStarted}
              onBreakContextChange={setBreakContext}
              readyObservers={readyObservers}
            />
          ) : (
            <AbacusNoticeGate
              plan={currentPlan}
              student={{ name: player.name, emoji: player.emoji, color: player.color }}
              enabled={!isBrowseMode}
              // A pause asked for during the notice waits for ActiveSession,
              // which mounts after it; the countdown holds meanwhile
              paused={manualPauseRequest || (teacherPauseRequest !== null && !teacherResumeRequest)}
              onShown={handleAbacusNoticeShown}
              onEnded={sendPartTransitionComplete}
            >
              <ActiveSession
                plan={currentPlan}
                historicalResults={historicalResults}
                student={{
                  id: player.id,
                  name: player.name,
                  emoji: player.emoji,
                  color: player.color,
                }}
                onAnswer={handleAnswer}
                onEndEarly={handleEndEarly}
                onPause={() => setIsPaused(true)}
                onResume={handleResume}
                onTimingUpdate={setTimingData}
                onBroadcastStateChange={setBroadcastState}
                isBrowseMode={isBrowseMode}
                browseIndex={browseIndex}
                onBrowseIndexChange={setBrowseIndex}
                teacherControl={teacherControl}
                onTeacherControlHandled={() => setTeacherControl(null)}
                teacherPauseRequest={teacherPauseRequest}
                onTeacherPauseHandled={() => setTeacherPauseRequest(null)}
                teacherResumeRequest={teacherResumeRequest}
                onTeacherResumeHandled={() => setTeacherResumeRequest(false)}
                manualPauseRequest={manualPauseRequest}
                onManualPauseHandled={() => setManualPauseRequest(false)}
                redoState={redoState}
                resyncRequest={resyncRequest}
                onRecordRedo={handleRecordRedo}
                onRedoComplete={() => setRedoState(null)}
                onCancelRedo={handleCancelRedo}
                onResultEdited={() => {
                  // Invalidate the session plan query to refetch updated results
                  queryClient.invalidateQueries({
                    queryKey: sessionPlanKeys.active(studentId),
                  })
                }}
              />
            </AbacusNoticeGate>
          )}
          {transitionKey && transitionParts && transitionShown?.key === transitionKey && (
            <PartTransitionScreen
              key={transitionShown.key}
              isVisible
              previous={transitionParts.previous}
              next={transitionParts.next}
              abacusNotice={transitionParts.abacusNotice}
              countdownStartTime={transitionShown.countdownStartTime}
              student={{ name: player.name, emoji: player.emoji, color: player.color }}
              onComplete={handleTransitionScreenDone}
            />
          )}
        </PracticeErrorBoundary>
      </main>

      {/* Debug panel for socket broadcast state - only visible when visual debug is enabled */}
      <BroadcastDebugPanel
        isConnected={broadcastConnected}
        isBroadcasting={isBroadcasting}
        isRecording={isRecording}
        sessionId={currentPlan.id}
        playerId={studentId}
        recordingId={recordingId}
        broadcastState={
          practiceBroadcast ? { ...practiceBroadcast, ...practiceBroadcast.position } : null
        }
      />
    </PageWithNav>
  )
}
