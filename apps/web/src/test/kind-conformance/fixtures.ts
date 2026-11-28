/**
 * The two kinds that run the conformance suite today (practice-kinds §4 K4):
 * arithmetic, as its parts are stored, and the stub `read_abacus` kind
 * (`parts/__tests__/fixtures/read-abacus-kind.ts`), which is written against
 * the contract alone and has its own cursor (no retry rounds).
 */

import type { ProblemSlot, SessionPart, SlotResult } from '@/db/schema/session-plans'
import type {
  ReadAbacusItem,
  ReadAbacusPart,
} from '@/lib/curriculum/parts/__tests__/fixtures/read-abacus-kind'
import type { ArithmeticItem } from '@/lib/curriculum/parts/arithmetic/state'
import type { KindFixtures } from './suite'

const SKILLS = ['basic.directAddition']

/** Arithmetic: an abacus part of slots with fixed problems (`p<part>s<slot>`). */
export const arithmeticFixtures: KindFixtures = {
  part(items, partNumber) {
    const part: SessionPart = {
      kind: 'arithmetic',
      partNumber: partNumber as SessionPart['partNumber'],
      type: 'abacus',
      format: 'vertical',
      useAbacus: true,
      slots: Array.from({ length: items }, (_, s): ProblemSlot => {
        const terms = [10 * partNumber + s + 1, s + 2]
        return {
          slotId: `p${partNumber}s${s}`,
          index: s,
          purpose: 'focus',
          constraints: {},
          problem: { terms, answer: terms[0] + terms[1], skillsRequired: SKILLS },
        }
      }),
      estimatedMinutes: 2,
    }
    return part
  },
  answer(item, correct) {
    const answer = (item as ArithmeticItem).problem!.answer
    return correct ? answer : answer + 1
  },
  payload: () => ({ kind: 'arithmetic', usedOnScreenAbacus: false }),
  skillsOf: (item) => (item as ArithmeticItem).problem?.skillsRequired ?? [],
  retryRounds: 2,
  doOverAfterDivulged: 'refused',
  // A row as every recorder wrote it before the envelope (K1): no tryId, no
  // try record, no envelope; the normalizer derives them
  legacyRow(part) {
    const slot = (part as SessionPart).slots[0]
    const problem = slot.problem!
    const row = {
      slotId: slot.slotId,
      partNumber: part.partNumber,
      slotIndex: 0,
      problem,
      studentAnswer: problem.answer,
      isCorrect: true,
      responseTimeMs: 4000,
      skillsExercised: problem.skillsRequired,
      usedOnScreenAbacus: false,
      timestamp: new Date('2025-06-01T00:00:00.000Z'),
      hadHelp: false,
      incorrectAttempts: 0,
    } satisfies SlotResult
    return {
      row,
      expected: {
        itemId: slot.slotId,
        outcome: 'answered',
        answer: problem.answer,
        isCorrect: true,
        evidence: { skills: problem.skillsRequired, presentation: 'abacus' },
      },
    }
  },
}

/** The stub `read_abacus` kind: bead pictures to read (`p<part>i<item>`). */
export const readAbacusFixtures: KindFixtures = {
  part(items, partNumber) {
    const part: ReadAbacusPart = {
      kind: 'read_abacus',
      partNumber,
      content: {
        items: Array.from(
          { length: items },
          (_, i): ReadAbacusItem => ({
            itemId: `p${partNumber}i${i}`,
            beadState: [i % 5, (i + 1) % 5],
            expectedValue: 10 * (i % 5) + ((i + 1) % 5),
            skillsRequired: ['read.tens'],
          })
        ),
      },
    }
    return part
  },
  answer(item, correct) {
    const value = (item as ReadAbacusItem).expectedValue
    return correct ? value : value + 1
  },
  // Its snapshot lives in the payload once (§3.1); its evidence reads it there
  payload: (item) => ({ kind: 'read_abacus', item }),
  skillsOf: (item) => (item as ReadAbacusItem).skillsRequired,
  retryRounds: 0,
  // The stub shows the answer after every wrong try and still takes a
  // do-over of it (the shared cursor refuses one): practice-only (A17)
  doOverAfterDivulged: 'practice_only',
  legacyRow: null,
}
