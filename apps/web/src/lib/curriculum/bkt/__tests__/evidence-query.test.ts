/**
 * @vitest-environment node
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as schema from '@/db/schema'
import type { SessionPart, SessionStatus, SlotResult } from '@/db/schema/session-plans'
import {
  createEphemeralDatabase,
  createTestStudent,
  getCurrentEphemeralDb,
  setCurrentEphemeralDb,
  type EphemeralDbResult,
} from '@/test/journey-simulator/EphemeralDatabase'
import { batchGetRecentSessionResults } from '../../session-planner'
import { computeBktFromHistory } from '../compute-bkt'
import { batchGetRecentBktEvidence, BKT_EVIDENCE_PLAYER_CHUNK_SIZE } from '../evidence-query'

vi.mock('server-only', () => ({}))

vi.mock('@/db', () => ({
  get db() {
    return getCurrentEphemeralDb()
  },
  schema,
}))

function makeSlotResult(
  overrides: Partial<SlotResult> & {
    partNumber?: SlotResult['partNumber']
  } = {}
): SlotResult {
  return {
    slotId: 'test-slot',
    partNumber: 1,
    slotIndex: 0,
    problem: {
      terms: [1, 2],
      skillIds: ['basic.directAddition'],
      id: 'problem',
    } as never,
    studentAnswer: 3,
    isCorrect: true,
    responseTimeMs: 5_000,
    skillsExercised: ['basic.directAddition'],
    usedOnScreenAbacus: false,
    timestamp: new Date('2026-01-01T12:00:00Z'),
    hadHelp: false,
    incorrectAttempts: 0,
    ...overrides,
  }
}

function makeSessionPart(
  partNumber: 1 | 2 | 3,
  type: 'abacus' | 'visualization' | 'linear',
  problem: SessionPart['slots'][number]['problem'] = undefined
): SessionPart {
  return {
    partNumber,
    type,
    format: type === 'linear' ? 'linear' : 'vertical',
    useAbacus: type === 'abacus',
    slots: [
      {
        slotId: `slot-${partNumber}`,
        index: 0,
        purpose: 'focus',
        constraints: {},
        problem,
      },
    ],
    estimatedMinutes: 4,
  }
}

async function insertSession(options: {
  id: string
  playerId: string
  results: SlotResult[]
  parts?: SessionPart[]
  status?: SessionStatus
  completedAt?: Date | null
}) {
  const now = new Date()
  await getCurrentEphemeralDb()
    .insert(schema.sessionPlans)
    .values({
      id: options.id,
      playerId: options.playerId,
      status: options.status ?? 'completed',
      parts: options.parts ?? [makeSessionPart(1, 'linear')],
      results: options.results,
      completedAt: options.completedAt === undefined ? now : options.completedAt,
      createdAt: now,
      targetDurationMinutes: 12,
      estimatedProblemCount: options.results.length,
      avgTimePerProblemSeconds: 5,
      summary: { parts: [] } as never,
    })
}

describe('batchGetRecentBktEvidence', () => {
  let ephemeralDb: EphemeralDbResult

  beforeEach(() => {
    ephemeralDb = createEphemeralDatabase()
    setCurrentEphemeralDb(ephemeralDb.db)
  })

  afterEach(() => {
    setCurrentEphemeralDb(null)
    ephemeralDb.cleanup()
  })

  it('returns empty results without querying for empty inputs or a zero limit', async () => {
    expect(await batchGetRecentBktEvidence([])).toEqual(new Map())
    expect(await batchGetRecentBktEvidence(['unused'], 0)).toEqual(new Map())
  })

  it('projects every field BKT uses and resolves the practice mode', async () => {
    const { playerId } = await createTestStudent(ephemeralDb.db, 'projection')
    const timingReview = {
      adjustedResponseTimeMs: 2_500,
      reviewedBy: 'adult',
      reviewedAt: '2026-01-01T13:00:00Z',
    }
    await insertSession({
      id: 'projection-session',
      playerId,
      parts: [makeSessionPart(1, 'abacus')],
      results: [
        makeSlotResult({
          isCorrect: false,
          responseTimeMs: 30_000,
          skillsExercised: ['fiveComplement.add.4'],
          hadHelp: true,
          masteryWeight: 0.5,
          source: 'teacher-corrected',
          originalSource: 'practice',
          timingReview,
        }),
      ],
    })

    const evidence = (await batchGetRecentBktEvidence([playerId])).get(playerId)

    expect(evidence).toEqual([
      expect.objectContaining({
        skillsExercised: ['fiveComplement.add.4'],
        isCorrect: false,
        responseTimeMs: 30_000,
        hadHelp: true,
        masteryWeight: 0.5,
        source: 'teacher-corrected',
        originalSource: 'practice',
        timingReview,
        partType: 'abacus',
      }),
    ])
    expect('problem' in evidence![0]).toBe(false)
    expect('sessionId' in evidence![0]).toBe(false)
  })

  it('enforces the recent-session limit per player inside the query', async () => {
    const { playerId } = await createTestStudent(ephemeralDb.db, 'bounded')

    for (let day = 1; day <= 4; day++) {
      await insertSession({
        id: `session-${day}`,
        playerId,
        completedAt: new Date(`2026-01-0${day}T13:00:00Z`),
        results: [
          makeSlotResult({
            skillsExercised: [`skill-${day}`],
            timestamp: new Date(`2026-01-0${day}T12:00:00Z`),
          }),
        ],
      })
    }

    const evidence = (await batchGetRecentBktEvidence([playerId], 2)).get(playerId)!
    expect(evidence.map((item) => item.skillsExercised[0])).toEqual(['skill-4', 'skill-3'])
  })

  it('filters session status and null completion dates before ranking', async () => {
    const { playerId } = await createTestStudent(ephemeralDb.db, 'statuses')
    const statuses: SessionStatus[] = ['draft', 'approved', 'in_progress', 'abandoned', 'deleted']

    for (const status of statuses) {
      await insertSession({
        id: `excluded-${status}`,
        playerId,
        status,
        results: [makeSlotResult({ skillsExercised: [status] })],
      })
    }
    await insertSession({
      id: 'null-completed',
      playerId,
      completedAt: null,
      results: [makeSlotResult({ skillsExercised: ['null-completed'] })],
    })
    await insertSession({
      id: 'completed',
      playerId,
      results: [makeSlotResult({ skillsExercised: ['completed'] })],
    })
    await insertSession({
      id: 'refresh',
      playerId,
      status: 'recency-refresh',
      results: [
        makeSlotResult({
          skillsExercised: ['refresh'],
          source: 'recency-refresh',
          responseTimeMs: 0,
        }),
      ],
    })

    const evidence = (await batchGetRecentBktEvidence([playerId])).get(playerId)!
    expect(evidence.map((item) => item.skillsExercised[0]).sort()).toEqual(['completed', 'refresh'])
  })

  it('chunks large player lists without losing or mixing evidence', async () => {
    const playerIds: string[] = []

    for (let index = 0; index <= BKT_EVIDENCE_PLAYER_CHUNK_SIZE; index++) {
      const { playerId } = await createTestStudent(ephemeralDb.db, `chunk-${index}`)
      playerIds.push(playerId)
      await insertSession({
        id: `chunk-session-${index}`,
        playerId,
        results: [makeSlotResult({ skillsExercised: [`chunk-skill-${index}`] })],
      })
    }

    const result = await batchGetRecentBktEvidence([...playerIds, playerIds[0]])
    expect(result.size).toBe(playerIds.length)
    playerIds.forEach((playerId, index) => {
      expect(result.get(playerId)?.[0].skillsExercised).toEqual([`chunk-skill-${index}`])
    })
  })

  it('produces the same BKT state as the full historical result query', async () => {
    const { playerId } = await createTestStudent(ephemeralDb.db, 'semantic-parity')
    const parts = [makeSessionPart(1, 'abacus'), makeSessionPart(2, 'visualization')]

    await insertSession({
      id: 'parity-completed',
      playerId,
      parts,
      completedAt: new Date('2026-01-03T13:00:00Z'),
      results: [
        makeSlotResult({
          partNumber: 1,
          timestamp: new Date('2026-01-01T12:00:00Z'),
          skillsExercised: ['fiveComplement.add.4'],
        }),
        makeSlotResult({
          partNumber: 2,
          timestamp: new Date('2026-01-02T12:00:00Z'),
          skillsExercised: ['fiveComplement.add.4', 'tenComplement.add.9'],
          isCorrect: false,
          hadHelp: true,
          masteryWeight: 0.5,
          timingReview: {
            adjustedResponseTimeMs: 8_000,
            reviewedBy: 'adult',
            reviewedAt: '2026-01-02T13:00:00Z',
          },
        }),
        makeSlotResult({
          partNumber: 2,
          timestamp: new Date('2026-01-03T12:00:00Z'),
          skillsExercised: ['tenComplement.add.9'],
          source: 'teacher-excluded',
          originalSource: 'practice',
        }),
      ],
    })
    await insertSession({
      id: 'parity-refresh',
      playerId,
      status: 'recency-refresh',
      completedAt: new Date('2026-01-04T13:00:00Z'),
      results: [
        makeSlotResult({
          timestamp: new Date('2026-01-04T12:00:00Z'),
          skillsExercised: ['fiveComplement.add.4'],
          source: 'recency-refresh',
          responseTimeMs: 0,
        }),
      ],
    })

    const full = (await batchGetRecentSessionResults([playerId], 100)).get(playerId)!
    const lean = (await batchGetRecentBktEvidence([playerId], 100)).get(playerId)!

    expect(computeBktFromHistory(lean)).toEqual(computeBktFromHistory(full))
  })

  it('does not return large problem or generation-trace payloads', async () => {
    const { playerId } = await createTestStudent(ephemeralDb.db, 'large-payload')
    const generationTrace = 'large-trace-'.repeat(100_000)
    const largeProblem = {
      id: 'large-problem',
      terms: [1, 2],
      skillIds: ['basic.directAddition'],
      generationTrace,
    }

    await insertSession({
      id: 'large-payload-session',
      playerId,
      parts: [makeSessionPart(1, 'linear', largeProblem as never)],
      results: [makeSlotResult({ problem: largeProblem as never })],
    })

    const evidence = (await batchGetRecentBktEvidence([playerId])).get(playerId)!
    expect(JSON.stringify(evidence).length).toBeLessThan(1_000)
    expect(JSON.stringify(evidence)).not.toContain('large-trace')
  })
})
