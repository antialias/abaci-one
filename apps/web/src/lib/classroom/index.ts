/**
 * Classroom Module
 *
 * Central module for the classroom/teacher/parent system.
 *
 * This module provides:
 * - Access control (who can see/control what)
 * - Family management (parent-child relationships)
 * - Enrollment management (consent workflow)
 * - Presence management (live classroom state)
 * - Classroom CRUD operations
 */

// Access Control
export {
  type AccessLevel,
  type PlayerAccess,
  type PlayerAction,
  type AccessiblePlayers,
  type RemediationType,
  type AuthorizationError,
  getPlayerAccess,
  canPerformAction,
  getAccessiblePlayers,
  isParentOf,
  getParentedPlayerIds,
  isTeacherOf,
  generateAuthorizationError,
} from './access-control'

// Family Management
export {
  type LinkResult,
  type FamilyCodeResult,
  MAX_PARENTS_PER_CHILD,
  FAMILY_CODE_EXPIRY_DAYS,
  linkParentToChild,
  getLinkedParents,
  getLinkedParentIds,
  getLinkedChildren,
  unlinkParentFromChild,
  getOrCreateFamilyCode,
  regenerateFamilyCode,
  generateFamilyCode,
  getRecentFamilyEvents,
} from './family-manager'

// Enrollment Management
export {
  type CreateEnrollmentRequestParams,
  type ApprovalResult,
  type EnrollmentRequestWithRelations,
  createEnrollmentRequest,
  approveEnrollmentRequest,
  denyEnrollmentRequest,
  cancelEnrollmentRequest,
  getPendingRequestsForClassroom,
  getRequestsAwaitingParentApproval,
  getPendingRequestsForParent,
  isEnrolled,
  getEnrolledStudents,
  unenrollStudent,
  getEnrolledClassrooms,
  batchGetEnrolledClassrooms,
  directEnrollStudent,
  getRequiredApprovals,
  isFullyApproved,
  isDenied,
} from './enrollment-manager'

// Presence Management
export {
  type EnterClassroomParams,
  type EnterClassroomResult,
  type PresenceWithClassroom,
  type PresenceWithPlayer,
  enterClassroom,
  leaveClassroom,
  leaveSpecificClassroom,
  clearClassroomPresence,
  getStudentPresence,
  batchGetStudentPresence,
  isStudentPresent,
  isStudentPresentIn,
  getClassroomPresence,
  getPresenceCount,
  getPresentPlayerIds,
} from './presence-manager'

// Classroom Management
export {
  type CreateClassroomParams,
  type CreateClassroomResult,
  type ClassroomWithTeacher,
  type UpdateClassroomParams,
  createClassroom,
  getClassroom,
  getTeacherClassroom,
  isTeacher,
  getClassroomByCode,
  updateClassroom,
  regenerateClassroomCode,
  deleteClassroom,
  generateClassroomCode,
} from './classroom-manager'
