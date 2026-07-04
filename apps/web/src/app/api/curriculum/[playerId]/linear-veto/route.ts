/**
 * API route for linear-readiness vetoes (L3)
 *
 * GET    /api/curriculum/[playerId]/linear-veto - derived linear-ready categories + veto state
 * POST   /api/curriculum/[playerId]/linear-veto - veto a category  { category, reason? }
 * DELETE /api/curriculum/[playerId]/linear-veto - lift a veto      { category }
 */

import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/withAuth'
import { canPerformAction } from '@/lib/classroom'
import { getUserId } from '@/lib/viewer'
import { SKILL_CATEGORIES } from '@/constants/skillCategories'
import { clearLinearReadinessVeto, setLinearReadinessVeto } from '@/lib/curriculum/progress-manager'
import { getLinearReadinessState } from '@/lib/curriculum/linear-readiness-service'

function isValidCategory(value: unknown): value is string {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(SKILL_CATEGORIES, value)
}

async function authorize(
  params: Promise<unknown> | unknown
): Promise<{ playerId: string } | NextResponse> {
  const { playerId } = (await params) as { playerId: string }
  if (!playerId) return NextResponse.json({ error: 'Player ID required' }, { status: 400 })
  const userId = await getUserId()
  const canModify = await canPerformAction(userId, playerId, 'start-session')
  if (!canModify) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  return { playerId }
}

/** GET - derived linear-ready categories (with veto flags) for this student */
export const GET = withAuth(async (_request, { params }) => {
  try {
    const auth = await authorize(params)
    if (auth instanceof NextResponse) return auth
    const state = await getLinearReadinessState(auth.playerId)
    return NextResponse.json(state)
  } catch (error) {
    console.error('Error loading linear-readiness state:', error)
    return NextResponse.json({ error: 'Failed to load linear-readiness state' }, { status: 500 })
  }
})

/** POST - veto a skill category off number sentences */
export const POST = withAuth(async (request, { params }) => {
  try {
    const auth = await authorize(params)
    if (auth instanceof NextResponse) return auth

    const body = await request.json()
    const { category, reason } = body
    if (!isValidCategory(category)) {
      return NextResponse.json({ error: 'Invalid skill category' }, { status: 400 })
    }
    if (reason != null && typeof reason !== 'string') {
      return NextResponse.json({ error: 'reason must be a string' }, { status: 400 })
    }

    await setLinearReadinessVeto(auth.playerId, category, reason ?? undefined)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error setting linear-readiness veto:', error)
    return NextResponse.json({ error: 'Failed to set veto' }, { status: 500 })
  }
})

/** DELETE - lift a category veto */
export const DELETE = withAuth(async (request, { params }) => {
  try {
    const auth = await authorize(params)
    if (auth instanceof NextResponse) return auth

    const body = await request.json()
    const { category } = body
    if (!isValidCategory(category)) {
      return NextResponse.json({ error: 'Invalid skill category' }, { status: 400 })
    }

    await clearLinearReadinessVeto(auth.playerId, category)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error clearing linear-readiness veto:', error)
    return NextResponse.json({ error: 'Failed to clear veto' }, { status: 500 })
  }
})
