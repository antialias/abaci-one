/**
 * Progression Deferrals
 *
 * Server-side functions for managing skill progression deferrals.
 * When a teacher clicks "Not yet, ask again later", the system defers
 * the progression recommendation for 7 days.
 */

import { and, eq, gt } from 'drizzle-orm'
import { db, schema } from '@/db'
import type { ProgressionDeferral } from '@/db/schema/progression-deferrals'

/** Default deferral duration: 7 days in milliseconds */
const DEFERRAL_DURATION_MS = 7 * 24 * 60 * 60 * 1000

/**
 * Check if there is an active (non-expired) deferral for a skill.
 */
export async function getActiveDeferral(
  playerId: string,
  skillId: string
): Promise<ProgressionDeferral | null> {
  const now = Date.now()

  const result = await db
    .select()
    .from(schema.progressionDeferrals)
    .where(
      and(
        eq(schema.progressionDeferrals.playerId, playerId),
        eq(schema.progressionDeferrals.skillId, skillId),
        gt(schema.progressionDeferrals.expiresAt, now)
      )
    )
    .limit(1)

  return result[0] ?? null
}

/**
 * Create or update a progression deferral for a skill.
 * Uses INSERT OR REPLACE since there's a unique constraint on (playerId, skillId).
 */
export async function deferProgression(
  playerId: string,
  skillId: string,
  durationMs: number = DEFERRAL_DURATION_MS
): Promise<ProgressionDeferral> {
  const now = Date.now()

  // Delete existing deferral first (upsert pattern for SQLite)
  await db
    .delete(schema.progressionDeferrals)
    .where(
      and(
        eq(schema.progressionDeferrals.playerId, playerId),
        eq(schema.progressionDeferrals.skillId, skillId)
      )
    )

  const [result] = await db
    .insert(schema.progressionDeferrals)
    .values({
      playerId,
      skillId,
      deferredAt: now,
      expiresAt: now + durationMs,
    })
    .returning()

  return result
}

/**
 * Remove a progression deferral (e.g., teacher changes their mind).
 */
export async function clearDeferral(playerId: string, skillId: string): Promise<void> {
  await db
    .delete(schema.progressionDeferrals)
    .where(
      and(
        eq(schema.progressionDeferrals.playerId, playerId),
        eq(schema.progressionDeferrals.skillId, skillId)
      )
    )
}
