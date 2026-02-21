import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/withAuth'
import {
  getLinkedParentIds,
  getOrCreateFamilyCode,
  isParentOf,
  MAX_PARENTS_PER_CHILD,
  regenerateFamilyCode,
} from '@/lib/classroom'
import { getUserId } from '@/lib/viewer'

/**
 * GET /api/family/children/[playerId]/code
 * Get family code for a child (must be parent)
 *
 * Returns: { familyCode: string }
 */
export const GET = withAuth(async (_request, { params }) => {
  try {
    const { playerId } = (await params) as { playerId: string }
    const userId = await getUserId()

    // Verify user is a parent of this child
    const parentCheck = await isParentOf(userId, playerId)
    if (!parentCheck) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    const [familyCode, linkedParentIds] = await Promise.all([
      getOrCreateFamilyCode(playerId),
      getLinkedParentIds(playerId),
    ])

    if (!familyCode) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 })
    }

    return NextResponse.json({
      familyCode,
      linkedParentCount: linkedParentIds.length,
      maxParents: MAX_PARENTS_PER_CHILD,
    })
  } catch (error) {
    console.error('Failed to get family code:', error)
    return NextResponse.json({ error: 'Failed to get family code' }, { status: 500 })
  }
})

/**
 * POST /api/family/children/[playerId]/code
 * Regenerate family code for a child (invalidates old code)
 *
 * Returns: { familyCode: string }
 */
export const POST = withAuth(async (_request, { params }) => {
  try {
    const { playerId } = (await params) as { playerId: string }
    const userId = await getUserId()

    // Verify user is a parent of this child
    const parentCheck = await isParentOf(userId, playerId)
    if (!parentCheck) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    const familyCode = await regenerateFamilyCode(playerId, userId)

    if (!familyCode) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 })
    }

    return NextResponse.json({ familyCode })
  } catch (error) {
    console.error('Failed to regenerate family code:', error)
    return NextResponse.json({ error: 'Failed to regenerate family code' }, { status: 500 })
  }
})
