/**
 * MCP Tool implementations for curriculum data access
 */

import { eq, or, inArray, desc, and, gte } from 'drizzle-orm'
import { db, schema } from '@/db'
import { parentChild, worksheetShares } from '@/db/schema'
import type { GameBreakSettings } from '@/db/schema/session-plans'
import { getAllSkillMastery, getRecentSessions } from '@/lib/curriculum/progress-manager'
import {
  getRecentSessionResults,
  generateSessionPlan,
  getActiveSessionPlan,
  approveSessionPlan,
  startSessionPlan,
  completeSessionPlanEarly,
  abandonSessionPlan,
  type EnabledParts,
} from '@/lib/curriculum/session-planner'
import {
  createSessionShare,
  getActiveSharesForSession,
  type ShareDuration,
} from '@/lib/session-share'
import { getShareUrl } from '@/lib/share/urls'
import { generateShareId, isValidShareId } from '@/lib/generateShareId'
import {
  DIFFICULTY_PROFILES,
  DIFFICULTY_PROGRESSION,
  type DifficultyProfile,
} from '@/app/create/worksheets/difficultyProfiles'
import {
  serializeAdditionConfig,
  parseAdditionConfig,
  defaultAdditionConfig,
  type AdditionConfigV4Custom,
} from '@/app/create/worksheets/config-schemas'

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
  // Session management tools
  {
    name: 'start_practice_session',
    description:
      'Create and optionally start a new practice session for a student. Returns URLs for practice and observation.',
    inputSchema: {
      type: 'object',
      properties: {
        player_id: {
          type: 'string',
          description: 'The student player ID',
        },
        duration_minutes: {
          type: 'number',
          description: 'Session duration in minutes (5-60)',
        },
        auto_start: {
          type: 'boolean',
          description:
            'If true, immediately approve and start the session. If false (default), creates a draft that needs approval.',
        },
        enabled_parts: {
          type: 'object',
          description: 'Which practice parts to enable. Default: all enabled.',
          properties: {
            abacus: {
              type: 'boolean',
              description: 'Physical abacus practice (default: true)',
            },
            visualization: {
              type: 'boolean',
              description: 'Mental math with visualization (default: true)',
            },
            linear: {
              type: 'boolean',
              description: 'Mental math with equations (default: true)',
            },
          },
        },
        max_terms: {
          type: 'number',
          description: 'Maximum terms per problem (3-12, default: 5)',
        },
        game_breaks: {
          type: 'object',
          description: 'Game break settings between session parts',
          properties: {
            enabled: {
              type: 'boolean',
              description: 'Allow game breaks (default: true)',
            },
            max_minutes: {
              type: 'number',
              description: 'Maximum game break duration in minutes (default: 5)',
            },
            selection_mode: {
              type: 'string',
              enum: ['auto-start', 'kid-chooses'],
              description: 'How game is selected (default: kid-chooses)',
            },
          },
        },
      },
      required: ['player_id', 'duration_minutes'],
    },
  },
  {
    name: 'get_active_session',
    description:
      'Get the current active practice session for a student, including URLs for practice and observation.',
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
    name: 'control_session',
    description:
      'Control an active session: approve a draft, start an approved session, end early, or abandon.',
    inputSchema: {
      type: 'object',
      properties: {
        player_id: {
          type: 'string',
          description: 'The student player ID',
        },
        session_id: {
          type: 'string',
          description: 'The session plan ID',
        },
        action: {
          type: 'string',
          enum: ['approve', 'start', 'end_early', 'abandon'],
          description: 'Action to perform on the session',
        },
      },
      required: ['player_id', 'session_id', 'action'],
    },
  },
  {
    name: 'create_observation_link',
    description:
      'Generate a shareable URL that allows anyone (without login) to observe a practice session in real-time.',
    inputSchema: {
      type: 'object',
      properties: {
        player_id: {
          type: 'string',
          description: 'The student player ID',
        },
        session_id: {
          type: 'string',
          description: 'The session plan ID',
        },
        expires_in: {
          type: 'string',
          enum: ['1h', '24h'],
          description: 'How long the link should be valid',
        },
      },
      required: ['player_id', 'session_id', 'expires_in'],
    },
  },
  {
    name: 'list_observation_links',
    description: 'List all active (non-expired, non-revoked) observation links for a session.',
    inputSchema: {
      type: 'object',
      properties: {
        player_id: {
          type: 'string',
          description: 'The student player ID',
        },
        session_id: {
          type: 'string',
          description: 'The session plan ID',
        },
      },
      required: ['player_id', 'session_id'],
    },
  },
  // Worksheet generation tools
  {
    name: 'generate_worksheet',
    description:
      'Generate a math worksheet with configurable difficulty, scaffolding, and layout. Returns share and download URLs.',
    inputSchema: {
      type: 'object',
      properties: {
        operator: {
          type: 'string',
          enum: ['addition', 'subtraction', 'mixed'],
          description: 'Type of math operation (default: addition)',
        },
        digit_range: {
          type: 'object',
          description: 'Range of digits per number (default: { min: 2, max: 2 })',
          properties: {
            min: {
              type: 'number',
              description: 'Minimum digits (1-5)',
            },
            max: {
              type: 'number',
              description: 'Maximum digits (1-5)',
            },
          },
        },
        problems_per_page: {
          type: 'number',
          description: 'Number of problems per page (default: 20)',
        },
        pages: {
          type: 'number',
          description: 'Number of pages (default: 1)',
        },
        difficulty_profile: {
          type: 'string',
          enum: ['beginner', 'earlyLearner', 'practice', 'intermediate', 'advanced', 'expert'],
          description: 'Preset difficulty profile that controls regrouping and scaffolding',
        },
        include_answer_key: {
          type: 'boolean',
          description: 'Include answer key pages at end (default: false)',
        },
        title: {
          type: 'string',
          description: 'Optional title for the worksheet',
        },
        orientation: {
          type: 'string',
          enum: ['portrait', 'landscape'],
          description: 'Page orientation (default: landscape)',
        },
        cols: {
          type: 'number',
          description: 'Number of columns (1-6, default: 5)',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_worksheet_info',
    description: 'Get information about an existing shared worksheet by its share ID.',
    inputSchema: {
      type: 'object',
      properties: {
        share_id: {
          type: 'string',
          description: 'The worksheet share ID',
        },
      },
      required: ['share_id'],
    },
  },
  {
    name: 'list_difficulty_profiles',
    description:
      'List all available difficulty profiles with their regrouping and scaffolding settings.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
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

// ============================================================================
// Session Management Tools
// ============================================================================

/**
 * Get the base URL for generating practice/observation URLs
 */
function getBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || 'https://abaci.one'
}

/**
 * Build practice and observation URLs for a player
 */
function buildSessionUrls(playerId: string) {
  const baseUrl = getBaseUrl()
  return {
    practiceUrl: `${baseUrl}/practice/${playerId}`,
    observeUrl: `${baseUrl}/practice/${playerId}/observe`,
  }
}

/**
 * Start a new practice session for a student
 */
export async function startPracticeSession(
  playerId: string,
  userId: string,
  options: {
    durationMinutes: number
    autoStart?: boolean
    enabledParts?: {
      abacus?: boolean
      visualization?: boolean
      linear?: boolean
    }
    maxTerms?: number
    gameBreaks?: {
      enabled?: boolean
      maxMinutes?: number
      selectionMode?: 'auto-start' | 'kid-chooses'
    }
  }
) {
  const { durationMinutes, autoStart = false, enabledParts, maxTerms, gameBreaks } = options

  // Build enabled parts with defaults
  const parts: EnabledParts = {
    abacus: enabledParts?.abacus ?? true,
    visualization: enabledParts?.visualization ?? true,
    linear: enabledParts?.linear ?? true,
  }

  // Build game break settings
  const gameBreakSettings: GameBreakSettings | undefined = gameBreaks
    ? {
        enabled: gameBreaks.enabled ?? true,
        maxDurationMinutes: gameBreaks.maxMinutes ?? 5,
        selectionMode: gameBreaks.selectionMode ?? 'kid-chooses',
        selectedGame: null,
        skipSetupPhase: true,
      }
    : undefined

  // Generate session plan
  let plan = await generateSessionPlan({
    playerId,
    durationMinutes,
    enabledParts: parts,
    gameBreakSettings,
    ...(maxTerms && {
      config: {
        abacusTermCount: { min: 3, max: maxTerms },
      },
    }),
  })

  // If auto_start, approve and start the session
  if (autoStart) {
    plan = await approveSessionPlan(plan.id)
    plan = await startSessionPlan(plan.id)
  }

  const urls = buildSessionUrls(playerId)

  // Build summary from plan parts
  const partSummaries = plan.parts.map((part) => ({
    partNumber: part.partNumber,
    type: part.type,
    problemCount: part.slots.length,
    estimatedMinutes: part.estimatedMinutes,
  }))

  const totalProblems = plan.parts.reduce((sum, part) => sum + part.slots.length, 0)
  const totalMinutes = plan.parts.reduce((sum, part) => sum + part.estimatedMinutes, 0)

  return {
    sessionId: plan.id,
    status: plan.status,
    practiceUrl: urls.practiceUrl,
    observeUrl: urls.observeUrl,
    summary: {
      totalProblemCount: totalProblems,
      estimatedMinutes: Math.round(totalMinutes),
      parts: partSummaries,
    },
  }
}

/**
 * Get the active session for a student
 */
export async function getActiveSession(playerId: string) {
  const plan = await getActiveSessionPlan(playerId)

  if (!plan) {
    // Get last completed session date
    const recentSessions = await getRecentSessions(playerId, 1)
    const lastSession = recentSessions[0]

    return {
      hasActiveSession: false,
      lastSessionAt: lastSession?.completedAt?.getTime() ?? null,
    }
  }

  const urls = buildSessionUrls(playerId)

  // Calculate progress
  const totalProblems = plan.parts.reduce((sum, part) => sum + part.slots.length, 0)
  const completedProblems = plan.results.length
  const correctAnswers = plan.results.filter((r) => r.isCorrect).length
  const accuracy = completedProblems > 0 ? correctAnswers / completedProblems : 0

  // Find current position
  let currentPart = 1
  let currentProblem = 1
  for (const part of plan.parts) {
    const partResults = plan.results.filter((r) => r.partNumber === part.partNumber)
    if (partResults.length < part.slots.length) {
      currentPart = part.partNumber
      currentProblem = partResults.length + 1
      break
    }
  }

  return {
    hasActiveSession: true,
    sessionId: plan.id,
    status: plan.status,
    practiceUrl: urls.practiceUrl,
    observeUrl: urls.observeUrl,
    startedAt: plan.startedAt?.getTime() ?? null,
    progress: {
      currentPart,
      currentProblem,
      totalProblems,
      completedProblems,
      accuracy: Math.round(accuracy * 100),
    },
  }
}

/**
 * Control an active session (approve, start, end, abandon)
 */
export async function controlSession(
  playerId: string,
  sessionId: string,
  action: 'approve' | 'start' | 'end_early' | 'abandon'
) {
  let plan
  let message: string

  switch (action) {
    case 'approve':
      plan = await approveSessionPlan(sessionId)
      message = 'Session approved and ready to start'
      break
    case 'start':
      plan = await startSessionPlan(sessionId)
      message = 'Session started'
      break
    case 'end_early':
      plan = await completeSessionPlanEarly(sessionId, 'Ended via MCP')
      message = 'Session ended early'
      break
    case 'abandon':
      plan = await abandonSessionPlan(sessionId)
      message = 'Session abandoned'
      break
  }

  return {
    success: true,
    sessionId: plan.id,
    newStatus: plan.status,
    message,
  }
}

/**
 * Create a shareable observation link for a session
 */
export async function createObservationLink(
  playerId: string,
  sessionId: string,
  userId: string,
  expiresIn: ShareDuration
) {
  const share = await createSessionShare(sessionId, playerId, userId, expiresIn)

  return {
    token: share.id,
    url: getShareUrl('observe', share.id),
    expiresAt: share.expiresAt.getTime(),
  }
}

/**
 * List active observation links for a session
 */
export async function listObservationLinks(playerId: string, sessionId: string) {
  const shares = await getActiveSharesForSession(sessionId)

  return {
    shares: shares.map((share) => ({
      token: share.id,
      url: getShareUrl('observe', share.id),
      expiresAt: share.expiresAt.getTime(),
      viewCount: share.viewCount,
      createdAt: share.createdAt.getTime(),
    })),
  }
}

// ============================================================================
// Worksheet Generation Tools
// ============================================================================

/**
 * Generate a worksheet with the given configuration
 * Returns share and download URLs
 */
export async function generateWorksheet(options: {
  operator?: 'addition' | 'subtraction' | 'mixed'
  digitRange?: { min: number; max: number }
  problemsPerPage?: number
  pages?: number
  difficultyProfile?: string
  includeAnswerKey?: boolean
  title?: string
  orientation?: 'portrait' | 'landscape'
  cols?: number
}) {
  const baseUrl = getBaseUrl()

  // Build config from options, using defaults
  const {
    operator = 'addition',
    digitRange = { min: 2, max: 2 },
    problemsPerPage = 20,
    pages = 1,
    difficultyProfile = 'earlyLearner',
    includeAnswerKey = false,
    title = '',
    orientation = 'landscape',
    cols = 5,
  } = options

  // Validate digit range
  const validDigitRange = {
    min: Math.max(1, Math.min(5, digitRange.min || 2)),
    max: Math.max(1, Math.min(5, digitRange.max || 2)),
  }
  if (validDigitRange.min > validDigitRange.max) {
    validDigitRange.max = validDigitRange.min
  }

  // Get difficulty profile settings
  const profile = DIFFICULTY_PROFILES[difficultyProfile] || DIFFICULTY_PROFILES.earlyLearner

  // Build worksheet config
  const config: AdditionConfigV4Custom = {
    version: 4,
    mode: 'custom',
    operator,
    digitRange: validDigitRange,
    problemsPerPage: Math.max(1, Math.min(40, problemsPerPage)),
    pages: Math.max(1, Math.min(20, pages)),
    cols: Math.max(1, Math.min(6, cols)),
    orientation,
    name: title,
    fontSize: 16,
    pAnyStart: profile.regrouping.pAnyStart,
    pAllStart: profile.regrouping.pAllStart,
    interpolate: true,
    displayRules: profile.displayRules,
    difficultyProfile: profile.name,
    includeAnswerKey,
    includeQRCode: true, // Always include QR code for MCP-generated worksheets
    seed: Math.floor(Math.random() * 1000000), // Random seed for unique problems
  }

  // Generate unique share ID
  let shareId = generateShareId()
  let attempts = 0
  const MAX_ATTEMPTS = 5
  let isUnique = false

  while (!isUnique && attempts < MAX_ATTEMPTS) {
    shareId = generateShareId()
    const existing = await db.query.worksheetShares.findFirst({
      where: eq(worksheetShares.id, shareId),
    })

    if (!existing) {
      isUnique = true
    } else {
      attempts++
    }
  }

  if (!isUnique) {
    throw new Error('Failed to generate unique share ID')
  }

  // Serialize config
  const configJson = serializeAdditionConfig(config)

  // Create share record
  await db.insert(worksheetShares).values({
    id: shareId,
    worksheetType: 'addition',
    config: configJson,
    createdAt: new Date(),
    views: 0,
    creatorIp: 'mcp', // Mark as MCP-generated
    title: title || null,
  })

  // Build URLs
  const shareUrl = `${baseUrl}/worksheets/shared/${shareId}`
  const downloadUrl = `${baseUrl}/api/worksheets/download/${shareId}`

  // Build summary
  const totalProblems = config.problemsPerPage * config.pages
  const summary = {
    shareId,
    operator: config.operator,
    digitRange: config.digitRange,
    totalProblems,
    pages: config.pages,
    problemsPerPage: config.problemsPerPage,
    cols: config.cols,
    orientation: config.orientation,
    difficultyProfile: profile.name,
    difficultyLabel: profile.label,
    regroupingPercent: Math.round(profile.regrouping.pAnyStart * 100),
    includeAnswerKey: config.includeAnswerKey,
    scaffolding: {
      carryBoxes: profile.displayRules.carryBoxes,
      answerBoxes: profile.displayRules.answerBoxes,
      placeValueColors: profile.displayRules.placeValueColors,
      tenFrames: profile.displayRules.tenFrames,
    },
  }

  return {
    shareId,
    shareUrl,
    downloadUrl,
    summary,
  }
}

/**
 * Get information about an existing shared worksheet
 */
export async function getWorksheetInfo(shareId: string) {
  // Validate ID format
  if (!isValidShareId(shareId)) {
    throw new Error('Invalid share ID format')
  }

  // Fetch share record
  const share = await db.query.worksheetShares.findFirst({
    where: eq(worksheetShares.id, shareId),
  })

  if (!share) {
    throw new Error('Worksheet not found')
  }

  // Parse config
  const config = parseAdditionConfig(share.config)
  const baseUrl = getBaseUrl()

  // Find matching difficulty profile
  let matchedProfile: DifficultyProfile | undefined
  if (config.mode === 'custom' && config.difficultyProfile) {
    matchedProfile = DIFFICULTY_PROFILES[config.difficultyProfile]
  }

  const totalProblems = config.problemsPerPage * config.pages

  return {
    shareId: share.id,
    shareUrl: `${baseUrl}/worksheets/shared/${share.id}`,
    downloadUrl: `${baseUrl}/api/worksheets/download/${share.id}`,
    title: share.title,
    worksheetType: share.worksheetType,
    createdAt: share.createdAt.toISOString(),
    views: share.views,
    config: {
      operator: config.operator,
      digitRange: config.digitRange,
      totalProblems,
      pages: config.pages,
      problemsPerPage: config.problemsPerPage,
      cols: config.cols,
      orientation: config.orientation,
      difficultyProfile: matchedProfile?.name || 'custom',
      difficultyLabel: matchedProfile?.label || 'Custom',
      regroupingPercent: Math.round(config.pAnyStart * 100),
      includeAnswerKey: config.includeAnswerKey || false,
    },
  }
}

/**
 * List all available difficulty profiles
 */
export function listDifficultyProfiles() {
  return {
    profiles: DIFFICULTY_PROGRESSION.map((name) => {
      const profile = DIFFICULTY_PROFILES[name]
      return {
        name: profile.name,
        label: profile.label,
        description: profile.description,
        regrouping: {
          pAnyStart: profile.regrouping.pAnyStart,
          pAllStart: profile.regrouping.pAllStart,
          percent: Math.round(profile.regrouping.pAnyStart * 100),
        },
        scaffolding: {
          carryBoxes: profile.displayRules.carryBoxes,
          answerBoxes: profile.displayRules.answerBoxes,
          placeValueColors: profile.displayRules.placeValueColors,
          tenFrames: profile.displayRules.tenFrames,
          borrowNotation: profile.displayRules.borrowNotation,
          borrowingHints: profile.displayRules.borrowingHints,
        },
      }
    }),
    progression: DIFFICULTY_PROGRESSION,
  }
}
