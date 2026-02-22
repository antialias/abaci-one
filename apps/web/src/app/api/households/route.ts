import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/withAuth'
import { getUserHouseholds, createHousehold, MAX_HOUSEHOLD_SIZE } from '@/lib/household'

/**
 * GET /api/households
 *
 * List the current user's households with member counts.
 */
export const GET = withAuth(async (_request, { userId }) => {
  const households = await getUserHouseholds(userId)
  return NextResponse.json({ households })
}, { role: 'user' })

/**
 * POST /api/households
 *
 * Create a new household with the current user as owner.
 * Body: { name: string }
 */
export const POST = withAuth(async (request, { userId }) => {
  const body = await request.json()
  const { name } = body

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  }

  if (name.trim().length > 100) {
    return NextResponse.json({ error: 'Name must be 100 characters or less' }, { status: 400 })
  }

  try {
    const household = await createHousehold(userId, name.trim())
    return NextResponse.json({ household }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create household'
    return NextResponse.json({ error: message }, { status: 409 })
  }
}, { role: 'user' })
