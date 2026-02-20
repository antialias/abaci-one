import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/withAuth'
import { db, schema } from '@/db'
import { getOrCreateFamilyCode, isParent, regenerateFamilyCode } from '@/lib/classroom'
import { getViewerId } from '@/lib/viewer'

/**
 * Resolve viewerId (guestId) to actual user.id
 */
async function getUserId(viewerId: string): Promise<string | null> {
  const user = await db.query.users.findFirst({
    where: eq(schema.users.guestId, viewerId),
  })
  return user?.id ?? null
}

/**
 * GET /api/family/children/[playerId]/code
 * Get family code for a child (must be parent)
 *
 * Returns: { familyCode: string }
 */
export const GET = withAuth(async (_request, { params }) => {
  try {
    const { playerId } = (await params) as { playerId: string }
    const viewerId = await getViewerId()

    // Resolve viewerId to actual user.id
    const userId = await getUserId(viewerId)
    if (!userId) {
      return NextResponse.json({ error: 'User not found' }, { status: 401 })
    }

    // Verify user is a parent of this child
    const parentCheck = await isParent(userId, playerId)
    if (!parentCheck) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    const familyCode = await getOrCreateFamilyCode(playerId)

    if (!familyCode) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 })
    }

    return NextResponse.json({ familyCode })
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
    const viewerId = await getViewerId()

    // Resolve viewerId to actual user.id
    const userId = await getUserId(viewerId)
    if (!userId) {
      return NextResponse.json({ error: 'User not found' }, { status: 401 })
    }

    // Verify user is a parent of this child
    const parentCheck = await isParent(userId, playerId)
    if (!parentCheck) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    const familyCode = await regenerateFamilyCode(playerId)

    if (!familyCode) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 })
    }

    return NextResponse.json({ familyCode })
  } catch (error) {
    console.error('Failed to regenerate family code:', error)
    return NextResponse.json({ error: 'Failed to regenerate family code' }, { status: 500 })
  }
})
