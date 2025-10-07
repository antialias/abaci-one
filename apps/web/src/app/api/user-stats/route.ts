import { eq } from 'drizzle-orm'
import { type NextRequest, NextResponse } from 'next/server'
import { db, schema } from '@/db'
import { getViewerId } from '@/lib/viewer'

/**
 * GET /api/user-stats
 * Get user statistics for the current viewer
 */
export async function GET() {
  try {
    const viewerId = await getViewerId()

    // Get user record
    const user = await db.query.users.findFirst({
      where: eq(schema.users.guestId, viewerId),
    })

    if (!user) {
      // No user yet, return default stats
      return NextResponse.json({
        stats: {
          gamesPlayed: 0,
          totalWins: 0,
          favoriteGameType: null,
          bestTime: null,
          highestAccuracy: 0,
        },
      })
    }

    // Get stats record
    let stats = await db.query.userStats.findFirst({
      where: eq(schema.userStats.userId, user.id),
    })

    // If no stats record exists, create one with defaults
    if (!stats) {
      const [newStats] = await db
        .insert(schema.userStats)
        .values({
          userId: user.id,
        })
        .returning()

      stats = newStats
    }

    return NextResponse.json({ stats })
  } catch (error) {
    console.error('Failed to fetch user stats:', error)
    return NextResponse.json({ error: 'Failed to fetch user stats' }, { status: 500 })
  }
}

/**
 * PATCH /api/user-stats
 * Update user statistics for the current viewer
 */
export async function PATCH(req: NextRequest) {
  try {
    const viewerId = await getViewerId()
    const body = await req.json()

    // Get or create user record
    let user = await db.query.users.findFirst({
      where: eq(schema.users.guestId, viewerId),
    })

    if (!user) {
      // Create user if it doesn't exist
      const [newUser] = await db
        .insert(schema.users)
        .values({
          guestId: viewerId,
        })
        .returning()

      user = newUser
    }

    // Get existing stats
    const stats = await db.query.userStats.findFirst({
      where: eq(schema.userStats.userId, user.id),
    })

    // Prepare update values
    const updates: any = {}
    if (body.gamesPlayed !== undefined) updates.gamesPlayed = body.gamesPlayed
    if (body.totalWins !== undefined) updates.totalWins = body.totalWins
    if (body.favoriteGameType !== undefined) updates.favoriteGameType = body.favoriteGameType
    if (body.bestTime !== undefined) updates.bestTime = body.bestTime
    if (body.highestAccuracy !== undefined) updates.highestAccuracy = body.highestAccuracy

    if (stats) {
      // Update existing stats
      const [updatedStats] = await db
        .update(schema.userStats)
        .set(updates)
        .where(eq(schema.userStats.userId, user.id))
        .returning()

      return NextResponse.json({ stats: updatedStats })
    } else {
      // Create new stats record
      const [newStats] = await db
        .insert(schema.userStats)
        .values({
          userId: user.id,
          ...updates,
        })
        .returning()

      return NextResponse.json({ stats: newStats }, { status: 201 })
    }
  } catch (error) {
    console.error('Failed to update user stats:', error)
    return NextResponse.json({ error: 'Failed to update user stats' }, { status: 500 })
  }
}
