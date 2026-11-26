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
 */

import { describe, expect, it } from 'vitest'
import { computeBktFromHistory } from '@/lib/curriculum/bkt'
import { deriveLinearGateState } from '@/lib/curriculum/linear-gate'
import type { ProblemResultWithContext } from '@/lib/curriculum/session-planner'
import { assessAllSkillsReadiness } from '@/lib/curriculum/skill-readiness'

const A = 'basic.directAddition'
const H = 'basic.heavenBead'
const F = 'fiveComplements.4=5-1'
const BASE_TS = new Date('2025-03-01T10:00:00Z').getTime()

let n = 0
function legacy(over: Partial<ProblemResultWithContext>): ProblemResultWithContext {
  n += 1
  return {
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
    partType: 'abacus',
    timestamp: new Date(BASE_TS + n * 60_000),
    ...over,
  }
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
  it('matches the pre-Phase-1 numbers', () => {
    expect(rounded(fixture())).toMatchInlineSnapshot(`
      [
        {
          "confidence": 0.3238833389,
          "opportunities": 7,
          "pKnown": 0.9247750804,
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

  it('readiness matches the pre-Phase-1 verdicts', () => {
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
              "pKnown": 0.924775080403111,
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
