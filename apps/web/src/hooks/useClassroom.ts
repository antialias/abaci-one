'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Classroom, EnrollmentRequest, Player, User } from '@/db/schema'
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

export interface EnrollmentRequestWithRelations extends EnrollmentRequest {
  player?: Player
  classroom?: Classroom
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

// ============================================================================
// Enrollment API Functions
// ============================================================================

/**
 * Fetch enrolled students for a classroom
 */
async function fetchEnrolledStudents(classroomId: string): Promise<Player[]> {
  const res = await api(`classrooms/${classroomId}/enrollments`)
  if (!res.ok) throw new Error('Failed to fetch enrolled students')
  const data = await res.json()
  return data.students
}

/**
 * Fetch pending enrollment requests for a classroom
 */
async function fetchPendingRequests(
  classroomId: string
): Promise<EnrollmentRequestWithRelations[]> {
  const res = await api(`classrooms/${classroomId}/enrollment-requests`)
  if (!res.ok) throw new Error('Failed to fetch enrollment requests')
  const data = await res.json()
  return data.requests
}

/**
 * Create enrollment request
 */
async function createEnrollmentRequest(params: {
  classroomId: string
  playerId: string
}): Promise<EnrollmentRequest> {
  const res = await api(`classrooms/${params.classroomId}/enrollment-requests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ playerId: params.playerId }),
  })
  if (!res.ok) {
    const data = await res.json()
    throw new Error(data.error || 'Failed to create enrollment request')
  }
  const data = await res.json()
  return data.request
}

/**
 * Approve enrollment request
 */
async function approveRequest(params: {
  classroomId: string
  requestId: string
}): Promise<{ request: EnrollmentRequest; fullyApproved: boolean }> {
  const res = await api(
    `classrooms/${params.classroomId}/enrollment-requests/${params.requestId}/approve`,
    { method: 'POST' }
  )
  if (!res.ok) {
    const data = await res.json()
    throw new Error(data.error || 'Failed to approve request')
  }
  return res.json()
}

/**
 * Deny enrollment request
 */
async function denyRequest(params: {
  classroomId: string
  requestId: string
}): Promise<EnrollmentRequest> {
  const res = await api(
    `classrooms/${params.classroomId}/enrollment-requests/${params.requestId}/deny`,
    { method: 'POST' }
  )
  if (!res.ok) {
    const data = await res.json()
    throw new Error(data.error || 'Failed to deny request')
  }
  const data = await res.json()
  return data.request
}

/**
 * Unenroll student from classroom
 */
async function unenrollStudent(params: { classroomId: string; playerId: string }): Promise<void> {
  const res = await api(`classrooms/${params.classroomId}/enrollments/${params.playerId}`, {
    method: 'DELETE',
  })
  if (!res.ok) {
    const data = await res.json()
    throw new Error(data.error || 'Failed to unenroll student')
  }
}

// ============================================================================
// Enrollment Hooks
// ============================================================================

/**
 * Get enrolled students in a classroom
 */
export function useEnrolledStudents(classroomId: string | undefined) {
  return useQuery({
    queryKey: classroomKeys.enrollments(classroomId ?? ''),
    queryFn: () => fetchEnrolledStudents(classroomId!),
    enabled: !!classroomId,
    staleTime: 60 * 1000, // 1 minute
  })
}

/**
 * Get pending enrollment requests for a classroom
 */
export function usePendingEnrollmentRequests(classroomId: string | undefined) {
  return useQuery({
    queryKey: [...classroomKeys.detail(classroomId ?? ''), 'pending-requests'],
    queryFn: () => fetchPendingRequests(classroomId!),
    enabled: !!classroomId,
    staleTime: 30 * 1000, // 30 seconds
  })
}

/**
 * Create enrollment request mutation
 *
 * Used by parents to request enrollment of their child in a classroom.
 */
export function useCreateEnrollmentRequest() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createEnrollmentRequest,
    onSuccess: (_, { classroomId }) => {
      // Invalidate pending requests for this classroom
      queryClient.invalidateQueries({
        queryKey: [...classroomKeys.detail(classroomId), 'pending-requests'],
      })
    },
  })
}

/**
 * Approve enrollment request mutation (for teachers)
 */
export function useApproveEnrollmentRequest() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: approveRequest,
    onSuccess: (result, { classroomId }) => {
      // Invalidate pending requests
      queryClient.invalidateQueries({
        queryKey: [...classroomKeys.detail(classroomId), 'pending-requests'],
      })
      // If fully approved, also invalidate enrollments
      if (result.fullyApproved) {
        queryClient.invalidateQueries({
          queryKey: classroomKeys.enrollments(classroomId),
        })
      }
    },
  })
}

/**
 * Deny enrollment request mutation (for teachers)
 */
export function useDenyEnrollmentRequest() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: denyRequest,
    onSuccess: (_, { classroomId }) => {
      // Invalidate pending requests
      queryClient.invalidateQueries({
        queryKey: [...classroomKeys.detail(classroomId), 'pending-requests'],
      })
    },
  })
}

/**
 * Unenroll student mutation
 */
export function useUnenrollStudent() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: unenrollStudent,
    onSuccess: (_, { classroomId }) => {
      // Invalidate enrollments
      queryClient.invalidateQueries({
        queryKey: classroomKeys.enrollments(classroomId),
      })
    },
  })
}
