import { notFound } from 'next/navigation'
import { canPerformAction } from '@/lib/classroom/access-control'
import { getPracticeStudent } from '@/lib/curriculum/server'
import { getUserId } from '@/lib/viewer'
import { ReviewTimingsClient } from './ReviewTimingsClient'

// Session/timing data must always be fresh (repairs self-correct at read time).
export const dynamic = 'force-dynamic'

interface ReviewTimingsPageProps {
  params: Promise<{ studentId: string }>
  searchParams: Promise<{ session?: string }>
}

/**
 * Timing Review Page — Server Component (#158).
 *
 * The single review destination (shared contract). Lists every flagged
 * (unusual/interrupted) timing across the student's recent sessions at the
 * player level, with per-attempt repair actions and a live estimate-recovery
 * header. Gated on `repair-data` (parent or teacher-present) to match the write
 * side — the whole page is a repair tool.
 *
 * URL: /practice/[studentId]/review-timings (optional ?session=<id> focus)
 */
export default async function ReviewTimingsPage({ params, searchParams }: ReviewTimingsPageProps) {
  const { studentId } = await params
  const { session } = await searchParams

  const player = await getPracticeStudent(studentId)
  if (!player) {
    notFound()
  }

  const viewerId = await getUserId()
  const canReview = await canPerformAction(viewerId, studentId, 'repair-data')
  if (!canReview) {
    // 404 rather than 403 to avoid leaking the player's existence.
    notFound()
  }

  return (
    <ReviewTimingsClient
      studentId={studentId}
      playerName={player.name}
      playerEmoji={player.emoji}
      focusSessionId={session}
    />
  )
}
