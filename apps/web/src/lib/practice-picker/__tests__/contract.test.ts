import { describe, expect, it } from 'vitest'
import type { StudentWithSkillData } from '@/utils/studentGrouping'
import {
  createPracticePickerV1Response,
  normalizePracticePickerV1Response,
  PRACTICE_PICKER_API_VERSION,
  type PracticePickerV1Response,
} from '../contract'

const PRIVATE_SENTINEL = 'PRIVATE-NOTES-MUST-NOT-CROSS-THE-ROSTER-CONTRACT'

function makeInternalStudent(index = 1): StudentWithSkillData {
  return {
    id: `student-${index}`,
    name: `Student ${index}`,
    emoji: '🧮',
    color: '#123456',
    createdAt: new Date('2026-01-02T03:04:05.000Z'),
    isArchived: index % 2 === 0,
    practicingSkills: ['addition.singleDigit', 'subtraction.singleDigit'],
    lastPracticedAt: new Date('2026-02-03T04:05:06.000Z'),
    skillCategory: 'basic',
    intervention: {
      type: 'stale',
      severity: 'medium',
      message: '2 skills are stale',
      icon: '⏰',
    },
    enrolledClassrooms: [
      {
        id: 'classroom-1',
        teacherId: 'teacher-1',
        name: 'Math Club',
        code: 'ABC123',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        entryPromptExpiryMinutes: 15,
      },
    ],
    currentPresence: {
      playerId: `student-${index}`,
      classroomId: 'classroom-1',
      enteredAt: '2026-02-03T04:00:00.000Z',
      enteredBy: 'teacher-1',
    },
    activeSession: {
      sessionId: 'session-1',
      status: 'active',
      completedProblems: 3,
      totalProblems: 10,
    },

    // Deliberately include database-only fields at runtime. The contract mapper
    // must use an allowlist instead of spreading these into its response.
    notes: PRIVATE_SENTINEL,
    userId: 'private-user-id',
    birthday: '2017-01-01',
    familyCode: 'PRIVATE-FAMILY-CODE',
    familyCodeGeneratedAt: new Date('2026-01-01T00:00:00.000Z'),
    helpSettings: { private: true },
    isActive: true,
    isPracticeStudent: true,
    isExpungeable: true,
  } as unknown as StudentWithSkillData
}

describe('practice picker v1 contract', () => {
  it('emits an explicit, versioned roster allowlist', () => {
    const response = createPracticePickerV1Response([
      makeInternalStudent(1),
      makeInternalStudent(2),
    ])

    expect(response.version).toBe(PRACTICE_PICKER_API_VERSION)
    expect(response.counts).toEqual({ active: 1, archived: 1, total: 2 })
    expect(Object.keys(response.students[0]).sort()).toEqual(
      [
        'activeSession',
        'color',
        'createdAt',
        'currentPresence',
        'emoji',
        'enrolledClassrooms',
        'id',
        'intervention',
        'isArchived',
        'lastPracticedAt',
        'name',
        'practicingSkills',
        'skillCategory',
      ].sort()
    )

    const serialized = JSON.stringify(response)
    for (const privateValue of [
      PRIVATE_SENTINEL,
      'private-user-id',
      'PRIVATE-FAMILY-CODE',
      'birthday',
      'helpSettings',
      'isExpungeable',
      'isPracticeStudent',
      'isActive',
    ]) {
      expect(serialized).not.toContain(privateValue)
    }
  })

  it('normalizes wire dates without mixing wire and client cache shapes', () => {
    const wire = createPracticePickerV1Response([makeInternalStudent()])
    expect(wire.students[0].createdAt).toBe('2026-01-02T03:04:05.000Z')
    expect(wire.students[0].enrolledClassrooms[0].createdAt).toBe(
      '2026-01-01T00:00:00.000Z'
    )

    const normalized = normalizePracticePickerV1Response(wire)
    expect(normalized.students[0].createdAt).toBeInstanceOf(Date)
    expect(normalized.students[0].lastPracticedAt).toBeInstanceOf(Date)
    expect(normalized.students[0].enrolledClassrooms?.[0].createdAt).toBeInstanceOf(Date)
  })

  it('rejects an unsupported response version', () => {
    const response = createPracticePickerV1Response([]) as unknown as PracticePickerV1Response
    Object.assign(response, { version: 2 })
    expect(() => normalizePracticePickerV1Response(response)).toThrow(
      'Unsupported practice picker API version: 2'
    )
  })

  it('stays under the roster payload budget even when private notes are large', () => {
    const students = Array.from({ length: 100 }, (_, index) => {
      const student = makeInternalStudent(index)
      return {
        ...student,
        notes: `${PRIVATE_SENTINEL}${'x'.repeat(20_000)}`,
      } as unknown as StudentWithSkillData
    })

    const serialized = JSON.stringify(createPracticePickerV1Response(students))
    expect(new TextEncoder().encode(serialized).byteLength).toBeLessThan(500_000)
    expect(serialized).not.toContain(PRIVATE_SENTINEL)
  })
})
