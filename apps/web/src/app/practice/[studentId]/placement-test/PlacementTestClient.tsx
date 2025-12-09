'use client'

import { useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { PageWithNav } from '@/components/PageWithNav'
import { PlacementTest } from '@/components/practice/PlacementTest'

interface PlacementTestClientProps {
  studentId: string
  playerName: string
}

/**
 * Client component for placement test page
 *
 * Wraps the PlacementTest component and handles navigation
 * on completion or cancellation.
 */
export function PlacementTestClient({ studentId, playerName }: PlacementTestClientProps) {
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
      router.push(`/practice/${studentId}`)
    },
    [studentId, router]
  )

  const handleCancel = useCallback(() => {
    router.push(`/practice/${studentId}`)
  }, [studentId, router])

  return (
    <PageWithNav>
      <PlacementTest
        studentName={playerName}
        playerId={studentId}
        onComplete={handleComplete}
        onCancel={handleCancel}
      />
    </PageWithNav>
  )
}
