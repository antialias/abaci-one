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
import type { Player } from '@/db/schema/players'

/**
 * Recency bucket for student grouping
 */
export type RecencyBucket = 'today' | 'thisWeek' | 'older' | 'new'

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
