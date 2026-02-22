import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/withAuth'
import { getHouseholdDetail, addHouseholdMember } from '@/lib/household'
import { db } from '@/db'
import { users } from '@/db/schema'
import { eq } from 'drizzle-orm'

/**
 * POST /api/households/[id]/members
 *
 * Add a member to a household (owner only).
 * Body: { userId: string } or { email: string }
 */
export const POST = withAuth(async (request, { userId, params }) => {
  const { id: householdId } = (await params) as { id: string }

  const household = await getHouseholdDetail(householdId)
  if (!household) {
    return NextResponse.json({ error: 'Household not found' }, { status: 404 })
  }

  if (household.ownerId !== userId) {
    return NextResponse.json({ error: 'Only the owner can add members' }, { status: 403 })
  }

  const body = await request.json()

  let targetUserId: string | undefined

  if (body.userId) {
    targetUserId = body.userId
  } else if (body.email) {
    // Look up user by email
    const user = await db.query.users.findFirst({
      where: eq(users.email, body.email),
      columns: { id: true },
    })
    if (!user) {
      return NextResponse.json({ error: 'No user found with that email' }, { status: 404 })
    }
    targetUserId = user.id
  }

  if (!targetUserId) {
    return NextResponse.json({ error: 'userId or email is required' }, { status: 400 })
  }

  const result = await addHouseholdMember(householdId, targetUserId)
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  const updated = await getHouseholdDetail(householdId)
  return NextResponse.json({ household: updated }, { status: 201 })
}, { role: 'user' })
