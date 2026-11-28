/**
 * @vitest-environment node
 *
 * Phase 4d (session architecture §10 P4d-8): the teacher-only classroom room
 * `classroom:<id>` (only its teacher may join it since socket identity PR 3;
 * the join is tested on a real server in `socket-rooms-server.test.ts`). The
 * classroom poll is gone, so the teacher's cards move only by push: every
 * committed write sends the report's progress, totals, outcome and row
 * version to `classroom:<id>` of every classroom the student is enrolled in,
 * present or not; the start and the end go there too.
 *
 * Real migrations and the production write path (EphemeralDatabase); the
 * socket server is a recorder in place of `@/lib/socket-io`.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as schema from '@/db/schema'
import type { SessionPlan } from '@/db/schema/session-plans'
import { getCurrentProblemInfo } from '@/lib/curriculum/parts/arithmetic/state'
import { setRowCommitListener } from '@/lib/curriculum/row-cas'
import {
  abandonSessionPlan,
  getSessionPlan,
  startSessionPlan,
} from '@/lib/curriculum/session-planner'
import {
  flushSessionReportPushes,
  registerSessionReportPush,
  resetSessionReportPushState,
} from '@/lib/curriculum/session-report-server'
import { sendRecord } from '@/test/fixtures/legacy-try-bodies'
import { fixtureParts } from './fixtures/session-report'
import {
  createEphemeralDatabase,
  createTestStudent,
  type EphemeralDbResult,
  getCurrentEphemeralDb,
  setCurrentEphemeralDb,
} from './journey-simulator/EphemeralDatabase'

vi.mock('server-only', () => ({}))
vi.mock('@/db', () => ({
  get db() {
    return getCurrentEphemeralDb()
  },
  schema,
}))

const { calls, fakeIo } = vi.hoisted(() => {
  const calls: Array<{ rooms: string[]; event: string; data: any }> = []
  const fakeIo = {
    to: (target: string | string[]) => ({
      emit: (event: string, data: unknown) => {
        calls.push({ rooms: Array.isArray(target) ? target : [target], event, data })
      },
    }),
  }
  return { calls, fakeIo }
})
vi.mock('@/lib/socket-io', () => ({
  getSocketIO: async () => fakeIo,
  hasSocketIO: () => true,
}))
// The student is enrolled but not present in any classroom
vi.mock('@/lib/classroom/presence-manager', () => ({ getStudentPresence: async () => null }))
vi.mock('@/lib/curriculum/progress-manager', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/curriculum/progress-manager')>()),
  recordSkillAttemptsWithHelp: vi.fn(async () => []),
}))

const T = new Date('2026-01-01T00:00:00.000Z')
let eph: EphemeralDbResult
let playerId: string
let teacherId: string
let classroomId: string

async function insertApprovedPlan(): Promise<string> {
  const id = `ct-${Math.random().toString(36).slice(2, 10)}`
  await getCurrentEphemeralDb()
    .insert(schema.sessionPlans)
    .values({
      id,
      playerId,
      targetDurationMinutes: 6,
      estimatedProblemCount: 10,
      avgTimePerProblemSeconds: 20,
      gameBreakSettings: {
        enabled: false,
        maxDurationMinutes: 5,
        selectionMode: 'kid-chooses',
        selectedGame: null,
      },
      parts: fixtureParts(),
      summary: {} as SessionPlan['summary'],
      masteredSkillIds: [],
      status: 'approved',
      flowState: 'practicing',
      flowUpdatedAt: T,
      flowVersion: 0,
      currentPartIndex: 0,
      results: [],
      adjustments: [],
      createdAt: T,
      approvedAt: T,
    })
  return id
}

async function answer(planId: string, correct: boolean) {
  const plan = (await getSessionPlan(planId))!
  const info = getCurrentProblemInfo(plan)!
  return sendRecord(planId, {
    tryId: crypto.randomUUID(),
    epochNumber: info.epochNumber,
    slotId: info.slotId,
    slotIndex: info.originalSlotIndex,
    problem: info.problem,
    studentAnswer: correct ? info.problem.answer : info.problem.answer + 1,
    isCorrect: correct,
    responseTimeMs: 3000,
    skillsExercised: info.problem.skillsRequired,
    usedOnScreenAbacus: false,
    hadHelp: false,
    incorrectAttempts: correct ? 0 : 1,
  })
}

const teacherRoom = () => `classroom:${classroomId}`
const toTeachers = (event: string) =>
  calls.filter((c) => c.event === event && c.rooms.includes(teacherRoom()))

beforeEach(async () => {
  eph = createEphemeralDatabase()
  setCurrentEphemeralDb(eph.db)
  ;({ playerId } = await createTestStudent(eph.db, 'teachers'))
  teacherId = 'teacher-user'
  classroomId = 'cls-teachers'
  await eph.db
    .insert(schema.users)
    .values({ id: teacherId, guestId: 'guest-teacher', createdAt: T })
  await eph.db.insert(schema.classrooms).values({
    id: classroomId,
    teacherId,
    name: 'Room 4',
    code: 'ROOM-4',
  })
  await eph.db.insert(schema.classroomEnrollments).values({ classroomId, playerId })
  calls.length = 0
  resetSessionReportPushState()
  registerSessionReportPush()
})

afterEach(async () => {
  await flushSessionReportPushes()
  setRowCommitListener(null)
  setCurrentEphemeralDb(null)
  eph.cleanup()
})

describe('the teacher room: push from the commit path', () => {
  it('a non-present enrolled student: start, each write’s progress, and the end reach the teacher', async () => {
    const planId = await insertApprovedPlan()
    await startSessionPlan(planId)
    await flushSessionReportPushes()
    expect(toTeachers('session-started').map((c) => c.data)).toEqual([
      expect.objectContaining({ sessionId: planId, playerId }),
    ])

    await answer(planId, true)
    await answer(planId, false)
    await flushSessionReportPushes()
    const summaries = toTeachers('classroom-session-summary').map((c) => c.data)
    expect(summaries.at(-1)).toEqual({
      sessionId: planId,
      playerId,
      outcome: 'in_progress',
      completedProblems: 2,
      totalProblems: 10,
      totals: expect.objectContaining({ problems: 2, tries: 2, firstTryCorrect: 1 }),
      rowVersion: 3,
    })
    // Strictly increasing versions, one per committed write
    const versions = summaries.map((s) => s.rowVersion)
    expect(versions).toEqual([...versions].sort((a, b) => a - b))
    expect(new Set(versions).size).toBe(versions.length)

    await abandonSessionPlan(planId)
    await flushSessionReportPushes()
    expect(toTeachers('session-ended').map((c) => c.data)).toEqual([
      expect.objectContaining({ sessionId: planId, reason: 'abandoned' }),
    ])
    expect(toTeachers('classroom-session-summary').at(-1)?.data.outcome).toBe('abandoned')
  })

  it('a student enrolled nowhere sends no teacher summaries', async () => {
    await eph.db.delete(schema.classroomEnrollments)
    const planId = await insertApprovedPlan()
    await startSessionPlan(planId)
    await answer(planId, true)
    await flushSessionReportPushes()
    expect(calls.filter((c) => c.event === 'classroom-session-summary')).toEqual([])
  })
})
