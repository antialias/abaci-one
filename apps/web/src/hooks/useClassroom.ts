'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Classroom } from '@/db/schema/classrooms'
import { api } from '@/lib/queryClient'

// Query keys for classroom data
export const classroomKeys = {
  all: ['classroom'] as const,
  mine: () => [...classroomKeys.all, 'mine'] as const,
  detail: (id: string) => [...classroomKeys.all, 'detail', id] as const,
  byCode: (code: string) => [...classroomKeys.all, 'code', code] as const,
}

/**
 * Fetch current user's classroom
 */
async function fetchMyClassroom(): Promise<Classroom | null> {
  const res = await api('classrooms')
  if (!res.ok) {
    // 404 means no classroom
    if (res.status === 404) return null
    throw new Error('Failed to fetch classroom')
  }
  const data = await res.json()
  return data.classroom ?? null
}

/**
 * Create a classroom
 */
async function createClassroom(name: string): Promise<Classroom> {
  const res = await api('classrooms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  })
  const data = await res.json()
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to create classroom')
  }
  return data.classroom
}

/**
 * Look up classroom by code
 */
async function fetchClassroomByCode(
  code: string
): Promise<{ classroom: Classroom; teacherName: string } | null> {
  const res = await api(`classrooms/code/${code.toUpperCase()}`)
  if (!res.ok) {
    if (res.status === 404) return null
    throw new Error('Failed to look up classroom')
  }
  const data = await res.json()
  return data
}

/**
 * Hook: Get current user's classroom (if they're a teacher)
 */
export function useMyClassroom() {
  return useQuery({
    queryKey: classroomKeys.mine(),
    queryFn: fetchMyClassroom,
    // Don't refetch too aggressively - classrooms rarely change
    staleTime: 60_000, // 1 minute
  })
}

/**
 * Hook: Create a classroom
 */
export function useCreateClassroom() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createClassroom,
    onSuccess: (classroom) => {
      // Update the cache with the new classroom
      queryClient.setQueryData(classroomKeys.mine(), classroom)
      // Invalidate to ensure consistency
      queryClient.invalidateQueries({ queryKey: classroomKeys.all })
    },
  })
}

/**
 * Hook: Look up classroom by join code
 */
export function useClassroomByCode(code: string | null) {
  return useQuery({
    queryKey: classroomKeys.byCode(code ?? ''),
    queryFn: () => (code ? fetchClassroomByCode(code) : null),
    enabled: !!code && code.length >= 4, // Only query if code is entered
    staleTime: 30_000, // 30 seconds
  })
}

/**
 * Check if current user is a teacher (has a classroom)
 */
export function useIsTeacher() {
  const { data: classroom, isLoading } = useMyClassroom()
  return {
    isTeacher: classroom !== null && classroom !== undefined,
    isLoading,
    classroom,
  }
}
