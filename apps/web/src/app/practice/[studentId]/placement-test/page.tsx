import { notFound } from 'next/navigation'
import { getPlayer } from '@/lib/curriculum/server'
import { PlacementTestClient } from './PlacementTestClient'

interface PlacementTestPageProps {
  params: Promise<{ studentId: string }>
}

/**
 * Placement Test Page - Server Component
 *
 * Orthogonal to session state - can be accessed anytime.
 * Results are saved and user is redirected to main practice page on completion.
 *
 * URL: /practice/[studentId]/placement-test
 */
export default async function PlacementTestPage({ params }: PlacementTestPageProps) {
  const { studentId } = await params

  const player = await getPlayer(studentId)

  // 404 if player doesn't exist
  if (!player) {
    notFound()
  }

  return <PlacementTestClient studentId={studentId} player={player} />
}
