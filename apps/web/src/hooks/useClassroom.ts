'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Classroom, EnrollmentRequest, Player, User } from '@/db/schema'
import { api } from '@/lib/queryClient'
import { classroomKeys, playerKeys } from '@/lib/queryKeys'

// Re-export query keys for consumers
export { classroomKeys, playerKeys } from '@/lib/queryKeys'

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
 * Fetch requests awaiting parent approval for a classroom
 */
async function fetchAwaitingParentApproval(
  classroomId: string
): Promise<EnrollmentRequestWithRelations[]> {
  const res = await api(`classrooms/${classroomId}/enrollment-requests`)
  if (!res.ok) throw new Error('Failed to fetch enrollment requests')
  const data = await res.json()
  return data.awaitingParentApproval || []
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
 * Get pending enrollment requests for a classroom (needing teacher approval)
 */
export function usePendingEnrollmentRequests(classroomId: string | undefined) {
  return useQuery({
    queryKey: classroomKeys.pendingRequests(classroomId ?? ''),
    queryFn: () => fetchPendingRequests(classroomId!),
    enabled: !!classroomId,
    staleTime: 30 * 1000, // 30 seconds
  })
}

/**
 * Get requests awaiting parent approval (teacher has approved, waiting on parent)
 */
export function useAwaitingParentApproval(classroomId: string | undefined) {
  return useQuery({
    queryKey: classroomKeys.awaitingParentApproval(classroomId ?? ''),
    queryFn: () => fetchAwaitingParentApproval(classroomId!),
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
      // Invalidate teacher's pending requests queries
      queryClient.invalidateQueries({
        queryKey: classroomKeys.pendingRequests(classroomId),
      })
      queryClient.invalidateQueries({
        queryKey: classroomKeys.awaitingParentApproval(classroomId),
      })
      // Invalidate parent's own pending approvals list so they see their new request
      queryClient.invalidateQueries({
        queryKey: classroomKeys.pendingParentApprovals(),
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
        queryKey: classroomKeys.pendingRequests(classroomId),
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
        queryKey: classroomKeys.pendingRequests(classroomId),
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

// ============================================================================
// Parent Enrollment Approval API Functions
// ============================================================================

/**
 * Fetch pending enrollment requests for current user as parent
 */
async function fetchPendingApprovalsForParent(): Promise<EnrollmentRequestWithRelations[]> {
  const res = await api('enrollment-requests/pending')
  if (!res.ok) throw new Error('Failed to fetch pending approvals')
  const data = await res.json()
  return data.requests
}

/**
 * Approve enrollment request as parent
 */
async function approveRequestAsParent(
  requestId: string
): Promise<{ request: EnrollmentRequest; enrolled: boolean }> {
  const res = await api(`enrollment-requests/${requestId}/approve`, { method: 'POST' })
  if (!res.ok) {
    const data = await res.json()
    throw new Error(data.error || 'Failed to approve request')
  }
  return res.json()
}

/**
 * Deny enrollment request as parent
 */
async function denyRequestAsParent(requestId: string): Promise<EnrollmentRequest> {
  const res = await api(`enrollment-requests/${requestId}/deny`, { method: 'POST' })
  if (!res.ok) {
    const data = await res.json()
    throw new Error(data.error || 'Failed to deny request')
  }
  const data = await res.json()
  return data.request
}

// ============================================================================
// Parent Enrollment Approval Hooks
// ============================================================================

/**
 * Get pending enrollment requests for current user as parent
 *
 * These are requests initiated by teachers for the user's children,
 * where parent approval hasn't been given yet.
 */
export function usePendingApprovalsForParent() {
  return useQuery({
    queryKey: classroomKeys.pendingParentApprovals(),
    queryFn: fetchPendingApprovalsForParent,
    staleTime: 30 * 1000, // 30 seconds
  })
}

/**
 * Approve enrollment request as parent
 */
export function useApproveEnrollmentRequestAsParent() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: approveRequestAsParent,
    onSuccess: (result) => {
      // Invalidate pending parent approvals
      queryClient.invalidateQueries({
        queryKey: classroomKeys.pendingParentApprovals(),
      })
      // If fully approved, classroom enrollments will be updated too
      // (but we don't know the classroomId from this response, so broader invalidation)
      if (result.enrolled) {
        queryClient.invalidateQueries({
          queryKey: ['classrooms'],
        })
      }
    },
  })
}

/**
 * Deny enrollment request as parent
 */
export function useDenyEnrollmentRequestAsParent() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: denyRequestAsParent,
    onSuccess: () => {
      // Invalidate pending parent approvals
      queryClient.invalidateQueries({
        queryKey: classroomKeys.pendingParentApprovals(),
      })
    },
  })
}

// ============================================================================
// Classroom Presence API Functions
// ============================================================================

export interface PresenceStudent extends Player {
  enteredAt: string
  enteredBy: string
}

/**
 * Fetch students currently present in a classroom
 */
async function fetchClassroomPresence(classroomId: string): Promise<PresenceStudent[]> {
  const res = await api(`classrooms/${classroomId}/presence`)
  if (!res.ok) throw new Error('Failed to fetch classroom presence')
  const data = await res.json()
  return data.students
}

/**
 * Enter a student into a classroom
 */
async function enterClassroom(params: {
  classroomId: string
  playerId: string
}): Promise<{ success: boolean; error?: string }> {
  const res = await api(`classrooms/${params.classroomId}/presence`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ playerId: params.playerId }),
  })
  const data = await res.json()
  if (!res.ok) {
    return { success: false, error: data.error || 'Failed to enter classroom' }
  }
  return { success: true }
}

/**
 * Remove a student from a classroom
 */
async function leaveClassroom(params: { classroomId: string; playerId: string }): Promise<void> {
  const res = await api(`classrooms/${params.classroomId}/presence/${params.playerId}`, {
    method: 'DELETE',
  })
  if (!res.ok) {
    const data = await res.json()
    throw new Error(data.error || 'Failed to leave classroom')
  }
}

// ============================================================================
// Classroom Presence Hooks
// ============================================================================

/**
 * Get students currently present in a classroom
 */
export function useClassroomPresence(classroomId: string | undefined) {
  return useQuery({
    queryKey: classroomKeys.presence(classroomId ?? ''),
    queryFn: () => fetchClassroomPresence(classroomId!),
    enabled: !!classroomId,
    staleTime: 15 * 1000, // 15 seconds - presence changes frequently
    refetchInterval: 30 * 1000, // Poll every 30 seconds for real-time feel
  })
}

/**
 * Enter a student into a classroom
 */
export function useEnterClassroom() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: enterClassroom,
    onSuccess: (result, { classroomId, playerId }) => {
      if (result.success) {
        // Invalidate teacher's view of classroom presence
        queryClient.invalidateQueries({
          queryKey: classroomKeys.presence(classroomId),
        })
        // Invalidate student's view of their own presence
        queryClient.invalidateQueries({
          queryKey: playerKeys.presence(playerId),
        })
      }
    },
  })
}

/**
 * Remove a student from a classroom
 */
export function useLeaveClassroom() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: leaveClassroom,
    onSuccess: (_, { classroomId, playerId }) => {
      // Invalidate teacher's view of classroom presence
      queryClient.invalidateQueries({
        queryKey: classroomKeys.presence(classroomId),
      })
      // Invalidate student's view of their own presence
      queryClient.invalidateQueries({
        queryKey: playerKeys.presence(playerId),
      })
    },
  })
}

// ============================================================================
// Active Sessions API Functions and Hooks
// ============================================================================

/**
 * Active session information for a student
 */
export interface ActiveSessionInfo {
  /** Session plan ID (for observation) */
  sessionId: string
  /** Player ID */
  playerId: string
  /** When the session started */
  startedAt: string
  /** Current part index */
  currentPartIndex: number
  /** Current slot index within the part */
  currentSlotIndex: number
  /** Total parts in session */
  totalParts: number
  /** Total problems in session */
  totalProblems: number
  /** Number of completed problems */
  completedProblems: number
}

/**
 * Fetch active practice sessions for students in a classroom
 */
async function fetchActiveSession(classroomId: string): Promise<ActiveSessionInfo[]> {
  const res = await api(`classrooms/${classroomId}/presence/active-sessions`)
  if (!res.ok) throw new Error('Failed to fetch active sessions')
  const data = await res.json()
  return data.sessions
}

/**
 * Get active practice sessions for students in a classroom
 *
 * Teachers can use this to see which students are currently practicing
 * and observe their sessions in real-time.
 */
export function useActiveSessionsInClassroom(classroomId: string | undefined) {
  return useQuery({
    queryKey: classroomKeys.activeSessions(classroomId ?? ''),
    queryFn: () => fetchActiveSession(classroomId!),
    enabled: !!classroomId,
    staleTime: 10 * 1000, // 10 seconds - sessions change frequently
    refetchInterval: 15 * 1000, // Poll every 15 seconds for real-time updates
  })
}

// ============================================================================
// Student Enrollment API Functions
// ============================================================================

export interface PresenceInfo {
  playerId: string
  classroomId: string
  enteredAt: string
  enteredBy: string
  classroom?: Classroom
}

/**
 * Fetch classrooms a student is enrolled in
 */
async function fetchEnrolledClassrooms(playerId: string): Promise<Classroom[]> {
  const res = await api(`players/${playerId}/enrolled-classrooms`)
  if (!res.ok) throw new Error('Failed to fetch enrolled classrooms')
  const data = await res.json()
  return data.classrooms
}

/**
 * Fetch student's current classroom presence
 */
async function fetchStudentPresence(playerId: string): Promise<PresenceInfo | null> {
  const res = await api(`players/${playerId}/presence`)
  if (!res.ok) throw new Error('Failed to fetch student presence')
  const data = await res.json()
  return data.presence
}

// ============================================================================
// Student Enrollment Hooks
// ============================================================================

/**
 * Get classrooms a student is enrolled in
 */
export function useEnrolledClassrooms(playerId: string | undefined) {
  return useQuery({
    queryKey: playerKeys.enrolledClassrooms(playerId!),
    queryFn: () => fetchEnrolledClassrooms(playerId!),
    enabled: !!playerId,
    staleTime: 60 * 1000, // 1 minute
  })
}

/**
 * Get student's current classroom presence
 */
export function useStudentPresence(playerId: string | undefined) {
  return useQuery({
    queryKey: playerKeys.presence(playerId!),
    queryFn: () => fetchStudentPresence(playerId!),
    enabled: !!playerId,
    staleTime: 30 * 1000, // 30 seconds
  })
}
