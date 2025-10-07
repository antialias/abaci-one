import { and, eq } from 'drizzle-orm'
import { type NextRequest, NextResponse } from 'next/server'
import { db, schema } from '@/db'
import { getViewerId } from '@/lib/viewer'

/**
 * PATCH /api/players/[id]
 * Update a player (only if it belongs to the current viewer)
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const viewerId = await getViewerId()
    const body = await req.json()

    // Get user record (must exist if player exists)
    const user = await db.query.users.findFirst({
      where: eq(schema.users.guestId, viewerId),
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Check if user has an active arcade session
    // If so, prevent changing isActive status (players are locked during games)
    if (body.isActive !== undefined) {
      const activeSession = await db.query.arcadeSessions.findFirst({
        where: eq(schema.arcadeSessions.userId, viewerId),
      })

      if (activeSession) {
        return NextResponse.json(
          {
            error: 'Cannot modify active players during an active game session',
            activeGame: activeSession.currentGame,
            gameUrl: activeSession.gameUrl,
          },
          { status: 403 }
        )
      }
    }

    // Security: Only allow updating specific fields (excludes userId)
    // Update player (only if it belongs to this user)
    const [updatedPlayer] = await db
      .update(schema.players)
      .set({
        ...(body.name !== undefined && { name: body.name }),
        ...(body.emoji !== undefined && { emoji: body.emoji }),
        ...(body.color !== undefined && { color: body.color }),
        ...(body.isActive !== undefined && { isActive: body.isActive }),
        // userId is explicitly NOT included - it comes from session
      })
      .where(and(eq(schema.players.id, params.id), eq(schema.players.userId, user.id)))
      .returning()

    if (!updatedPlayer) {
      return NextResponse.json({ error: 'Player not found or unauthorized' }, { status: 404 })
    }

    return NextResponse.json({ player: updatedPlayer })
  } catch (error) {
    console.error('Failed to update player:', error)
    return NextResponse.json({ error: 'Failed to update player' }, { status: 500 })
  }
}

/**
 * DELETE /api/players/[id]
 * Delete a player (only if it belongs to the current viewer)
 */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const viewerId = await getViewerId()

    // Get user record (must exist if player exists)
    const user = await db.query.users.findFirst({
      where: eq(schema.users.guestId, viewerId),
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Delete player (only if it belongs to this user)
    const [deletedPlayer] = await db
      .delete(schema.players)
      .where(and(eq(schema.players.id, params.id), eq(schema.players.userId, user.id)))
      .returning()

    if (!deletedPlayer) {
      return NextResponse.json({ error: 'Player not found or unauthorized' }, { status: 404 })
    }

    return NextResponse.json({ success: true, player: deletedPlayer })
  } catch (error) {
    console.error('Failed to delete player:', error)
    return NextResponse.json({ error: 'Failed to delete player' }, { status: 500 })
  }
}
