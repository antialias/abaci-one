/**
 * A hand-built history row, as `batchGetRecentSessionResults` returns it
 * (practice-kinds plan K1b): the stored row with what it counts toward,
 * resolved by the derivation the history and the SQL path share
 * (`resolvedEvidenceOfRow`) for a row of a part of type `partType`.
 * Throws for a row that would not be in the history (no evidence).
 */

import { resolvedEvidenceOfRow } from '@/db/schema/session-plan-normalize'
import type { SlotResult } from '@/db/schema/session-plans'
import type { HistoryTry } from '@/lib/curriculum/session-planner'

export type HistoryRowInput = Omit<HistoryTry, 'evidence' | 'presentation' | 'mode'> &
  Pick<SlotResult, 'evidence'>

export function historyTryOf(row: HistoryRowInput, partType: string | undefined): HistoryTry {
  // The row's own part, found by its partNumber whatever its partIndex says
  const resolved = resolvedEvidenceOfRow({ ...row, partIndex: undefined } as SlotResult, [
    { partNumber: row.partNumber, type: partType },
  ])
  if (!resolved) throw new Error(`historyTryOf: row ${row.slotId} is no evidence`)
  return { ...row, ...resolved }
}
