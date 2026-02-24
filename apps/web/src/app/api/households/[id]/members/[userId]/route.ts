import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/withAuth'
import { getHouseholdDetail, isHouseholdMember, removeHouseholdMember } from '@/lib/household'

/**
 * DELETE /api/households/[id]/members/[userId]
 *
 * Remove a member from a household.
 * - Owner can remove any member (except themselves — must transfer ownership first)
 * - Members can only remove themselves (leave)
 */
export const DELETE = withAuth(
  async (_request, { userId: actingUserId, params }) => {
    const { id: householdId, userId: targetUserId } = (await params) as {
      id: string
      userId: string
    }

    // Verify the acting user is a member of the household
    const isMember = await isHouseholdMember(householdId, actingUserId)
    if (!isMember) {
      return NextResponse.json({ error: 'Not a member of this household' }, { status: 403 })
    }

    // Check permissions: owner can remove anyone, members can only leave
    const household = await getHouseholdDetail(householdId)
    if (!household) {
      return NextResponse.json({ error: 'Household not found' }, { status: 404 })
    }

    const isOwner = household.ownerId === actingUserId
    const isSelfLeave = actingUserId === targetUserId

    if (!isOwner && !isSelfLeave) {
      return NextResponse.json(
        { error: 'Only the owner can remove other members' },
        { status: 403 }
      )
    }

    const result = await removeHouseholdMember(householdId, targetUserId)
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  },
  { role: 'user' }
)
