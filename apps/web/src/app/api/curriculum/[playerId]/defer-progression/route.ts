/**
 * API route for managing progression deferrals
 *
 * POST /api/curriculum/[playerId]/defer-progression
 *   Body: { skillId: string }
 *   Creates a 7-day deferral for the specified skill progression.
 *
 * DELETE /api/curriculum/[playerId]/defer-progression
 *   Body: { skillId: string }
 *   Removes the deferral for the specified skill.
 */

import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/withAuth'
import { canPerformAction } from '@/lib/classroom'
import { clearDeferral, deferProgression } from '@/lib/curriculum/progression-deferrals'
import { getDbUserId } from '@/lib/viewer'

export const POST = withAuth(async (request, { params }) => {
  try {
    const { playerId } = (await params) as { playerId: string }
    const { skillId } = await request.json()

    if (!playerId || !skillId) {
      return NextResponse.json({ error: 'Player ID and skill ID required' }, { status: 400 })
    }

    const userId = await getDbUserId()
    const canManage = await canPerformAction(userId, playerId, 'start-session')
    if (!canManage) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    const deferral = await deferProgression(playerId, skillId)

    return NextResponse.json({ deferral })
  } catch (error) {
    console.error('Error deferring progression:', error)
    return NextResponse.json({ error: 'Failed to defer progression' }, { status: 500 })
  }
})

export const DELETE = withAuth(async (request, { params }) => {
  try {
    const { playerId } = (await params) as { playerId: string }
    const { skillId } = await request.json()

    if (!playerId || !skillId) {
      return NextResponse.json({ error: 'Player ID and skill ID required' }, { status: 400 })
    }

    const userId = await getDbUserId()
    const canManage = await canPerformAction(userId, playerId, 'start-session')
    if (!canManage) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    await clearDeferral(playerId, skillId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error clearing deferral:', error)
    return NextResponse.json({ error: 'Failed to clear deferral' }, { status: 500 })
  }
})
