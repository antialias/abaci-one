import { describe, expect, it } from 'vitest'
import { calculateMasteryWeight, MAX_RETRY_EPOCHS } from '@/db/schema/session-plan-helpers'
import type { TryKind } from '@/db/schema/session-plans'
import { evidenceWeightOf, weightOfTry } from '../try-weight'

/**
 * Phase 1w (plan §7, §8 Q10, §10 P1-9, P1w-1): a try weighs 1/2^round right or
 * wrong; a first try is round 0; a practice-only do-over weighs 0. Main stored a
 * wrong try at 0 and a counted do-over at 1.0 / 0 whatever its round; a correct
 * first try or retry keeps main's number exactly.
 */
describe('weightOfTry', () => {
  const kinds: TryKind[] = ['first', 'retry', 'do_over']
  const rounds = [0, 1, 2, 3, 4]

  for (const kind of kinds) {
    for (const round of rounds) {
      if (kind === 'first' && round !== 0) continue
      if (kind === 'retry' && (round < 1 || round > MAX_RETRY_EPOCHS)) continue
      if (kind === 'do_over' && round < 1) continue // a do-over always follows a try
      for (const isCorrect of [true, false]) {
        it(`${kind} round ${round} ${isCorrect ? 'correct' : 'wrong'} = 1/2^round`, () => {
          expect(weightOfTry({ kind, round, isCorrect, practiceOnly: false })).toBe(1 / 2 ** round)
          expect(weightOfTry({ kind, round, isCorrect, practiceOnly: true })).toBe(0)
        })
      }
    }
  }

  it('keeps main’s weight for every correct first try and retry', () => {
    expect(weightOfTry({ kind: 'first', round: 0, isCorrect: true, practiceOnly: false })).toBe(
      calculateMasteryWeight(true, 0)
    )
    for (let round = 1; round <= MAX_RETRY_EPOCHS; round++) {
      expect(weightOfTry({ kind: 'retry', round, isCorrect: true, practiceOnly: false })).toBe(
        calculateMasteryWeight(true, round)
      )
    }
  })

  it('gives the headline numbers', () => {
    const w = (kind: TryKind, round: number, isCorrect = true, practiceOnly = false) =>
      weightOfTry({ kind, round, isCorrect, practiceOnly })
    expect(w('first', 0)).toBe(1)
    expect(w('first', 0, false)).toBe(1) // a wrong first try now carries full evidence (main: 0)
    expect(w('retry', 1)).toBe(0.5)
    expect(w('retry', 1, false)).toBe(0.5) // main: 0
    expect(w('retry', 2, false)).toBe(0.25)
    expect(w('do_over', 1)).toBe(0.5) // a once-wrong item redone right: like its first retry (main: 1.0)
    expect(w('do_over', 2, false)).toBe(0.25) // main: 0
    expect(w('do_over', 3)).toBe(0.125) // main: 1.0
    expect(w('do_over', 1, true, true)).toBe(0) // practice-only
    expect(w('do_over', 1, false, true)).toBe(0) // practice-only, wrong
  })

  it('weighs a first try as round 0 whatever round it carries', () => {
    expect(weightOfTry({ kind: 'first', round: 3, isCorrect: true, practiceOnly: false })).toBe(1)
    expect(weightOfTry({ kind: 'first', round: 3, isCorrect: false, practiceOnly: false })).toBe(1)
  })
})

describe('evidenceWeightOf (every reader, Phase 1w retroactive)', () => {
  it('re-derives a wrong row’s weight from the row, ignoring a stored 0', () => {
    // main's rows: no Phase 1 stamps
    expect(evidenceWeightOf({ isCorrect: false, masteryWeight: 0 })).toBe(1)
    expect(evidenceWeightOf({ isCorrect: false, epochNumber: 0, masteryWeight: 0 })).toBe(1)
    expect(
      evidenceWeightOf({ isCorrect: false, isRetry: true, epochNumber: 1, masteryWeight: 0 })
    ).toBe(0.5)
    expect(evidenceWeightOf({ isCorrect: false, epochNumber: 2, masteryWeight: 0 })).toBe(0.25)
    // a legacy (unstamped) wrong do-over stays 0: it may be a redo of an item
    // already answered right, which is practice-only today, never a slip
    expect(
      evidenceWeightOf({ isCorrect: false, isManualRedo: true, epochNumber: 0, masteryWeight: 0 })
    ).toBe(0)
    expect(evidenceWeightOf({ isCorrect: false, isManualRedo: true })).toBe(0)
    // a Phase 1 row: its stamped kind and round
    expect(
      evidenceWeightOf({ isCorrect: false, kind: 'do_over', round: 3, masteryWeight: 0 })
    ).toBe(0.125)
    // unstamped (offline) wrong first try: 1, as before
    expect(evidenceWeightOf({ isCorrect: false })).toBe(1)
  })

  it('agrees with the stamp on rows recorded from Phase 1w on', () => {
    for (const kind of ['first', 'retry', 'do_over'] as const) {
      for (const round of [0, 1, 2, 3]) {
        const t = { kind, round, isCorrect: false, practiceOnly: false }
        expect(evidenceWeightOf({ ...t, masteryWeight: weightOfTry(t) })).toBe(weightOfTry(t))
      }
    }
  })

  it('keeps a correct row’s stored weight, legacy do-overs included', () => {
    expect(evidenceWeightOf({ isCorrect: true, masteryWeight: 0.25, epochNumber: 2 })).toBe(0.25)
    expect(
      evidenceWeightOf({ isCorrect: true, isManualRedo: true, epochNumber: 0, masteryWeight: 1 })
    ).toBe(1)
    expect(evidenceWeightOf({ isCorrect: true })).toBe(1)
  })

  it('weighs a practice-only row 0, right or wrong', () => {
    expect(evidenceWeightOf({ isCorrect: true, practiceOnly: true, masteryWeight: 0 })).toBe(0)
    expect(
      evidenceWeightOf({ isCorrect: false, practiceOnly: true, kind: 'do_over', round: 1 })
    ).toBe(0)
  })
})
