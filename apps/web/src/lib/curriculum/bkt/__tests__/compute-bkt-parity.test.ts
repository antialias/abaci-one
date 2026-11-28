/**
 * @vitest-environment node
 *
 * BKT, readiness and linear-gate parity on legacy data (session architecture
 * Phase 1).
 *
 * Phase 1 stamps new rows with kind/round/practiceOnly and makes these readers
 * skip practice-only rows. Rows recorded before it carry none of that, so the
 * readers over them must not move. How the inline snapshots were produced: they
 * were written by this code, then the same test file was run once against
 * temporary copies of origin/main `4e896158d`'s `bkt/compute-bkt.ts`,
 * `skill-readiness.ts` and `linear-gate.ts` (imports pointed at the copies),
 * where every snapshot passed unchanged; the copies were then deleted. Legacy
 * correct-item do-overs keep their stored weight 1.0 (no refold, §1.2), and rows
 * without masteryWeight (worksheet/offline) still read as 1.0.
 *
 * Phase 1w is retroactive (§10 P1w-1): every reader weighs a wrong row
 * 1/2^round re-derived from the row, so the fixture's two wrong rows stored at
 * 0 (F's wrong first try and its wrong round-1 retry) now count at 1 and 0.5.
 * That moved only F's pKnown (0.925 -> 0.771) in the BKT and readiness
 * snapshots below (re-recorded in Phase 1w); its confidence and verdicts, the
 * A and H entries (no wrong row touches them) and the linear gate (it reads no
 * weight) are unchanged. Correct rows keep their stored weight, including the
 * legacy do-overs' 1.0. The last block shows the rule row by row.
 */

import { describe, expect, it } from 'vitest'
import { calculateMasteryWeight } from '@/db/schema/session-plan-helpers'
import { computeBktFromHistory } from '@/lib/curriculum/bkt'
import { deriveLinearGateState } from '@/lib/curriculum/linear-gate'
import type { ProblemResultWithContext } from '@/lib/curriculum/session-planner'
import { assessAllSkillsReadiness } from '@/lib/curriculum/skill-readiness'
import { weightOfTry } from '@/lib/curriculum/try-weight'
import { historyTryOf } from '@/test/fixtures/history-try'

const A = 'basic.directAddition'
const H = 'basic.heavenBead'
const F = 'fiveComplements.4=5-1'
const BASE_TS = new Date('2025-03-01T10:00:00Z').getTime()

let n = 0
function legacy(
  over: Partial<ProblemResultWithContext> & { partType?: string }
): ProblemResultWithContext {
  n += 1
  const { partType = 'abacus', ...rest } = over
  return historyTryOf(
    {
      slotId: `slot-${n}`,
      partNumber: 1,
      slotIndex: n,
      problem: { terms: [n, 1], answer: n + 1 } as never,
      studentAnswer: n + 1,
      isCorrect: true,
      responseTimeMs: 4000,
      skillsExercised: [A],
      usedOnScreenAbacus: false,
      hadHelp: false,
      incorrectAttempts: 0,
      sessionId: 'legacy-1',
      sessionCompletedAt: new Date(BASE_TS + 3_600_000),
      timestamp: new Date(BASE_TS + n * 60_000),
      ...rest,
    },
    partType
  )
}

/** Two legacy sessions: first tries, wrong tries, weighted retries, do-overs, worksheet rows. */
function fixture(): ProblemResultWithContext[] {
  n = 0
  return [
    legacy({ masteryWeight: 1 }),
    legacy({ skillsExercised: [A, H], masteryWeight: 1 }),
    legacy({ skillsExercised: [F], isCorrect: false, studentAnswer: 0, masteryWeight: 0 }),
    legacy({ skillsExercised: [H], masteryWeight: 1, hadHelp: true }),
    legacy({ skillsExercised: [F], isRetry: true, epochNumber: 1, masteryWeight: 0.5 }),
    legacy({
      skillsExercised: [F],
      isCorrect: false,
      isRetry: true,
      epochNumber: 1,
      masteryWeight: 0,
    }),
    legacy({ skillsExercised: [F], isRetry: true, epochNumber: 2, masteryWeight: 0.25 }),
    // pre-Phase-1 do-overs: the server stored epochNumber 0 and weight 1.0,
    // whether the item had been right or wrong; both keep counting
    legacy({ skillsExercised: [F], isManualRedo: true, epochNumber: 0, masteryWeight: 1 }),
    legacy({ skillsExercised: [A], isManualRedo: true, epochNumber: 0, masteryWeight: 1 }),
    legacy({ responseTimeMs: 45_000, masteryWeight: 1, partType: 'linear' }),
    legacy({ partType: 'visualization', masteryWeight: 1, usedOnScreenAbacus: true }),
    // offline worksheet rows: no masteryWeight at all
    legacy({ sessionId: 'legacy-2', skillsExercised: [H], source: 'offline' as never }),
    legacy({ sessionId: 'legacy-2', skillsExercised: [F, H], source: 'offline' as never }),
    legacy({
      sessionId: 'legacy-2',
      skillsExercised: [F],
      isCorrect: false,
      source: 'offline' as never,
    }),
  ]
}

const rounded = (history: ProblemResultWithContext[]) =>
  computeBktFromHistory(history, { applyDecay: false }).skills.map((s) => ({
    skillId: s.skillId,
    pKnown: Number(s.pKnown.toFixed(10)),
    confidence: Number(s.confidence.toFixed(10)),
    opportunities: s.opportunities,
    successCount: s.successCount,
  }))

describe('BKT parity on legacy rows', () => {
  it('matches the pre-Phase-1 numbers (F: with its wrong rows counted, Phase 1w)', () => {
    expect(rounded(fixture())).toMatchInlineSnapshot(`
      [
        {
          "confidence": 0.3238833389,
          "opportunities": 7,
          "pKnown": 0.770687675,
          "skillId": "fiveComplements.4=5-1",
          "successCount": 4,
        },
        {
          "confidence": 0.3812692469,
          "opportunities": 4,
          "pKnown": 0.997619692,
          "skillId": "basic.heavenBead",
          "successCount": 4,
        },
        {
          "confidence": 0.4211992169,
          "opportunities": 5,
          "pKnown": 0.9998235837,
          "skillId": "basic.directAddition",
          "successCount": 5,
        },
      ]
    `)
  })

  it('reads a row stamped practiceOnly: false exactly like its legacy twin', () => {
    const history = fixture()
    const stamped = history.map((r) => ({ ...r, practiceOnly: false }))
    expect(rounded(stamped)).toEqual(rounded(history))
  })

  it('skips only rows stamped practice-only', () => {
    const history = fixture()
    const extra = { ...history[0], practiceOnly: true, masteryWeight: 0, isManualRedo: true }
    expect(rounded([...history, extra])).toEqual(rounded(history))
  })

  it('readiness matches the pre-Phase-1 verdicts (F: with its wrong rows counted, Phase 1w)', () => {
    const history = fixture()
    const skills = computeBktFromHistory(history, { applyDecay: false }).skills
    const readiness = assessAllSkillsReadiness(history, skills, new Set([A, H, F]))
    expect(Object.fromEntries(readiness)).toMatchInlineSnapshot(`
      {
        "basic.directAddition": {
          "dimensions": {
            "consistency": {
              "lastFiveAllCorrect": true,
              "met": false,
              "recentAccuracy": 1,
              "recentHelpCount": 0,
            },
            "mastery": {
              "confidence": 0.42119921692859513,
              "met": false,
              "pKnown": 0.9998235836963376,
            },
            "speed": {
              "medianSecondsPerTerm": 2,
              "met": true,
            },
            "volume": {
              "met": false,
              "opportunities": 5,
              "sessionCount": 1,
            },
          },
          "isSolid": false,
          "skillId": "basic.directAddition",
        },
        "basic.heavenBead": {
          "dimensions": {
            "consistency": {
              "lastFiveAllCorrect": false,
              "met": false,
              "recentAccuracy": 1,
              "recentHelpCount": 1,
            },
            "mastery": {
              "confidence": 0.3812692469220182,
              "met": false,
              "pKnown": 0.9976196920092418,
            },
            "speed": {
              "medianSecondsPerTerm": 2,
              "met": true,
            },
            "volume": {
              "met": false,
              "opportunities": 4,
              "sessionCount": 2,
            },
          },
          "isSolid": false,
          "skillId": "basic.heavenBead",
        },
        "fiveComplements.4=5-1": {
          "dimensions": {
            "consistency": {
              "lastFiveAllCorrect": false,
              "met": false,
              "recentAccuracy": 0.5,
              "recentHelpCount": 0,
            },
            "mastery": {
              "confidence": 0.32388333885271514,
              "met": false,
              "pKnown": 0.7706876750289361,
            },
            "speed": {
              "medianSecondsPerTerm": 2,
              "met": true,
            },
            "volume": {
              "met": false,
              "opportunities": 4,
              "sessionCount": 2,
            },
          },
          "isSolid": false,
          "skillId": "fiveComplements.4=5-1",
        },
      }
    `)
  })

  it('the linear gate matches the pre-Phase-1 verdicts', () => {
    const gate = deriveLinearGateState({
      problemHistory: fixture(),
      categories: ['basic', 'fiveComplements'],
      thresholds: { minAccuracy: 0.85, accuracyWindowSize: 3, minOpportunities: 1 },
    })
    expect(gate).toMatchInlineSnapshot(`
      Map {
        "basic" => {
          "category": "basic",
          "opportunities": 1,
          "passed": false,
          "recentAccuracy": 1,
        },
        "fiveComplements" => {
          "category": "fiveComplements",
          "opportunities": 0,
          "passed": false,
          "recentAccuracy": 0,
        },
      }
    `)
  })
})

describe('Phase 1w: wrong tries weigh 1/2^round, recorded before it or after (retroactive)', () => {
  const pKnownOf = (history: ProblemResultWithContext[], skillId: string) =>
    computeBktFromHistory(history, { applyDecay: false }).skills.find((s) => s.skillId === skillId)!
      .pKnown

  /** A row recorded from Phase 1w on: stamped by weightOfTry */
  function stamped(
    over: Partial<ProblemResultWithContext> & Pick<ProblemResultWithContext, 'kind' | 'round'>
  ): ProblemResultWithContext {
    const row = legacy({ sessionId: 'new-1', practiceOnly: false, ...over })
    return {
      ...row,
      masteryWeight: weightOfTry({
        kind: row.kind!,
        round: row.round!,
        isCorrect: row.isCorrect,
        practiceOnly: false,
      }),
    }
  }

  it('keeps every legacy correct row at its stored weight', () => {
    // Restamping the fixture's correct first tries and retries with weightOfTry
    // changes nothing: their stored weight already is 1/2^round
    const history = fixture()
    const restampedCorrect = history.map((r) =>
      r.isCorrect && r.masteryWeight !== undefined && !r.isManualRedo
        ? {
            ...r,
            masteryWeight: weightOfTry({
              kind: r.isRetry ? 'retry' : 'first',
              round: r.epochNumber ?? 0,
              isCorrect: true,
              practiceOnly: false,
            }),
          }
        : r
    )
    expect(rounded(restampedCorrect)).toEqual(rounded(history))
    for (const r of history) {
      if (r.isCorrect && !r.isManualRedo && r.masteryWeight !== undefined) {
        expect(r.masteryWeight).toBe(calculateMasteryWeight(true, r.epochNumber ?? 0))
      }
    }
  })

  it('lets a legacy wrong try stored at 0 lower pKnown, exactly as a newly stamped one', () => {
    const history = fixture()
    const before = pKnownOf(history, F)
    const wrong = stamped({ skillsExercised: [F], isCorrect: false, kind: 'first', round: 0 })
    expect(wrong.masteryWeight).toBe(1)
    const afterNew = pKnownOf([...history, wrong], F)
    expect(afterNew).toBeLessThan(before - 0.05)
    // Main's row: no Phase 1 stamps, weight 0
    const legacyWrong = legacy({ skillsExercised: [F], isCorrect: false, masteryWeight: 0 })
    expect(pKnownOf([...history, { ...legacyWrong, timestamp: wrong.timestamp }], F)).toBe(afterNew)
  })

  it('weighs a legacy wrong retry by its epoch; a legacy (unstamped) wrong do-over stays 0', () => {
    const history = fixture()
    const before = pKnownOf(history, F)
    const legacyRetry = legacy({
      skillsExercised: [F],
      isCorrect: false,
      isRetry: true,
      epochNumber: 1,
      masteryWeight: 0,
    })
    n -= 1
    const legacyDoOver = legacy({
      skillsExercised: [F],
      isCorrect: false,
      isManualRedo: true,
      epochNumber: 0,
      masteryWeight: 0,
    })
    n -= 1
    // A legacy wrong first try at the same position weighs 1
    const full = pKnownOf(
      [...history, legacy({ skillsExercised: [F], isCorrect: false, masteryWeight: 0 })],
      F
    )
    expect(pKnownOf([...history, legacyRetry], F)).toBeLessThan(before)
    expect(pKnownOf([...history, legacyRetry], F)).toBeGreaterThan(full)
    // It may be a redo of an item already answered right: practice-only today, never a slip
    expect(pKnownOf([...history, legacyDoOver], F)).toBe(before)
  })

  it('weighs a wrong retry by its round', () => {
    const history = fixture()
    const before = pKnownOf(history, F)
    const r1 = stamped({
      skillsExercised: [F],
      isCorrect: false,
      kind: 'retry',
      round: 1,
      isRetry: true,
      epochNumber: 1,
    })
    const first = stamped({ skillsExercised: [F], isCorrect: false, kind: 'first', round: 0 })
    expect(r1.masteryWeight).toBe(0.5)
    const afterRetry = pKnownOf([...history, r1], F)
    expect(afterRetry).toBeLessThan(before)
    expect(afterRetry).toBeGreaterThan(pKnownOf([...history, first], F))
  })

  it('weighs a correct do-over of a once-wrong item 1/2^round, not 1.0 (P1-9)', () => {
    const history = [
      ...fixture(),
      stamped({ skillsExercised: [F], isCorrect: false, kind: 'first', round: 0 }),
    ]
    const doOver = stamped({
      skillsExercised: [F],
      kind: 'do_over',
      round: 1,
      isManualRedo: true,
      epochNumber: 0,
    })
    expect(doOver.masteryWeight).toBe(0.5)
    const withHalf = pKnownOf([...history, doOver], F)
    const withMainWeight = pKnownOf([...history, { ...doOver, masteryWeight: 1 }], F)
    expect(withHalf).toBeGreaterThan(pKnownOf(history, F))
    expect(withHalf).toBeLessThan(withMainWeight)
  })
})
