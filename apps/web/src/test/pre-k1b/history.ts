/**
 * VERBATIM copy of `ProblemResultWithContext` and `batchGetRecentSessionResults` of `src/lib/curriculum/session-planner.ts` at 76b2cc46c (before practice-kinds K1b),
 * the "before" side of `try-readers-k1b-parity.test.ts`. Only imports
 * changed (paths repointed, `server-only` dropped). Never edit the logic: it is the old
 * reader the new one is compared against.
 */
import { and, desc, inArray, sql } from 'drizzle-orm'
import { db, schema } from '@/db'
import { isCountedTry } from '@/db/schema/session-plan-helpers'
import type { SessionPartType, SlotResult } from '@/db/schema/session-plans'

export interface ProblemResultWithContext extends SlotResult {
  /** Session ID this result came from */
  sessionId: string
  /** When the session was completed */
  sessionCompletedAt: Date
  /** Part type (abacus/visualization/linear) */
  partType: SessionPartType
}

/**
 * Batch-fetch recent problem results for multiple players in a single query.
 *
 * Returns a Map<playerId, ProblemResultWithContext[]> with results ordered
 * by timestamp descending (most recent first).
 *
 * @param playerIds - The players to fetch results for
 * @param sessionCountPerPlayer - Max sessions per player (default 50)
 */
export async function batchGetRecentSessionResults(
  playerIds: string[],
  sessionCountPerPlayer = 50
): Promise<Map<string, ProblemResultWithContext[]>> {
  const resultMap = new Map<string, ProblemResultWithContext[]>()
  if (playerIds.length === 0) return resultMap

  // Include both 'completed' sessions and 'recency-refresh' sentinels
  // Recency-refresh sessions contain sentinel records that update lastPracticedAt
  // but are zero-weight for BKT mastery calculation
  //
  // Use .select() instead of .findMany() to skip the massive `parts` column
  // (which contains full problem generation traces, 10-50KB per session).
  // Instead, extract just the partNumber→type mapping via a SQLite JSON subquery.
  const sessions = await db
    .select({
      id: schema.sessionPlans.id,
      playerId: schema.sessionPlans.playerId,
      completedAt: schema.sessionPlans.completedAt,
      results: schema.sessionPlans.results,
      // Extract lightweight [{n: partNumber, t: type}, ...] from parts JSON
      // instead of fetching the entire parts column with all slots/problems
      partTypeMap: sql<string>`(
        SELECT json_group_array(json_object(
          'n', json_extract(value, '$.partNumber'),
          't', json_extract(value, '$.type')
        )) FROM json_each(${schema.sessionPlans.parts})
      )`,
    })
    .from(schema.sessionPlans)
    .where(
      and(
        inArray(schema.sessionPlans.playerId, playerIds),
        inArray(schema.sessionPlans.status, ['completed', 'recency-refresh'])
      )
    )
    .orderBy(desc(schema.sessionPlans.completedAt))

  // Cap sessions per player and flatten results with session context
  const sessionCountByPlayer = new Map<string, number>()

  for (const session of sessions) {
    if (!session.completedAt) continue

    const count = sessionCountByPlayer.get(session.playerId) ?? 0
    if (count >= sessionCountPerPlayer) continue
    sessionCountByPlayer.set(session.playerId, count + 1)

    let list = resultMap.get(session.playerId)
    if (!list) {
      list = []
      resultMap.set(session.playerId, list)
    }

    // Build partNumber→type lookup from the lightweight extraction
    const partTypes = JSON.parse(session.partTypeMap || '[]') as Array<{ n: number; t: string }>
    const typeByPartNumber = new Map(partTypes.map((p) => [p.n, p.t]))

    for (const result of session.results) {
      // Some pre-schema fixtures (e.g. validation seed plans) carry result
      // entries that don't match SlotResult — missing skillsExercised,
      // partNumber, etc. Skip them so downstream consumers can assume the
      // SlotResult contract holds. Real practice records always have at
      // least `skillsExercised: []` from `recordSlotResult`.
      if (!Array.isArray((result as Partial<SlotResult>).skillsExercised)) continue
      // Practice-only do-overs (Phase 1) carry no evidence for any history
      // reader: readiness, the linear gate, skill metrics, leaderboards, MCP.
      if (!isCountedTry(result)) continue

      const partType = (typeByPartNumber.get(result.partNumber) ?? 'linear') as SessionPartType

      list.push({
        ...result,
        sessionId: session.id,
        sessionCompletedAt: session.completedAt,
        partType,
      })
    }
  }

  // Sort each player's results by timestamp descending (most recent first)
  for (const list of resultMap.values()) {
    list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  }

  return resultMap
}
