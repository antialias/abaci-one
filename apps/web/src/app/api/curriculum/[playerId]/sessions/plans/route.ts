import { and, eq, gte, inArray } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db, schema } from '@/db'
import type { SessionPlan, GameBreakSettings } from '@/db/schema/session-plans'
import { withAuth } from '@/lib/auth/withAuth'
import { canPerformAction } from '@/lib/classroom'
import {
  ActiveSessionExistsError,
  type EnabledParts,
  getActiveSessionPlan,
  NoSkillsEnabledError,
} from '@/lib/curriculum'
import type { ProblemGenerationMode } from '@/lib/curriculum/config'
import type { SessionMode } from '@/lib/curriculum/session-mode'
import { getLimitsForUser } from '@/lib/subscription'
import { startSessionPlanGeneration } from '@/lib/tasks/session-plan'
import { getDbUserId } from '@/lib/viewer'

/**
 * Serialize a SessionPlan for JSON response.
 * Converts Date objects to timestamps (milliseconds) for consistent client handling.
 */
function serializePlan(plan: SessionPlan) {
  return {
    ...plan,
    createdAt: plan.createdAt instanceof Date ? plan.createdAt.getTime() : plan.createdAt,
    approvedAt: plan.approvedAt instanceof Date ? plan.approvedAt.getTime() : plan.approvedAt,
    startedAt: plan.startedAt instanceof Date ? plan.startedAt.getTime() : plan.startedAt,
    completedAt: plan.completedAt instanceof Date ? plan.completedAt.getTime() : plan.completedAt,
  }
}

/**
 * GET /api/curriculum/[playerId]/sessions/plans
 * Get the active session plan for a player (if any)
 */
export const GET = withAuth(async (_request, { params }) => {
  const { playerId } = (await params) as { playerId: string }

  try {
    // Authorization check
    const userId = await getDbUserId()
    const canView = await canPerformAction(userId, playerId, 'view')
    if (!canView) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    const plan = await getActiveSessionPlan(playerId)
    return NextResponse.json({ plan: plan ? serializePlan(plan) : null })
  } catch (error) {
    console.error('Error fetching active plan:', error)
    return NextResponse.json({ error: 'Failed to fetch active plan' }, { status: 500 })
  }
})

/**
 * POST /api/curriculum/[playerId]/sessions/plans
 * Generate a new session plan
 *
 * Body:
 * - durationMinutes: number (required) - Total session duration
 * - abacusTermCount?: { min: number, max: number } - Term count for abacus part
 *   (visualization auto-calculates as 75% of abacus)
 * - enabledParts?: { abacus: boolean, visualization: boolean, linear: boolean } - Which parts to include
 *   (default: all enabled)
 * - problemGenerationMode?: 'adaptive' | 'classic' - Problem generation algorithm
 *   - 'adaptive': BKT-based continuous scaling (default)
 *   - 'classic': Fluency-based discrete states
 *
 * The plan will include the selected parts:
 * - Part 1: Abacus (use physical abacus, vertical format)
 * - Part 2: Visualization (mental math, vertical format)
 * - Part 3: Linear (mental math, sentence format)
 */
export const POST = withAuth(async (request, { params }) => {
  const { playerId } = (await params) as { playerId: string }

  try {
    // Authorization check - only parents/present teachers can create sessions
    const userId = await getDbUserId()
    const canCreate = await canPerformAction(userId, playerId, 'start-session')
    if (!canCreate) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    // Enforce tier limits (duration cap + sessions-per-week)
    const limits = await getLimitsForUser(userId)

    const body = await request.json()
    let {
      durationMinutes,
      abacusTermCount,
      enabledParts,
      partTimeWeights,
      purposeTimeWeights,
      shufflePurposes,
      problemGenerationMode,
      confidenceThreshold,
      sessionMode,
      gameBreakSettings,
      comfortAdjustment,
    } = body

    if (!durationMinutes || typeof durationMinutes !== 'number') {
      return NextResponse.json(
        { error: 'durationMinutes is required and must be a number' },
        { status: 400 }
      )
    }

    // Clamp duration to tier max
    if (durationMinutes > limits.maxSessionMinutes) {
      durationMinutes = limits.maxSessionMinutes
    }

    // Enforce sessions-per-week limit (rolling 7-day window)
    if (limits.maxSessionsPerWeek !== Infinity) {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      const completedStatuses = ['completed', 'in_progress', 'approved'] as const
      const recentSessions = await db
        .select({ id: schema.sessionPlans.id })
        .from(schema.sessionPlans)
        .where(
          and(
            eq(schema.sessionPlans.playerId, playerId),
            inArray(schema.sessionPlans.status, [...completedStatuses]),
            gte(schema.sessionPlans.createdAt, sevenDaysAgo)
          )
        )
        .all()
      if (recentSessions.length >= limits.maxSessionsPerWeek) {
        return NextResponse.json(
          {
            error: 'Weekly session limit reached',
            code: 'SESSION_LIMIT_REACHED',
            limit: limits.maxSessionsPerWeek,
            count: recentSessions.length,
          },
          { status: 403 }
        )
      }
    }

    // Validate enabledParts if provided
    if (enabledParts) {
      const validParts = ['abacus', 'visualization', 'linear']
      const enabledCount = validParts.filter((p) => enabledParts[p] === true).length
      if (enabledCount === 0) {
        return NextResponse.json({ error: 'At least one part must be enabled' }, { status: 400 })
      }
    }

    // Pre-check for active session before creating the task
    // This gives immediate feedback rather than waiting for the task to fail
    const existingActive = await getActiveSessionPlan(playerId)
    if (existingActive) {
      // Check if session has timed out (same logic as generateSessionPlan)
      const sessionAgeMs = Date.now() - new Date(existingActive.createdAt).getTime()
      const timeoutMs = 24 * 60 * 60 * 1000 // 24 hours default
      if (sessionAgeMs <= timeoutMs) {
        return NextResponse.json(
          {
            error: 'Active session exists',
            code: 'ACTIVE_SESSION_EXISTS',
            existingPlan: serializePlan(existingActive),
          },
          { status: 409 }
        )
      }
    }

    const configOverrides: Record<string, unknown> = {}
    if (abacusTermCount) configOverrides.abacusTermCount = abacusTermCount
    if (partTimeWeights) configOverrides.partTimeWeights = partTimeWeights
    if (purposeTimeWeights) {
      configOverrides.focusWeight = purposeTimeWeights.focus
      configOverrides.reinforceWeight = purposeTimeWeights.reinforce
      configOverrides.reviewWeight = purposeTimeWeights.review
      configOverrides.challengeWeight = purposeTimeWeights.challenge
    }

    // Create background task for session plan generation
    const taskId = await startSessionPlanGeneration(
      {
        playerId,
        durationMinutes,
        enabledParts: enabledParts as EnabledParts | undefined,
        problemGenerationMode: problemGenerationMode as ProblemGenerationMode | undefined,
        confidenceThreshold:
          typeof confidenceThreshold === 'number' ? confidenceThreshold : undefined,
        sessionMode: sessionMode as SessionMode | undefined,
        gameBreakSettings: gameBreakSettings as GameBreakSettings | undefined,
        comfortAdjustment: typeof comfortAdjustment === 'number' ? comfortAdjustment : undefined,
        ...(Object.keys(configOverrides).length > 0 && {
          config: configOverrides,
        }),
        ...(shufflePurposes !== undefined && { shufflePurposes }),
      },
      userId
    )

    return NextResponse.json({ taskId }, { status: 202 })
  } catch (error) {
    // Handle active session conflict (from pre-check)
    if (error instanceof ActiveSessionExistsError) {
      return NextResponse.json(
        {
          error: 'Active session exists',
          code: 'ACTIVE_SESSION_EXISTS',
          existingPlan: serializePlan(error.existingSession),
        },
        { status: 409 }
      )
    }

    // Handle no skills enabled (from early validation)
    if (error instanceof NoSkillsEnabledError) {
      return NextResponse.json(
        {
          error: error.message,
          code: 'NO_SKILLS_ENABLED',
        },
        { status: 400 }
      )
    }

    console.error('Error creating session plan task:', error)
    return NextResponse.json({ error: 'Failed to create session plan task' }, { status: 500 })
  }
})
