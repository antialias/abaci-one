import { notFound, redirect } from 'next/navigation'
import { isEndedOutcome, sessionOutcome } from '@/db/schema/session-plan-normalize'
import { getPlayerAccess, isParentOf } from '@/lib/classroom'
import { getActiveSessionPlan, getPracticeStudent } from '@/lib/curriculum/server'
import { getUserId } from '@/lib/viewer'
import { ObservationClient } from './ObservationClient'
import { StudentNotPresentPage } from './StudentNotPresentPage'

export const dynamic = 'force-dynamic'

interface ObservationPageProps {
  params: Promise<{ studentId: string }>
}

export default async function PracticeObservationPage({ params }: ObservationPageProps) {
  const { studentId } = await params
  const [observerId, player, activeSession] = await Promise.all([
    getUserId(),
    getPracticeStudent(studentId),
    getActiveSessionPlan(studentId),
  ])

  if (!player) {
    notFound()
  }

  const [access, isParent] = await Promise.all([
    getPlayerAccess(observerId, studentId),
    isParentOf(observerId, studentId),
  ])

  // Check if user can observe (parent or teacher-present)
  const canObserve = access.isParent || access.isPresent

  if (!canObserve) {
    // If they're a teacher but student isn't present, show helpful message
    if (access.isTeacher && access.classroomId) {
      return (
        <StudentNotPresentPage
          studentName={player.name}
          studentEmoji={player.emoji}
          studentId={studentId}
          classroomId={access.classroomId}
        />
      )
    }
    // Otherwise, they have no relationship to this student
    notFound()
  }

  // No session, or not started yet: back to the dashboard
  const outcome = activeSession ? sessionOutcome(activeSession) : null
  if (!activeSession || (outcome !== 'in_progress' && !isEndedOutcome(outcome!))) {
    redirect(`/practice/${studentId}/dashboard`)
  }

  // The view reads everything it shows from the session report (Phase 4c);
  // an ended session shows the ended view with a link to the full report
  return (
    <ObservationClient
      session={{ sessionId: activeSession.id, playerId: activeSession.playerId }}
      observerId={observerId}
      student={{
        name: player.name,
        emoji: player.emoji,
        color: player.color,
      }}
      studentId={studentId}
      isParent={isParent}
      sessionReportUrl={`/practice/${studentId}/session/${activeSession.id}`}
    />
  )
}
