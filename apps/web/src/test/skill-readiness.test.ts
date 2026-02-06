/**
 * @vitest-environment node
 *
 * Skill Readiness Assessment Unit Tests
 *
 * Tests that the multi-dimensional readiness system correctly identifies
 * when a student is ready to advance past a skill, using four dimensions:
 * mastery, volume, speed, and consistency.
 */

import { describe, expect, it } from 'vitest'
import type { SkillBktResult } from '@/lib/curriculum/bkt'
import type { ProblemResultWithContext } from '@/lib/curriculum/session-planner'
import { assessSkillReadiness, assessAllSkillsReadiness } from '@/lib/curriculum/skill-readiness'
import { READINESS_THRESHOLDS } from '@/lib/curriculum/config/readiness-thresholds'

// =============================================================================
// Helpers
// =============================================================================

let slotCounter = 0

function createResult(
  sessionId: string,
  skillsExercised: string[],
  isCorrect: boolean,
  responseTimeMs: number,
  opts: {
    hadHelp?: boolean
    timestamp?: Date
    source?: 'practice' | 'recency-refresh'
    isRetry?: boolean
    terms?: number[]
  } = {}
): ProblemResultWithContext {
  slotCounter++
  const timestamp = opts.timestamp ?? new Date(Date.now() - slotCounter * 60000)
  return {
    sessionId,
    partNumber: 1,
    slotIndex: slotCounter,
    problem: {
      terms: opts.terms ?? [1, 2, 3],
      answer: 6,
      skillsRequired: skillsExercised,
    },
    studentAnswer: isCorrect ? 6 : 7,
    isCorrect,
    responseTimeMs,
    skillsExercised,
    usedOnScreenAbacus: false,
    timestamp,
    hadHelp: opts.hadHelp ?? false,
    incorrectAttempts: 0,
    sessionCompletedAt: timestamp,
    partType: 'abacus',
    source: opts.source,
    isRetry: opts.isRetry,
  }
}

function createBktResult(
  skillId: string,
  pKnown: number,
  confidence: number,
  opportunities = 30
): SkillBktResult {
  return {
    skillId,
    pKnown,
    confidence,
    uncertaintyRange: { low: pKnown - 0.1, high: pKnown + 0.1 },
    opportunities,
    successCount: Math.round(opportunities * pKnown),
    lastPracticedAt: new Date(),
    masteryClassification: pKnown >= 0.8 ? 'strong' : pKnown >= 0.5 ? 'developing' : 'weak',
  }
}

/**
 * Generate a set of results that meet ALL readiness criteria for a skill.
 */
function generateSolidResults(
  skillId: string,
  sessionCount = 4
): ProblemResultWithContext[] {
  const results: ProblemResultWithContext[] = []
  const now = Date.now()

  for (let s = 0; s < sessionCount; s++) {
    const sessionId = `session-${s}`
    // 8 problems per session = 32 total (>= 20 min)
    for (let i = 0; i < 8; i++) {
      results.push(
        createResult(sessionId, [skillId], true, 3000, {
          // 3 terms, 3000ms = 1.0s/term (well under 4.0)
          terms: [1, 2, 3],
          timestamp: new Date(now - (s * 86400000 + i * 60000)),
        })
      )
    }
  }

  return results
}

// =============================================================================
// Tests
// =============================================================================

describe('assessSkillReadiness', () => {
  beforeEach(() => {
    slotCounter = 0
  })

  it('returns solid when all criteria are met', () => {
    const skillId = 'basic.directAddition'
    const results = generateSolidResults(skillId)
    const bkt = createBktResult(skillId, 0.90, 0.70)

    const readiness = assessSkillReadiness(skillId, results, bkt)

    expect(readiness.isSolid).toBe(true)
    expect(readiness.dimensions.mastery.met).toBe(true)
    expect(readiness.dimensions.volume.met).toBe(true)
    expect(readiness.dimensions.speed.met).toBe(true)
    expect(readiness.dimensions.consistency.met).toBe(true)
  })

  it('returns not solid when volume is insufficient (too few problems)', () => {
    const skillId = 'basic.directAddition'
    // Only 5 problems (need 20)
    const results: ProblemResultWithContext[] = []
    for (let i = 0; i < 5; i++) {
      results.push(createResult('session-1', [skillId], true, 3000, { terms: [1, 2, 3] }))
    }
    const bkt = createBktResult(skillId, 0.90, 0.70)

    const readiness = assessSkillReadiness(skillId, results, bkt)

    expect(readiness.isSolid).toBe(false)
    expect(readiness.dimensions.volume.met).toBe(false)
    expect(readiness.dimensions.volume.opportunities).toBe(5)
  })

  it('returns not solid when volume is insufficient (too few sessions)', () => {
    const skillId = 'basic.directAddition'
    // 25 problems but all in 1 session (need 3 sessions)
    const results: ProblemResultWithContext[] = []
    for (let i = 0; i < 25; i++) {
      results.push(createResult('session-1', [skillId], true, 3000, { terms: [1, 2, 3] }))
    }
    const bkt = createBktResult(skillId, 0.90, 0.70)

    const readiness = assessSkillReadiness(skillId, results, bkt)

    expect(readiness.isSolid).toBe(false)
    expect(readiness.dimensions.volume.met).toBe(false)
    expect(readiness.dimensions.volume.sessionCount).toBe(1)
  })

  it('returns not solid when BKT pKnown is below threshold', () => {
    const skillId = 'basic.directAddition'
    const results = generateSolidResults(skillId)
    const bkt = createBktResult(skillId, 0.70, 0.70) // pKnown too low

    const readiness = assessSkillReadiness(skillId, results, bkt)

    expect(readiness.isSolid).toBe(false)
    expect(readiness.dimensions.mastery.met).toBe(false)
    expect(readiness.dimensions.mastery.pKnown).toBe(0.70)
  })

  it('returns not solid when BKT confidence is below threshold', () => {
    const skillId = 'basic.directAddition'
    const results = generateSolidResults(skillId)
    const bkt = createBktResult(skillId, 0.95, 0.30) // confidence too low

    const readiness = assessSkillReadiness(skillId, results, bkt)

    expect(readiness.isSolid).toBe(false)
    expect(readiness.dimensions.mastery.met).toBe(false)
    expect(readiness.dimensions.mastery.confidence).toBe(0.30)
  })

  it('returns not solid when responses are too slow', () => {
    const skillId = 'basic.directAddition'
    // Generate results with slow response times
    const results: ProblemResultWithContext[] = []
    const now = Date.now()
    for (let s = 0; s < 4; s++) {
      for (let i = 0; i < 8; i++) {
        results.push(
          createResult(`session-${s}`, [skillId], true, 15000, {
            // 3 terms, 15000ms = 5.0s/term (too slow, max is 4.0)
            terms: [1, 2, 3],
            timestamp: new Date(now - (s * 86400000 + i * 60000)),
          })
        )
      }
    }
    const bkt = createBktResult(skillId, 0.90, 0.70)

    const readiness = assessSkillReadiness(skillId, results, bkt)

    expect(readiness.isSolid).toBe(false)
    expect(readiness.dimensions.speed.met).toBe(false)
    expect(readiness.dimensions.speed.medianSecondsPerTerm).toBeGreaterThan(4.0)
  })

  it('returns not solid when recent problems have errors', () => {
    const skillId = 'basic.directAddition'
    const now = Date.now()
    const results: ProblemResultWithContext[] = []

    // 20 correct problems across 3 sessions
    for (let s = 0; s < 3; s++) {
      for (let i = 0; i < 7; i++) {
        results.push(
          createResult(`session-${s}`, [skillId], true, 3000, {
            terms: [1, 2, 3],
            timestamp: new Date(now - (s * 86400000 + (i + 3) * 60000)),
          })
        )
      }
    }

    // Last 5 problems: 4 correct, 1 wrong (most recent)
    for (let i = 0; i < 4; i++) {
      results.push(
        createResult('session-3', [skillId], true, 3000, {
          terms: [1, 2, 3],
          timestamp: new Date(now - (i + 1) * 60000),
        })
      )
    }
    results.push(
      createResult('session-3', [skillId], false, 3000, {
        terms: [1, 2, 3],
        timestamp: new Date(now),
      })
    )

    const bkt = createBktResult(skillId, 0.90, 0.70)

    const readiness = assessSkillReadiness(skillId, results, bkt)

    expect(readiness.isSolid).toBe(false)
    expect(readiness.dimensions.consistency.met).toBe(false)
    expect(readiness.dimensions.consistency.lastFiveAllCorrect).toBe(false)
  })

  it('returns not solid when recent problems used help', () => {
    const skillId = 'basic.directAddition'
    const now = Date.now()
    const results: ProblemResultWithContext[] = []

    // 25 correct problems across 4 sessions
    for (let s = 0; s < 4; s++) {
      for (let i = 0; i < 7; i++) {
        results.push(
          createResult(`session-${s}`, [skillId], true, 3000, {
            terms: [1, 2, 3],
            timestamp: new Date(now - (s * 86400000 + (i + 5) * 60000)),
          })
        )
      }
    }

    // Last 5: all correct, but 1 had help
    for (let i = 0; i < 4; i++) {
      results.push(
        createResult('session-4', [skillId], true, 3000, {
          terms: [1, 2, 3],
          timestamp: new Date(now - (i + 1) * 60000),
        })
      )
    }
    results.push(
      createResult('session-4', [skillId], true, 3000, {
        terms: [1, 2, 3],
        timestamp: new Date(now),
        hadHelp: true,
      })
    )

    const bkt = createBktResult(skillId, 0.90, 0.70)

    const readiness = assessSkillReadiness(skillId, results, bkt)

    expect(readiness.isSolid).toBe(false)
    expect(readiness.dimensions.consistency.met).toBe(false)
    expect(readiness.dimensions.consistency.recentHelpCount).toBe(1)
  })

  it('treats skill with 0 opportunities as solid (does not block)', () => {
    const skillId = 'basic.directAddition'
    const results: ProblemResultWithContext[] = [] // No results for this skill
    const bkt = createBktResult(skillId, 0.0, 0.0, 0)

    const readiness = assessSkillReadiness(skillId, results, bkt)

    expect(readiness.isSolid).toBe(true) // 0 opportunities = doesn't block
  })

  it('excludes retry and recency-refresh records from assessment', () => {
    const skillId = 'basic.directAddition'
    const now = Date.now()
    const results: ProblemResultWithContext[] = []

    // 22 normal problems across 3 sessions (meets volume)
    for (let s = 0; s < 3; s++) {
      for (let i = 0; i < 8; i++) {
        results.push(
          createResult(`session-${s}`, [skillId], true, 3000, {
            terms: [1, 2, 3],
            timestamp: new Date(now - (s * 86400000 + i * 60000)),
          })
        )
      }
    }

    // Add retry and recency-refresh records (should be excluded)
    results.push(
      createResult('session-0', [skillId], false, 30000, {
        terms: [1, 2, 3],
        isRetry: true,
        timestamp: new Date(now + 1000),
      })
    )
    results.push(
      createResult('session-0', [skillId], false, 30000, {
        terms: [1, 2, 3],
        source: 'recency-refresh',
        timestamp: new Date(now + 2000),
      })
    )

    const bkt = createBktResult(skillId, 0.90, 0.70)
    const readiness = assessSkillReadiness(skillId, results, bkt)

    // The retry and recency-refresh should be excluded, so consistency should still be met
    expect(readiness.dimensions.consistency.lastFiveAllCorrect).toBe(true)
  })

  it('handles missing BKT result gracefully', () => {
    const skillId = 'basic.directAddition'
    const results = generateSolidResults(skillId)

    const readiness = assessSkillReadiness(skillId, results, undefined)

    expect(readiness.isSolid).toBe(false)
    expect(readiness.dimensions.mastery.met).toBe(false)
    expect(readiness.dimensions.mastery.pKnown).toBe(0)
    expect(readiness.dimensions.mastery.confidence).toBe(0)
  })
})

describe('assessAllSkillsReadiness', () => {
  beforeEach(() => {
    slotCounter = 0
  })

  it('all skills solid when every skill meets all dimensions', () => {
    const skills = ['skill.a', 'skill.b']
    const results = [
      ...generateSolidResults('skill.a'),
      ...generateSolidResults('skill.b'),
    ]
    const bktResults = [
      createBktResult('skill.a', 0.90, 0.70),
      createBktResult('skill.b', 0.92, 0.75),
    ]

    const readiness = assessAllSkillsReadiness(
      results,
      bktResults,
      new Set(skills)
    )

    expect(readiness.get('skill.a')?.isSolid).toBe(true)
    expect(readiness.get('skill.b')?.isSolid).toBe(true)
  })

  it('overall not solid if even one skill is not solid', () => {
    const skills = ['skill.a', 'skill.b']
    const results = [
      ...generateSolidResults('skill.a'),
      // skill.b has only 5 problems (not enough)
      ...Array.from({ length: 5 }, (_, i) =>
        createResult('session-0', ['skill.b'], true, 3000, {
          terms: [1, 2, 3],
          timestamp: new Date(Date.now() - i * 60000),
        })
      ),
    ]
    const bktResults = [
      createBktResult('skill.a', 0.90, 0.70),
      createBktResult('skill.b', 0.90, 0.70),
    ]

    const readiness = assessAllSkillsReadiness(
      results,
      bktResults,
      new Set(skills)
    )

    expect(readiness.get('skill.a')?.isSolid).toBe(true)
    expect(readiness.get('skill.b')?.isSolid).toBe(false)

    // Verify overall: not all solid
    const allSolid = [...readiness.values()].every((r) => r.isSolid)
    expect(allSolid).toBe(false)
  })

  it('does not assess skills outside practicingIds', () => {
    const results = generateSolidResults('skill.a')
    const bktResults = [createBktResult('skill.a', 0.90, 0.70)]

    const readiness = assessAllSkillsReadiness(
      results,
      bktResults,
      new Set(['skill.a'])
    )

    expect(readiness.size).toBe(1)
    expect(readiness.has('skill.a')).toBe(true)
    expect(readiness.has('skill.b')).toBe(false)
  })
})

describe('readiness thresholds are reasonable', () => {
  it('thresholds have expected values', () => {
    expect(READINESS_THRESHOLDS.minOpportunities).toBe(20)
    expect(READINESS_THRESHOLDS.minSessions).toBe(3)
    expect(READINESS_THRESHOLDS.pKnownThreshold).toBe(0.85)
    expect(READINESS_THRESHOLDS.confidenceThreshold).toBe(0.5)
    expect(READINESS_THRESHOLDS.maxMedianSecondsPerTerm).toBe(4.0)
    expect(READINESS_THRESHOLDS.noHelpInLastN).toBe(5)
    expect(READINESS_THRESHOLDS.accuracyWindowSize).toBe(15)
    expect(READINESS_THRESHOLDS.minAccuracy).toBe(0.85)
    expect(READINESS_THRESHOLDS.lastNAllCorrect).toBe(5)
  })
})
