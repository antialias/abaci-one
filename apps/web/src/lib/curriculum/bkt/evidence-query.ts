import 'server-only'

import { sql } from 'drizzle-orm'
import { db } from '@/db'
import type { SessionPartType, SlotResult } from '@/db/schema/session-plans'
import type { BktEvidence } from './types'

/**
 * Keep each libSQL response comfortably below the server response-size cap,
 * even for accounts with many students and long practice histories.
 */
export const BKT_EVIDENCE_PLAYER_CHUNK_SIZE = 10

interface RawEvidenceSession {
  playerId: string
  evidenceJson: string | null
  partTypeMap: string | null
}

interface RawProjectedEvidence {
  skillsExercised?: unknown
  timestamp?: unknown
  isCorrect?: unknown
  responseTimeMs?: unknown
  hadHelp?: unknown
  masteryWeight?: unknown
  source?: unknown
  originalSource?: unknown
  timingReview?: unknown
  partNumber?: unknown
}

interface RawPartType {
  n?: unknown
  t?: unknown
}

function parseJsonArray(value: string | null): unknown[] {
  if (!value) return []

  try {
    const parsed: unknown = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function optionalSource(value: unknown): SlotResult['source'] {
  if (
    value === 'practice' ||
    value === 'recency-refresh' ||
    value === 'teacher-corrected' ||
    value === 'teacher-excluded'
  ) {
    return value
  }
  return undefined
}

function normalizeTimestamp(value: unknown): Date | string | null {
  if (typeof value === 'string') return value
  if (typeof value === 'number' && Number.isFinite(value)) return new Date(value)
  return null
}

function toBktEvidence(
  raw: RawProjectedEvidence,
  typeByPartNumber: ReadonlyMap<number, SessionPartType>
): BktEvidence | null {
  if (!Array.isArray(raw.skillsExercised)) return null

  const timestamp = normalizeTimestamp(raw.timestamp)
  if (!timestamp) return null

  const partNumber = optionalNumber(raw.partNumber)
  const timingReview =
    raw.timingReview && typeof raw.timingReview === 'object'
      ? (raw.timingReview as SlotResult['timingReview'])
      : undefined

  return {
    skillsExercised: raw.skillsExercised.filter(
      (skillId): skillId is string => typeof skillId === 'string'
    ),
    timestamp,
    isCorrect: raw.isCorrect === true || raw.isCorrect === 1,
    responseTimeMs: optionalNumber(raw.responseTimeMs) ?? 0,
    hadHelp: raw.hadHelp === true || raw.hadHelp === 1,
    masteryWeight: optionalNumber(raw.masteryWeight),
    source: optionalSource(raw.source),
    originalSource: optionalSource(raw.originalSource),
    timingReview,
    partType: (partNumber == null ? undefined : typeByPartNumber.get(partNumber)) ?? 'linear',
  }
}

async function getEvidenceChunk(
  playerIds: readonly string[],
  sessionCountPerPlayer: number
): Promise<RawEvidenceSession[]> {
  const playerIdList = sql.join(
    playerIds.map((playerId) => sql`${playerId}`),
    sql`, `
  )

  return db.all<RawEvidenceSession>(sql`
    WITH ranked_sessions AS (
      SELECT
        player_id,
        completed_at,
        id,
        ROW_NUMBER() OVER (
          PARTITION BY player_id
          ORDER BY completed_at DESC, id DESC
        ) AS session_rank
      FROM session_plans
      WHERE player_id IN (${playerIdList})
        AND status IN ('completed', 'recency-refresh')
        AND completed_at IS NOT NULL
    ), recent_sessions AS (
      SELECT player_id, completed_at, id
      FROM ranked_sessions
      WHERE session_rank <= ${sessionCountPerPlayer}
    )
    SELECT
      recent_sessions.player_id AS playerId,
      (
        SELECT json_group_array(json_object(
          'skillsExercised', json_extract(value, '$.skillsExercised'),
          'timestamp', json_extract(value, '$.timestamp'),
          'isCorrect', json_extract(value, '$.isCorrect'),
          'responseTimeMs', json_extract(value, '$.responseTimeMs'),
          'hadHelp', json_extract(value, '$.hadHelp'),
          'masteryWeight', json_extract(value, '$.masteryWeight'),
          'source', json_extract(value, '$.source'),
          'originalSource', json_extract(value, '$.originalSource'),
          'timingReview', json_extract(value, '$.timingReview'),
          'partNumber', json_extract(value, '$.partNumber')
        ))
        FROM json_each(session_plans.results)
      ) AS evidenceJson,
      (
        SELECT json_group_array(json_object(
          'n', json_extract(value, '$.partNumber'),
          't', json_extract(value, '$.type')
        ))
        FROM json_each(session_plans.parts)
      ) AS partTypeMap
    FROM recent_sessions
    INNER JOIN session_plans ON session_plans.id = recent_sessions.id
    ORDER BY recent_sessions.completed_at DESC, recent_sessions.id DESC
  `)
}

/**
 * Load only the attempt fields used by BKT for each player's recent sessions.
 *
 * The per-player limit is applied inside SQLite before any JSON is returned,
 * and players are queried in bounded sequential chunks. This prevents a large
 * household/classroom history from exceeding libSQL's response-size limit.
 */
export async function batchGetRecentBktEvidence(
  playerIds: readonly string[],
  sessionCountPerPlayer = 100
): Promise<Map<string, BktEvidence[]>> {
  const resultMap = new Map<string, BktEvidence[]>()
  const uniquePlayerIds = [...new Set(playerIds.filter(Boolean))]
  const sessionLimit = Math.max(0, Math.floor(sessionCountPerPlayer))

  if (uniquePlayerIds.length === 0 || sessionLimit === 0) return resultMap

  for (let offset = 0; offset < uniquePlayerIds.length; offset += BKT_EVIDENCE_PLAYER_CHUNK_SIZE) {
    const chunk = uniquePlayerIds.slice(offset, offset + BKT_EVIDENCE_PLAYER_CHUNK_SIZE)
    const sessions = await getEvidenceChunk(chunk, sessionLimit)

    for (const session of sessions) {
      const partTypes = parseJsonArray(session.partTypeMap) as RawPartType[]
      const typeByPartNumber = new Map<number, SessionPartType>()

      for (const part of partTypes) {
        if (typeof part.n === 'number' && typeof part.t === 'string') {
          typeByPartNumber.set(part.n, part.t as SessionPartType)
        }
      }

      let evidence = resultMap.get(session.playerId)
      if (!evidence) {
        evidence = []
        resultMap.set(session.playerId, evidence)
      }

      for (const raw of parseJsonArray(session.evidenceJson) as RawProjectedEvidence[]) {
        if (!raw || typeof raw !== 'object') continue
        const normalized = toBktEvidence(raw, typeByPartNumber)
        if (normalized) evidence.push(normalized)
      }
    }
  }

  for (const evidence of resultMap.values()) {
    evidence.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  }

  return resultMap
}
