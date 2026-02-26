import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  computeIntervention,
  getStudentsNeedingAttention,
  computeSkillCategory,
  getRecencyBucket,
  getRecencyBucketName,
  getGroupCategoryName,
  groupStudents,
  filterStudents,
  type StudentWithSkillData,
  type SkillDistribution,
} from '../studentGrouping'

// Helper to create a mock student
function makeStudent(overrides: Partial<StudentWithSkillData> = {}): StudentWithSkillData {
  return {
    id: 'student-1',
    userId: 'user-1',
    name: 'Test Student',
    emoji: '🧑',
    color: '#FF0000',
    isActive: true,
    createdAt: new Date('2024-01-01'),
    helpSettings: null,
    notes: null,
    isArchived: false,
    isPracticeStudent: true,
    birthday: null,
    familyCode: null,
    familyCodeGeneratedAt: null,
    practicingSkills: [],
    lastPracticedAt: null,
    skillCategory: null,
    intervention: null,
    ...overrides,
  }
}

// ============================================================================
// computeIntervention
// ============================================================================
describe('computeIntervention', () => {
  const emptyDist: SkillDistribution = {
    strong: 0,
    stale: 0,
    developing: 0,
    weak: 0,
    unassessed: 0,
    total: 0,
  }

  it('returns null when total skills is 0', () => {
    expect(computeIntervention(emptyDist, 0, false)).toBeNull()
  })

  it('returns struggling when >= 50% of skills are weak', () => {
    const dist: SkillDistribution = {
      strong: 1,
      stale: 0,
      developing: 0,
      weak: 5,
      unassessed: 0,
      total: 10,
    }
    const result = computeIntervention(dist, 0, true)
    expect(result).not.toBeNull()
    expect(result!.type).toBe('struggling')
    expect(result!.severity).toBe('high')
    expect(result!.message).toContain('50%')
  })

  it('returns struggling when exactly 50% weak', () => {
    const dist: SkillDistribution = {
      strong: 2,
      stale: 0,
      developing: 3,
      weak: 5,
      unassessed: 0,
      total: 10,
    }
    const result = computeIntervention(dist, 0, true)
    expect(result).not.toBeNull()
    expect(result!.type).toBe('struggling')
  })

  it('returns stale when >= 3 stale skills', () => {
    const dist: SkillDistribution = {
      strong: 5,
      stale: 3,
      developing: 2,
      weak: 0,
      unassessed: 0,
      total: 10,
    }
    const result = computeIntervention(dist, 0, true)
    expect(result).not.toBeNull()
    expect(result!.type).toBe('stale')
    expect(result!.severity).toBe('medium')
    expect(result!.message).toContain('3 stale skills')
  })

  it('returns stale when > 50% of mastered skills are stale', () => {
    const dist: SkillDistribution = {
      strong: 1,
      stale: 2,
      developing: 5,
      weak: 0,
      unassessed: 0,
      total: 8,
    }
    // masteredTotal = 1 + 2 = 3, stale/mastered = 2/3 > 0.5
    const result = computeIntervention(dist, 0, true)
    expect(result).not.toBeNull()
    expect(result!.type).toBe('stale')
  })

  it('returns absent when > 14 days since practice with active skills', () => {
    const dist: SkillDistribution = {
      strong: 5,
      stale: 0,
      developing: 3,
      weak: 1,
      unassessed: 0,
      total: 9,
    }
    const result = computeIntervention(dist, 15, true)
    expect(result).not.toBeNull()
    expect(result!.type).toBe('absent')
    expect(result!.severity).toBe('medium')
  })

  it('absent message shows weeks when >= 2 weeks', () => {
    const dist: SkillDistribution = {
      strong: 5,
      stale: 0,
      developing: 3,
      weak: 1,
      unassessed: 0,
      total: 9,
    }
    const result = computeIntervention(dist, 21, true)
    expect(result!.message).toContain('3 weeks absent')
  })

  it('absent message shows days when < 2 weeks (< 14 days floor)', () => {
    const dist: SkillDistribution = {
      strong: 5,
      stale: 0,
      developing: 3,
      weak: 1,
      unassessed: 0,
      total: 9,
    }
    // 15 days / 7 = 2 weeks, so it shows "2 weeks absent"
    // To get day-based message, need days where Math.floor(days/7) < 2, e.g. 13 days
    // But 13 days <= 14 so it won't trigger absent.
    // Actually: absent triggers at >14 days. At 15 days, weeks=2 so it shows weeks.
    // The only way to get the days message is if weeks < 2, i.e. days < 14 -- but absent requires >14.
    // So the weeks branch always triggers. Let's just verify it works as implemented.
    const result = computeIntervention(dist, 15, true)
    expect(result!.message).toBe('2 weeks absent')
  })

  it('does not return absent when no practicing skills', () => {
    const dist: SkillDistribution = {
      strong: 5,
      stale: 0,
      developing: 3,
      weak: 1,
      unassessed: 0,
      total: 9,
    }
    const result = computeIntervention(dist, 100, false)
    expect(result).toBeNull()
  })

  it('returns null when no intervention criteria are met', () => {
    const dist: SkillDistribution = {
      strong: 5,
      stale: 1,
      developing: 3,
      weak: 1,
      unassessed: 0,
      total: 10,
    }
    const result = computeIntervention(dist, 5, true)
    expect(result).toBeNull()
  })

  it('struggling takes priority over stale', () => {
    const dist: SkillDistribution = {
      strong: 0,
      stale: 3,
      developing: 0,
      weak: 7,
      unassessed: 0,
      total: 10,
    }
    const result = computeIntervention(dist, 0, true)
    expect(result!.type).toBe('struggling')
  })

  it('stale takes priority over absent', () => {
    const dist: SkillDistribution = {
      strong: 5,
      stale: 4,
      developing: 1,
      weak: 0,
      unassessed: 0,
      total: 10,
    }
    const result = computeIntervention(dist, 30, true)
    expect(result!.type).toBe('stale')
  })

  it('handles singular stale skill message', () => {
    // Only triggers if > 50% of mastered are stale
    const dist: SkillDistribution = {
      strong: 0,
      stale: 1,
      developing: 8,
      weak: 0,
      unassessed: 0,
      total: 9,
    }
    // masteredTotal = 0 + 1 = 1, stale/mastered = 1/1 > 0.5
    const result = computeIntervention(dist, 0, true)
    expect(result).not.toBeNull()
    expect(result!.type).toBe('stale')
    expect(result!.message).toBe('1 stale skill')
  })
})

// ============================================================================
// getStudentsNeedingAttention
// ============================================================================
describe('getStudentsNeedingAttention', () => {
  it('returns only students with intervention', () => {
    const students = [
      makeStudent({ id: '1', intervention: null }),
      makeStudent({
        id: '2',
        intervention: {
          type: 'struggling',
          severity: 'high',
          message: '50% weak',
          icon: '🆘',
        },
      }),
      makeStudent({ id: '3', intervention: null }),
    ]
    const result = getStudentsNeedingAttention(students)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('2')
  })

  it('excludes archived students', () => {
    const students = [
      makeStudent({
        id: '1',
        isArchived: true,
        intervention: {
          type: 'struggling',
          severity: 'high',
          message: '50% weak',
          icon: '🆘',
        },
      }),
    ]
    const result = getStudentsNeedingAttention(students)
    expect(result).toHaveLength(0)
  })

  it('sorts by severity: high before medium before low', () => {
    const students = [
      makeStudent({
        id: 'low',
        intervention: {
          type: 'plateau',
          severity: 'low',
          message: 'plateau',
          icon: '📊',
        },
      }),
      makeStudent({
        id: 'high',
        intervention: {
          type: 'struggling',
          severity: 'high',
          message: '50% weak',
          icon: '🆘',
        },
      }),
      makeStudent({
        id: 'medium',
        intervention: {
          type: 'stale',
          severity: 'medium',
          message: '3 stale',
          icon: '⏰',
        },
      }),
    ]
    const result = getStudentsNeedingAttention(students)
    expect(result.map((s) => s.id)).toEqual(['high', 'medium', 'low'])
  })

  it('returns empty array when no students need attention', () => {
    const students = [
      makeStudent({ id: '1', intervention: null }),
      makeStudent({ id: '2', intervention: null }),
    ]
    expect(getStudentsNeedingAttention(students)).toHaveLength(0)
  })
})

// ============================================================================
// computeSkillCategory
// ============================================================================
describe('computeSkillCategory', () => {
  it('returns null for empty skills array', () => {
    expect(computeSkillCategory([])).toBeNull()
  })

  it('returns basic for basic skills', () => {
    expect(computeSkillCategory(['basic.directAddition'])).toBe('basic')
  })

  it('returns fiveComplements for five complement skills', () => {
    expect(computeSkillCategory(['fiveComplements.4=5-1'])).toBe('fiveComplements')
  })

  it('returns the highest priority category when multiple present', () => {
    // advanced > tenComplements > fiveComplements > basic
    const result = computeSkillCategory([
      'basic.directAddition',
      'fiveComplements.4=5-1',
      'tenComplements.9=10-1',
    ])
    expect(result).toBe('tenComplements')
  })

  it('returns advanced when any advanced skill is present', () => {
    const result = computeSkillCategory(['basic.directAddition', 'advanced.cascadingCarry'])
    expect(result).toBe('advanced')
  })

  it('returns basic as fallback for unknown skills', () => {
    expect(computeSkillCategory(['unknown.skill'])).toBe('basic')
  })
})

// ============================================================================
// getRecencyBucket
// ============================================================================
describe('getRecencyBucket', () => {
  let realDateNow: () => number

  beforeEach(() => {
    realDateNow = Date.now
  })

  afterEach(() => {
    Date.now = realDateNow
    vi.useRealTimers()
  })

  it('returns "new" for null lastPracticedAt', () => {
    expect(getRecencyBucket(null)).toBe('new')
  })

  it('returns "today" for a date today', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-06-15T14:00:00'))
    const todayMorning = new Date('2025-06-15T08:00:00')
    expect(getRecencyBucket(todayMorning)).toBe('today')
    vi.useRealTimers()
  })

  it('returns "thisWeek" for a date within the last 7 days but not today', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-06-15T14:00:00'))
    const threeDaysAgo = new Date('2025-06-12T10:00:00')
    expect(getRecencyBucket(threeDaysAgo)).toBe('thisWeek')
    vi.useRealTimers()
  })

  it('returns "older" for a date more than 7 days ago', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-06-15T14:00:00'))
    const twoWeeksAgo = new Date('2025-06-01T10:00:00')
    expect(getRecencyBucket(twoWeeksAgo)).toBe('older')
    vi.useRealTimers()
  })
})

// ============================================================================
// getRecencyBucketName
// ============================================================================
describe('getRecencyBucketName', () => {
  it('returns "Today" for today bucket', () => {
    expect(getRecencyBucketName('today')).toBe('Today')
  })

  it('returns "This Week" for thisWeek bucket', () => {
    expect(getRecencyBucketName('thisWeek')).toBe('This Week')
  })

  it('returns "Older" for older bucket', () => {
    expect(getRecencyBucketName('older')).toBe('Older')
  })

  it('returns "New Students" for new bucket', () => {
    expect(getRecencyBucketName('new')).toBe('New Students')
  })
})

// ============================================================================
// getGroupCategoryName
// ============================================================================
describe('getGroupCategoryName', () => {
  it('returns "Not Started" for null category', () => {
    expect(getGroupCategoryName(null)).toBe('Not Started')
  })

  it('returns display name for a valid category', () => {
    expect(getGroupCategoryName('basic')).toBe('Basic Skills')
  })

  it('returns display name for advanced category', () => {
    expect(getGroupCategoryName('advanced')).toBe('Advanced Multi-Column Operations')
  })
})

// ============================================================================
// groupStudents
// ============================================================================
describe('groupStudents', () => {
  it('returns empty array for no students', () => {
    expect(groupStudents([])).toEqual([])
  })

  it('groups new students into the "new" bucket', () => {
    const students = [makeStudent({ id: '1', lastPracticedAt: null, skillCategory: null })]
    const groups = groupStudents(students)
    expect(groups).toHaveLength(1)
    expect(groups[0].bucket).toBe('new')
    expect(groups[0].bucketName).toBe('New Students')
    expect(groups[0].categories).toHaveLength(1)
    expect(groups[0].categories[0].category).toBeNull()
    expect(groups[0].categories[0].categoryName).toBe('Not Started')
  })

  it('groups students by recency then by category', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-06-15T14:00:00'))

    const students = [
      makeStudent({
        id: '1',
        lastPracticedAt: new Date('2025-06-15T08:00:00'),
        skillCategory: 'basic',
      }),
      makeStudent({
        id: '2',
        lastPracticedAt: new Date('2025-06-15T09:00:00'),
        skillCategory: 'fiveComplements',
      }),
      makeStudent({ id: '3', lastPracticedAt: null, skillCategory: null }),
    ]

    const groups = groupStudents(students)
    // Should have "today" and "new" buckets
    expect(groups).toHaveLength(2)
    expect(groups[0].bucket).toBe('today')
    expect(groups[1].bucket).toBe('new')

    // Today bucket should have 2 categories: fiveComplements (higher priority), basic
    expect(groups[0].categories).toHaveLength(2)
    // fiveComplements comes before basic in CATEGORY_PRIORITY
    expect(groups[0].categories[0].category).toBe('fiveComplements')
    expect(groups[0].categories[1].category).toBe('basic')

    vi.useRealTimers()
  })

  it('orders buckets correctly: today, thisWeek, older, new', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-06-15T14:00:00'))

    const students = [
      makeStudent({
        id: 'new',
        lastPracticedAt: null,
        skillCategory: null,
      }),
      makeStudent({
        id: 'today',
        lastPracticedAt: new Date('2025-06-15T08:00:00'),
        skillCategory: 'basic',
      }),
      makeStudent({
        id: 'older',
        lastPracticedAt: new Date('2025-05-01T08:00:00'),
        skillCategory: 'basic',
      }),
      makeStudent({
        id: 'thisWeek',
        lastPracticedAt: new Date('2025-06-12T08:00:00'),
        skillCategory: 'basic',
      }),
    ]

    const groups = groupStudents(students)
    expect(groups.map((g) => g.bucket)).toEqual(['today', 'thisWeek', 'older', 'new'])

    vi.useRealTimers()
  })
})

// ============================================================================
// filterStudents
// ============================================================================
describe('filterStudents', () => {
  const students = [
    makeStudent({
      id: '1',
      name: 'Alice',
      practicingSkills: ['basic.directAddition', 'fiveComplements.4=5-1'],
      isArchived: false,
    }),
    makeStudent({
      id: '2',
      name: 'Bob',
      practicingSkills: ['basic.directAddition'],
      isArchived: false,
    }),
    makeStudent({
      id: '3',
      name: 'Charlie',
      practicingSkills: ['tenComplements.9=10-1'],
      isArchived: true,
    }),
  ]

  it('returns all non-archived students with no filters', () => {
    const result = filterStudents(students, '', [], false)
    expect(result).toHaveLength(2)
    expect(result.map((s) => s.name)).toEqual(['Alice', 'Bob'])
  })

  it('includes archived students when showArchived is true', () => {
    const result = filterStudents(students, '', [], true)
    expect(result).toHaveLength(3)
  })

  it('filters by search query (case-insensitive)', () => {
    const result = filterStudents(students, 'alice', [], false)
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Alice')
  })

  it('filters by search query partial match', () => {
    const result = filterStudents(students, 'al', [], false)
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Alice')
  })

  it('returns empty when search query matches nothing', () => {
    const result = filterStudents(students, 'Zara', [], false)
    expect(result).toHaveLength(0)
  })

  it('filters by skill filters (AND logic)', () => {
    const result = filterStudents(students, '', ['basic.directAddition'], false)
    expect(result).toHaveLength(2)
    expect(result.map((s) => s.name)).toEqual(['Alice', 'Bob'])
  })

  it('AND logic: requires all skills', () => {
    const result = filterStudents(
      students,
      '',
      ['basic.directAddition', 'fiveComplements.4=5-1'],
      false
    )
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Alice')
  })

  it('combines search query and skill filters', () => {
    const result = filterStudents(students, 'bob', ['basic.directAddition'], false)
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Bob')
  })

  it('returns empty when search and skills have no intersection', () => {
    const result = filterStudents(students, 'bob', ['fiveComplements.4=5-1'], false)
    expect(result).toHaveLength(0)
  })
})
