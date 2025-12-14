'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useMemo, useState } from 'react'
import { PageWithNav } from '@/components/PageWithNav'
import {
  ActiveSession,
  type AttemptTimingData,
  PracticeErrorBoundary,
  PracticeSubNav,
  type SessionHudData,
} from '@/components/practice'
import type { Player } from '@/db/schema/players'
import type { SessionHealth, SessionPart, SessionPlan, SlotResult } from '@/db/schema/session-plans'
import {
  useActiveSessionPlan,
  useEndSessionEarly,
  useRecordSlotResult,
} from '@/hooks/useSessionPlan'
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

  // Track pause state for HUD display (ActiveSession owns the modal and actual pause logic)
  const [isPaused, setIsPaused] = useState(false)
  // Track timing data from ActiveSession for the sub-nav HUD
  const [timingData, setTimingData] = useState<AttemptTimingData | null>(null)
  // Browse mode state - lifted here so PracticeSubNav can trigger it
  const [isBrowseMode, setIsBrowseMode] = useState(false)
  // Browse index - lifted for navigation from SessionProgressIndicator
  const [browseIndex, setBrowseIndex] = useState(0)

  // Session plan mutations
  const recordResult = useRecordSlotResult()
  const endEarly = useEndSessionEarly()

  // Fetch active session plan from cache or API with server data as initial
  const { data: fetchedPlan } = useActiveSessionPlan(studentId, initialSession)

  // Current plan - mutations take priority, then fetched/cached data
  const currentPlan = endEarly.data ?? recordResult.data ?? fetchedPlan ?? initialSession

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

  // Pause/resume handlers - just update HUD state (ActiveSession owns the modal)
  const handlePause = useCallback(() => {
    setIsPaused(true)
  }, [])

  const handleResume = useCallback(() => {
    setIsPaused(false)
  }, [])

  // Handle recording an answer
  const handleAnswer = useCallback(
    async (result: Omit<SlotResult, 'timestamp' | 'partNumber'>): Promise<void> => {
      const updatedPlan = await recordResult.mutateAsync({
        playerId: studentId,
        planId: currentPlan.id,
        result,
      })

      // If session just completed, redirect to summary
      if (updatedPlan.completedAt) {
        router.push(`/practice/${studentId}/summary`, { scroll: false })
      }
    },
    [studentId, currentPlan.id, recordResult, router]
  )

  // Handle ending session early
  const handleEndEarly = useCallback(
    async (reason?: string) => {
      await endEarly.mutateAsync({
        playerId: studentId,
        planId: currentPlan.id,
        reason,
      })
      // Redirect to summary after ending early
      router.push(`/practice/${studentId}/summary`, { scroll: false })
    },
    [studentId, currentPlan.id, endEarly, router]
  )

  // Handle session completion (called by ActiveSession when all problems done)
  const handleSessionComplete = useCallback(() => {
    // Redirect to summary
    router.push(`/practice/${studentId}/summary`, { scroll: false })
  }, [studentId, router])

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
        isBrowseMode,
        onToggleBrowse: () => setIsBrowseMode((prev) => !prev),
        onBrowseNavigate: setBrowseIndex,
      }
    : undefined

  return (
    <PageWithNav>
      {/* Practice Sub-Navigation with Session HUD */}
      <PracticeSubNav student={player} pageContext="session" sessionHud={sessionHud} />

      <main
        data-component="practice-page"
        className={css({
          minHeight: 'calc(100vh - 140px)', // Full height minus nav and sub-nav
        })}
      >
        <PracticeErrorBoundary studentName={player.name}>
          <ActiveSession
            plan={currentPlan}
            student={{ name: player.name, emoji: player.emoji, color: player.color }}
            onAnswer={handleAnswer}
            onEndEarly={handleEndEarly}
            onPause={handlePause}
            onResume={handleResume}
            onComplete={handleSessionComplete}
            onTimingUpdate={setTimingData}
            isBrowseMode={isBrowseMode}
            browseIndex={browseIndex}
            onBrowseIndexChange={setBrowseIndex}
          />
        </PracticeErrorBoundary>
      </main>
    </PageWithNav>
  )
}
