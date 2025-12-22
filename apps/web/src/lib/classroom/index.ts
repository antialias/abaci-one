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
  getPlayerAccess,
  canPerformAction,
  getAccessiblePlayers,
  isParentOf,
  isTeacherOf,
} from './access-control'

// Family Management
export {
  type LinkResult,
  linkParentToChild,
  getLinkedParents,
  getLinkedParentIds,
  getLinkedChildren,
  unlinkParentFromChild,
  getOrCreateFamilyCode,
  regenerateFamilyCode,
  isParent,
  generateFamilyCode,
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
  getPendingRequestsForParent,
  isEnrolled,
  getEnrolledStudents,
  unenrollStudent,
  getEnrolledClassrooms,
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
