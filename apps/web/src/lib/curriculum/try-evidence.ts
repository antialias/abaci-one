/**
 * Reading a try's evidence (practice-kinds plan §3.1, K1b).
 *
 * Every evidence reader (BKT, readiness, the linear gate, skill metrics and
 * stats, the dashboard, MCP) takes a row's skills here, so they agree. What
 * the row is evidence of is its `evidence`; how much it counts is still the
 * row's `source`, `voided` and `practiceOnly`, read by each reader as before
 * (amendment A5: "has evidence" is not "counts").
 *
 * Client-safe: no server imports (`parts/presentations` is data).
 */

import type { TryEvidence } from '@/db/schema/session-plans'
import { masteryModeOf } from '@/lib/curriculum/parts/presentations'

/**
 * A row as an evidence reader holds it. A history row (`HistoryTry`) and an
 * SQL evidence row (`BktEvidence`) carry their resolved `evidence` and `mode`;
 * a plan's own row carries `evidence` once stamped (K1a); a row built by hand
 * (a fixture, a simulation) may carry neither, only `skillsExercised`.
 */
export interface EvidenceRow {
  evidence?: TryEvidence | null
  mode?: string | null
  skillsExercised?: readonly string[]
}

/**
 * The skills a row is evidence of: `evidence.skills`; none when `evidence`
 * is null (recorded, not counted) or its presentation counts toward no mode.
 * A history or SQL row carries its resolved `mode`; a plan's own row
 * (`SkillsPanel`, `progress-manager`) has none, so it is resolved here
 * (`masteryModeOf`). A row without the field at all reads `skillsExercised`,
 * which is what the normalizer derives for it (arithmetic's evidence,
 * amendment A4).
 */
export function evidenceSkillsOf(row: EvidenceRow): readonly string[] {
  if (row.evidence === undefined) return row.skillsExercised ?? []
  if (row.evidence === null) return []
  const mode = row.mode === undefined ? masteryModeOf(row.evidence.presentation) : row.mode
  return mode === null ? [] : row.evidence.skills
}

/**
 * A stored `evidence` value as readers trust it: `{ skills, presentation }`
 * with the skills that are strings; anything else is null (not evidence).
 * The in-JS history and the SQL projection both read stamped values here.
 */
export function asTryEvidence(value: unknown): TryEvidence | null {
  if (!value || typeof value !== 'object') return null
  const { skills, presentation } = value as { skills?: unknown; presentation?: unknown }
  if (!Array.isArray(skills) || typeof presentation !== 'string') return null
  return {
    skills: skills.filter((s): s is string => typeof s === 'string'),
    presentation,
  }
}
