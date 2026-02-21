import { and, eq, inArray } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/db'
import { classrooms, enrollmentRequests, users } from '@/db/schema'
import { withAuth } from '@/lib/auth/withAuth'
import {
  canPerformAction,
  getEnrolledClassrooms,
  getLinkedParents,
  getStudentPresence,
  getTeacherClassroom,
} from '@/lib/classroom'
import { getUserId } from '@/lib/viewer'
import type {
  EnrolledClassroomInfo,
  ParentInfo,
  PendingEnrollmentInfo,
  PresenceInfo,
  StudentStakeholders,
  ViewerRelationshipSummary,
  ViewerRelationType,
} from '@/types/student'

/**
 * GET /api/players/[id]/stakeholders
 *
 * Get complete stakeholder information for a student:
 * - All linked parents
 * - All enrolled classrooms (with teacher names)
 * - Pending enrollment requests
 * - Current classroom presence
 * - Viewer's relationship summary
 */
export const GET = withAuth(async (_request, { params }) => {
  try {
    const { id: playerId } = (await params) as { id: string }
    const viewerId = await getUserId()

    // Check authorization: must have at least view access
    const canView = await canPerformAction(viewerId, playerId, 'view')
    if (!canView) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    // Fetch all data in parallel
    const [linkedParents, enrolledClassroomsList, presence, viewerClassroom, pendingRequests] =
      await Promise.all([
        getLinkedParents(playerId),
        getEnrolledClassrooms(playerId),
        getStudentPresence(playerId),
        getTeacherClassroom(viewerId),
        db.query.enrollmentRequests.findMany({
          where: and(
            eq(enrollmentRequests.playerId, playerId),
            eq(enrollmentRequests.status, 'pending')
          ),
        }),
      ])

    // Get teacher info for enrolled classrooms
    const teacherIds = enrolledClassroomsList.map((c) => c.teacherId)
    const uniqueTeacherIds = [...new Set(teacherIds)]
    const teachers =
      uniqueTeacherIds.length > 0
        ? await db.query.users.findMany({
            where: inArray(users.id, uniqueTeacherIds),
          })
        : []
    const teacherMap = new Map(teachers.map((t) => [t.id, t]))

    // Get classroom info for pending requests
    const pendingClassroomIds = pendingRequests.map((r) => r.classroomId)
    const uniquePendingClassroomIds = [...new Set(pendingClassroomIds)]
    const pendingClassrooms =
      uniquePendingClassroomIds.length > 0
        ? await db.query.classrooms.findMany({
            where: inArray(classrooms.id, uniquePendingClassroomIds),
          })
        : []
    const pendingClassroomMap = new Map(pendingClassrooms.map((c) => [c.id, c]))

    // Get teacher info for pending request classrooms
    const pendingTeacherIds = pendingClassrooms.map((c) => c.teacherId)
    const uniquePendingTeacherIds = [...new Set(pendingTeacherIds)]
    const additionalTeachers =
      uniquePendingTeacherIds.length > 0
        ? await db.query.users.findMany({
            where: inArray(users.id, uniquePendingTeacherIds),
          })
        : []
    for (const t of additionalTeachers) {
      if (!teacherMap.has(t.id)) {
        teacherMap.set(t.id, t)
      }
    }

    // Build parent info
    const parents: ParentInfo[] = linkedParents.map((parent) => ({
      id: parent.id,
      name: parent.name ?? 'Unknown',
      email: parent.email ?? undefined,
      isMe: parent.id === viewerId,
    }))

    // Build enrolled classrooms info
    const enrolledClassrooms: EnrolledClassroomInfo[] = enrolledClassroomsList.map((classroom) => {
      const teacher = teacherMap.get(classroom.teacherId)
      return {
        id: classroom.id,
        name: classroom.name,
        teacherName: teacher?.name ?? 'Unknown Teacher',
        isMyClassroom: classroom.teacherId === viewerId,
      }
    })

    // Build pending enrollments info
    const pendingEnrollments: PendingEnrollmentInfo[] = pendingRequests.map((request) => {
      const classroom = pendingClassroomMap.get(request.classroomId)
      const teacher = classroom ? teacherMap.get(classroom.teacherId) : null
      return {
        id: request.id,
        classroomId: request.classroomId,
        classroomName: classroom?.name ?? 'Unknown Classroom',
        teacherName: teacher?.name ?? 'Unknown Teacher',
        pendingApproval: request.teacherApproval === null ? 'teacher' : 'parent',
        initiatedBy: request.requestedByRole as 'teacher' | 'parent',
      }
    })

    // Build presence info
    let currentPresence: PresenceInfo | null = null
    if (presence?.classroomId) {
      const presenceClassroom = await db.query.classrooms.findFirst({
        where: eq(classrooms.id, presence.classroomId),
      })
      if (presenceClassroom) {
        const presenceTeacher = teacherMap.get(presenceClassroom.teacherId)
        if (!presenceTeacher) {
          const fetchedTeacher = await db.query.users.findFirst({
            where: eq(users.id, presenceClassroom.teacherId),
          })
          if (fetchedTeacher) {
            teacherMap.set(fetchedTeacher.id, fetchedTeacher)
          }
        }
        const teacher = teacherMap.get(presenceClassroom.teacherId)
        currentPresence = {
          classroomId: presenceClassroom.id,
          classroomName: presenceClassroom.name,
          teacherName: teacher?.name ?? 'Unknown Teacher',
        }
      }
    }

    // Determine viewer's relationship
    const isMyChild = parents.some((p) => p.isMe)
    const isMyStudent = enrolledClassrooms.some((c) => c.isMyClassroom)
    const isPresent = currentPresence && viewerClassroom?.id === currentPresence.classroomId

    let viewerType: ViewerRelationType = 'none'
    let viewerDescription = 'No relationship'
    let viewerClassroomName: string | undefined

    if (isMyChild) {
      viewerType = 'parent'
      viewerDescription = 'Your child'
    } else if (isMyStudent) {
      viewerType = 'teacher'
      const myClassroom = enrolledClassrooms.find((c) => c.isMyClassroom)
      viewerClassroomName = myClassroom?.name
      viewerDescription = `Enrolled in ${viewerClassroomName ?? 'your classroom'}`
    } else if (isPresent) {
      viewerType = 'observer'
      viewerDescription = `Visiting ${currentPresence?.classroomName ?? 'your classroom'}`
    }

    const viewerRelationship: ViewerRelationshipSummary = {
      type: viewerType,
      description: viewerDescription,
      classroomName: viewerClassroomName,
    }

    const stakeholders: StudentStakeholders = {
      parents,
      enrolledClassrooms,
      pendingEnrollments,
      currentPresence,
    }

    return NextResponse.json({
      stakeholders,
      viewerRelationship,
    })
  } catch (error) {
    console.error('Failed to fetch stakeholders:', error)
    return NextResponse.json({ error: 'Failed to fetch stakeholders' }, { status: 500 })
  }
})
