/**
 * Unified Student Type
 *
 * Combines data from multiple sources into a single type for display
 * in the unified student list. Used by teachers and parents.
 */

import type { Player } from '@/db/schema/players'
import type { StudentIntervention } from '@/utils/studentGrouping'

/**
 * Activity status for a student
 */
export type StudentActivityStatus = 'idle' | 'practicing' | 'learning'

/**
 * Enrollment status for a student relative to a classroom
 */
export type EnrollmentStatus = 'enrolled' | 'pending-teacher' | 'pending-parent' | null

/**
 * Session progress when student is practicing
 */
export interface SessionProgress {
  /** Current problem index (0-based) */
  current: number
  /** Total problems in session */
  total: number
}

/**
 * Tutorial progress when student is learning
 */
export interface TutorialProgress {
  /** Skill being learned */
  skill: string
  /** Current step index */
  step: number
  /** Total steps */
  total: number
}

/**
 * Relationship indicators for a student
 *
 * Determines what views a student appears in and what actions are available.
 */
export interface StudentRelationship {
  /** Parent-child link exists (viewer is parent of this student) */
  isMyChild: boolean
  /** Student is enrolled in viewer's classroom (teachers only) */
  isEnrolled: boolean
  /** Student is currently present in viewer's classroom (teachers only) */
  isPresent: boolean
  /** Enrollment status if any pending enrollment */
  enrollmentStatus: EnrollmentStatus
}

/**
 * Activity state for a student
 *
 * Indicates what the student is currently doing (practicing, learning, or idle).
 */
export interface StudentActivity {
  /** Current activity status */
  status: StudentActivityStatus
  /** Session progress when practicing */
  sessionProgress?: SessionProgress
  /** Tutorial progress when learning */
  tutorialProgress?: TutorialProgress
  /** Session ID for observation (when practicing) */
  sessionId?: string
}

/**
 * Unified student type combining all data sources
 *
 * This is the main type used by the unified student list component.
 * It extends Player with:
 * - Skill/progress data from curriculum system
 * - Relationship data (is child, enrolled, present)
 * - Activity data (practicing, learning)
 *
 * Note: Fields that already exist in Player (like isArchived) are not redeclared
 * to avoid type conflicts.
 */
export interface UnifiedStudent extends Player {
  // ============================================================================
  // From StudentWithSkillData / StudentWithProgress
  // (Only fields NOT already in Player)
  // ============================================================================

  /** Current curriculum level (1-3) */
  currentLevel?: number
  /** Current phase ID within level */
  currentPhaseId?: string
  /** Overall mastery percentage (0-100) */
  masteryPercent?: number
  /** List of skill IDs being practiced */
  practicingSkills?: string[]
  /** Most recent practice session timestamp */
  lastPracticedAt?: Date | null
  /** Computed skill category (highest level) */
  skillCategory?: string | null
  /** Intervention data if student needs attention */
  intervention?: StudentIntervention | null

  // ============================================================================
  // New: Relationship and Activity Data
  // ============================================================================

  /** Relationship to the current viewer (parent/teacher) */
  relationship: StudentRelationship
  /** Current activity (practicing, learning, idle) */
  activity: StudentActivity
}

/**
 * Create default relationship for a student
 */
export function createDefaultRelationship(): StudentRelationship {
  return {
    isMyChild: false,
    isEnrolled: false,
    isPresent: false,
    enrollmentStatus: null,
  }
}

/**
 * Create default activity for a student
 */
export function createDefaultActivity(): StudentActivity {
  return {
    status: 'idle',
  }
}

/**
 * Convert a basic Player to UnifiedStudent with defaults
 */
export function toUnifiedStudent(player: Player): UnifiedStudent {
  return {
    ...player,
    relationship: createDefaultRelationship(),
    activity: createDefaultActivity(),
  }
}
