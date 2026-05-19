/**
 * Persist derived session moments to the `session_moments` table.
 *
 * Idempotent — if moments already exist for the session, we replace them
 * wholesale rather than diffing. Songs can be regenerated; moments rotate
 * with each regen.
 */

import { eq } from 'drizzle-orm'
import { db, schema } from '@/db'
import type { ResolvedMoment } from './types'
import type { DerivedMoment } from './derive'

export async function persistSessionMoments(
  sessionPlanId: string,
  playerId: string,
  moments: DerivedMoment[]
): Promise<void> {
  if (moments.length === 0) {
    await db
      .delete(schema.sessionMoments)
      .where(eq(schema.sessionMoments.sessionPlanId, sessionPlanId))
    return
  }

  // Drop any existing rows for this session first — moments are
  // re-derivable, so we keep a single canonical batch per session.
  await db
    .delete(schema.sessionMoments)
    .where(eq(schema.sessionMoments.sessionPlanId, sessionPlanId))

  await db.insert(schema.sessionMoments).values(
    moments.map((m) => ({
      sessionPlanId,
      playerId,
      shortId: m.shortId,
      type: m.type,
      significance: m.significance,
      timestampMs: m.timestampMs,
      summary: m.summary,
      snapshot: m.snapshot as unknown as Record<string, unknown>,
    }))
  )
}

/**
 * Read all moments for a session, in catalog order (highest significance first).
 */
export async function loadSessionMoments(sessionPlanId: string): Promise<ResolvedMoment[]> {
  const rows = await db
    .select()
    .from(schema.sessionMoments)
    .where(eq(schema.sessionMoments.sessionPlanId, sessionPlanId))

  return rows
    .map((row) => ({
      id: row.id,
      shortId: row.shortId,
      type: row.type as ResolvedMoment['type'],
      summary: row.summary,
      significance: row.significance,
      timestampMs: row.timestampMs,
      snapshot: row.snapshot as ResolvedMoment['snapshot'],
    }))
    .sort((a, b) => b.significance - a.significance)
}
