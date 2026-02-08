import { type NextRequest, NextResponse } from 'next/server'
import type { SessionPlan, GameBreakSettings } from '@/db/schema/session-plans'
import { canPerformAction } from '@/lib/classroom'
import {
  ActiveSessionExistsError,
  type EnabledParts,
  type GenerateSessionPlanOptions,
  generateSessionPlan,
  getActiveSessionPlan,
  NoSkillsEnabledError,
} from '@/lib/curriculum'
import type { ProblemGenerationMode } from '@/lib/curriculum/config'
import type { SessionMode } from '@/lib/curriculum/session-mode'
import { getDbUserId } from '@/lib/viewer'

interface RouteParams {
  params: Promise<{ playerId: string }>
}

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
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { playerId } = await params

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
}

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
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { playerId } = await params

  try {
    // Authorization check - only parents/present teachers can create sessions
    const userId = await getDbUserId()
    const canCreate = await canPerformAction(userId, playerId, 'start-session')
    if (!canCreate) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    const body = await request.json()
    const {
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

    // Validate enabledParts if provided
    if (enabledParts) {
      const validParts = ['abacus', 'visualization', 'linear']
      const enabledCount = validParts.filter((p) => enabledParts[p] === true).length
      if (enabledCount === 0) {
        return NextResponse.json({ error: 'At least one part must be enabled' }, { status: 400 })
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

    const options: GenerateSessionPlanOptions = {
      playerId,
      durationMinutes,
      enabledParts: enabledParts as EnabledParts | undefined,
      problemGenerationMode: problemGenerationMode as ProblemGenerationMode | undefined,
      confidenceThreshold:
        typeof confidenceThreshold === 'number' ? confidenceThreshold : undefined,
      sessionMode: sessionMode as SessionMode | undefined,
      gameBreakSettings: gameBreakSettings as GameBreakSettings | undefined,
      comfortAdjustment:
        typeof comfortAdjustment === 'number' ? comfortAdjustment : undefined,
      ...(Object.keys(configOverrides).length > 0 && {
        config: configOverrides,
      }),
      ...(shufflePurposes !== undefined && { shufflePurposes }),
    }

    const plan = await generateSessionPlan(options)
    return NextResponse.json({ plan: serializePlan(plan) }, { status: 201 })
  } catch (error) {
    // Handle active session conflict
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

    // Handle no skills enabled
    if (error instanceof NoSkillsEnabledError) {
      return NextResponse.json(
        {
          error: error.message,
          code: 'NO_SKILLS_ENABLED',
        },
        { status: 400 }
      )
    }

    console.error('Error generating session plan:', error)
    return NextResponse.json({ error: 'Failed to generate session plan' }, { status: 500 })
  }
}
