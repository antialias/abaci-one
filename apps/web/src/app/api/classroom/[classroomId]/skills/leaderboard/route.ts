/**
 * API route for classroom skills leaderboard
 *
 * GET /api/classroom/[classroomId]/skills/leaderboard
 * Returns skill-based rankings for all players in a classroom.
 *
 * This provides "fun ways to compare students across different ability levels":
 * - Effort-based: weekly problems, total problems, practice streak
 * - Improvement-based: learning rate (pKnown delta per week)
 * - Speed champions: fastest in each category (only mastered students compete)
 */

import { NextResponse } from 'next/server'
import { and, desc, eq, inArray } from 'drizzle-orm'
import { db } from '@/db'
import * as schema from '@/db/schema'
import { getDbUserId } from '@/lib/viewer'
import { computeBktFromHistory } from '@/lib/curriculum/bkt/compute-bkt'
import { BKT_THRESHOLDS } from '@/lib/curriculum/config/bkt-integration'
import {
  calculateCategorySpeed,
  computeClassroomLeaderboard,
  computeStudentSkillMetrics,
  getSkillCategory,
  type PlayerLeaderboardData,
  type SkillCategory,
} from '@/lib/curriculum/skill-metrics'
import { getRecentSessionResults } from '@/lib/curriculum/session-planner'

interface RouteParams {
  params: Promise<{ classroomId: string }>
}

/**
 * GET /api/classroom/[classroomId]/skills/leaderboard
 * Get skill-based leaderboard for a classroom.
 */
export async function GET(_request: Request, { params }: RouteParams) {
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

    // Get all players in this classroom with their info
    const classmates = await db
      .select({
        playerId: schema.classroomEnrollments.playerId,
        playerName: schema.players.name,
        playerEmoji: schema.players.emoji,
      })
      .from(schema.classroomEnrollments)
      .innerJoin(schema.players, eq(schema.classroomEnrollments.playerId, schema.players.id))
      .where(eq(schema.classroomEnrollments.classroomId, classroomId))

    if (classmates.length === 0) {
      return NextResponse.json({
        leaderboard: {
          computedAt: new Date(),
          playerCount: 0,
          byWeeklyProblems: [],
          byTotalProblems: [],
          byPracticeStreak: [],
          byImprovementRate: [],
          speedChampions: [],
        },
      })
    }

    // Compute metrics for each player
    const playersData: PlayerLeaderboardData[] = []

    for (const player of classmates) {
      // Get problem results and sessions for this player
      const [results, sessions] = await Promise.all([
        getRecentSessionResults(player.playerId, 100),
        db.query.sessionPlans.findMany({
          where: and(
            eq(schema.sessionPlans.playerId, player.playerId),
            inArray(schema.sessionPlans.status, ['completed', 'abandoned'])
          ),
          orderBy: [desc(schema.sessionPlans.completedAt)],
          limit: 100,
        }),
      ])

      // Skip players with no practice data
      if (results.length === 0) continue

      // Compute metrics
      const metrics = computeStudentSkillMetrics(results, sessions)

      // Compute BKT to find mastered skills for speed champions
      const bktResult = computeBktFromHistory(results)
      const masteredSkillIds = new Set(
        bktResult.skills.filter((s) => s.pKnown >= BKT_THRESHOLDS.strong).map((s) => s.skillId)
      )

      // Calculate speed for each category where student has mastered skills
      const categorySpeedByMastered = new Map<SkillCategory, number>()
      const categories: SkillCategory[] = [
        'basic',
        'fiveComplements',
        'fiveComplementsSub',
        'tenComplements',
        'tenComplementsSub',
        'advanced',
      ]

      for (const category of categories) {
        // Check if player has any mastered skills in this category
        const hasMasteredInCategory = Array.from(masteredSkillIds).some(
          (skillId) => getSkillCategory(skillId) === category
        )

        if (hasMasteredInCategory) {
          const speed = calculateCategorySpeed(results, category, masteredSkillIds)
          if (speed !== null) {
            categorySpeedByMastered.set(category, speed)
          }
        }
      }

      playersData.push({
        playerId: player.playerId,
        playerName: player.playerName,
        playerEmoji: player.playerEmoji,
        metrics,
        categorySpeedByMastered,
      })
    }

    // Compute the leaderboard
    const leaderboard = computeClassroomLeaderboard(playersData)

    return NextResponse.json({ leaderboard })
  } catch (error) {
    console.error('Error fetching classroom skills leaderboard:', error)
    return NextResponse.json({ error: 'Failed to fetch skills leaderboard' }, { status: 500 })
  }
}
