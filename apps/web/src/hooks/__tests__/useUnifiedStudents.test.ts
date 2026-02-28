import { describe, expect, it } from 'vitest'
import { filterStudentsByView, computeViewCounts } from '../useUnifiedStudents'
import type { UnifiedStudent } from '@/types/student'

// ============================================================================
// Helpers
// ============================================================================

function createStudent(overrides: Partial<UnifiedStudent> & { id: string }): UnifiedStudent {
  return {
    name: 'Test Student',
    emoji: '1f600',
    userId: 'user-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    isArchived: false,
    relationship: {
      isMyChild: false,
      isEnrolled: false,
      isPresent: false,
      enrollmentStatus: null,
    },
    activity: { status: 'idle' },
    ...overrides,
  } as UnifiedStudent
}

const myChild = createStudent({
  id: 'child-1',
  name: 'My Child',
  relationship: { isMyChild: true, isEnrolled: true, isPresent: false, enrollmentStatus: null },
  activity: { status: 'idle' },
})

const myChildPracticing = createStudent({
  id: 'child-2',
  name: 'My Child Practicing',
  relationship: { isMyChild: true, isEnrolled: false, isPresent: true, enrollmentStatus: null },
  activity: { status: 'practicing', sessionProgress: { current: 5, total: 20 }, sessionId: 's-1' },
})

const enrolledStudent = createStudent({
  id: 'enrolled-1',
  name: 'Enrolled Student',
  relationship: { isMyChild: false, isEnrolled: true, isPresent: false, enrollmentStatus: null },
  activity: { status: 'idle' },
})

const presentStudent = createStudent({
  id: 'present-1',
  name: 'Present Student',
  relationship: { isMyChild: false, isEnrolled: true, isPresent: true, enrollmentStatus: null },
  activity: { status: 'idle' },
})

const presentPracticingStudent = createStudent({
  id: 'present-2',
  name: 'Present & Practicing',
  relationship: { isMyChild: false, isEnrolled: true, isPresent: true, enrollmentStatus: null },
  activity: { status: 'practicing', sessionProgress: { current: 10, total: 15 }, sessionId: 's-2' },
})

const needsAttentionStudent = createStudent({
  id: 'attention-1',
  name: 'Needs Attention',
  relationship: { isMyChild: true, isEnrolled: false, isPresent: false, enrollmentStatus: null },
  activity: { status: 'idle' },
  intervention: { type: 'struggling', severity: 'medium' } as any,
})

const archivedStudentWithIntervention = createStudent({
  id: 'archived-1',
  name: 'Archived',
  isArchived: true,
  relationship: { isMyChild: true, isEnrolled: false, isPresent: false, enrollmentStatus: null },
  activity: { status: 'idle' },
  intervention: { type: 'struggling', severity: 'low' } as any,
})

const allStudents = [
  myChild,
  myChildPracticing,
  enrolledStudent,
  presentStudent,
  presentPracticingStudent,
  needsAttentionStudent,
  archivedStudentWithIntervention,
]

// ============================================================================
// filterStudentsByView
// ============================================================================

describe('filterStudentsByView', () => {
  it('returns all students for "all" view', () => {
    const filtered = filterStudentsByView(allStudents, 'all')
    expect(filtered).toHaveLength(allStudents.length)
  })

  it('filters by "my-children"', () => {
    const filtered = filterStudentsByView(allStudents, 'my-children')
    expect(filtered.every((s) => s.relationship.isMyChild)).toBe(true)
    // myChild, myChildPracticing, needsAttentionStudent, archivedStudentWithIntervention
    expect(filtered).toHaveLength(4)
  })

  it('filters by "my-children-active" (my children who are practicing)', () => {
    const filtered = filterStudentsByView(allStudents, 'my-children-active')
    expect(filtered).toHaveLength(1)
    expect(filtered[0].id).toBe('child-2')
  })

  it('filters by "enrolled"', () => {
    const filtered = filterStudentsByView(allStudents, 'enrolled')
    expect(filtered.every((s) => s.relationship.isEnrolled)).toBe(true)
    // myChild, enrolledStudent, presentStudent, presentPracticingStudent
    expect(filtered).toHaveLength(4)
  })

  it('filters by "in-classroom"', () => {
    const filtered = filterStudentsByView(allStudents, 'in-classroom')
    expect(filtered.every((s) => s.relationship.isPresent)).toBe(true)
    // myChildPracticing, presentStudent, presentPracticingStudent
    expect(filtered).toHaveLength(3)
  })

  it('filters by "in-classroom-active"', () => {
    const filtered = filterStudentsByView(allStudents, 'in-classroom-active')
    expect(filtered).toHaveLength(2) // myChildPracticing, presentPracticingStudent
    expect(
      filtered.every((s) => s.relationship.isPresent && s.activity?.status === 'practicing')
    ).toBe(true)
  })

  it('filters by "needs-attention" (excludes archived)', () => {
    const filtered = filterStudentsByView(allStudents, 'needs-attention')
    // needsAttentionStudent has intervention and is NOT archived
    // archivedStudentWithIntervention has intervention but IS archived => excluded
    expect(filtered).toHaveLength(1)
    expect(filtered[0].id).toBe('attention-1')
  })

  it('returns all for unknown view', () => {
    const filtered = filterStudentsByView(allStudents, 'unknown-view' as any)
    expect(filtered).toHaveLength(allStudents.length)
  })

  it('handles empty array', () => {
    const filtered = filterStudentsByView([], 'all')
    expect(filtered).toHaveLength(0)
  })
})

// ============================================================================
// computeViewCounts
// ============================================================================

describe('computeViewCounts', () => {
  it('computes basic counts (non-teacher)', () => {
    const counts = computeViewCounts(allStudents, false)

    // "all" excludes archived students (1 archived => 6 active)
    expect(counts.all).toBe(6)
    expect(counts.allTotal).toBe(7) // full roster including archived
    expect(counts['my-children']).toBe(3) // 4 children minus 1 archived
    expect(counts['my-children-active']).toBe(1)
    expect(counts['needs-attention']).toBe(1) // archived ones excluded
    // Teacher-only counts should not be present
    expect(counts.enrolled).toBeUndefined()
    expect(counts['in-classroom']).toBeUndefined()
    expect(counts['in-classroom-active']).toBeUndefined()
  })

  it('includes teacher-only counts when isTeacher=true', () => {
    const counts = computeViewCounts(allStudents, true)

    // "all" excludes archived students (1 archived => 6 active)
    expect(counts.all).toBe(6)
    expect(counts.allTotal).toBe(7) // full roster including archived
    expect(counts['my-children']).toBe(3) // 4 children minus 1 archived
    expect(counts['my-children-active']).toBe(1)
    expect(counts['needs-attention']).toBe(1)
    expect(counts.enrolled).toBe(4) // myChild, enrolledStudent, presentStudent, presentPracticingStudent
    expect(counts['in-classroom']).toBe(3) // myChildPracticing, presentStudent, presentPracticingStudent
    expect(counts['in-classroom-active']).toBe(2) // myChildPracticing, presentPracticingStudent
  })

  it('handles empty array', () => {
    const counts = computeViewCounts([], true)

    expect(counts.all).toBe(0)
    expect(counts['my-children']).toBe(0)
    expect(counts['my-children-active']).toBe(0)
    expect(counts['needs-attention']).toBe(0)
    expect(counts.enrolled).toBe(0)
    expect(counts['in-classroom']).toBe(0)
    expect(counts['in-classroom-active']).toBe(0)
  })
})
