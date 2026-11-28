/**
 * A hand-built history row, as `batchGetRecentSessionResults` returns it
 * (practice-kinds plan K1b): the stored row, with its evidence derived the
 * way the history derives it for a row of a part of type `partType`
 * (`evidenceOfRow`: stamped wins, else arithmetic's `skillsExercised` and the
 * part's type, 'linear' when it has none), its presentation and its mode.
 */

import { evidenceOfRow } from '@/db/schema/session-plan-normalize'
import type { SlotResult } from '@/db/schema/session-plans'
import { masteryModeOf } from '@/lib/curriculum/parts/presentations'
import type { HistoryTry } from '@/lib/curriculum/session-planner'
import { asTryEvidence } from '@/lib/curriculum/try-evidence'

export type HistoryRowInput = Omit<HistoryTry, 'evidence' | 'presentation' | 'mode'> &
  Pick<SlotResult, 'evidence'>

export function historyTryOf(row: HistoryRowInput, partType: string | undefined): HistoryTry {
  const evidence = asTryEvidence(
    // The row's own part, found by its partNumber whatever its partIndex says
    evidenceOfRow({ ...row, partIndex: undefined } as SlotResult, [
      { partNumber: row.partNumber, type: partType },
    ])
  )
  return {
    ...row,
    evidence,
    presentation: evidence?.presentation ?? null,
    mode: evidence ? masteryModeOf(evidence.presentation) : null,
  }
}
