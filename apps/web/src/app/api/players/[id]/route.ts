import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db, schema } from '@/db'
import { withAuth } from '@/lib/auth/withAuth'
import { isParentOf } from '@/lib/classroom/access-control'
import { getUserId } from '@/lib/viewer'
import { normalizeBirthdayInput } from '@/lib/playerAge'

/**
 * PATCH /api/players/[id]
 * Update a player (owner or linked parent)
 */
export const PATCH = withAuth(async (request, { params }) => {
  try {
    const { id } = (await params) as { id: string }
    const userId = await getUserId()
    const body = await request.json()
    let normalizedBirthday: string | null | undefined
    if (body.birthday === null) {
      normalizedBirthday = null
    } else if (typeof body.birthday === 'string') {
      normalizedBirthday = normalizeBirthdayInput(body.birthday)
      if (normalizedBirthday === null) {
        return NextResponse.json({ error: 'Invalid birthday' }, { status: 400 })
      }
    }

    // Check authorization: owner or linked parent
    const authorized = await isParentOf(userId, id)
    if (!authorized) {
      return NextResponse.json({ error: 'Player not found or unauthorized' }, { status: 404 })
    }

    // Security: Only allow updating specific fields (excludes userId)
    const [updatedPlayer] = await db
      .update(schema.players)
      .set({
        ...(body.name !== undefined && { name: body.name }),
        ...(body.emoji !== undefined && { emoji: body.emoji }),
        ...(body.color !== undefined && { color: body.color }),
        ...(body.isActive !== undefined && { isActive: body.isActive }),
        ...(body.isArchived !== undefined && { isArchived: body.isArchived }),
        ...(body.notes !== undefined && { notes: body.notes }),
        ...(normalizedBirthday !== undefined && { birthday: normalizedBirthday }),
      })
      .where(eq(schema.players.id, id))
      .returning()

    if (!updatedPlayer) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 })
    }

    return NextResponse.json({ player: updatedPlayer })
  } catch (error) {
    console.error('Failed to update player:', error)
    return NextResponse.json({ error: 'Failed to update player' }, { status: 500 })
  }
})

/**
 * DELETE /api/players/[id]
 * Delete a player (owner or linked parent)
 */
export const DELETE = withAuth(async (_request, { params }) => {
  try {
    const { id } = (await params) as { id: string }
    const userId = await getUserId()

    const authorized = await isParentOf(userId, id)
    if (!authorized) {
      return NextResponse.json({ error: 'Player not found or unauthorized' }, { status: 404 })
    }

    const [deletedPlayer] = await db
      .delete(schema.players)
      .where(eq(schema.players.id, id))
      .returning()

    if (!deletedPlayer) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, player: deletedPlayer })
  } catch (error) {
    console.error('Failed to delete player:', error)
    return NextResponse.json({ error: 'Failed to delete player' }, { status: 500 })
  }
})
