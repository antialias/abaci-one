'use client'

/**
 * Arithmetic's browser half (practice-kinds plan §1.3, K9; §4 K5a-3b): its
 * optimistic check (amendment A11), the same comparison the server's `judge`
 * makes and the screen has always shown at once, and what the session shell
 * reads of it through `parts/browser-registry.ts`: the try items, the views
 * (`ItemView`, `ObserverView`, `TryCard`, `Interlude`) and the wire it writes
 * (the record bodies, the do-over write, the observer broadcast). The check is
 * display only.
 */

import type { InterludeProps, SessionKind } from '@/components/practice/session/sessionKind'
import type {
  ActiveRedo,
  BroadcastComplexity,
  RecordRedoParams,
} from '@/components/practice/session/types'
import { sameProblem } from '@/db/schema/session-plan-helpers'
import type { GeneratedProblem, ProblemSlot, SlotResult } from '@/db/schema/session-plans'
import type { BrowserKind } from '../browser-kind'
import { ArithmeticItemView, answeredProblemIdentity } from './browser/ItemView'
import { ArithmeticObserverView } from './browser/ObserverView'
import { extractTargetSkillName } from './browser/PurposeBadge'
import { RetryTransitionScreen } from './browser/RetryTransitionScreen'
import { ArithmeticTryCard } from './browser/TryCard'
import {
  type AttemptInput,
  arithmeticTryItems,
  type DigitEntryPhase,
  type InitialProblemData,
  type OutgoingAttempt,
} from './browser/useDigitEntry'
import {
  arithmeticRetryRoundSize,
  arithmeticSlotAt,
  arithmeticSlotOf,
  arithmeticSlotOfProblem,
} from './session-view'
import { type ArithmeticItem, MAX_RETRY_EPOCHS } from './state'

/** What the check reads of an item: its problem (an item on the plan, or an attempt at one). */
type Checked = { problem?: Pick<GeneratedProblem, 'answer'> }

const check = (item: Checked, answer: number) =>
  item.problem !== undefined && answer === item.problem.answer

export const arithmeticBrowserKind: BrowserKind<Checked, number> = {
  id: 'arithmetic',
  check,
}

/**
 * The do-over write for a tapped item: the result names the item
 * (`slotId = itemId`) and `redoContext.itemId` names it to a server from Phase
 * 5a on; the item's slot index rides beside it for servers before that (the
 * indices must agree with the id).
 */
export function doOverWriteOf({
  playerId,
  planId,
  redo,
  slotIndex,
  result,
  originalWasCorrect,
}: {
  playerId: string
  planId: string
  redo: Pick<ActiveRedo, 'partIndex' | 'itemId'>
  /** The item's slot index, read off the item */
  slotIndex: number
  result: Omit<SlotResult, 'timestamp' | 'partNumber'> & { tryId: string }
  originalWasCorrect: boolean
}): RecordRedoParams {
  return {
    playerId,
    planId,
    result: { ...result, slotId: redo.itemId, slotIndex, originalSlotIndex: slotIndex },
    redoContext: {
      itemId: redo.itemId,
      originalPartIndex: redo.partIndex,
      originalSlotIndex: slotIndex,
      // For servers from before Phase 1; a current server derives it
      originalWasCorrect,
    },
  }
}

/** Complexity data of a slot, for the observer's tooltip. */
function complexityOf(slot: ProblemSlot | undefined): BroadcastComplexity | undefined {
  if (!slot) return undefined

  const bounds = slot.complexityBounds
  const trace = slot.problem?.generationTrace
  const hasBounds = bounds && (bounds.min !== undefined || bounds.max !== undefined)
  const hasCost = trace?.totalComplexityCost !== undefined

  if (!hasBounds && !hasCost) return undefined

  return {
    bounds: hasBounds ? { min: bounds?.min, max: bounds?.max } : undefined,
    totalCost: trace?.totalComplexityCost,
    stepCount: trace?.steps?.length,
    targetSkillName: extractTargetSkillName(slot) ?? undefined,
  }
}

/** The round interlude: the retry round's transition screen. */
function ArithmeticInterlude({ isVisible, round, itemCount, student, onComplete }: InterludeProps) {
  return (
    <RetryTransitionScreen
      isVisible={isVisible}
      epochNumber={round}
      problemCount={itemCount}
      student={student}
      onComplete={onComplete}
    />
  )
}

export const arithmeticSessionKind: SessionKind<
  InitialProblemData,
  AttemptInput,
  OutgoingAttempt,
  DigitEntryPhase,
  number,
  Checked
> = {
  id: 'arithmetic',
  check,
  maxRounds: MAX_RETRY_EPOCHS,
  tryItems: arithmeticTryItems,

  tryItemOf({ partIndex, item }, { doOver }) {
    const shown = item as ArithmeticItem
    if (!shown.problem) return null
    // A do-over is shown as its slot, with no round (the record sends 0)
    return doOver
      ? { problem: shown.problem, slotIndex: shown.originalSlotIndex, partIndex }
      : {
          problem: shown.problem,
          slotIndex: shown.originalSlotIndex,
          partIndex,
          epochNumber: shown.epochNumber,
        }
  },

  positionOf(parts, attempt) {
    const identity = answeredProblemIdentity(parts, attempt)
    return {
      partIndex: identity.partIndex,
      itemId: identity.slotId,
      round: identity.epochNumber,
    }
  },

  doOverWriteOf({ plan, redo, ...rest }) {
    const found = arithmeticSlotOf(plan.parts[redo.partIndex], redo.itemId)
    return found ? doOverWriteOf({ ...rest, redo, slotIndex: found.slotIndex }) : null
  },

  roundSizeOf: arithmeticRetryRoundSize,

  broadcastPhaseOf: (phase) => (phase === 'helpMode' ? 'tutorial' : null),

  broadcastOf(parts, attempt, { phase, isCorrect, startedAt, item }) {
    // The slot of the problem on screen (its own part and slot: a retry's
    // original slot, a do-over's slot), not the plan's cursor
    const slot = arithmeticSlotAt(parts, attempt.partIndex, attempt.slotIndex)
    return {
      currentProblem: {
        terms: attempt.problem.terms,
        answer: attempt.problem.answer,
      },
      slotId: slot?.slotId ?? '',
      phase,
      studentAnswer: attempt.userAnswer,
      isCorrect,
      startedAt,
      purpose: slot?.purpose ?? 'focus',
      complexity: complexityOf(slot),
      item,
    }
  },

  outgoingBroadcastOf(parts, outgoing, last, { doOver, startedAt }) {
    // During transitioning the observer sees the outgoing (answered) problem:
    // the item last broadcast as on screen, with its own round and do-over
    // flag (the redo state may already be cleared by then)
    const outgoingItem =
      last &&
      last.item.partIndex === outgoing.partIndex &&
      sameProblem(last.attempt.problem, outgoing.problem)
        ? last.item
        : null
    const outgoingSlot = outgoingItem
      ? arithmeticSlotOf(parts[outgoingItem.partIndex], outgoingItem.itemId)?.slot
      : arithmeticSlotOfProblem(parts, outgoing.partIndex, outgoing.problem)
    return {
      currentProblem: {
        terms: outgoing.problem.terms,
        answer: outgoing.problem.answer,
      },
      slotId: outgoingSlot?.slotId ?? '',
      phase: 'feedback',
      studentAnswer: outgoing.userAnswer,
      isCorrect: outgoing.result === 'correct',
      startedAt,
      purpose: outgoingSlot?.purpose ?? 'focus',
      complexity: complexityOf(outgoingSlot),
      item: outgoingItem ?? {
        partIndex: outgoing.partIndex,
        itemId: outgoingSlot?.slotId ?? '',
        doOver,
        round: 0,
      },
    }
  },

  ItemView: ArithmeticItemView,
  ObserverView: ArithmeticObserverView,
  TryCard: ArithmeticTryCard,
  Interlude: ArithmeticInterlude,
}
