import 'server-only'

import { sql } from 'drizzle-orm'
import { db } from '@/db'
import { legacyTryFieldsOfProjection } from '@/db/schema/legacy-try-fields'
import type { SlotResult, TryKind } from '@/db/schema/session-plans'
import type { BktMode } from '../parts/kind'
import { bktModeOf } from '../parts/registry'
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
  kind?: unknown
  round?: unknown
  practiceOnly?: unknown
  /** The legacy try fields, read only through `legacyTryFieldsOfProjection` */
  [legacyField: string]: unknown
  voided?: unknown
}

interface RawPartType {
  n?: unknown
  t?: unknown
  k?: unknown
}

/**
 * Each part's BKT mode by part number, from its kind's `bktMode` (absent kind
 * = arithmetic: the part's type). null = the part's tries are not evidence.
 * (Arithmetic answers 'linear' for a part stored without a type, as main did.)
 * A non-string, non-null answer is left out, so its rows fall back to the
 * legacy default below.
 */
function bktModesByPartNumber(parts: RawPartType[]): Map<number, BktMode | null> {
  const modes = new Map<number, BktMode | null>()
  for (const part of parts) {
    if (!part || typeof part.n !== 'number') continue
    // The projected part: what the kinds' bktMode reads (arithmetic: `type`)
    const stored = {
      kind: typeof part.k === 'string' ? part.k : undefined,
      partNumber: part.n,
      type: part.t,
    }
    const mode = bktModeOf(stored)
    if (mode === null || typeof mode === 'string') modes.set(part.n, mode)
  }
  return modes
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

function optionalTryKind(value: unknown): TryKind | undefined {
  return value === 'first' || value === 'retry' || value === 'do_over' ? value : undefined
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
  modeByPartNumber: ReadonlyMap<number, BktMode | null>
): BktEvidence | null {
  if (!Array.isArray(raw.skillsExercised)) return null

  const timestamp = normalizeTimestamp(raw.timestamp)
  if (!timestamp) return null

  // Practice-only do-overs carry no evidence (the server's stamp; never derived)
  const practiceOnly = raw.practiceOnly === true || raw.practiceOnly === 1
  if (practiceOnly) return null
  // Voided tries (worksheet unapproval, Phase 3a) count nowhere
  if (raw.voided === true || raw.voided === 1) return null

  const partNumber = optionalNumber(raw.partNumber)
  const mode = partNumber == null ? undefined : modeByPartNumber.get(partNumber)
  // The part's kind says its tries are not BKT evidence
  if (mode === null) return null
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
    // What compute-bkt's evidenceWeightOf reads to weigh a wrong row, as the
    // in-JS history path hands it the whole row (Phase 1w, retroactive): the
    // stamps, and for a legacy row its legacy fields, which only the
    // normalizer reads (Phase 6a). Practice-only is the stamp above, never
    // the normalizer's derived flag (§1.2).
    kind: optionalTryKind(raw.kind),
    round: optionalNumber(raw.round),
    ...legacyTryFieldsOfProjection(raw),
    source: optionalSource(raw.source),
    originalSource: optionalSource(raw.originalSource),
    timingReview,
    // Rows that name no part (recency-refresh sentinels, parts: []) keep the
    // legacy 'linear' default (§10 P2-5)
    partType: mode ?? 'linear',
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
          'partNumber', json_extract(value, '$.partNumber'),
          'kind', json_extract(value, '$.kind'),
          'round', json_extract(value, '$.round'),
          'practiceOnly', json_extract(value, '$.practiceOnly'),
          'isRetry', json_extract(value, '$.isRetry'),
          'epochNumber', json_extract(value, '$.epochNumber'),
          'isManualRedo', json_extract(value, '$.isManualRedo'),
          'voided', json_extract(value, '$.voided')
        ))
        FROM json_each(session_plans.results)
      ) AS evidenceJson,
      (
        SELECT json_group_array(json_object(
          'n', json_extract(value, '$.partNumber'),
          't', json_extract(value, '$.type'),
          'k', json_extract(value, '$.kind')
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
      const modeByPartNumber = bktModesByPartNumber(
        parseJsonArray(session.partTypeMap) as RawPartType[]
      )

      let evidence = resultMap.get(session.playerId)
      if (!evidence) {
        evidence = []
        resultMap.set(session.playerId, evidence)
      }

      for (const raw of parseJsonArray(session.evidenceJson) as RawProjectedEvidence[]) {
        if (!raw || typeof raw !== 'object') continue
        const normalized = toBktEvidence(raw, modeByPartNumber)
        if (normalized) evidence.push(normalized)
      }
    }
  }

  for (const evidence of resultMap.values()) {
    evidence.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  }

  return resultMap
}
