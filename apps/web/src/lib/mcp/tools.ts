/**
 * MCP Tool implementations for curriculum data access
 */

import { eq, or, inArray, desc, and, gte } from 'drizzle-orm'
import { db, schema } from '@/db'
import { parentChild } from '@/db/schema'
import { getAllSkillMastery, getRecentSessions } from '@/lib/curriculum/progress-manager'
import { getRecentSessionResults } from '@/lib/curriculum/session-planner'

// Tool definitions for MCP tools/list response
export const MCP_TOOLS = [
  {
    name: 'list_students',
    description:
      'List all students (players) accessible to this API key. Returns player IDs, names, and emojis.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_student_overview',
    description:
      'Get a quick overview of a student including skill counts, last practice date, and current streak.',
    inputSchema: {
      type: 'object',
      properties: {
        player_id: {
          type: 'string',
          description: 'The student player ID',
        },
      },
      required: ['player_id'],
    },
  },
  {
    name: 'get_skills',
    description:
      'Get detailed skill mastery levels for a student. Can filter by status (strong/developing/weak) or category.',
    inputSchema: {
      type: 'object',
      properties: {
        player_id: {
          type: 'string',
          description: 'The student player ID',
        },
        status: {
          type: 'string',
          enum: ['strong', 'developing', 'weak'],
          description: 'Filter by mastery status',
        },
        category: {
          type: 'string',
          description:
            'Filter by skill category (basic, fiveComplements, tenComplements, fiveComplementsSub, tenComplementsSub, advanced)',
        },
      },
      required: ['player_id'],
    },
  },
  {
    name: 'get_recent_errors',
    description:
      'Get recent incorrect answers for a student. Useful for identifying patterns and targeting practice.',
    inputSchema: {
      type: 'object',
      properties: {
        player_id: {
          type: 'string',
          description: 'The student player ID',
        },
        days: {
          type: 'number',
          description: 'Number of days to look back (default: 7)',
        },
        skill_id: {
          type: 'string',
          description: 'Filter to a specific skill ID',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of errors to return (default: 20)',
        },
      },
      required: ['player_id'],
    },
  },
  {
    name: 'get_practice_sessions',
    description:
      'Get recent practice session history showing when and how much a student practiced.',
    inputSchema: {
      type: 'object',
      properties: {
        player_id: {
          type: 'string',
          description: 'The student player ID',
        },
        days: {
          type: 'number',
          description: 'Number of days to look back (default: 14)',
        },
      },
      required: ['player_id'],
    },
  },
  {
    name: 'get_recommended_focus',
    description:
      'Get skill recommendations based on mastery levels. Returns skills that need the most practice.',
    inputSchema: {
      type: 'object',
      properties: {
        player_id: {
          type: 'string',
          description: 'The student player ID',
        },
        count: {
          type: 'number',
          description: 'Number of recommendations to return (default: 5)',
        },
      },
      required: ['player_id'],
    },
  },
]

/**
 * Get all players accessible to a user (created or linked via parent_child)
 */
export async function listStudents(userId: string) {
  // Get player IDs linked via parent_child table
  const linkedPlayerIds = await db.query.parentChild.findMany({
    where: eq(parentChild.parentUserId, userId),
  })
  const linkedIds = linkedPlayerIds.map((link) => link.childPlayerId)

  // Get all players: created by this user OR linked via parent_child
  let players
  if (linkedIds.length > 0) {
    players = await db.query.players.findMany({
      where: or(eq(schema.players.userId, userId), inArray(schema.players.id, linkedIds)),
      orderBy: (players, { desc }) => [desc(players.createdAt)],
    })
  } else {
    players = await db.query.players.findMany({
      where: eq(schema.players.userId, userId),
      orderBy: (players, { desc }) => [desc(players.createdAt)],
    })
  }

  return players.map((p) => ({
    playerId: p.id,
    name: p.name,
    emoji: p.emoji,
  }))
}

/**
 * Verify a player belongs to a user
 */
export async function verifyPlayerAccess(userId: string, playerId: string): Promise<boolean> {
  const students = await listStudents(userId)
  return students.some((s) => s.playerId === playerId)
}

/**
 * Get student overview with skill counts and practice info
 */
export async function getStudentOverview(playerId: string) {
  const player = await db.query.players.findFirst({
    where: eq(schema.players.id, playerId),
  })

  if (!player) {
    throw new Error('Player not found')
  }

  const skills = await getAllSkillMastery(playerId)
  const recentSessions = await getRecentSessions(playerId, 30)

  // Count by status
  const strong = skills.filter((s) => s.isPracticing && s.lastPracticedAt).length
  const developing = skills.filter((s) => s.isPracticing && !s.lastPracticedAt).length

  // Find last practice date
  const lastSession = recentSessions[0]
  const lastPracticed = lastSession?.startedAt ?? null

  return {
    playerId: player.id,
    name: player.name,
    emoji: player.emoji,
    lastPracticed,
    totalSkills: skills.length,
    strong,
    developing,
    weak: skills.length - strong - developing,
  }
}

/**
 * Get detailed skill data with optional filtering
 */
export async function getSkills(playerId: string, status?: string, category?: string) {
  const rawSkills = await getAllSkillMastery(playerId)
  const sessionResults = await getRecentSessionResults(playerId, 2000)

  // Compute skill stats from session results
  const skillStats = new Map<
    string,
    { attempts: number; correct: number; lastPracticed: Date | null }
  >()

  for (const result of sessionResults) {
    for (const skillId of result.skillsExercised) {
      if (!skillStats.has(skillId)) {
        skillStats.set(skillId, {
          attempts: 0,
          correct: 0,
          lastPracticed: null,
        })
      }
      const stats = skillStats.get(skillId)!
      stats.attempts++
      if (result.isCorrect) {
        stats.correct++
      }
      if (!stats.lastPracticed || result.timestamp > stats.lastPracticed) {
        stats.lastPracticed = result.timestamp
      }
    }
  }

  // Enrich skills with computed stats
  let skills = rawSkills.map((skill) => {
    const stats = skillStats.get(skill.skillId)
    const attempts = stats?.attempts ?? 0
    const correct = stats?.correct ?? 0
    const accuracy = attempts > 0 ? correct / attempts : 0

    // Determine status based on accuracy and attempts
    let computedStatus: 'strong' | 'developing' | 'weak'
    if (attempts >= 5 && accuracy >= 0.9) {
      computedStatus = 'strong'
    } else if (attempts >= 3 && accuracy >= 0.7) {
      computedStatus = 'developing'
    } else {
      computedStatus = 'weak'
    }

    // Parse category from skillId (e.g., "fiveComplements.4=5-1" -> "fiveComplements")
    const skillCategory = skill.skillId.split('.')[0]

    return {
      skillId: skill.skillId,
      displayName: skill.skillId.split('.')[1] || skill.skillId,
      category: skillCategory,
      attempts,
      correct,
      errors: attempts - correct,
      accuracy: Math.round(accuracy * 100),
      lastPracticed: stats?.lastPracticed ?? null,
      status: computedStatus,
    }
  })

  // Apply filters
  if (status) {
    skills = skills.filter((s) => s.status === status)
  }
  if (category) {
    skills = skills.filter((s) => s.category === category)
  }

  return skills
}

/**
 * Get recent errors for a student
 */
export async function getRecentErrors(
  playerId: string,
  days: number = 7,
  skillId?: string,
  limit: number = 20
) {
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - days)

  const sessionResults = await getRecentSessionResults(playerId, 2000)

  // Filter to errors only
  let errors = sessionResults
    .filter((r) => !r.isCorrect && r.timestamp >= cutoffDate)
    .map((r) => ({
      timestamp: r.timestamp,
      skillsExercised: r.skillsExercised,
      responseTimeMs: r.responseTimeMs,
    }))

  // Filter by skill if specified
  if (skillId) {
    errors = errors.filter((e) => e.skillsExercised.includes(skillId))
  }

  // Limit results
  return errors.slice(0, limit)
}

/**
 * Get practice session history
 */
export async function getPracticeSessions(playerId: string, days: number = 14) {
  const sessions = await getRecentSessions(playerId, 100)

  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - days)

  return sessions
    .filter((s) => s.startedAt && s.startedAt >= cutoffDate)
    .map((s) => ({
      date: s.startedAt,
      completedAt: s.completedAt,
      // Duration in minutes if completed
      durationMinutes:
        s.completedAt && s.startedAt
          ? Math.round((s.completedAt.getTime() - s.startedAt.getTime()) / 60000)
          : null,
    }))
}

/**
 * Get recommended skills to focus on
 */
export async function getRecommendedFocus(playerId: string, count: number = 5) {
  const skills = await getSkills(playerId)

  // Sort by priority: weak first, then developing, then by lowest accuracy
  const sorted = [...skills].sort((a, b) => {
    // Status priority
    const statusOrder = { weak: 0, developing: 1, strong: 2 }
    const statusDiff = statusOrder[a.status] - statusOrder[b.status]
    if (statusDiff !== 0) return statusDiff

    // Then by accuracy (lower is higher priority)
    return a.accuracy - b.accuracy
  })

  return sorted.slice(0, count).map((skill) => ({
    skillId: skill.skillId,
    displayName: skill.displayName,
    category: skill.category,
    accuracy: skill.accuracy,
    attempts: skill.attempts,
    status: skill.status,
    reason:
      skill.status === 'weak'
        ? 'needs_practice'
        : skill.status === 'developing'
          ? 'close_to_mastery'
          : 'maintenance',
  }))
}
