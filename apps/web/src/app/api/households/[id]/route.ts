import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/withAuth'
import {
  getHouseholdDetail,
  isHouseholdMember,
  updateHouseholdName,
  transferHouseholdOwnership,
} from '@/lib/household'

/**
 * GET /api/households/[id]
 *
 * Get full details of a household including all members.
 * Only accessible to household members.
 */
export const GET = withAuth(async (_request, { userId, params }) => {
  const { id: householdId } = (await params) as { id: string }

  const isMember = await isHouseholdMember(householdId, userId)
  if (!isMember) {
    return NextResponse.json({ error: 'Not a member of this household' }, { status: 403 })
  }

  const household = await getHouseholdDetail(householdId)
  if (!household) {
    return NextResponse.json({ error: 'Household not found' }, { status: 404 })
  }

  return NextResponse.json({ household })
}, { role: 'user' })

/**
 * PATCH /api/households/[id]
 *
 * Update household. Supports:
 * - { name: string } — rename (owner only)
 * - { newOwnerId: string } — transfer ownership (owner only)
 */
export const PATCH = withAuth(async (request, { userId, params }) => {
  const { id: householdId } = (await params) as { id: string }

  const household = await getHouseholdDetail(householdId)
  if (!household) {
    return NextResponse.json({ error: 'Household not found' }, { status: 404 })
  }

  if (household.ownerId !== userId) {
    return NextResponse.json({ error: 'Only the owner can update the household' }, { status: 403 })
  }

  const body = await request.json()

  // Transfer ownership
  if (body.newOwnerId) {
    const result = await transferHouseholdOwnership(householdId, userId, body.newOwnerId)
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
    const updated = await getHouseholdDetail(householdId)
    return NextResponse.json({ household: updated })
  }

  // Rename
  if (body.name !== undefined) {
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (name.length === 0) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }
    if (name.length > 100) {
      return NextResponse.json({ error: 'Name must be 100 characters or less' }, { status: 400 })
    }
    await updateHouseholdName(householdId, name)
    const updated = await getHouseholdDetail(householdId)
    return NextResponse.json({ household: updated })
  }

  return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
}, { role: 'user' })
