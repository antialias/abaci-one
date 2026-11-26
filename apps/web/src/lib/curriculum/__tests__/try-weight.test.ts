import { describe, expect, it } from 'vitest'
import { calculateMasteryWeight, MAX_RETRY_EPOCHS } from '@/db/schema/session-plan-helpers'
import type { TryKind } from '@/db/schema/session-plans'
import { weightOfTry } from '../try-weight'

/**
 * weightOfTry must reproduce the numbers origin/main stores (plan §1.2, §10
 * P1-9): first and retry tries weigh calculateMasteryWeight(isCorrect, round);
 * a do-over of a once-wrong item weighs 1.0 correct / 0 wrong whatever its round
 * (session-planner's recordRedoResult on main: `result.isCorrect ? 1.0 : 0`);
 * a practice-only do-over weighs 0.
 */
describe('weightOfTry', () => {
  const kinds: TryKind[] = ['first', 'retry', 'do_over']
  const rounds = [0, 1, 2, 3, 4]
  /** What origin/main stores for this try */
  const mainWeight = (kind: TryKind, round: number, isCorrect: boolean) =>
    kind === 'do_over' ? (isCorrect ? 1.0 : 0) : calculateMasteryWeight(isCorrect, round)

  for (const kind of kinds) {
    for (const round of rounds) {
      if (kind === 'first' && round !== 0) continue
      if (kind === 'retry' && (round < 1 || round > MAX_RETRY_EPOCHS)) continue
      for (const isCorrect of [true, false]) {
        it(`${kind} round ${round} ${isCorrect ? 'correct' : 'wrong'} = main's stored weight`, () => {
          expect(weightOfTry({ kind, round, isCorrect, practiceOnly: false })).toBe(
            mainWeight(kind, round, isCorrect)
          )
          expect(weightOfTry({ kind, round, isCorrect, practiceOnly: true })).toBe(0)
        })
      }
    }
  }

  it('gives the headline numbers', () => {
    const w = (kind: TryKind, round: number, isCorrect = true, practiceOnly = false) =>
      weightOfTry({ kind, round, isCorrect, practiceOnly })
    expect(w('first', 0)).toBe(1)
    expect(w('retry', 1)).toBe(0.5)
    expect(w('retry', 2)).toBe(0.25)
    expect(w('do_over', 1)).toBe(1) // a once-wrong item redone right: 1.0 as on main (1/2^r is Phase 1w)
    expect(w('do_over', 3)).toBe(1)
    expect(w('do_over', 1, false)).toBe(0)
    expect(w('first', 0, false)).toBe(0) // a wrong try is still 0 (Phase 1w changes it)
    expect(w('do_over', 1, true, true)).toBe(0) // practice-only
  })

  it('weighs a first try as round 0 whatever round it carries', () => {
    expect(weightOfTry({ kind: 'first', round: 3, isCorrect: true, practiceOnly: false })).toBe(1)
  })
})
