/**
 * Hook to check viewer's access level to a player
 *
 * Used for pre-flight authorization checks before showing UI that requires
 * specific access levels.
 */

import { useQuery } from '@tanstack/react-query'
import type { AccessLevel } from '@/lib/classroom'
import { api } from '@/lib/queryClient'

export interface PlayerAccessData {
  accessLevel: AccessLevel
  isParent: boolean
  isTeacher: boolean
  isPresent: boolean
  /** Classroom ID if the viewer is a teacher */
  classroomId?: string
}

/**
 * Query key factory for player access
 */
export const playerAccessKeys = {
  all: ['player-access'] as const,
  detail: (playerId: string) => [...playerAccessKeys.all, playerId] as const,
}

/**
 * Hook to get the current viewer's access level to a player
 *
 * Returns access information including:
 * - accessLevel: 'none' | 'teacher-enrolled' | 'teacher-present' | 'parent'
 * - isParent: true if viewer is a parent of the player
 * - isTeacher: true if player is enrolled in viewer's classroom
 * - isPresent: true if player is currently present in viewer's classroom
 */
export function usePlayerAccess(playerId: string) {
  return useQuery({
    queryKey: playerAccessKeys.detail(playerId),
    queryFn: async (): Promise<PlayerAccessData> => {
      const response = await api(`players/${playerId}/access`)
      if (!response.ok) {
        throw new Error('Failed to check player access')
      }
      return response.json()
    },
    // Refetch on window focus to catch presence changes
    refetchOnWindowFocus: true,
    // Keep data fresh - presence can change anytime
    staleTime: 30 * 1000, // 30 seconds
  })
}

/**
 * Helper to check if the viewer can upload photos for a player
 *
 * Upload requires either:
 * - Being a parent (full access)
 * - Being a teacher with the student present in classroom
 *
 * Note: This mirrors the server-side logic in the attachments API
 */
export function canUploadPhotos(access: PlayerAccessData | undefined): boolean {
  if (!access) return false
  return access.isParent || access.isPresent
}

/**
 * Helper to get remediation info for upload-restricted access
 */
export function getUploadRemediation(access: PlayerAccessData | undefined): {
  type: 'send-entry-prompt' | 'enroll-student' | 'link-via-family-code' | 'no-access' | null
  message: string | null
} {
  if (!access) {
    return { type: null, message: null }
  }

  // Can upload - no remediation needed
  if (canUploadPhotos(access)) {
    return { type: null, message: null }
  }

  // Teacher with enrolled student, but student not present
  if (access.accessLevel === 'teacher-enrolled' && !access.isPresent) {
    return {
      type: 'send-entry-prompt',
      message:
        'This student is enrolled in your classroom but not currently present. To upload photos, they need to enter your classroom first.',
    }
  }

  // User has some access but not enough
  if (access.accessLevel !== 'none') {
    return {
      type: 'no-access',
      message: "You don't have permission to upload photos for this student.",
    }
  }

  // No access at all
  return {
    type: 'link-via-family-code',
    message: 'Your account is not linked to this student.',
  }
}
