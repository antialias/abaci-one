/**
 * API route for skill tutorial management
 *
 * POST /api/curriculum/[playerId]/tutorial - Handle tutorial actions
 *   - action: 'complete' - Mark a tutorial as completed
 *   - action: 'skip' - Record that the tutorial was skipped
 *   - action: 'override' - Teacher override (requires reason)
 *
 * GET /api/curriculum/[playerId]/tutorial?skillId=xxx - Get tutorial status
 */

import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/withAuth'
import { canPerformAction } from '@/lib/classroom'
import {
  getSkillTutorialProgress,
  markTutorialComplete,
  recordTutorialSkip,
  applyTutorialOverride,
  enableSkillForPractice,
} from '@/lib/curriculum/progress-manager'
import { getSkillTutorialConfig } from '@/lib/curriculum/skill-unlock'
import { getUserId } from '@/lib/viewer'

/**
 * GET - Get tutorial progress for a specific skill
 */
export const GET = withAuth(async (request, { params }) => {
  try {
    const { playerId } = (await params) as { playerId: string }

    if (!playerId) {
      return NextResponse.json({ error: 'Player ID required' }, { status: 400 })
    }

    // Authorization check
    const userId = await getUserId()
    const canView = await canPerformAction(userId, playerId, 'view')
    if (!canView) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const skillId = searchParams.get('skillId')

    if (!skillId) {
      return NextResponse.json({ error: 'Skill ID required' }, { status: 400 })
    }

    const progress = await getSkillTutorialProgress(playerId, skillId)
    const config = getSkillTutorialConfig(skillId)

    return NextResponse.json({
      progress,
      tutorialAvailable: !!config,
      config: config
        ? {
            title: config.title,
            description: config.description,
            problemCount: config.exampleProblems.length,
          }
        : null,
    })
  } catch (error) {
    console.error('Error fetching tutorial progress:', error)
    return NextResponse.json({ error: 'Failed to fetch tutorial progress' }, { status: 500 })
  }
})

/**
 * POST - Handle tutorial actions
 */
export const POST = withAuth(async (request, { params }) => {
  try {
    const { playerId } = (await params) as { playerId: string }

    if (!playerId) {
      return NextResponse.json({ error: 'Player ID required' }, { status: 400 })
    }

    const body = await request.json()
    const { skillId, action, reason } = body

    if (!skillId) {
      return NextResponse.json({ error: 'Skill ID required' }, { status: 400 })
    }

    if (!action || !['complete', 'skip', 'override'].includes(action)) {
      return NextResponse.json(
        { error: 'Valid action required (complete, skip, or override)' },
        { status: 400 }
      )
    }

    let progress

    switch (action) {
      case 'complete':
        // Mark tutorial complete and enable skill for practice
        progress = await markTutorialComplete(playerId, skillId)
        // Automatically enable the skill for practice after completing tutorial
        await enableSkillForPractice(playerId, skillId)
        break

      case 'skip':
        // Record that the tutorial was skipped
        progress = await recordTutorialSkip(playerId, skillId)
        break

      case 'override':
        // Teacher override - requires reason
        if (!reason) {
          return NextResponse.json(
            { error: 'Reason required for teacher override' },
            { status: 400 }
          )
        }
        progress = await applyTutorialOverride(playerId, skillId, reason)
        // Also enable the skill for practice
        await enableSkillForPractice(playerId, skillId)
        break
    }

    return NextResponse.json({
      success: true,
      progress,
    })
  } catch (error) {
    console.error('Error handling tutorial action:', error)
    return NextResponse.json({ error: 'Failed to handle tutorial action' }, { status: 500 })
  }
})
