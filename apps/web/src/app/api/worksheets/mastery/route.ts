import { and, eq } from 'drizzle-orm'
import { type NextRequest, NextResponse } from 'next/server'
import type { SkillId } from '@/app/create/worksheets/skills'
import { db, schema } from '@/db'
import { getViewerId } from '@/lib/viewer'
import { withAuth } from '@/lib/auth/withAuth'

/**
 * GET /api/worksheets/mastery?operator=addition
 * Load user's mastery states for all skills
 *
 * Query params:
 *   - operator: 'addition' | 'subtraction'
 *
 * Returns:
 *   - masteryStates: Array of mastery records
 *   - skillCount: Total number of skills tracked
 */
export const GET = withAuth(async (request) => {
  try {
    const viewerId = await getViewerId()
    const { searchParams } = new URL(request.url)
    const operator = searchParams.get('operator')

    if (!operator) {
      return NextResponse.json({ error: 'Missing operator parameter' }, { status: 400 })
    }

    if (operator !== 'addition' && operator !== 'subtraction') {
      return NextResponse.json({ error: `Invalid operator: ${operator}` }, { status: 400 })
    }

    // Fetch all mastery records for this user
    // Note: We don't filter by operator here because skill IDs are already namespaced
    // (e.g., "sd-no-regroup" for addition, "sd-sub-no-borrow" for subtraction)
    const masteryRecords = await db
      .select()
      .from(schema.worksheetMastery)
      .where(eq(schema.worksheetMastery.userId, viewerId))

    return NextResponse.json({
      masteryStates: masteryRecords,
      skillCount: masteryRecords.length,
    })
  } catch (error: any) {
    console.error('Failed to load mastery states:', error)
    return NextResponse.json({ error: 'Failed to load mastery states' }, { status: 500 })
  }
})

/**
 * POST /api/worksheets/mastery
 * Update mastery state for a skill
 *
 * Body:
 *   - skillId: string (e.g., "td-ones-regroup")
 *   - isMastered: boolean
 *   - totalAttempts?: number (optional)
 *   - correctAttempts?: number (optional)
 *   - lastAccuracy?: number (optional, 0.0-1.0)
 *
 * Returns:
 *   - success: boolean
 *   - masteryState: Updated mastery record
 */
export const POST = withAuth(async (request) => {
  try {
    const viewerId = await getViewerId()
    const body = await request.json()

    const { skillId, isMastered, totalAttempts, correctAttempts, lastAccuracy } = body

    if (!skillId) {
      return NextResponse.json({ error: 'Missing skillId field' }, { status: 400 })
    }

    if (typeof isMastered !== 'boolean') {
      return NextResponse.json(
        { error: 'Missing or invalid isMastered field (must be boolean)' },
        { status: 400 }
      )
    }

    // Check if user already has mastery record for this skill
    const [existing] = await db
      .select()
      .from(schema.worksheetMastery)
      .where(
        and(
          eq(schema.worksheetMastery.userId, viewerId),
          eq(schema.worksheetMastery.skillId, skillId)
        )
      )
      .limit(1)

    const now = new Date()

    if (existing) {
      // Update existing record
      const updated = {
        isMastered,
        totalAttempts: totalAttempts !== undefined ? totalAttempts : existing.totalAttempts,
        correctAttempts: correctAttempts !== undefined ? correctAttempts : existing.correctAttempts,
        lastAccuracy: lastAccuracy !== undefined ? lastAccuracy : existing.lastAccuracy,
        masteredAt: isMastered ? existing.masteredAt || now : null, // Set mastered timestamp on first mastery
        lastPracticedAt: now,
        updatedAt: now,
      }

      await db
        .update(schema.worksheetMastery)
        .set(updated)
        .where(eq(schema.worksheetMastery.id, existing.id))

      return NextResponse.json({
        success: true,
        masteryState: {
          ...existing,
          ...updated,
        },
      })
    } else {
      // Insert new record
      const id = crypto.randomUUID()
      const newRecord = {
        id,
        userId: viewerId,
        skillId: skillId as SkillId,
        isMastered,
        totalAttempts: totalAttempts || 0,
        correctAttempts: correctAttempts || 0,
        lastAccuracy: lastAccuracy || null,
        firstAttemptAt: now,
        masteredAt: isMastered ? now : null,
        lastPracticedAt: now,
        createdAt: now,
        updatedAt: now,
      }

      await db.insert(schema.worksheetMastery).values(newRecord)

      return NextResponse.json({
        success: true,
        masteryState: newRecord,
      })
    }
  } catch (error: any) {
    console.error('Failed to update mastery state:', error)
    return NextResponse.json({ error: 'Failed to update mastery state' }, { status: 500 })
  }
})
