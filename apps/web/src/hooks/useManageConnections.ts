'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { stakeholdersKeys } from '@/hooks/useStudentStakeholders'
import { invalidateForEvent } from '@/lib/classroom/query-invalidations'
import { api } from '@/lib/queryClient'
import { playerKeys, practicePickerKeys } from '@/lib/queryKeys'

// =============================================================================
// Unlink Parent
// =============================================================================

interface UnlinkParentParams {
  playerId: string
  parentUserId: string
}

async function unlinkParent({ playerId, parentUserId }: UnlinkParentParams): Promise<void> {
  const res = await api(`family/children/${playerId}/parents/${parentUserId}`, {
    method: 'DELETE',
  })
  if (!res.ok) {
    const data = await res.json()
    throw new Error(data.error || 'Failed to remove parent access')
  }
}

/**
 * Mutation hook to remove another parent's access to a child.
 * Invalidates stakeholders and player queries on success.
 */
export function useUnlinkParent() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: unlinkParent,
    onSuccess: (_, { playerId }) => {
      queryClient.invalidateQueries({ queryKey: stakeholdersKeys.player(playerId) })
      queryClient.invalidateQueries({ queryKey: playerKeys.all })
      queryClient.invalidateQueries({ queryKey: practicePickerKeys.v1() })
    },
  })
}

// =============================================================================
// Unenroll from Classroom
// =============================================================================

interface UnenrollParams {
  classroomId: string
  playerId: string
}

async function unenrollFromClassroom({ classroomId, playerId }: UnenrollParams): Promise<void> {
  const res = await api(`classrooms/${classroomId}/enrollments/${playerId}`, {
    method: 'DELETE',
  })
  if (!res.ok) {
    const data = await res.json()
    throw new Error(data.error || 'Failed to unenroll from classroom')
  }
}

/**
 * Mutation hook to unenroll a child from a classroom (parent-initiated).
 * Invalidates stakeholders, classroom enrollments, and player queries on success.
 */
export function useUnenrollFromClassroom() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: unenrollFromClassroom,
    onSuccess: (_, { classroomId, playerId }) => {
      invalidateForEvent(queryClient, 'studentUnenrolled', { classroomId, playerId })
      // Also invalidate stakeholders view and broad player cache
      queryClient.invalidateQueries({ queryKey: stakeholdersKeys.player(playerId) })
      queryClient.invalidateQueries({ queryKey: playerKeys.all })
      queryClient.invalidateQueries({ queryKey: practicePickerKeys.v1() })
    },
  })
}
