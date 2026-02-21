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

// =============================================================================
// Stakeholder Types
// =============================================================================
// Rich relationship data for showing complete stakeholder information.
// These types are used by the stakeholders API and RelationshipCard component.

/**
 * Information about a parent linked to a student
 */
export interface ParentInfo {
  /** Parent user ID */
  id: string
  /** Parent's display name */
  name: string
  /** Parent's email (optional) */
  email?: string
  /** Whether this parent is the current viewer */
  isMe: boolean
}

/**
 * Information about a classroom the student is enrolled in
 */
export interface EnrolledClassroomInfo {
  /** Classroom ID */
  id: string
  /** Classroom name */
  name: string
  /** Teacher's display name */
  teacherName: string
  /** Whether the current viewer is the teacher of this classroom */
  isMyClassroom: boolean
}

/**
 * Information about a pending enrollment request
 */
export interface PendingEnrollmentInfo {
  /** Enrollment request ID */
  id: string
  /** Target classroom ID */
  classroomId: string
  /** Target classroom name */
  classroomName: string
  /** Teacher's display name */
  teacherName: string
  /** Who needs to approve: 'teacher' or 'parent' */
  pendingApproval: 'teacher' | 'parent'
  /** Who initiated the request */
  initiatedBy: 'teacher' | 'parent'
}

/**
 * Information about current classroom presence
 */
export interface PresenceInfo {
  /** Classroom ID where student is present */
  classroomId: string
  /** Classroom name */
  classroomName: string
  /** Teacher's display name */
  teacherName: string
}

/**
 * A family event for the activity feed
 */
export interface FamilyEventInfo {
  /** Event ID */
  id: string
  /** Type of event */
  eventType: 'parent_linked' | 'parent_unlinked' | 'code_regenerated'
  /** Name of user who performed the action */
  actorName: string
  /** Name of the parent being linked/unlinked (null for code_regenerated) */
  targetName: string | null
  /** When the event occurred (ISO string) */
  createdAt: string
}

/**
 * Complete stakeholder information for a student
 */
export interface StudentStakeholders {
  /** All parents linked to this student */
  parents: ParentInfo[]
  /** All classrooms the student is enrolled in */
  enrolledClassrooms: EnrolledClassroomInfo[]
  /** All pending enrollment requests */
  pendingEnrollments: PendingEnrollmentInfo[]
  /** Current classroom presence (if any) */
  currentPresence: PresenceInfo | null
  /** Recent family events (last 7 days) */
  recentFamilyEvents: FamilyEventInfo[]
}

/**
 * Type of relationship the viewer has with a student
 */
export type ViewerRelationType = 'parent' | 'teacher' | 'observer' | 'none'

/**
 * Summary of the viewer's relationship with a student
 */
export interface ViewerRelationshipSummary {
  /** Primary relationship type */
  type: ViewerRelationType
  /** Human-readable description (e.g., "Your child", "Enrolled in Math 101") */
  description: string
  /** Classroom name if relevant (for teacher/observer) */
  classroomName?: string
}
