/**
 * The session flow machine (session architecture plan of record §1.1, D1).
 *
 * A session is `part, (break, part)*, end`. This machine is the only writer of
 * `flowState`, `currentPartIndex`, `breaks`, `status` and `completedAt`: every
 * event, the client's (transition, break) and the server's (a recorded try, an
 * adult ending the session, a worksheet approval), comes through
 * `applyFlowEvent`, which returns the row patch. Of a part it calls only its
 * kind (`partKinds[kind].applyTry/applyTryAside/isDone`); it knows nothing of
 * slots or retry rounds.
 *
 * Pure: the caller writes the patch through `withRowCas` (D2).
 *
 * Expand/contract (D5): the patch writes the new columns (`breaks`,
 * `partStates`) and the legacy ones (`break_*`, `currentSlotIndex`,
 * `retryState`) exactly as the code before Phase 3a did; readers stay on the
 * legacy columns until Phase 5.
 */

import { isCountedTry } from '@/db/schema/session-plan-helpers'
import {
  adjustmentsOf,
  normalizeTries,
  partStateOf,
  partStatePatch,
  tryIdOf,
} from '@/db/schema/session-plan-normalize'
import type {
  BreakRecord,
  GameBreakEndReason,
  GameBreakSettings,
  SessionAdjustment,
  SessionFlowState,
  SessionPlan,
  SlotResult,
} from '@/db/schema/session-plans'
import type { GameResultsReport } from '@/lib/arcade/game-sdk/types'
import type { KindTry } from './parts/kind'
import { partKindOf } from './parts/registry'

/** Events a client sends (the flow-events route and the plan route's flow actions). */
export type ClientFlowEvent =
  | { type: 'PART_TRANSITION_STARTED' }
  /** `shouldRunBreak` is ignored from Phase 3a: the server decides from `gameBreakSettings` */
  | { type: 'PART_TRANSITION_COMPLETED'; shouldRunBreak?: boolean }
  | { type: 'BREAK_STARTED'; game?: string | null }
  | { type: 'BREAK_FINISHED'; reason: GameBreakEndReason; results?: GameResultsReport | null }
  | { type: 'BREAK_RESULTS_ACKED' }

export const CLIENT_FLOW_EVENT_TYPES: ReadonlySet<string> = new Set<ClientFlowEvent['type']>([
  'PART_TRANSITION_STARTED',
  'PART_TRANSITION_COMPLETED',
  'BREAK_STARTED',
  'BREAK_FINISHED',
  'BREAK_RESULTS_ACKED',
])

/** A try as the machine applies it: the stamped row and its kind-level record. */
export interface RecordedTry extends KindTry {
  partIndex: number
}

/** Events only the server raises. */
export type ServerFlowEvent =
  | { type: 'TRY_RECORDED'; row: SlotResult; try: RecordedTry }
  | { type: 'SESSION_ENDED_EARLY'; adjustment: SessionAdjustment }
  | { type: 'SESSION_ABANDONED' }
  | { type: 'WORKSHEET_APPROVED'; tries: SlotResult[] }
  | { type: 'WORKSHEET_UNAPPROVED'; tryIds: string[] }

export type SessionFlowEvent = ClientFlowEvent | ServerFlowEvent

export class InvalidFlowTransitionError extends Error {
  constructor(
    message: string,
    public readonly state: SessionFlowState,
    public readonly eventType: SessionFlowEvent['type']
  ) {
    super(message)
    this.name = 'InvalidFlowTransitionError'
  }
}

/** The row fields the machine writes. */
export type FlowPatch = Partial<
  Pick<
    SessionPlan,
    | 'flowState'
    | 'flowUpdatedAt'
    | 'flowVersion'
    | 'status'
    | 'completedAt'
    | 'currentPartIndex'
    | 'currentSlotIndex'
    | 'retryState'
    | 'partStates'
    | 'breaks'
    | 'breakStartedAt'
    | 'breakReason'
    | 'breakSelectedGame'
    | 'breakResults'
    | 'results'
    | 'adjustments'
  >
>

export interface AppliedFlowEvent {
  changed: boolean
  patch: FlowPatch
}

function sameResults(
  a: GameResultsReport | null | undefined,
  b: GameResultsReport | null | undefined
): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
}

function noChange(): AppliedFlowEvent {
  return { changed: false, patch: {} }
}

function breaksEnabled(plan: SessionPlan): boolean {
  return (plan.gameBreakSettings as GameBreakSettings | null)?.enabled ?? false
}

function breaksOf(plan: SessionPlan): BreakRecord[] {
  return Array.isArray(plan.breaks) ? plan.breaks : []
}

/** Index of the open break (started, not ended), or -1. */
function openBreakIndex(breaks: readonly BreakRecord[]): number {
  const last = breaks.length - 1
  return last >= 0 && breaks[last].endedAt === undefined ? last : -1
}

function durationBetween(startedAt: string | null, endedAt: Date): number | undefined {
  if (!startedAt) return undefined
  return Math.max(0, endedAt.getTime() - new Date(startedAt).getTime())
}

/** The list with its open break closed at `now` (no reason: the session ended under it). */
function closeOpenBreak(breaks: BreakRecord[], now: Date): BreakRecord[] {
  const i = openBreakIndex(breaks)
  if (i < 0) return breaks
  const closed = [...breaks]
  closed[i] = {
    ...closed[i],
    endedAt: now.toISOString(),
    durationMs: durationBetween(closed[i].startedAt, now),
  }
  return closed
}

/** A flow-state patch that bumps `flowVersion` only when the flow state moves. */
function flowMove(plan: SessionPlan, to: SessionFlowState, now: Date): FlowPatch {
  const current = plan.flowState ?? 'practicing'
  if (current === to) return { flowState: to }
  return { flowState: to, flowUpdatedAt: now, flowVersion: (plan.flowVersion ?? 0) + 1 }
}

export function applyFlowEvent(plan: SessionPlan, event: SessionFlowEvent): AppliedFlowEvent {
  const current = plan.flowState ?? 'practicing'
  const currentVersion = plan.flowVersion ?? 0
  const now = new Date()

  const commit = (patch: FlowPatch): AppliedFlowEvent => ({
    changed: true,
    patch: {
      ...patch,
      flowUpdatedAt: now,
      flowVersion: currentVersion + 1,
    },
  })

  switch (event.type) {
    case 'PART_TRANSITION_STARTED': {
      if (current === 'part_transition') return noChange()
      if (current !== 'practicing') {
        throw new InvalidFlowTransitionError(
          `PART_TRANSITION_STARTED not allowed from ${current}`,
          current,
          event.type
        )
      }
      return commit({
        flowState: 'part_transition',
        breakStartedAt: null,
        breakReason: null,
        breakSelectedGame: null,
        breakResults: null,
      })
    }

    case 'PART_TRANSITION_COMPLETED': {
      // The server decides whether a break runs; the client's shouldRunBreak is
      // ignored (§1.1). From any state past the transition it is a no-op, so a
      // late or repeated event from a tab never fails.
      if (current !== 'part_transition') {
        if (
          current === 'practicing' ||
          current === 'break_pending' ||
          current === 'break_active' ||
          current === 'break_results'
        ) {
          return noChange()
        }
        throw new InvalidFlowTransitionError(
          `PART_TRANSITION_COMPLETED not allowed from ${current}`,
          current,
          event.type
        )
      }

      if (!breaksEnabled(plan)) {
        return commit({
          flowState: 'practicing',
          breakStartedAt: null,
          breakReason: null,
          breakSelectedGame: null,
          breakResults: null,
        })
      }

      return commit({
        flowState: 'break_pending',
        breakStartedAt: plan.breakStartedAt ?? now,
        breakReason: null,
        breakSelectedGame: null,
        breakResults: null,
      })
    }

    case 'BREAK_STARTED': {
      const selectedGame = event.game ?? null
      const breaks = breaksOf(plan)

      if (current === 'break_active') {
        if ((plan.breakSelectedGame ?? null) === selectedGame || event.game === undefined) {
          return noChange()
        }
        const open = openBreakIndex(breaks)
        const updated = [...breaks]
        if (open >= 0) updated[open] = { ...updated[open], game: selectedGame }
        return commit({
          breakSelectedGame: selectedGame,
          breaks: updated,
        })
      }

      if (current !== 'break_pending') {
        throw new InvalidFlowTransitionError(
          `BREAK_STARTED not allowed from ${current}`,
          current,
          event.type
        )
      }

      const startedAt = plan.breakStartedAt ?? now
      return commit({
        flowState: 'break_active',
        breakStartedAt: startedAt,
        breakSelectedGame: selectedGame,
        breaks: [
          ...breaks,
          {
            breakIndex: breaks.length,
            afterPartIndex: plan.currentPartIndex - 1,
            startedAt: startedAt.toISOString(),
            game: selectedGame,
          },
        ],
      })
    }

    case 'BREAK_FINISHED': {
      const targetState: SessionFlowState =
        event.reason === 'gameFinished' ? 'break_results' : 'practicing'
      const targetResults = event.reason === 'gameFinished' ? (event.results ?? null) : null

      const alreadyApplied =
        current === targetState &&
        (plan.breakReason ?? null) === event.reason &&
        sameResults(plan.breakResults, targetResults)
      if (alreadyApplied) return noChange()

      if (current !== 'break_active' && current !== 'break_pending') {
        throw new InvalidFlowTransitionError(
          `BREAK_FINISHED not allowed from ${current}`,
          current,
          event.type
        )
      }

      // Close the open break; a break finished before it started (skipped
      // from break_pending) is appended already closed.
      const breaks = [...breaksOf(plan)]
      const open = openBreakIndex(breaks)
      const record: BreakRecord =
        open >= 0
          ? breaks[open]
          : {
              breakIndex: breaks.length,
              afterPartIndex: plan.currentPartIndex - 1,
              startedAt: (plan.breakStartedAt ?? now).toISOString(),
              game: plan.breakSelectedGame ?? null,
            }
      const closed: BreakRecord = {
        ...record,
        endedAt: now.toISOString(),
        reason: event.reason,
        results: targetResults,
        durationMs: durationBetween(record.startedAt, now),
      }
      if (open >= 0) breaks[open] = closed
      else breaks.push(closed)

      return commit({
        flowState: targetState,
        breakReason: event.reason,
        breakResults: targetResults,
        breaks,
      })
    }

    case 'BREAK_RESULTS_ACKED': {
      const alreadyApplied =
        current === 'practicing' &&
        plan.breakReason === null &&
        (plan.breakSelectedGame ?? null) === null &&
        plan.breakResults == null
      if (alreadyApplied) return noChange()

      if (current !== 'break_results') {
        throw new InvalidFlowTransitionError(
          `BREAK_RESULTS_ACKED not allowed from ${current}`,
          current,
          event.type
        )
      }

      // The legacy columns are cleared as before; `breaks` keeps the record.
      return commit({
        flowState: 'practicing',
        breakReason: null,
        breakSelectedGame: null,
        breakResults: null,
      })
    }

    case 'TRY_RECORDED':
      return applyTryRecorded(plan, event, now)

    case 'SESSION_ENDED_EARLY': {
      if (current === 'abandoned' || plan.status === 'abandoned') {
        throw new InvalidFlowTransitionError(
          'SESSION_ENDED_EARLY not allowed from abandoned',
          current,
          event.type
        )
      }
      if (current === 'completed' && plan.status === 'completed') return noChange()
      return {
        changed: true,
        patch: {
          ...flowMove(plan, 'completed', now),
          status: 'completed',
          completedAt: now,
          adjustments: [...adjustmentsOf(plan), event.adjustment],
          breaks: closeOpenBreak(breaksOf(plan), now),
        },
      }
    }

    case 'SESSION_ABANDONED': {
      if (current === 'abandoned' && plan.status === 'abandoned' && plan.completedAt) {
        return noChange()
      }
      if (current === 'completed') {
        throw new InvalidFlowTransitionError(
          'SESSION_ABANDONED not allowed from completed',
          current,
          event.type
        )
      }
      return {
        changed: true,
        patch: {
          ...flowMove(plan, 'abandoned', now),
          status: 'abandoned',
          completedAt: now,
          breaks: closeOpenBreak(breaksOf(plan), now),
        },
      }
    }

    case 'WORKSHEET_APPROVED': {
      // Nothing to add (the approval already landed, e.g. a double submit)
      if (event.tries.length === 0) return noChange()
      return {
        changed: true,
        patch: {
          ...flowMove(plan, 'completed', now),
          results: [...plan.results, ...event.tries],
          status: 'completed',
          completedAt: now,
          breaks: closeOpenBreak(breaksOf(plan), now),
        },
      }
    }

    case 'WORKSHEET_UNAPPROVED': {
      const ids = new Set(event.tryIds)
      let voidedAny = false
      const results = plan.results.map((r, i) => {
        if (r.voided || !ids.has(tryIdOf(r, i, plan.id))) return r
        voidedAny = true
        return { ...r, voided: true }
      })
      if (!voidedAny) return noChange()
      // Tries are voided, never removed: `results` is append-only (§3.3).
      // Something left that counts, or a session already past its last part
      // (an offline session, a finished one): it stays completed. Otherwise
      // it goes back to being practiced, with completedAt cleared alongside.
      const anyCounted = results.some((r) => r.source !== 'recency-refresh' && isCountedTry(r))
      const pastLastPart = plan.currentPartIndex >= plan.parts.length
      if (anyCounted || pastLastPart) {
        return {
          changed: true,
          patch: {
            ...flowMove(plan, 'completed', now),
            results,
            status: 'completed',
            completedAt: plan.completedAt ?? now,
          },
        }
      }
      return {
        changed: true,
        patch: {
          ...flowMove(plan, 'practicing', now),
          results,
          status: 'in_progress',
          completedAt: null,
        },
      }
    }
  }
}

/**
 * TRY_RECORDED: the part's kind applies the try; the machine decides the rhythm.
 *
 * - A first or retry try is accepted only while `practicing`. In
 *   `part_transition` or a break it is refused: since Phase 3c the client
 *   renders the transition from `flowState`, so a try arriving there is stale
 *   (§1.1 B3). `recordSlotResult` refuses it first, as 409 `not_practicing`
 *   with the plan; this throw is the machine's own guard.
 * - A do-over moves the cursor only in the part being practiced while
 *   practicing (`applyTry`); anywhere else the kind records it aside
 *   (`applyTryAside`) and the flow does not move.
 * - When the part is done: `part_transition` if parts remain (every part, with
 *   or without breaks), else `completed` with `status` and `completedAt`.
 */
function applyTryRecorded(
  plan: SessionPlan,
  event: Extract<ServerFlowEvent, { type: 'TRY_RECORDED' }>,
  now: Date
): AppliedFlowEvent {
  const current = plan.flowState ?? 'practicing'
  const t = event.try
  if (plan.status !== 'in_progress') {
    throw new InvalidFlowTransitionError(
      `TRY_RECORDED not allowed while the session is ${plan.status}`,
      current,
      event.type
    )
  }

  const isDoOver = t.kind === 'do_over'
  if (!isDoOver) {
    if (current !== 'practicing') {
      throw new InvalidFlowTransitionError(
        `TRY_RECORDED not allowed from ${current}`,
        current,
        event.type
      )
    }
    if (t.partIndex !== plan.currentPartIndex) {
      throw new Error(`TRY_RECORDED for part ${t.partIndex}, current ${plan.currentPartIndex}`)
    }
  }

  const part = plan.parts[t.partIndex]
  if (!part) throw new Error(`TRY_RECORDED for missing part ${t.partIndex}`)
  const kind = partKindOf(part)
  const content = kind.contentOf(part)
  const state = partStateOf(plan, t.partIndex)
  const partTries = normalizeTries(plan.id, plan.parts, plan.results).filter(
    (x) => x.partIndex === t.partIndex
  )
  const onCursor = !isDoOver || (t.partIndex === plan.currentPartIndex && current === 'practicing')
  const next = onCursor
    ? kind.applyTry(content, state, partTries, t)
    : kind.applyTryAside(content, state, partTries, t)
  const changed = next !== state

  const nextPartIndex =
    changed && onCursor && kind.isDone(content, next) ? t.partIndex + 1 : plan.currentPartIndex

  const patch: FlowPatch = {
    results: [...plan.results, event.row],
    ...partStatePatch(plan, t.partIndex, changed ? next : undefined, nextPartIndex),
  }
  // A first/retry try always settles the position; a do-over only when it
  // finished the part (it never steps past an item).
  if (!isDoOver || nextPartIndex !== plan.currentPartIndex) {
    const isComplete = nextPartIndex >= plan.parts.length
    const partTransitioned = nextPartIndex > plan.currentPartIndex
    const nextFlowState: SessionFlowState = isComplete
      ? 'completed'
      : partTransitioned
        ? 'part_transition'
        : 'practicing'
    const flowStateChanged =
      current !== nextFlowState || plan.breakStartedAt !== null || plan.breakResults !== null
    Object.assign(patch, {
      currentPartIndex: nextPartIndex,
      status: isComplete ? 'completed' : 'in_progress',
      flowState: nextFlowState,
      flowUpdatedAt: flowStateChanged ? now : (plan.flowUpdatedAt ?? now),
      flowVersion: (plan.flowVersion ?? 0) + (flowStateChanged ? 1 : 0),
      // Operational break fields are cleared; breakSelectedGame/breakReason
      // stay for readers of the legacy columns (the song).
      breakStartedAt: null,
      breakResults: null,
      completedAt: isComplete ? now : null,
    } satisfies FlowPatch)
  }

  return { changed: true, patch }
}
