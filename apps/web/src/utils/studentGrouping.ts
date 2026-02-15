/**
 * Student Grouping Utilities
 *
 * Functions for organizing students by recency and skill category
 * for display in the practice page.
 */

import {
  CATEGORY_PRIORITY,
  getCategoryDisplayName,
  getSkillCategory,
  type SkillCategoryKey,
} from '@/constants/skillCategories'
import type { Classroom } from '@/db/schema/classrooms'
import type { Player } from '@/db/schema/players'

/**
 * Recency bucket for student grouping
 */
export type RecencyBucket = 'today' | 'thisWeek' | 'older' | 'new'

// ============================================================================
// Intervention Types
// ============================================================================

/**
 * Types of intervention signals that indicate a student needs attention.
 * Ordered by severity (struggling is most severe).
 */
export type InterventionType = 'struggling' | 'declining' | 'stale' | 'absent' | 'plateau'

/**
 * Severity level for intervention signals.
 */
export type InterventionSeverity = 'high' | 'medium' | 'low'

/**
 * Skill distribution at a point in time.
 */
export interface SkillDistribution {
  strong: number
  stale: number
  developing: number
  weak: number
  unassessed: number
  total: number
}

/**
 * Intervention data for a student.
 * Null if the student doesn't need intervention.
 */
export interface StudentIntervention {
  /** Type of intervention needed */
  type: InterventionType
  /** Severity level */
  severity: InterventionSeverity
  /** Human-readable message (e.g., "4 skills are stale") */
  message: string
  /** Icon/emoji for the intervention type */
  icon: string
}

/**
 * Presence info shape matching the client-side PresenceInfo type.
 * Defined here to avoid circular dependency with useClassroom.ts.
 */
export interface StudentPresenceInfo {
  playerId: string
  classroomId: string
  enteredAt: string
  enteredBy: string
  classroom?: Classroom
}

/**
 * Active session info shape matching the active-session API response.
 */
export interface StudentActiveSessionInfo {
  sessionId: string
  status: string
  completedProblems: number
  totalProblems: number
}

/**
 * Extended student type with skill data for grouping
 */
export interface StudentWithSkillData extends Player {
  /** List of skillIds being practiced */
  practicingSkills: string[]
  /** Most recent practice session timestamp */
  lastPracticedAt: Date | null
  /** Computed skill category (highest level) */
  skillCategory: SkillCategoryKey | null
  /** Intervention data if student needs attention (null = no intervention needed) */
  intervention: StudentIntervention | null

  // ---- Batch-fetched enrichment fields (may be undefined on cold cache) ----

  /** Classrooms this student is enrolled in */
  enrolledClassrooms?: Classroom[]
  /** Current classroom presence */
  currentPresence?: StudentPresenceInfo | null
  /** Active session info */
  activeSession?: StudentActiveSessionInfo | null
}

// ============================================================================
// Intervention Configuration
// ============================================================================

const INTERVENTION_CONFIG: Record<
  InterventionType,
  { severity: InterventionSeverity; icon: string }
> = {
  struggling: { severity: 'high', icon: '🆘' },
  declining: { severity: 'medium', icon: '📉' },
  stale: { severity: 'medium', icon: '⏰' },
  absent: { severity: 'medium', icon: '👻' },
  plateau: { severity: 'low', icon: '📊' },
}

/**
 * Compute intervention status for a student based on their skill distribution.
 *
 * Priority order (first match wins):
 * 1. Struggling: ≥50% weak skills
 * 2. Stale: ≥3 stale skills OR >50% of strong+stale are stale
 * 3. Absent: No practice in >14 days (with active skills)
 *
 * Note: "Declining" and "Plateau" require historical trend data,
 * which is more expensive to compute. They're handled separately.
 */
export function computeIntervention(
  distribution: SkillDistribution,
  daysSinceLastPractice: number,
  hasPracticingSkills: boolean
): StudentIntervention | null {
  const { strong, stale, weak, total } = distribution

  // Skip students with no skills to assess
  if (total === 0) return null

  // PRIORITY 1: Struggling (≥50% weak skills)
  const weakPercent = (weak / total) * 100
  if (weakPercent >= 50) {
    return {
      type: 'struggling',
      ...INTERVENTION_CONFIG.struggling,
      message: `${Math.round(weakPercent)}% weak skills`,
    }
  }

  // PRIORITY 2: Stale (≥3 stale skills OR >50% of mastered skills are stale)
  const masteredTotal = strong + stale
  if (stale >= 3 || (masteredTotal > 0 && stale / masteredTotal > 0.5)) {
    return {
      type: 'stale',
      ...INTERVENTION_CONFIG.stale,
      message: `${stale} stale skill${stale !== 1 ? 's' : ''}`,
    }
  }

  // PRIORITY 3: Absent (>14 days without practice, with active skills)
  if (hasPracticingSkills && daysSinceLastPractice > 14) {
    const weeks = Math.floor(daysSinceLastPractice / 7)
    return {
      type: 'absent',
      ...INTERVENTION_CONFIG.absent,
      message: weeks >= 2 ? `${weeks} weeks absent` : `${daysSinceLastPractice} days absent`,
    }
  }

  return null
}

/**
 * Get students who need intervention, sorted by severity.
 */
export function getStudentsNeedingAttention(
  students: StudentWithSkillData[]
): StudentWithSkillData[] {
  const needsAttention = students.filter((s) => s.intervention !== null && !s.isArchived)

  // Sort by severity (high → medium → low)
  const severityOrder: Record<InterventionSeverity, number> = {
    high: 0,
    medium: 1,
    low: 2,
  }

  return needsAttention.sort((a, b) => {
    const aSeverity = a.intervention?.severity ?? 'low'
    const bSeverity = b.intervention?.severity ?? 'low'
    return severityOrder[aSeverity] - severityOrder[bSeverity]
  })
}

/**
 * Grouped students structure
 */
export interface GroupedStudents {
  /** Recency bucket */
  bucket: RecencyBucket
  /** Display name for the bucket */
  bucketName: string
  /** Categories within this bucket */
  categories: {
    /** Skill category key (null for new students) */
    category: SkillCategoryKey | null
    /** Display name for the category */
    categoryName: string
    /** Students in this category */
    students: StudentWithSkillData[]
  }[]
}

/**
 * Compute the skill category for a student based on their practicing skills.
 * Returns the highest-level category the student has skills in.
 */
export function computeSkillCategory(practicingSkills: string[]): SkillCategoryKey | null {
  if (practicingSkills.length === 0) {
    return null
  }

  // Check each category in priority order (highest first)
  for (const category of CATEGORY_PRIORITY) {
    for (const skillId of practicingSkills) {
      if (getSkillCategory(skillId) === category) {
        return category
      }
    }
  }

  // Fallback to basic if skills exist but don't match known categories
  return 'basic'
}

/**
 * Get the recency bucket for a student based on last practice date.
 */
export function getRecencyBucket(lastPracticedAt: Date | null): RecencyBucket {
  if (!lastPracticedAt) {
    return 'new'
  }

  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const oneWeekAgo = new Date(startOfToday.getTime() - 7 * 24 * 60 * 60 * 1000)

  if (lastPracticedAt >= startOfToday) {
    return 'today'
  }
  if (lastPracticedAt >= oneWeekAgo) {
    return 'thisWeek'
  }
  return 'older'
}

/**
 * Get display name for a recency bucket.
 */
export function getRecencyBucketName(bucket: RecencyBucket): string {
  switch (bucket) {
    case 'today':
      return 'Today'
    case 'thisWeek':
      return 'This Week'
    case 'older':
      return 'Older'
    case 'new':
      return 'New Students'
  }
}

/**
 * Get display name for a skill category (including null for new students).
 */
export function getGroupCategoryName(category: SkillCategoryKey | null): string {
  if (category === null) {
    return 'Not Started'
  }
  return getCategoryDisplayName(category)
}

/**
 * Group students by recency bucket, then by skill category.
 *
 * Students appear exactly once (no duplication).
 * Within each bucket, they're grouped by their highest-level skill category.
 */
export function groupStudents(students: StudentWithSkillData[]): GroupedStudents[] {
  // First, group by recency bucket
  const byBucket = new Map<RecencyBucket, StudentWithSkillData[]>()

  for (const student of students) {
    const bucket = getRecencyBucket(student.lastPracticedAt)
    if (!byBucket.has(bucket)) {
      byBucket.set(bucket, [])
    }
    byBucket.get(bucket)!.push(student)
  }

  // Then, within each bucket, group by skill category
  const bucketOrder: RecencyBucket[] = ['today', 'thisWeek', 'older', 'new']
  const result: GroupedStudents[] = []

  for (const bucket of bucketOrder) {
    const studentsInBucket = byBucket.get(bucket)
    if (!studentsInBucket || studentsInBucket.length === 0) {
      continue
    }

    // Group by category
    const byCategory = new Map<SkillCategoryKey | null, StudentWithSkillData[]>()
    for (const student of studentsInBucket) {
      const category = student.skillCategory
      if (!byCategory.has(category)) {
        byCategory.set(category, [])
      }
      byCategory.get(category)!.push(student)
    }

    // Order categories by priority (advanced first, then null/new at end)
    const categoryOrder: (SkillCategoryKey | null)[] = [...CATEGORY_PRIORITY, null]
    const categories: GroupedStudents['categories'] = []

    for (const category of categoryOrder) {
      const studentsInCategory = byCategory.get(category)
      if (studentsInCategory && studentsInCategory.length > 0) {
        categories.push({
          category,
          categoryName: getGroupCategoryName(category),
          students: studentsInCategory,
        })
      }
    }

    if (categories.length > 0) {
      result.push({
        bucket,
        bucketName: getRecencyBucketName(bucket),
        categories,
      })
    }
  }

  return result
}

/**
 * Filter students based on search query and skill filters.
 *
 * @param students - All students to filter
 * @param searchQuery - Text search (matches student name)
 * @param skillFilters - Skill IDs to filter by (AND logic - must have all)
 * @param showArchived - Whether to include archived students
 */
export function filterStudents(
  students: StudentWithSkillData[],
  searchQuery: string,
  skillFilters: string[],
  showArchived: boolean
): StudentWithSkillData[] {
  return students.filter((student) => {
    // Filter by archived status
    if (!showArchived && student.isArchived) {
      return false
    }

    // Filter by search query (case-insensitive name match)
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      if (!student.name.toLowerCase().includes(query)) {
        return false
      }
    }

    // Filter by skill filters (AND logic - must have ALL selected skills)
    if (skillFilters.length > 0) {
      const practicingSet = new Set(student.practicingSkills)
      for (const skillId of skillFilters) {
        if (!practicingSet.has(skillId)) {
          return false
        }
      }
    }

    return true
  })
}
