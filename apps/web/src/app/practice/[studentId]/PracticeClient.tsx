'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useToast } from '@/components/common/ToastContext'
import { useMyAbacus } from '@/contexts/MyAbacusContext'
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
import { GameBreakScreen } from '@/components/practice/GameBreakScreen'
import { GameBreakResultsScreen } from '@/components/practice/GameBreakResultsScreen'
import type { GameResultsReport } from '@/lib/arcade/game-sdk/types'
import type { Player } from '@/db/schema/players'
import type {
  GameBreakSettings,
  SessionHealth,
  SessionPart,
  SessionPlan,
  SlotResult,
} from '@/db/schema/session-plans'

/**
 * State for redoing a previously completed problem
 * Allows students to tap any completed problem dot to practice it again
 */
export interface RedoState {
  /** Whether redo mode is currently active */
  isActive: boolean
  /** Linear index of the problem being redone (flat across all parts) */
  linearIndex: number
  /** Part index containing the redo problem */
  originalPartIndex: number
  /** Slot index within the part */
  originalSlotIndex: number
  /** The original result (to check if it was correct) */
  originalResult: SlotResult
  /** Part index to return to after redo */
  returnToPartIndex: number
  /** Slot index to return to after redo */
  returnToSlotIndex: number
}
import {
  type ReceivedAbacusControl,
  type TeacherPauseRequest,
  useSessionBroadcast,
} from '@/hooks/useSessionBroadcast'
import {
  sessionPlanKeys,
  useActiveSessionPlan,
  useEndSessionEarly,
  useRecordRedoResult,
  useRecordSlotResult,
} from '@/hooks/useSessionPlan'
import { useQueryClient } from '@tanstack/react-query'
import { useSaveGameResult } from '@/hooks/useGameResults'
import { css } from '../../../../styled-system/css'

interface PracticeClientProps {
  studentId: string
  player: Player
  initialSession: SessionPlan
}

/**
 * Practice Client Component
 *
 * This component ONLY shows the current problem.
 * It assumes the session is in_progress (server guards ensure this).
 *
 * When the session completes, it redirects to /summary.
 */
export function PracticeClient({ studentId, player, initialSession }: PracticeClientProps) {
  const router = useRouter()
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
  // Game break state
  const [showGameBreak, setShowGameBreak] = useState(false)
  const [gameBreakStartTime, setGameBreakStartTime] = useState<number>(Date.now())
  // Track pending game break - set when part transition happens, triggers after transition screen
  const [pendingGameBreak, setPendingGameBreak] = useState(false)
  // Game break results - captured when game completes to show on interstitial screen
  const [gameBreakResults, setGameBreakResults] = useState<GameResultsReport | null>(null)
  // Show results interstitial before returning to practice
  const [showGameBreakResults, setShowGameBreakResults] = useState(false)
  // Track previous part index to detect part transitions
  const previousPartIndexRef = useRef<number>(initialSession.currentPartIndex)
  // Redo state - allows students to re-attempt any completed problem
  const [redoState, setRedoState] = useState<RedoState | null>(null)

  // Dev shortcut: Ctrl+Shift+G to trigger game break for testing
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'G') {
        e.preventDefault()
        setShowGameBreak((prev) => {
          if (!prev) {
            setGameBreakStartTime(Date.now())
          }
          return !prev
        })
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Session plan mutations
  const recordResult = useRecordSlotResult()
  const recordRedo = useRecordRedoResult()
  const endEarly = useEndSessionEarly()

  // Game results mutation - saves to scoreboard when game break completes
  const saveGameResult = useSaveGameResult()

  // Fetch active session plan from cache or API with server data as initial
  const { data: fetchedPlan } = useActiveSessionPlan(studentId, initialSession)

  // Current plan - mutations take priority, then fetched/cached data
  const currentPlan = endEarly.data ?? recordResult.data ?? fetchedPlan ?? initialSession

  // Game break settings from the session plan
  const gameBreakSettings = currentPlan.gameBreakSettings as GameBreakSettings | null

  // Build game config with skipSetupPhase merged into each game's config
  // This allows games to start immediately without showing their setup screen
  const gameBreakGameConfig = useMemo(() => {
    const baseConfig = gameBreakSettings?.gameConfig ?? {}
    const skipSetup = gameBreakSettings?.skipSetupPhase ?? true // Default to true for practice breaks

    if (!skipSetup) {
      return baseConfig
    }

    // Merge skipSetupPhase into each game's config
    const mergedConfig: Record<string, Record<string, unknown>> = {}
    for (const [gameName, config] of Object.entries(baseConfig)) {
      mergedConfig[gameName] = { ...config, skipSetupPhase: true }
    }

    // Also add skipSetupPhase for the selected game if not already in config
    const selectedGame = gameBreakSettings?.selectedGame
    if (selectedGame && selectedGame !== 'random' && !mergedConfig[selectedGame]) {
      mergedConfig[selectedGame] = { skipSetupPhase: true }
    }

    return mergedConfig
  }, [
    gameBreakSettings?.gameConfig,
    gameBreakSettings?.skipSetupPhase,
    gameBreakSettings?.selectedGame,
  ])

  // Compute HUD data from current plan
  const currentPart = currentPlan.parts[currentPlan.currentPartIndex] as SessionPart | undefined
  const sessionHealth = currentPlan.sessionHealth as SessionHealth | null

  // Calculate totals
  const { totalProblems, completedProblems } = useMemo(() => {
    const total = currentPlan.parts.reduce((sum, part) => sum + part.slots.length, 0)
    let completed = 0
    for (let i = 0; i < currentPlan.currentPartIndex; i++) {
      completed += currentPlan.parts[i].slots.length
    }
    completed += currentPlan.currentSlotIndex
    return { totalProblems: total, completedProblems: completed }
  }, [currentPlan.parts, currentPlan.currentPartIndex, currentPlan.currentSlotIndex])

  // Pause handler - triggers manual pause in ActiveSession
  const handlePause = useCallback(() => {
    setManualPauseRequest(true)
  }, [])

  const handleResume = useCallback(() => {
    setIsPaused(false)
  }, [])

  // Handle recording an answer
  const handleAnswer = useCallback(
    async (result: Omit<SlotResult, 'timestamp' | 'partNumber'>): Promise<void> => {
      try {
        const previousPartIndex = previousPartIndexRef.current
        const updatedPlan = await recordResult.mutateAsync({
          playerId: studentId,
          planId: currentPlan.id,
          result,
        })

        // Update previous part index tracking
        previousPartIndexRef.current = updatedPlan.currentPartIndex

        // If session just completed, redirect to summary with completed flag
        if (updatedPlan.completedAt) {
          router.push(`/practice/${studentId}/summary?completed=1`, {
            scroll: false,
          })
          return
        }

        // Check for part transition - queue game break to show AFTER transition screen
        const partTransitioned = updatedPlan.currentPartIndex > previousPartIndex
        const hasMoreParts = updatedPlan.currentPartIndex < updatedPlan.parts.length
        const gameBreakEnabled =
          (updatedPlan.gameBreakSettings as GameBreakSettings | null)?.enabled ?? false

        if (partTransitioned && hasMoreParts && gameBreakEnabled) {
          console.log(
            `[PracticeClient] Part completed (${previousPartIndex} → ${updatedPlan.currentPartIndex}), queuing game break for after transition screen`
          )
          // Don't show game break immediately - wait for transition screen to complete
          // The game break will be triggered when onPartTransitionComplete is called
          setPendingGameBreak(true)
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        if (message.includes('Not authorized')) {
          showError(
            'Not authorized',
            'Only parents or teachers with the student present in their classroom can record answers.'
          )
        } else {
          showError('Failed to record answer', message)
        }
      }
    },
    [studentId, currentPlan.id, recordResult, router, showError]
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

  // Handle session completion (called by ActiveSession when all problems done)
  const handleSessionComplete = useCallback(() => {
    // Redirect to summary with completed flag
    router.push(`/practice/${studentId}/summary?completed=1`, {
      scroll: false,
    })
  }, [studentId, router])

  // Handle redoing a previously completed problem
  // Called when student taps a completed problem dot in the progress indicator
  const handleRedoProblem = useCallback(
    (linearIndex: number, originalResult: SlotResult) => {
      // Find the part and slot for this linear index
      let partIndex = 0
      let remaining = linearIndex
      for (let i = 0; i < currentPlan.parts.length; i++) {
        const partSlotCount = currentPlan.parts[i].slots.length
        if (remaining < partSlotCount) {
          partIndex = i
          break
        }
        remaining -= partSlotCount
      }
      const slotIndex = remaining

      // Exit browse mode if active
      if (isBrowseMode) {
        setIsBrowseMode(false)
      }

      // Set redo state
      setRedoState({
        isActive: true,
        linearIndex,
        originalPartIndex: partIndex,
        originalSlotIndex: slotIndex,
        originalResult,
        returnToPartIndex: currentPlan.currentPartIndex,
        returnToSlotIndex: currentPlan.currentSlotIndex,
      })
    },
    [currentPlan.parts, currentPlan.currentPartIndex, currentPlan.currentSlotIndex, isBrowseMode]
  )

  // Handle canceling a redo - exit without recording
  const handleCancelRedo = useCallback(() => {
    setRedoState(null)
  }, [])

  // Handle game break end - show results screen if game finished normally
  const handleGameBreakEnd = useCallback(
    (reason: 'timeout' | 'gameFinished' | 'skipped', results?: GameResultsReport) => {
      setShowGameBreak(false)

      // If game finished normally with results, save to scoreboard and show interstitial
      if (reason === 'gameFinished' && results) {
        // Save result to database for scoreboard
        saveGameResult.mutate({
          playerId: player.id,
          sessionType: 'practice-break',
          sessionId: currentPlan.id,
          report: results,
        })

        setGameBreakResults(results)
        setShowGameBreakResults(true)
      } else {
        // Timeout or skip - no results to show, return to practice immediately
        setGameBreakResults(null)
      }
    },
    [saveGameResult, player.id, currentPlan.id]
  )

  // Handle results screen completion - return to practice
  const handleGameBreakResultsComplete = useCallback(() => {
    setShowGameBreakResults(false)
    setGameBreakResults(null)
  }, [])

  // Broadcast session state if student is in a classroom
  // broadcastState is updated by ActiveSession via the onBroadcastStateChange callback
  // onAbacusControl receives control events from observing teacher
  // onTeacherPause/onTeacherResume receive pause/resume commands from teacher
  const { sendPartTransition, sendPartTransitionComplete, sendVisionFrame } = useSessionBroadcast(
    currentPlan.id,
    studentId,
    broadcastState,
    {
      onAbacusControl: setTeacherControl,
      onTeacherPause: setTeacherPauseRequest,
      onTeacherResume: () => setTeacherResumeRequest(true),
    }
  )

  // Handle part transition complete - called when transition screen finishes
  // This is where we trigger game break (after "put away abacus" message is shown)
  const handlePartTransitionComplete = useCallback(() => {
    // First, broadcast to observers
    sendPartTransitionComplete()

    // Then, check if we have a pending game break
    if (pendingGameBreak) {
      console.log('[PracticeClient] Transition screen complete, now showing game break')
      setGameBreakStartTime(Date.now())
      setShowGameBreak(true)
      setPendingGameBreak(false)
    }
  }, [sendPartTransitionComplete, pendingGameBreak])

  // Wire vision frame callback to broadcast vision frames to observers
  useEffect(() => {
    setVisionFrameCallback((frame) => {
      sendVisionFrame(frame.imageData, frame.detectedValue, frame.confidence)
    })

    return () => {
      setVisionFrameCallback(null)
    }
  }, [setVisionFrameCallback, sendVisionFrame])

  // Build session HUD data for PracticeSubNav
  const sessionHud: SessionHudData | undefined = currentPart
    ? {
        isPaused,
        parts: currentPlan.parts,
        currentPartIndex: currentPlan.currentPartIndex,
        currentPart: {
          type: currentPart.type,
          partNumber: currentPart.partNumber,
          totalSlots: currentPart.slots.length,
        },
        currentSlotIndex: currentPlan.currentSlotIndex,
        results: currentPlan.results,
        completedProblems,
        totalProblems,
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
        onRedoProblem: redoState ? undefined : handleRedoProblem, // Disable redo when already in redo mode
        redoLinearIndex: redoState?.linearIndex,
        plan: currentPlan,
      }
    : undefined

  // Build game break HUD data for PracticeSubNav (when on game break)
  const gameBreakHud: GameBreakHudData | undefined = showGameBreak
    ? {
        startTime: gameBreakStartTime,
        maxDurationMs: (gameBreakSettings?.maxDurationMinutes ?? 5) * 60 * 1000,
        onSkip: handleGameBreakEnd,
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
      />

      <main
        data-component="practice-page"
        className={css({
          // Fixed positioning to precisely control bounds
          position: 'fixed',
          // Top: main nav (80px) + sub-nav height (~52px mobile, ~60px desktop)
          top: { base: '132px', md: '140px' },
          left: 0,
          // Right: 0 by default, landscape mobile handled via media query below
          right: 0,
          // Bottom: keypad height on mobile portrait (48px), 0 on desktop
          // Landscape mobile handled via media query below
          bottom: { base: '48px', md: 0 },
          overflow: 'hidden', // Prevent scrolling during practice
        })}
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
            />
          ) : (
            <ActiveSession
              plan={currentPlan}
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
              onComplete={handleSessionComplete}
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
              onPartTransition={sendPartTransition}
              onPartTransitionComplete={handlePartTransitionComplete}
              redoState={redoState}
              onRecordRedo={recordRedo.mutateAsync}
              onRedoComplete={() => setRedoState(null)}
              onCancelRedo={handleCancelRedo}
              onResultEdited={() => {
                // Invalidate the session plan query to refetch updated results
                queryClient.invalidateQueries({
                  queryKey: sessionPlanKeys.active(studentId),
                })
              }}
            />
          )}
        </PracticeErrorBoundary>
      </main>
    </PageWithNav>
  )
}
