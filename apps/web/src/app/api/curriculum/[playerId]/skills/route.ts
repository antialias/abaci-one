/**
 * API route for skill mastery operations
 *
 * POST /api/curriculum/[playerId]/skills - Record a skill attempt
 * PUT /api/curriculum/[playerId]/skills - Set mastered skills (manual override)
 * PATCH /api/curriculum/[playerId]/skills - Refresh skill recency (sets lastPracticedAt to now)
 */

import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/withAuth'
import { canPerformAction } from '@/lib/classroom'
import {
  recordSkillAttempt,
  refreshSkillRecency,
  setMasteredSkills,
} from '@/lib/curriculum/progress-manager'
import { getDbUserId } from '@/lib/viewer'

/**
 * POST - Record a single skill attempt
 * Requires 'start-session' permission (parent or teacher-present)
 */
export const POST = withAuth(async (request, { params }) => {
  try {
    const { playerId } = (await params) as { playerId: string }

    if (!playerId) {
      return NextResponse.json({ error: 'Player ID required' }, { status: 400 })
    }

    // Authorization: require 'start-session' permission (parent or teacher-present)
    const userId = await getDbUserId()
    const canModify = await canPerformAction(userId, playerId, 'start-session')
    if (!canModify) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    const body = await request.json()
    const { skillId, isCorrect } = body

    if (!skillId) {
      return NextResponse.json({ error: 'Skill ID required' }, { status: 400 })
    }

    if (typeof isCorrect !== 'boolean') {
      return NextResponse.json({ error: 'isCorrect must be a boolean' }, { status: 400 })
    }

    const result = await recordSkillAttempt(playerId, skillId, isCorrect)

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error recording skill attempt:', error)
    return NextResponse.json({ error: 'Failed to record skill attempt' }, { status: 500 })
  }
})

/**
 * PUT - Set which skills are mastered (teacher manual override)
 * Requires 'start-session' permission (parent or teacher-present)
 * Body: { masteredSkillIds: string[] }
 */
export const PUT = withAuth(async (request, { params }) => {
  try {
    const { playerId } = (await params) as { playerId: string }

    if (!playerId) {
      return NextResponse.json({ error: 'Player ID required' }, { status: 400 })
    }

    // Authorization: require 'start-session' permission (parent or teacher-present)
    const userId = await getDbUserId()
    const canModify = await canPerformAction(userId, playerId, 'start-session')
    if (!canModify) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    const body = await request.json()
    const { masteredSkillIds } = body

    if (!Array.isArray(masteredSkillIds)) {
      return NextResponse.json({ error: 'masteredSkillIds must be an array' }, { status: 400 })
    }

    // Validate that all items are strings
    if (!masteredSkillIds.every((id) => typeof id === 'string')) {
      return NextResponse.json({ error: 'All skill IDs must be strings' }, { status: 400 })
    }

    const result = await setMasteredSkills(playerId, masteredSkillIds)

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error setting mastered skills:', error)
    return NextResponse.json({ error: 'Failed to set mastered skills' }, { status: 500 })
  }
})

/**
 * PATCH - Refresh skill recency by inserting a sentinel record
 * Requires 'start-session' permission (parent or teacher-present)
 * Body: { skillId: string }
 *
 * Use this when a teacher wants to mark a skill as "recently practiced"
 * (e.g., student did offline workbooks).
 *
 * This inserts a "recency-refresh" sentinel record that:
 * - Updates lastPracticedAt in BKT (resets staleness)
 * - Does NOT affect pKnown (zero-weight for mastery calculation)
 *
 * Returns: { sessionId: string, timestamp: Date } or 404 if skill not found
 */
export const PATCH = withAuth(async (request, { params }) => {
  try {
    const { playerId } = (await params) as { playerId: string }

    if (!playerId) {
      return NextResponse.json({ error: 'Player ID required' }, { status: 400 })
    }

    // Authorization: require 'start-session' permission (parent or teacher-present)
    const userId = await getDbUserId()
    const canModify = await canPerformAction(userId, playerId, 'start-session')
    if (!canModify) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    const body = await request.json()
    const { skillId } = body

    if (!skillId || typeof skillId !== 'string') {
      return NextResponse.json({ error: 'Skill ID required (string)' }, { status: 400 })
    }

    const result = await refreshSkillRecency(playerId, skillId)

    if (!result) {
      return NextResponse.json({ error: 'Skill not found for this player' }, { status: 404 })
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error refreshing skill recency:', error)
    return NextResponse.json({ error: 'Failed to refresh skill recency' }, { status: 500 })
  }
})
