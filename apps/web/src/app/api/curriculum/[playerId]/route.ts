/**
 * API route for player curriculum management
 *
 * GET /api/curriculum/[playerId] - Get full curriculum state
 * PATCH /api/curriculum/[playerId] - Update curriculum settings
 */

import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/withAuth'
import { canPerformAction } from '@/lib/classroom'
import {
  getPlayerCurriculum,
  getAllSkillMastery,
  getRecentSessions,
  upsertPlayerCurriculum,
} from '@/lib/curriculum/progress-manager'
import { getRecentSessionResults } from '@/lib/curriculum/session-planner'
import { getUserId } from '@/lib/viewer'

/**
 * GET - Fetch player's full curriculum state
 */
export const GET = withAuth(async (_request, { params }) => {
  const routeStart = performance.now()
  const timings: Record<string, number> = {}

  try {
    const { playerId } = (await params) as { playerId: string }

    if (!playerId) {
      return NextResponse.json({ error: 'Player ID required' }, { status: 400 })
    }

    // Authorization check
    let t = performance.now()
    const userId = await getUserId()
    timings.getUserId = performance.now() - t

    t = performance.now()
    const canView = await canPerformAction(userId, playerId, 'view')
    timings.canPerformAction = performance.now() - t

    if (!canView) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    t = performance.now()
    const [curriculum, rawSkills, recentSessions, sessionResults] = await Promise.all([
      getPlayerCurriculum(playerId),
      getAllSkillMastery(playerId),
      getRecentSessions(playerId, 200),
      getRecentSessionResults(playerId, 2000),
    ])
    timings.dataFetch = performance.now() - t

    t = performance.now()
    // Compute skill stats from session results (single source of truth)
    const skillStats = new Map<
      string,
      { attempts: number; correct: number; responseTimes: number[] }
    >()
    for (const result of sessionResults) {
      for (const skillId of result.skillsExercised) {
        if (!skillStats.has(skillId)) {
          skillStats.set(skillId, {
            attempts: 0,
            correct: 0,
            responseTimes: [],
          })
        }
        const stats = skillStats.get(skillId)!
        stats.attempts++
        if (result.isCorrect) {
          stats.correct++
        }
        if (result.responseTimeMs > 0) {
          stats.responseTimes.push(result.responseTimeMs)
        }
      }
    }

    // Enrich skills with computed stats
    const skills = rawSkills.map((skill) => {
      const stats = skillStats.get(skill.skillId)
      return {
        ...skill,
        attempts: stats?.attempts ?? 0,
        correct: stats?.correct ?? 0,
        totalResponseTimeMs: stats?.responseTimes.reduce((a, b) => a + b, 0) ?? 0,
        responseTimeCount: stats?.responseTimes.length ?? 0,
      }
    })
    timings.compute = performance.now() - t

    const total = performance.now() - routeStart
    console.log(
      `[PERF] /api/curriculum/[playerId] GET: ${total.toFixed(1)}ms | ` +
        `auth=${(timings.getUserId + timings.canPerformAction).toFixed(1)}ms, ` +
        `dataFetch=${timings.dataFetch.toFixed(1)}ms, ` +
        `compute=${timings.compute.toFixed(1)}ms | ` +
        `sessions=${recentSessions.length}, results=${sessionResults.length}, skills=${rawSkills.length}`
    )

    return NextResponse.json({
      curriculum,
      skills,
      recentSessions,
    })
  } catch (error) {
    console.error('Error fetching curriculum:', error)
    return NextResponse.json({ error: 'Failed to fetch curriculum' }, { status: 500 })
  }
})

/**
 * PATCH - Update curriculum settings
 *
 * Only parents and present teachers can modify curriculum settings.
 */
export const PATCH = withAuth(async (request, { params }) => {
  try {
    const { playerId } = (await params) as { playerId: string }

    if (!playerId) {
      return NextResponse.json({ error: 'Player ID required' }, { status: 400 })
    }

    // Authorization check - stricter than 'view', only parents/present teachers can modify
    const userId = await getUserId()
    const canModify = await canPerformAction(userId, playerId, 'start-session')
    if (!canModify) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    const body = await request.json()
    const { worksheetPreset, visualizationMode, currentLevel, currentPhaseId } = body

    const updated = await upsertPlayerCurriculum(playerId, {
      ...(worksheetPreset !== undefined && { worksheetPreset }),
      ...(visualizationMode !== undefined && { visualizationMode }),
      ...(currentLevel !== undefined && { currentLevel }),
      ...(currentPhaseId !== undefined && { currentPhaseId }),
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating curriculum:', error)
    return NextResponse.json({ error: 'Failed to update curriculum' }, { status: 500 })
  }
})
