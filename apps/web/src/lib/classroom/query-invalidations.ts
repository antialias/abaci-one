/**
 * Query Invalidation Map for Classroom/Enrollment Events
 *
 * This provides a single source of truth for which React Query caches need to be
 * invalidated when enrollment/presence events occur. Using this map prevents
 * bugs from scattered, inconsistent invalidation logic across socket handlers
 * and mutations.
 *
 * Event Types:
 * - requestCreated: A new enrollment request was created (either teacher or parent initiated)
 * - requestApproved: One side (teacher or parent) approved their part of the request
 * - requestDenied: A request was denied by either side
 * - enrollmentCompleted: Both sides approved, student is now fully enrolled
 * - studentUnenrolled: Student was removed from a classroom (by teacher or parent)
 * - studentEntered: Student entered a classroom
 * - studentLeft: Student left a classroom
 */

import type { QueryClient } from '@tanstack/react-query'
import { classroomKeys, playerKeys } from '@/lib/queryKeys'

/**
 * Event types that trigger query invalidations
 */
export type ClassroomEventType =
  | 'requestCreated'
  | 'requestApproved'
  | 'requestDenied'
  | 'enrollmentCompleted'
  | 'studentUnenrolled'
  | 'studentEntered'
  | 'studentLeft'

/**
 * Parameters for invalidation - each event type may need different params
 */
export interface InvalidationParams {
  classroomId?: string
  playerId?: string
}

/**
 * Invalidate the appropriate queries based on an event type
 *
 * This function encapsulates all the knowledge about which queries need to be
 * invalidated for each type of classroom event.
 *
 * @param queryClient - The React Query client
 * @param event - The type of event that occurred
 * @param params - Parameters like classroomId and playerId
 */
export function invalidateForEvent(
  queryClient: QueryClient,
  event: ClassroomEventType,
  params: InvalidationParams
): void {
  const { classroomId, playerId } = params

  switch (event) {
    case 'requestCreated':
      // Teacher sees new pending request
      if (classroomId) {
        queryClient.invalidateQueries({
          queryKey: classroomKeys.pendingRequests(classroomId),
        })
        queryClient.invalidateQueries({
          queryKey: classroomKeys.awaitingParentApproval(classroomId),
        })
      }
      // Parent sees new pending approval
      queryClient.invalidateQueries({
        queryKey: classroomKeys.pendingParentApprovals(),
      })
      break

    case 'requestApproved':
      // Teacher's pending list updates when one side approves
      if (classroomId) {
        queryClient.invalidateQueries({
          queryKey: classroomKeys.pendingRequests(classroomId),
        })
        queryClient.invalidateQueries({
          queryKey: classroomKeys.awaitingParentApproval(classroomId),
        })
      }
      // Parent's pending list updates
      queryClient.invalidateQueries({
        queryKey: classroomKeys.pendingParentApprovals(),
      })
      break

    case 'requestDenied':
      // Remove denied request from teacher's pending lists
      if (classroomId) {
        queryClient.invalidateQueries({
          queryKey: classroomKeys.pendingRequests(classroomId),
        })
        queryClient.invalidateQueries({
          queryKey: classroomKeys.awaitingParentApproval(classroomId),
        })
      }
      // Remove from parent's pending approvals
      queryClient.invalidateQueries({
        queryKey: classroomKeys.pendingParentApprovals(),
      })
      break

    case 'enrollmentCompleted':
      // Teacher sees new student in enrollments
      if (classroomId) {
        queryClient.invalidateQueries({
          queryKey: classroomKeys.enrollments(classroomId),
        })
        queryClient.invalidateQueries({
          queryKey: classroomKeys.awaitingParentApproval(classroomId),
        })
        queryClient.invalidateQueries({
          queryKey: classroomKeys.pendingRequests(classroomId),
        })
      }
      // Student sees new classroom in their enrolled list
      if (playerId) {
        queryClient.invalidateQueries({
          queryKey: playerKeys.enrolledClassrooms(playerId),
        })
      }
      // Parent's pending approvals list updates
      queryClient.invalidateQueries({
        queryKey: classroomKeys.pendingParentApprovals(),
      })
      break

    case 'studentUnenrolled':
      // Teacher sees student removed from enrollments and presence
      if (classroomId) {
        queryClient.invalidateQueries({
          queryKey: classroomKeys.enrollments(classroomId),
        })
        queryClient.invalidateQueries({
          queryKey: classroomKeys.presence(classroomId),
        })
      }
      // Student/parent sees classroom removed from enrolled list and presence cleared
      if (playerId) {
        queryClient.invalidateQueries({
          queryKey: playerKeys.enrolledClassrooms(playerId),
        })
        queryClient.invalidateQueries({
          queryKey: playerKeys.presence(playerId),
        })
      }
      break

    case 'studentEntered':
      // Teacher sees updated presence
      if (classroomId) {
        queryClient.invalidateQueries({
          queryKey: classroomKeys.presence(classroomId),
        })
      }
      break

    case 'studentLeft':
      // Teacher sees updated presence
      if (classroomId) {
        queryClient.invalidateQueries({
          queryKey: classroomKeys.presence(classroomId),
        })
      }
      break

    default: {
      // Exhaustive check - if we hit this, we're missing a case
      const _exhaustive: never = event
      console.error('[QueryInvalidations] Unknown event type:', _exhaustive)
    }
  }
}

/**
 * Convenience function to get the list of query keys that would be invalidated
 * for a given event. Useful for debugging and testing.
 */
export function getInvalidationKeys(
  event: ClassroomEventType,
  params: InvalidationParams
): readonly (readonly string[])[] {
  const { classroomId, playerId } = params
  const keys: (readonly string[])[] = []

  switch (event) {
    case 'requestCreated':
      if (classroomId) {
        keys.push(classroomKeys.pendingRequests(classroomId))
        keys.push(classroomKeys.awaitingParentApproval(classroomId))
      }
      keys.push(classroomKeys.pendingParentApprovals())
      break

    case 'requestApproved':
      if (classroomId) {
        keys.push(classroomKeys.pendingRequests(classroomId))
        keys.push(classroomKeys.awaitingParentApproval(classroomId))
      }
      keys.push(classroomKeys.pendingParentApprovals())
      break

    case 'requestDenied':
      if (classroomId) {
        keys.push(classroomKeys.pendingRequests(classroomId))
        keys.push(classroomKeys.awaitingParentApproval(classroomId))
      }
      keys.push(classroomKeys.pendingParentApprovals())
      break

    case 'enrollmentCompleted':
      if (classroomId) {
        keys.push(classroomKeys.enrollments(classroomId))
        keys.push(classroomKeys.awaitingParentApproval(classroomId))
        keys.push(classroomKeys.pendingRequests(classroomId))
      }
      if (playerId) {
        keys.push(playerKeys.enrolledClassrooms(playerId))
      }
      keys.push(classroomKeys.pendingParentApprovals())
      break

    case 'studentUnenrolled':
      if (classroomId) {
        keys.push(classroomKeys.enrollments(classroomId))
        keys.push(classroomKeys.presence(classroomId))
      }
      if (playerId) {
        keys.push(playerKeys.enrolledClassrooms(playerId))
        keys.push(playerKeys.presence(playerId))
      }
      break

    case 'studentEntered':
      if (classroomId) {
        keys.push(classroomKeys.presence(classroomId))
      }
      break

    case 'studentLeft':
      if (classroomId) {
        keys.push(classroomKeys.presence(classroomId))
      }
      break

    default: {
      const _exhaustive: never = event
      console.error('[QueryInvalidations] Unknown event type:', _exhaustive)
    }
  }

  return keys
}
