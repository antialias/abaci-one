import { notFound, redirect } from 'next/navigation'
import { canPerformAction, isParentOf } from '@/lib/classroom'
import { getActiveSessionPlan, getPlayer } from '@/lib/curriculum/server'
import type { ActiveSessionInfo } from '@/hooks/useClassroom'
import { getDbUserId } from '@/lib/viewer'
import { ObservationClient } from './ObservationClient'

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

  const [canObserve, isParent] = await Promise.all([
    canPerformAction(observerId, studentId, 'observe'),
    isParentOf(observerId, studentId),
  ])
  if (!canObserve) {
    notFound()
  }

  if (!activeSession || !activeSession.startedAt || activeSession.completedAt) {
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
    startedAt: activeSession.startedAt as string,
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
