import { eq } from 'drizzle-orm'
import { type NextRequest, NextResponse } from 'next/server'
import { db, schema } from '@/db'
import { getUserId } from '@/lib/viewer'
import { withAuth } from '@/lib/auth/withAuth'

/**
 * GET /api/user-stats
 * Get user statistics for the current viewer
 */
export const GET = withAuth(async () => {
  try {
    const userId = await getUserId()

    // Get stats record
    let stats = await db.query.userStats.findFirst({
      where: eq(schema.userStats.userId, userId),
    })

    // If no stats record exists, create one with defaults
    if (!stats) {
      const [newStats] = await db
        .insert(schema.userStats)
        .values({
          userId,
        })
        .returning()

      stats = newStats
    }

    return NextResponse.json({ stats })
  } catch (error) {
    console.error('Failed to fetch user stats:', error)
    return NextResponse.json({ error: 'Failed to fetch user stats' }, { status: 500 })
  }
})

/**
 * PATCH /api/user-stats
 * Update user statistics for the current viewer
 */
export const PATCH = withAuth(async (request) => {
  try {
    const userId = await getUserId()
    const body = await request.json()

    // Get existing stats
    const stats = await db.query.userStats.findFirst({
      where: eq(schema.userStats.userId, userId),
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
        .where(eq(schema.userStats.userId, userId))
        .returning()

      return NextResponse.json({ stats: updatedStats })
    } else {
      // Create new stats record
      const [newStats] = await db
        .insert(schema.userStats)
        .values({
          userId,
          ...updates,
        })
        .returning()

      return NextResponse.json({ stats: newStats }, { status: 201 })
    }
  } catch (error) {
    console.error('Failed to update user stats:', error)
    return NextResponse.json({ error: 'Failed to update user stats' }, { status: 500 })
  }
})
