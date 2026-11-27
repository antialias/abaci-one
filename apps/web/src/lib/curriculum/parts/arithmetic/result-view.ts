/**
 * What the result grids, the plan overview and the observer's dots read of an
 * arithmetic part (session architecture §7 Phase 5c).
 *
 * The screens under `components/practice`, `app/practice` and `hooks` never
 * read an arithmetic part's slots or the legacy encoding of its cursor
 * (`currentSlotIndex`, `retryState`; the import gate,
 * `src/test/session-view-import-gate.test.ts`). Where a grid shows something
 * only arithmetic has (one cell per slot, a problem's number, its purpose),
 * it asks this module; every verdict and count comes from the session report:
 * a cell's tries are the report's tries of its item (`itemId`, the
 * normalizer's identity), and its status follows the report's rules
 * (`firstTryRows`, `isVerdictTryRow`), so a grid's cells add up to the
 * report's totals.
 *
 * Client-safe: no drizzle, no server imports.
 */

import { tryIdOf } from '@/db/schema/session-plan-normalize'
import type { ProblemSlot, SessionPart, SessionPlan, SlotResult } from '@/db/schema/session-plans'
import type { PracticeStateEvent } from '@/lib/classroom/socket-events'
import {
  firstTryRows,
  isVerdictTryRow,
  type SessionReport,
  type TryRow,
} from '@/lib/curriculum/session-report'
import { kindIdOf } from '../registry'
import { arithmeticKind } from './server'

/** A part's slots; none for a part of another kind or a slot-less (offline) part. */
export function arithmeticSlotsOf(part: SessionPart | undefined): readonly ProblemSlot[] {
  if (!part || kindIdOf(part) !== arithmeticKind.id) return []
  return Array.isArray(part.slots) ? part.slots : []
}

/**
 * The item id of a slot, as the normalizer resolves it (`resolveItemId`): the
 * slot's id when its tries carry it; else the item whose tries were recorded
 * at the slot's place (a slot written without an id, a try naming another);
 * else the legacy id an id-less try of it would get.
 */
function itemIdOf(
  partIndex: number,
  part: SessionPart,
  slot: ProblemSlot,
  slotIndex: number,
  tried: ReadonlyMap<string, unknown>,
  byPlace: ReadonlyMap<string, string>
): string {
  if (slot.slotId && tried.has(slot.slotId)) return slot.slotId
  return (
    byPlace.get(`${partIndex}:${slotIndex}`) ??
    (slot.slotId || `legacy-item:${part.partNumber}:${slotIndex}`)
  )
}

// ============================================================================
// Plan overview
// ============================================================================

export type ArithmeticPurpose = ProblemSlot['purpose']

/** What the plan overview shows of a part besides its count (which is the report's). */
export interface ArithmeticPartOverview {
  purposeCounts: Record<ArithmeticPurpose, number>
  /** The comfort level the planner chose the part's term counts by, when it recorded one */
  comfortLevel?: number
}

export function arithmeticPartOverview(part: SessionPart): ArithmeticPartOverview {
  const purposeCounts: Record<ArithmeticPurpose, number> = {
    focus: 0,
    reinforce: 0,
    review: 0,
    challenge: 0,
  }
  const slots = arithmeticSlotsOf(part)
  for (const slot of slots) {
    if (slot.purpose in purposeCounts) purposeCounts[slot.purpose]++
  }
  const comfortLevel = slots[0]?.termCountExplanation?.comfortLevel
  return comfortLevel === undefined ? { purposeCounts } : { purposeCounts, comfortLevel }
}

// ============================================================================
// Result cells
// ============================================================================

/** One of an item's tries: the report's row joined to the stored try. */
export interface ArithmeticItemTry {
  row: TryRow
  /** The stored try (content, help, timing); null when the plan no longer holds it */
  result: SlotResult | null
  /** Its index in `plan.results` (review edits address it); -1 when not joined */
  resultIndex: number
}

/**
 * How a cell counts in the report: `correct` / `incorrect` = attempted, by the
 * item's final verdict (`finalCorrect` / `unresolved`); `not-counted` = its
 * first try was excluded by an adult; `practice-only` = its only tries are
 * practice-only (its counted first try was voided); `unanswered` = no try.
 * Only the first two count in `problems`.
 */
export type ArithmeticItemStatus =
  | 'correct'
  | 'incorrect'
  | 'not-counted'
  | 'practice-only'
  | 'unanswered'

export interface ArithmeticItemCell {
  itemId: string
  partIndex: number
  part: SessionPart
  slotIndex: number
  slot: ProblemSlot
  /** The item's 1-based number across the plan (the dots' numbering) */
  number: number
  /** Every try of the item in recorded order (practice-only do-overs included: they are tries) */
  tries: ArithmeticItemTry[]
  /** The try the item's first-try verdict is read from (the totals' rule), when it has one */
  firstTry: ArithmeticItemTry | null
  /** The try carrying the item's final verdict, when the item is attempted */
  verdict: ArithmeticItemTry | null
  status: ArithmeticItemStatus
  /**
   * The stored try the cell shows: the verdict's; for a not-counted item its
   * latest try that is not practice-only; for a practice-only item its latest
   * try. Null when unanswered.
   */
  shown: SlotResult | null
}

/** The plan fields the cells read. */
export type ArithmeticCellsPlan = Pick<SessionPlan, 'id' | 'parts' | 'results'>

/**
 * One cell per slot, per part (a part of another kind has none), with the
 * report's tries of each item. Without a report (a plan not started, a report
 * still loading) every cell is unanswered: nothing is recounted from `results`.
 */
export function arithmeticItemCells(
  plan: ArithmeticCellsPlan,
  report: Pick<SessionReport, 'tries'> | null | undefined
): ArithmeticItemCell[][] {
  const results = plan.results ?? []
  const stored = new Map<string, { result: SlotResult; index: number }>()
  results.forEach((result, index) => {
    if (result) stored.set(tryIdOf(result, index, plan.id), { result, index })
  })

  const rows = report?.tries ?? []
  const firsts = firstTryRows(rows)
  const byItem = new Map<string, ArithmeticItemTry[]>()
  const byPlace = new Map<string, string>()
  for (const row of rows) {
    const joined = stored.get(row.tryId)
    if (joined) {
      const place = `${row.partIndex}:${joined.result.originalSlotIndex ?? joined.result.slotIndex}`
      if (!byPlace.has(place)) byPlace.set(place, row.itemId)
    }
    const t: ArithmeticItemTry = {
      row,
      result: joined?.result ?? null,
      resultIndex: joined?.index ?? -1,
    }
    const group = byItem.get(row.itemId)
    if (group) group.push(t)
    else byItem.set(row.itemId, [t])
  }

  let number = 0
  return (plan.parts ?? []).map((part, partIndex) =>
    arithmeticSlotsOf(part).map((slot, slotIndex): ArithmeticItemCell => {
      number++
      const itemId = itemIdOf(partIndex, part, slot, slotIndex, byItem, byPlace)
      const tries = byItem.get(itemId) ?? []
      const firstTry = tries.find((t) => firsts.first.has(t.row.tryId)) ?? null
      const attempted = firstTry !== null && firsts.verdict.has(firstTry.row.tryId)
      const weighted = tries.filter((t) => isVerdictTryRow(t.row))
      const verdict = attempted ? (weighted[weighted.length - 1] ?? null) : null
      const status: ArithmeticItemStatus = verdict
        ? verdict.row.isCorrect
          ? 'correct'
          : 'incorrect'
        : firstTry?.row.excluded
          ? 'not-counted'
          : tries.length > 0
            ? 'practice-only'
            : 'unanswered'
      const latestCounted = [...tries].reverse().find((t) => !t.row.practiceOnly)
      return {
        itemId,
        partIndex,
        part,
        slotIndex,
        slot,
        number,
        tries,
        firstTry,
        verdict,
        status,
        shown: verdict?.result ?? latestCounted?.result ?? tries[tries.length - 1]?.result ?? null,
      }
    })
  )
}

/**
 * The stored tries recorded before an item was first answered (all of them
 * for an item not answered yet): the history its auto-pause threshold was
 * computed from. Readers pass it to `calculateAutoPauseInfo`, which keeps only
 * counted tries (`isCountedTry`).
 */
export function triesBeforeItem(
  plan: Pick<SessionPlan, 'results'>,
  cell: Pick<ArithmeticItemCell, 'firstTry' | 'tries'>
): SlotResult[] {
  const results = plan.results ?? []
  const first = cell.firstTry ?? cell.tries[0]
  return first && first.resultIndex >= 0 ? results.slice(0, first.resultIndex) : [...results]
}

// ============================================================================
// Observer dots (the legacy wire, P5b-2)
// ============================================================================

/** The props of the observer's arithmetic dots, from a `practice-state` broadcast. */
export interface ArithmeticObserverDots {
  sessionParts?: SessionPart[]
  currentPartIndex?: number
  currentSlotIndex?: number
  slotResults?: SlotResult[]
}

/**
 * Decodes the arithmetic position fields of a broadcast (the encoder is
 * `arithmeticObserverPosition` in `session-view.ts`). Legacy wire, retired
 * with Phase 6 once observers read `currentItem` (§10 P5b-2).
 */
export function arithmeticObserverDotsOf(
  event: Pick<
    PracticeStateEvent,
    'sessionParts' | 'currentPartIndex' | 'currentSlotIndex' | 'slotResults'
  >
): ArithmeticObserverDots {
  return {
    sessionParts: event.sessionParts as SessionPart[] | undefined,
    currentPartIndex: event.currentPartIndex,
    currentSlotIndex: event.currentSlotIndex,
    slotResults: event.slotResults as SlotResult[] | undefined,
  }
}
