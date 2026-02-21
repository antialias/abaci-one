import { NextResponse } from 'next/server'
import { and, eq, inArray } from 'drizzle-orm'
import { db } from '@/db'
import { sessionPlans, type SessionPart, type SlotResult } from '@/db/schema/session-plans'
import { withAuth } from '@/lib/auth/withAuth'
import { canPerformAction } from '@/lib/classroom'
import { getUserId } from '@/lib/viewer'

/**
 * GET /api/players/[id]/active-session
 *
 * Returns the active session for a player (if any).
 * Requires 'view' permission (parent or teacher relationship).
 *
 * Response:
 * - { session: null } if no active session
 * - { session: { sessionId, status, completedProblems, totalProblems } } if active
 */
export const GET = withAuth(async (_request, { params }) => {
  try {
    const { id: playerId } = (await params) as { id: string }

    if (!playerId) {
      return NextResponse.json({ error: 'Player ID required' }, { status: 400 })
    }

    // Authorization: require 'view' permission (parent or teacher)
    const userId = await getUserId()
    const canView = await canPerformAction(userId, playerId, 'view')
    if (!canView) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    // Find active session (started but not completed/abandoned)
    const activeStatuses = ['approved', 'in_progress'] as const
    const activePlan = await db
      .select({
        id: sessionPlans.id,
        status: sessionPlans.status,
        parts: sessionPlans.parts,
        results: sessionPlans.results,
      })
      .from(sessionPlans)
      .where(
        and(eq(sessionPlans.playerId, playerId), inArray(sessionPlans.status, [...activeStatuses]))
      )
      .orderBy(sessionPlans.createdAt)
      .limit(1)
      .then((rows) => rows[0])

    if (!activePlan) {
      return NextResponse.json({ session: null })
    }

    // Calculate progress - parts is an array of SessionPart, each with slots
    const parts = (activePlan.parts as SessionPart[]) || []
    const results = (activePlan.results as SlotResult[]) || []
    const totalProblems = parts.reduce((sum, part) => sum + part.slots.length, 0)
    const completedProblems = results.length

    return NextResponse.json({
      session: {
        sessionId: activePlan.id,
        status: activePlan.status,
        completedProblems,
        totalProblems,
      },
    })
  } catch (error) {
    console.error('Error fetching active session:', error)
    return NextResponse.json({ error: 'Failed to fetch active session' }, { status: 500 })
  }
})
