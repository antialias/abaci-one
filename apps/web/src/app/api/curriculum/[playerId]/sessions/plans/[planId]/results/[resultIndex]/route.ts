import { type NextRequest, NextResponse } from 'next/server'
import { canPerformAction } from '@/lib/classroom'
import { getSessionPlan } from '@/lib/curriculum'
import { updateSessionPlanResults } from '@/lib/curriculum/session-planner'
import { getDbUserId } from '@/lib/viewer'

interface RouteParams {
  params: Promise<{ playerId: string; planId: string; resultIndex: string }>
}

/**
 * PATCH /api/curriculum/[playerId]/sessions/plans/[planId]/results/[resultIndex]
 * Edit a specific result in the session plan
 *
 * Actions:
 * - mark_correct: Change an incorrect result to correct
 * - exclude: Mark result as excluded from tracking (source: 'teacher-excluded')
 * - include: Remove exclusion (restore original source)
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { playerId, planId, resultIndex: resultIndexStr } = await params
  const resultIndex = parseInt(resultIndexStr, 10)

  if (isNaN(resultIndex) || resultIndex < 0) {
    return NextResponse.json({ error: 'Invalid result index' }, { status: 400 })
  }

  try {
    // Authorization: require 'start-session' permission (parent or teacher-present)
    const userId = await getDbUserId()
    const canModify = await canPerformAction(userId, playerId, 'start-session')
    if (!canModify) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    const body = await request.json()
    const { action } = body

    // Get current plan
    const plan = await getSessionPlan(planId)
    if (!plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    }

    // Validate result index
    if (resultIndex >= plan.results.length) {
      return NextResponse.json({ error: 'Result index out of bounds' }, { status: 400 })
    }

    const result = plan.results[resultIndex]
    const updatedResults = [...plan.results]

    switch (action) {
      case 'mark_correct': {
        if (result.isCorrect) {
          return NextResponse.json({ error: 'Result is already correct' }, { status: 400 })
        }

        // Mark as correct and recalculate mastery weight
        const epochNumber = result.epochNumber ?? 0
        const masteryWeight = 1.0 / 2 ** epochNumber

        updatedResults[resultIndex] = {
          ...result,
          isCorrect: true,
          masteryWeight,
          // Add marker that this was teacher-corrected for audit trail
          source: 'teacher-corrected' as const,
        }

        // Handle retry queue implications
        // If this was epoch 0 and there are retry results for this slot, we should handle that
        // For now, we'll leave the retry results in place - they still happened
        // The BKT will recalculate based on the corrected result

        break
      }

      case 'exclude': {
        if (result.source === 'teacher-excluded') {
          return NextResponse.json({ error: 'Result is already excluded' }, { status: 400 })
        }

        // Store original source so we can restore it
        const originalSource = result.source

        updatedResults[resultIndex] = {
          ...result,
          source: 'teacher-excluded' as const,
          // Store original source in a new field for potential restoration
          _originalSource: originalSource,
        } as typeof result & { _originalSource?: string }

        break
      }

      case 'include': {
        if (result.source !== 'teacher-excluded') {
          return NextResponse.json({ error: 'Result is not excluded' }, { status: 400 })
        }

        // Restore original source
        const originalSource = (result as typeof result & { _originalSource?: string })
          ._originalSource

        updatedResults[resultIndex] = {
          ...result,
          source: (originalSource as typeof result.source) ?? 'practice',
        }

        // Remove the _originalSource field
        delete (
          updatedResults[resultIndex] as typeof result & {
            _originalSource?: string
          }
        )._originalSource

        break
      }

      default:
        return NextResponse.json(
          {
            error: 'Invalid action. Must be: mark_correct, exclude, or include',
          },
          { status: 400 }
        )
    }

    // Update the plan with modified results
    const updatedPlan = await updateSessionPlanResults(planId, updatedResults)

    return NextResponse.json({
      plan: {
        ...updatedPlan,
        createdAt:
          updatedPlan.createdAt instanceof Date
            ? updatedPlan.createdAt.getTime()
            : updatedPlan.createdAt,
        approvedAt:
          updatedPlan.approvedAt instanceof Date
            ? updatedPlan.approvedAt.getTime()
            : updatedPlan.approvedAt,
        startedAt:
          updatedPlan.startedAt instanceof Date
            ? updatedPlan.startedAt.getTime()
            : updatedPlan.startedAt,
        completedAt:
          updatedPlan.completedAt instanceof Date
            ? updatedPlan.completedAt.getTime()
            : updatedPlan.completedAt,
      },
    })
  } catch (error) {
    console.error('Error updating result:', error)
    return NextResponse.json({ error: 'Failed to update result' }, { status: 500 })
  }
}
