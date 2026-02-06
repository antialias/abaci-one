import { notFound, redirect } from 'next/navigation'
import { getPlayerAccess, isParentOf } from '@/lib/classroom'
import { getActiveSessionPlan, getPlayer } from '@/lib/curriculum/server'
import type { ActiveSessionInfo } from '@/hooks/useClassroom'
import { getDbUserId } from '@/lib/viewer'
import { ObservationClient } from './ObservationClient'
import { StudentNotPresentPage } from './StudentNotPresentPage'

export const dynamic = 'force-dynamic'

interface ObservationPageProps {
  params: Promise<{ studentId: string }>
}

export default async function PracticeObservationPage({ params }: ObservationPageProps) {
  const { studentId } = await params
  const [observerId, player, activeSession] = await Promise.all([
    getDbUserId(),
    getPlayer(studentId),
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

  // If session is completed, show the observation page with a banner linking to the report
  if (activeSession?.completedAt) {
    return (
      <ObservationClient
        session={{
          sessionId: activeSession.id,
          playerId: activeSession.playerId,
          startedAt: activeSession.startedAt!.toISOString(),
          currentPartIndex: activeSession.currentPartIndex,
          currentSlotIndex: activeSession.currentSlotIndex,
          totalParts: activeSession.parts.length,
          totalProblems: activeSession.parts.reduce((sum, part) => sum + part.slots.length, 0),
          completedProblems: activeSession.parts.reduce((sum, part) => sum + part.slots.length, 0),
        }}
        observerId={observerId}
        student={{
          name: player.name,
          emoji: player.emoji,
          color: player.color,
        }}
        studentId={studentId}
        isParent={isParent}
        sessionReportUrl={`/practice/${studentId}/session/${activeSession.id}`}
        sessionEnded
      />
    )
  }

  // If no active session or session hasn't started, go to dashboard
  if (!activeSession || !activeSession.startedAt) {
    redirect(`/practice/${studentId}/dashboard`)
  }

  const totalProblems = activeSession.parts.reduce((sum, part) => sum + part.slots.length, 0)
  let completedProblems = 0
  for (let i = 0; i < activeSession.currentPartIndex; i++) {
    completedProblems += activeSession.parts[i]?.slots.length ?? 0
  }
  completedProblems += activeSession.currentSlotIndex

  const session: ActiveSessionInfo = {
    sessionId: activeSession.id,
    playerId: activeSession.playerId,
    startedAt: activeSession.startedAt!.toISOString(),
    currentPartIndex: activeSession.currentPartIndex,
    currentSlotIndex: activeSession.currentSlotIndex,
    totalParts: activeSession.parts.length,
    totalProblems,
    completedProblems,
  }

  return (
    <ObservationClient
      session={session}
      observerId={observerId}
      student={{
        name: player.name,
        emoji: player.emoji,
        color: player.color,
      }}
      studentId={studentId}
      isParent={isParent}
    />
  )
}
