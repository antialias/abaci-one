'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Classroom, User } from '@/db/schema'
import { api } from '@/lib/queryClient'
import { classroomKeys } from '@/lib/queryKeys'

// Re-export query keys for consumers
export { classroomKeys } from '@/lib/queryKeys'

// ============================================================================
// Types
// ============================================================================

export interface ClassroomWithTeacher extends Classroom {
  teacher?: User
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Fetch current user's classroom
 */
async function fetchMyClassroom(): Promise<Classroom | null> {
  const res = await api('classrooms/mine')
  if (res.status === 404) return null
  if (!res.ok) throw new Error('Failed to fetch classroom')
  const data = await res.json()
  return data.classroom
}

/**
 * Look up classroom by join code
 */
async function fetchClassroomByCode(code: string): Promise<ClassroomWithTeacher | null> {
  if (!code || code.length < 4) return null
  const res = await api(`classrooms/code/${encodeURIComponent(code)}`)
  if (res.status === 404) return null
  if (!res.ok) throw new Error('Failed to fetch classroom')
  const data = await res.json()
  return data.classroom
}

/**
 * Create a new classroom
 */
async function createClassroom(params: { name: string }): Promise<Classroom> {
  const res = await api('classrooms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  if (!res.ok) {
    const data = await res.json()
    throw new Error(data.error || 'Failed to create classroom')
  }
  const data = await res.json()
  return data.classroom
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Get current user's classroom (if they are a teacher)
 */
export function useMyClassroom() {
  return useQuery({
    queryKey: classroomKeys.mine(),
    queryFn: fetchMyClassroom,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

/**
 * Look up classroom by join code
 *
 * Use this when a parent wants to enroll their child.
 * The query is disabled until code has at least 4 characters.
 */
export function useClassroomByCode(code: string) {
  return useQuery({
    queryKey: classroomKeys.byCode(code.toUpperCase()),
    queryFn: () => fetchClassroomByCode(code),
    enabled: code.length >= 4,
    staleTime: 60 * 1000, // 1 minute
  })
}

/**
 * Create a new classroom
 *
 * Use this when a user wants to become a teacher.
 * Each user can have only one classroom.
 */
export function useCreateClassroom() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createClassroom,
    onSuccess: (classroom) => {
      // Update the 'mine' query with the new classroom
      queryClient.setQueryData(classroomKeys.mine(), classroom)
    },
  })
}

/**
 * Check if current user is a teacher (has a classroom)
 */
export function useIsTeacher() {
  const { data: classroom, isLoading } = useMyClassroom()
  return {
    isTeacher: classroom !== null,
    isLoading,
  }
}
