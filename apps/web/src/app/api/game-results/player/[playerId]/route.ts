/**
 * API route for player game history
 *
 * GET /api/game-results/player/[playerId] - Get player's game history and personal bests
 */

import { NextResponse } from 'next/server'
import { db } from '@/db'
import { gameResults } from '@/db/schema'
import { eq, desc, and, sql } from 'drizzle-orm'
import { withAuth } from '@/lib/auth/withAuth'
import { canPerformAction } from '@/lib/classroom'
import { getDbUserId } from '@/lib/viewer'

/**
 * GET - Fetch player's game history with optional filters
 *
 * Query params:
 * - gameName: Filter to specific game
 * - category: Filter to specific category
 * - limit: Max number of results (default 50)
 */
export const GET = withAuth(async (request, { params }) => {
  try {
    const { playerId } = (await params) as { playerId: string }

    if (!playerId) {
      return NextResponse.json({ error: 'Player ID required' }, { status: 400 })
    }

    // Authorization check
    const userId = await getDbUserId()
    const canView = await canPerformAction(userId, playerId, 'view')
    if (!canView) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const gameName = searchParams.get('gameName')
    const category = searchParams.get('category')
    const limit = parseInt(searchParams.get('limit') ?? '50')

    // Build query conditions
    const conditions = [eq(gameResults.playerId, playerId)]
    if (gameName) conditions.push(eq(gameResults.gameName, gameName))
    if (category) conditions.push(eq(gameResults.category, category))

    // Fetch game history
    const history = await db
      .select()
      .from(gameResults)
      .where(and(...conditions))
      .orderBy(desc(gameResults.playedAt))
      .limit(limit)

    // Calculate personal bests per game
    const personalBestsRaw = await db
      .select({
        gameName: gameResults.gameName,
        gameDisplayName: gameResults.gameDisplayName,
        gameIcon: gameResults.gameIcon,
        bestScore: sql<number>`MAX(${gameResults.normalizedScore})`,
        gamesPlayed: sql<number>`COUNT(*)`,
      })
      .from(gameResults)
      .where(eq(gameResults.playerId, playerId))
      .groupBy(gameResults.gameName, gameResults.gameDisplayName, gameResults.gameIcon)

    // Format personal bests as a lookup object
    const personalBests: Record<
      string,
      {
        bestScore: number
        gamesPlayed: number
        displayName: string
        icon: string | null
      }
    > = {}
    for (const pb of personalBestsRaw) {
      personalBests[pb.gameName] = {
        bestScore: pb.bestScore,
        gamesPlayed: pb.gamesPlayed,
        displayName: pb.gameDisplayName,
        icon: pb.gameIcon,
      }
    }

    return NextResponse.json({
      history,
      personalBests,
      totalGames: history.length,
    })
  } catch (error) {
    console.error('Error fetching player game history:', error)
    return NextResponse.json({ error: 'Failed to fetch game history' }, { status: 500 })
  }
})
