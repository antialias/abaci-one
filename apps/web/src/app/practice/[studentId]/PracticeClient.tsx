'use client'

import { useRouter } from 'next/navigation'
import { useCallback } from 'react'
import { PageWithNav } from '@/components/PageWithNav'
import { ActiveSession, PracticeErrorBoundary } from '@/components/practice'
import type { Player } from '@/db/schema/players'
import type { SessionPlan, SlotResult } from '@/db/schema/session-plans'
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

  // Session plan mutations
  const recordResult = useRecordSlotResult()
  const endEarly = useEndSessionEarly()

  // Fetch active session plan from cache or API with server data as initial
  const { data: fetchedPlan } = useActiveSessionPlan(studentId, initialSession)

  // Current plan - mutations take priority, then fetched/cached data
  const currentPlan = endEarly.data ?? recordResult.data ?? fetchedPlan ?? initialSession

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

  return (
    <PageWithNav>
      <main
        data-component="practice-page"
        className={css({
          minHeight: 'calc(100vh - 80px)', // Full height minus nav
          marginTop: '80px', // Push below nav
        })}
      >
        <PracticeErrorBoundary studentName={player.name}>
          <ActiveSession
            plan={currentPlan}
            studentName={player.name}
            onAnswer={handleAnswer}
            onEndEarly={handleEndEarly}
            onComplete={handleSessionComplete}
          />
        </PracticeErrorBoundary>
      </main>
    </PageWithNav>
  )
}
