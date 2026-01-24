/**
 * API route for saving game results
 *
 * POST /api/game-results - Save a completed game result
 */

import { NextResponse } from 'next/server'
import { db } from '@/db'
import { gameResults } from '@/db/schema'
import { canPerformAction } from '@/lib/classroom'
import { getDbUserId } from '@/lib/viewer'
import type { GameResultsReport } from '@/lib/arcade/game-sdk/types'
import { metrics } from '@/lib/metrics'
import { getCurrentTraceId, recordError } from '@/lib/tracing'

interface SaveGameResultRequest {
  playerId: string
  userId?: string
  sessionType: 'practice-break' | 'arcade-room' | 'standalone'
  sessionId?: string
  report: GameResultsReport
}

/**
 * POST - Save a completed game result
 *
 * This endpoint is called when a game finishes to persist the result
 * for scoreboard and history features.
 */
export async function POST(request: Request) {
  try {
    const body: SaveGameResultRequest = await request.json()
    const { playerId, userId, sessionType, sessionId, report } = body

    if (!playerId) {
      return NextResponse.json({ error: 'Player ID required' }, { status: 400 })
    }

    if (!report) {
      return NextResponse.json({ error: 'Game report required' }, { status: 400 })
    }

    // Authorization check - only the player's parent or teacher can save results
    const dbUserId = await getDbUserId()
    const canSave = await canPerformAction(dbUserId, playerId, 'view')
    if (!canSave) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    // Extract player result (first player for single-player, find by playerId for multiplayer)
    const playerResult =
      report.playerResults.find((p) => p.playerId === playerId) ?? report.playerResults[0]

    const result = await db
      .insert(gameResults)
      .values({
        playerId,
        userId,
        gameName: report.gameName,
        gameDisplayName: report.gameDisplayName,
        gameIcon: report.gameIcon,
        sessionType,
        sessionId,
        normalizedScore: report.leaderboardEntry?.normalizedScore ?? playerResult?.accuracy ?? 0,
        rawScore: playerResult?.score,
        accuracy: playerResult?.accuracy,
        category: report.leaderboardEntry?.category,
        difficulty: report.leaderboardEntry?.difficulty,
        durationMs: report.durationMs,
        playedAt: new Date(report.endedAt),
        fullReport: report,
      })
      .returning()

    // Track arcade metrics
    const gameName = report.gameName || 'unknown'
    const outcome = playerResult?.accuracy && playerResult.accuracy >= 0.8 ? 'win' : 'lose'
    metrics.arcade.gamesCompleted.inc({ game: gameName, outcome })
    if (playerResult?.score !== undefined) {
      metrics.arcade.scoreHistogram.observe({ game: gameName }, playerResult.score)
    }

    return NextResponse.json(result[0])
  } catch (error) {
    console.error('Error saving game result:', error)
    if (error instanceof Error) {
      recordError(error)
    }
    const traceId = getCurrentTraceId()
    return NextResponse.json(
      { error: 'Failed to save game result', ...(traceId && { traceId }) },
      { status: 500 }
    )
  }
}
