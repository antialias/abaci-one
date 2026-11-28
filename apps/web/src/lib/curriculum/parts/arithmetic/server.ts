/**
 * The arithmetic part kind: slots, retry rounds and do-overs behind the
 * `PartKind` contract (session architecture §1.2, Phase 2).
 *
 * `Content` = the part's slots, `State` = the cursor and its retry round
 * (`{ slotIndex, retry }`, the part's `part_states` entry, see `state.ts`),
 * `Item` = the slot or retry-round item shown next.
 *
 * Pure (no database, no server-only imports), so the registry can be read on
 * either side; the name follows the plan's module layout.
 */

import type { SessionPart, SlotResult, TryEvidence } from '@/db/schema/session-plans'
import type { KindTry, KindTryRecord, PartKind, Presentation } from '../kind'
import { formatProblemExpression } from './describe'
import { arithmeticPresentationOf, arithmeticPresentations } from './presentations'
import {
  type ArithmeticContent,
  type ArithmeticItem,
  type ArithmeticState,
  arithmeticCursor,
  expectedArithmeticItem,
} from './state'

/**
 * A do-over's effect without settling: a correct do-over of an item whose
 * latest counted try was wrong redeems it; anything else (practice-only,
 * wrong, a part with no retry state) returns `state` itself.
 *
 * The kind's `applyTryAside`: a do-over outside the part being practiced
 * (another part, or a break) redeems without settling (§10 P2-3). The shared
 * cursor's `redeem` since K3.
 */
export function redeemByDoOver(
  slots: ArithmeticContent,
  state: ArithmeticState,
  t: KindTry
): ArithmeticState {
  return arithmeticCursor.redeem(slots, state, t)
}

/**
 * A part's presentation (§1.3 `presentationOf`): the registered one, with the
 * ledger's `abacusAvailable` as the part decides it (a linear part on the
 * ramp keeps the working abacus, `useAbacus`), which is what the axes read
 * before K3. An id this image does not register (a newer image's
 * presentation, read after a rollback) is its own: labelled by its id, its
 * own mastery mode (§3.1), the abacus as the part says.
 */
export function arithmeticPartPresentation(part: SessionPart): Presentation<SessionPart> {
  const id = arithmeticPresentationOf(part)
  const registered = arithmeticPresentations.get(id)
  const presentation: Presentation<SessionPart> = registered ?? {
    id,
    label: id,
    emoji: '⭐',
    masteryMode: id,
    axes: { layer: id, modality: 'visual', abacusAvailable: false, input: 'keypad' },
    needsPhysicalAbacus: (p) => p.useAbacus === true,
    autoPause: true,
  }
  if (typeof part.useAbacus !== 'boolean') return presentation
  if (presentation.axes.abacusAvailable === part.useAbacus) return presentation
  return { ...presentation, axes: { ...presentation.axes, abacusAvailable: part.useAbacus } }
}

/**
 * What an arithmetic try is evidence of: the skills the row says it exercised
 * and its part's presentation. `skillsExercised` is today's evidence, the
 * list every BKT reader and the skill-attempt bump read; it is not always the
 * problem's `skillsRequired` (seeded rows store every skill a problem used,
 * the journey simulator the skills it challenged). A row without a
 * `skillsExercised` array is not evidence, as every reader skips it today
 * (`session-planner.ts` history, `evidence-query.ts` `toBktEvidence`).
 */
export function arithmeticEvidenceOf(
  part: { type?: unknown } | undefined,
  row: Pick<SlotResult, 'skillsExercised'>
): TryEvidence | null {
  const skills: unknown = row.skillsExercised
  if (!Array.isArray(skills)) return null
  return { skills: skills as string[], presentation: arithmeticPresentationOf(part) }
}

export const arithmeticKind: PartKind<
  ArithmeticContent,
  ArithmeticState,
  ArithmeticItem,
  SessionPart
> = {
  id: 'arithmetic',

  contentOf: (part) => part.slots,

  // Sessions from before problem pre-generation have slots without problems
  isPlayable: (slots) => slots.every((slot) => !!slot.problem),

  // The cursor is the shared one (K3, decision K4): slots in order, two retry
  // rounds, redemption, do-overs. A do-over is refused for an item the part
  // does not have, one with no try, or one whose answer was divulged (a wrong
  // try of the last retry round, which shows the answer; the dots' copy reads
  // the same, `SessionProgressIndicator`): moved here from `recordRedoResult`
  // in K2, where it was a plain Error (500); refused here it is the
  // recorder's quiet 409 `SLOT_MISMATCH` (R14).
  initialState: arithmeticCursor.initialState,
  answerShown: arithmeticCursor.answerShown,
  acceptsDoOver: arithmeticCursor.acceptsDoOver,
  whyNotDoOver: arithmeticCursor.whyNotDoOver,
  applyTry: arithmeticCursor.applyTry,
  applyTryAside: arithmeticCursor.applyTryAside,
  isDone: arithmeticCursor.isDone,
  progress: arithmeticCursor.progress,
  roundsRemaining: arithmeticCursor.roundsRemaining,

  // What the student is shown, as this kind has always shown it (`slotId`,
  // `epochNumber`, a retry's problem from the queue)
  expectedItem: expectedArithmeticItem,

  presentations: arithmeticPresentations,

  items: (slots) => slots.map((slot) => ({ itemId: slot.slotId })),

  itemOf(slots, itemId) {
    const index = slots.findIndex((s) => s.slotId === itemId)
    if (index < 0) return null
    const slot = slots[index]
    return {
      slotId: slot.slotId,
      originalSlotIndex: index,
      epochNumber: 0,
      retryIndex: null,
      problem: slot.problem,
      purpose: slot.purpose,
    }
  },

  judge(slots, itemId, answer) {
    const problem = slots.find((s) => s.slotId === itemId)?.problem
    return problem !== undefined && answer === problem.answer
  },

  evidenceOf: (part, t: KindTryRecord) => arithmeticEvidenceOf(part, t.result),

  describe(_part, t) {
    const problem = t.payload.problem as SlotResult['problem'] | undefined
    if (!problem || !Array.isArray(problem.terms)) return 'a problem'
    return formatProblemExpression(problem.terms, problem.answer)
  },

  // The stored payload is `{ kind: 'arithmetic' }`: the snapshot stays at top
  // level (K6, K14), and the in-memory payload lifts it
  payloadOf: (row) => ({
    ...(row.payload ?? { kind: 'arithmetic' }),
    problem: row.problem,
    usedOnScreenAbacus: row.usedOnScreenAbacus,
  }),

  // The part's presentation; its `axes` are what the ledger adapter copies
  // (L/ledger/adapters/problem-result.ts), as `presentationOf` answered
  // before K3. The mastery mode is the presentation's (`bktMode` is retired).
  presentationOf: arithmeticPartPresentation,

  // A retry item shares its slot's id; its round is the retry round
  itemPositionOf: (item) => ({ itemId: item.slotId, round: item.epochNumber }),

  // A `record_try` row keeps the top-level snapshot every older reader reads
  // (K6, K14); a skip or timeout in today's frozen projection (§3.1, S4)
  snapshotOf(slots, itemId, t) {
    const slotIndex = slots.findIndex((s) => s.slotId === itemId)
    const problem = slots[slotIndex]?.problem
    if (!problem) return null
    const answered = t.outcome === 'answered'
    return {
      fields: {
        slotId: itemId,
        slotIndex,
        problem,
        studentAnswer: answered ? (t.answer as number) : problem.answer,
        skillsExercised: problem.skillsRequired,
        usedOnScreenAbacus: t.payload.usedOnScreenAbacus === true,
        ...(answered ? {} : { hadHelp: true, helpTrigger: 'manual' as const }),
      },
      payload: { kind: 'arithmetic' },
    }
  },
}
