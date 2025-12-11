'use client'

import { useRouter } from 'next/navigation'
import { useCallback } from 'react'
import { PageWithNav } from '@/components/PageWithNav'
import { PracticeSubNav } from '@/components/practice'
import { PlacementTest } from '@/components/practice/PlacementTest'
import type { Player } from '@/db/schema/players'

interface PlacementTestClientProps {
  studentId: string
  player: Player
}

/**
 * Client component for placement test page
 *
 * Wraps the PlacementTest component and handles navigation
 * on completion or cancellation.
 */
export function PlacementTestClient({ studentId, player }: PlacementTestClientProps) {
  const router = useRouter()

  const handleComplete = useCallback(
    (results: {
      masteredSkillIds: string[]
      practicingSkillIds: string[]
      totalProblems: number
      totalCorrect: number
    }) => {
      // TODO: Save results to curriculum via API
      console.log('Placement test complete:', results)
      // Return to main practice page
      router.push(`/practice/${studentId}`, { scroll: false })
    },
    [studentId, router]
  )

  const handleCancel = useCallback(() => {
    router.push(`/practice/${studentId}`, { scroll: false })
  }, [studentId, router])

  return (
    <PageWithNav>
      {/* Practice Sub-Navigation */}
      <PracticeSubNav student={player} pageContext="placement-test" />

      <PlacementTest
        studentName={player.name}
        playerId={studentId}
        onComplete={handleComplete}
        onCancel={handleCancel}
      />
    </PageWithNav>
  )
}
