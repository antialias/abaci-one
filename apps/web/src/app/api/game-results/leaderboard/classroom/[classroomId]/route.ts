/**
 * API route for classroom leaderboard
 *
 * GET /api/game-results/leaderboard/classroom/[classroomId] - Get rankings for all players in classroom
 */

import { NextResponse } from 'next/server'
import { db } from '@/db'
import { gameResults, classroomEnrollments, players } from '@/db/schema'
import { eq, desc, and, inArray, sql } from 'drizzle-orm'
import { getDbUserId } from '@/lib/viewer'

interface RouteParams {
  params: Promise<{ classroomId: string }>
}

/**
 * GET - Fetch classroom leaderboard
 *
 * Query params:
 * - gameName: Filter to specific game
 * - category: Filter to specific category
 */
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { classroomId } = await params

    if (!classroomId) {
      return NextResponse.json({ error: 'Classroom ID required' }, { status: 400 })
    }

    // Authentication check (must be logged in)
    const userId = await getDbUserId()
    if (!userId) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const gameName = searchParams.get('gameName')
    const category = searchParams.get('category')

    // Get all players in this classroom
    const classmates = await db
      .select({ playerId: classroomEnrollments.playerId })
      .from(classroomEnrollments)
      .where(eq(classroomEnrollments.classroomId, classroomId))

    const playerIds = classmates.map((c) => c.playerId)

    // If no players in classroom, return empty rankings
    if (playerIds.length === 0) {
      return NextResponse.json({ rankings: [], playerCount: 0 })
    }

    // Build query conditions
    const conditions = [inArray(gameResults.playerId, playerIds)]
    if (gameName) conditions.push(eq(gameResults.gameName, gameName))
    if (category) conditions.push(eq(gameResults.category, category))

    // Get best scores per player
    const rankings = await db
      .select({
        playerId: gameResults.playerId,
        playerName: players.name,
        playerEmoji: players.emoji,
        bestScore: sql<number>`MAX(${gameResults.normalizedScore})`,
        gamesPlayed: sql<number>`COUNT(*)`,
        avgScore: sql<number>`AVG(${gameResults.normalizedScore})`,
        totalDuration: sql<number>`SUM(${gameResults.durationMs})`,
      })
      .from(gameResults)
      .innerJoin(players, eq(gameResults.playerId, players.id))
      .where(and(...conditions))
      .groupBy(gameResults.playerId, players.name, players.emoji)
      .orderBy(desc(sql`MAX(${gameResults.normalizedScore})`))

    // Add rank to each result
    const rankedResults = rankings.map((r, idx) => ({
      ...r,
      rank: idx + 1,
      avgScore: Math.round((r.avgScore ?? 0) * 10) / 10, // Round to 1 decimal
    }))

    // Get unique games played by these players (for filter dropdown)
    const gamesInClassroom = await db
      .select({
        gameName: gameResults.gameName,
        gameDisplayName: gameResults.gameDisplayName,
        gameIcon: gameResults.gameIcon,
      })
      .from(gameResults)
      .where(inArray(gameResults.playerId, playerIds))
      .groupBy(gameResults.gameName, gameResults.gameDisplayName, gameResults.gameIcon)

    return NextResponse.json({
      rankings: rankedResults,
      playerCount: playerIds.length,
      gamesAvailable: gamesInClassroom,
    })
  } catch (error) {
    console.error('Error fetching classroom leaderboard:', error)
    return NextResponse.json({ error: 'Failed to fetch leaderboard' }, { status: 500 })
  }
}
