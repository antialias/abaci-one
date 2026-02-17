import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { euclidProgress } from '@/db/schema/euclid-progress'
import { canPerformAction } from '@/lib/classroom'
import { getDbUserId } from '@/lib/viewer'

interface RouteParams {
  params: Promise<{ playerId: string }>
}

/**
 * GET - Fetch completed proposition IDs for a player
 */
export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { playerId } = await params
    if (!playerId) {
      return NextResponse.json({ error: 'Player ID required' }, { status: 400 })
    }

    const userId = await getDbUserId()
    const canView = await canPerformAction(userId, playerId, 'view')
    if (!canView) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    const rows = await db
      .select({ propositionId: euclidProgress.propositionId })
      .from(euclidProgress)
      .where(eq(euclidProgress.playerId, playerId))

    const completed = rows.map(r => r.propositionId)

    return NextResponse.json({ completed })
  } catch (error) {
    console.error('Error fetching euclid progress:', error)
    return NextResponse.json({ error: 'Failed to fetch progress' }, { status: 500 })
  }
}

/**
 * POST - Mark a proposition as completed (idempotent upsert)
 */
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { playerId } = await params
    if (!playerId) {
      return NextResponse.json({ error: 'Player ID required' }, { status: 400 })
    }

    const userId = await getDbUserId()
    const canAct = await canPerformAction(userId, playerId, 'start-session')
    if (!canAct) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    const body = await request.json()
    const propositionId = body.propositionId
    if (typeof propositionId !== 'number' || propositionId < 1 || propositionId > 48) {
      return NextResponse.json({ error: 'Invalid propositionId (must be 1-48)' }, { status: 400 })
    }

    // Idempotent insert — ignore if already exists
    await db
      .insert(euclidProgress)
      .values({ playerId, propositionId })
      .onConflictDoNothing()

    // Return full updated list
    const rows = await db
      .select({ propositionId: euclidProgress.propositionId })
      .from(euclidProgress)
      .where(eq(euclidProgress.playerId, playerId))

    const completed = rows.map(r => r.propositionId)

    return NextResponse.json({ completed })
  } catch (error) {
    console.error('Error marking euclid progress:', error)
    return NextResponse.json({ error: 'Failed to save progress' }, { status: 500 })
  }
}
