/**
 * Session reports for many sessions at once (session architecture §4, Phase
 * 4d): the dashboard list, the classroom's active cards and the MCP tools.
 *
 * Every report here comes from the one builder (`buildSessionReport`), so a
 * list row and the summary of the same session show the same numbers. What is
 * batched is the loading: the sessions' break game results in one query
 * (instead of one per row), and, for lists, a slim `parts` projection made in
 * SQL (§10 P4d-1).
 *
 * The song is not loaded: none of these views shows it (`song.status` is
 * `none` in these reports; the summary projection drops it).
 */

import { and, asc, eq, inArray, type SQL, sql } from 'drizzle-orm'
import { db, schema } from '@/db'
import type { SessionPart } from '@/db/schema/session-plans'
import { readTries } from './read-tries'
import {
  buildSessionReport,
  type ReportGameResult,
  type ReportPlan,
  type SessionReport,
} from './session-report'

/**
 * `session_plans.parts` reduced, in SQL, to what the report reads of a part:
 * `kind`, `partNumber`, `type`, and each slot's `slotId`, `index` and
 * problem `terms`/`answer` (item identity, `resolveItemId`; planned count,
 * the kind's `progress`). The full column carries every slot's generation
 * trace and blew libsql's response cap on lists of heavy users (#141), so
 * lists never select it.
 *
 * Keep in step with what `buildSessionReport` reads of a part: the
 * equivalence test (`session-report-batch.test.ts`) builds the fixtures'
 * reports from this projection and from the full rows and compares them.
 */
export function slimPartsSql(): SQL<SessionPart[]> {
  // Each array is aggregated from an inner query ordered by the source array's
  // index (json_each's `key`): SQLite does not promise json_group_array's input
  // order otherwise. The inner query loses the JSON subtype, so the outer
  // wraps each element in json() to keep it an object, not a string.
  return sql<SessionPart[]>`(
  SELECT json_group_array(json(pp.v)) FROM (
    SELECT json_object(
      'kind', json_extract(p.value, '$.kind'),
      'partNumber', json_extract(p.value, '$.partNumber'),
      'type', json_extract(p.value, '$.type'),
      'slots', (
        SELECT json_group_array(json(ss.v)) FROM (
          SELECT json_object(
            'slotId', json_extract(s.value, '$.slotId'),
            'index', json_extract(s.value, '$.index'),
            'problem', CASE WHEN json_type(s.value, '$.problem') = 'object' THEN json_object(
              'terms', json(json_extract(s.value, '$.problem.terms')),
              'answer', json_extract(s.value, '$.problem.answer')
            ) END
          ) AS v
          FROM json_each(p.value, '$.slots') AS s
          ORDER BY s.key
        ) AS ss
      )
    ) AS v
    FROM json_each(${schema.sessionPlans.parts}) AS p
    ORDER BY p.key
  ) AS pp
)`.mapWith((value: unknown) =>
    typeof value === 'string'
      ? (JSON.parse(value) as SessionPart[])
      : ((value ?? []) as SessionPart[])
  )
}

/**
 * The columns a report reads, for `db.select(...)`, with `parts` slimmed.
 * Everything else is the row's own value. Built on call, not at import, so
 * modules that import this one load under tests that mock `@/db`.
 */
export const reportRowColumns = () => ({
  id: schema.sessionPlans.id,
  playerId: schema.sessionPlans.playerId,
  status: schema.sessionPlans.status,
  parts: slimPartsSql(),
  results: schema.sessionPlans.results,
  flowState: schema.sessionPlans.flowState,
  currentPartIndex: schema.sessionPlans.currentPartIndex,
  currentSlotIndex: schema.sessionPlans.currentSlotIndex,
  retryState: schema.sessionPlans.retryState,
  partStates: schema.sessionPlans.partStates,
  breakStartedAt: schema.sessionPlans.breakStartedAt,
  breakReason: schema.sessionPlans.breakReason,
  breakSelectedGame: schema.sessionPlans.breakSelectedGame,
  breakResults: schema.sessionPlans.breakResults,
  adjustments: schema.sessionPlans.adjustments,
  startedAt: schema.sessionPlans.startedAt,
  completedAt: schema.sessionPlans.completedAt,
  rowVersion: schema.sessionPlans.rowVersion,
  pauses: schema.sessionPlans.pauses,
  breaks: schema.sessionPlans.breaks,
})

/** The `practice-break` game results of many sessions, in one query, by session id. */
export async function loadBreakGameResultsFor(
  sessionIds: readonly string[]
): Promise<Map<string, ReportGameResult[]>> {
  const bySession = new Map<string, ReportGameResult[]>()
  if (sessionIds.length === 0) return bySession
  const rows = await db
    .select({
      sessionId: schema.gameResults.sessionId,
      id: schema.gameResults.id,
      gameName: schema.gameResults.gameName,
      playedAt: schema.gameResults.playedAt,
      durationMs: schema.gameResults.durationMs,
      // Only what the break dedupe reads of the report (distinctBreakResults):
      // the full report is the whole game's log
      fullReport: sql<{ endedAt?: number; gameName?: string } | null>`CASE
        WHEN json_valid(${schema.gameResults.fullReport}) THEN json_object(
          'endedAt', json_extract(${schema.gameResults.fullReport}, '$.endedAt'),
          'gameName', json_extract(${schema.gameResults.fullReport}, '$.gameName')
        ) END`.mapWith((value: unknown) =>
        typeof value === 'string' ? JSON.parse(value) : (value ?? null)
      ),
    })
    .from(schema.gameResults)
    .where(
      and(
        inArray(schema.gameResults.sessionId, [...sessionIds]),
        eq(schema.gameResults.sessionType, 'practice-break')
      )
    )
    .orderBy(asc(schema.gameResults.playedAt), asc(schema.gameResults.id))
  for (const { sessionId, ...row } of rows) {
    if (!sessionId) continue
    const list = bySession.get(sessionId)
    if (list) list.push(row)
    else bySession.set(sessionId, [row])
  }
  return bySession
}

/**
 * A row's JSON list columns as arrays. A drizzle insert that omits a JSON
 * column with `.default('[]')` stores the JSON string `"[]"` (the default is
 * serialized as a value, not left to SQL), which reads back as a string; the
 * builder would throw on it (`.some` of a string). Seen on rows the dashboard
 * tests insert; any writer that omits these columns makes them.
 */
function withListColumns<P extends ReportPlan>(plan: P): P {
  const list = <T>(value: T[] | null | undefined | unknown): T[] =>
    Array.isArray(value) ? (value as T[]) : []
  return {
    ...plan,
    parts: list(plan.parts),
    results: list(plan.results),
    adjustments: list(plan.adjustments),
    pauses: list(plan.pauses),
    breaks: list(plan.breaks),
  }
}

/**
 * The reports of rows already loaded (full rows, or `reportRowColumns`), in
 * their order: one game-results query for all of them. A row whose report
 * cannot be built is logged and comes back as `null` in its place, so one bad
 * row does not take the whole list down; callers skip it.
 */
export async function buildSessionReports(
  plans: readonly ReportPlan[],
  now: number = Date.now()
): Promise<(SessionReport | null)[]> {
  const gameResults = await loadBreakGameResultsFor(plans.map((p) => p.id))
  return Promise.all(
    plans.map(async (row) => {
      try {
        const plan = withListColumns(row)
        return buildSessionReport({
          plan,
          tries: await readTries(plan),
          gameResults: gameResults.get(plan.id) ?? [],
          song: null,
          now,
        })
      } catch (error) {
        console.error('[session-report] report not built', { sessionId: row.id, error })
        return null
      }
    })
  )
}
