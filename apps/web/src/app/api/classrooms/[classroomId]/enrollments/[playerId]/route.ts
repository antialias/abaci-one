import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db, schema } from '@/db'
import { getLinkedParentIds, getTeacherClassroom, isParent, unenrollStudent } from '@/lib/classroom'
import { emitStudentUnenrolled } from '@/lib/classroom/socket-emitter'
import { getDbUserId } from '@/lib/viewer'
import { withAuth } from '@/lib/auth/withAuth'

/**
 * DELETE /api/classrooms/[classroomId]/enrollments/[playerId]
 * Unenroll student from classroom (teacher or parent)
 *
 * Returns: { success: true }
 */
export const DELETE = withAuth(async (_request, { params }) => {
  try {
    const { classroomId, playerId } = (await params) as { classroomId: string; playerId: string }
    const userId = await getDbUserId()

    // Check authorization: must be teacher of classroom OR parent of student
    const classroom = await getTeacherClassroom(userId)
    const isTeacher = classroom?.id === classroomId
    const parentCheck = await isParent(userId, playerId)

    if (!isTeacher && !parentCheck) {
      return NextResponse.json(
        { error: 'Must be the classroom teacher or a parent of the student' },
        { status: 403 }
      )
    }

    await unenrollStudent(classroomId, playerId)

    // Emit socket event for real-time updates
    try {
      // Get classroom and player info for socket event
      const [classroomInfo] = await db
        .select({ name: schema.classrooms.name })
        .from(schema.classrooms)
        .where(eq(schema.classrooms.id, classroomId))
        .limit(1)

      const [playerInfo] = await db
        .select({ name: schema.players.name })
        .from(schema.players)
        .where(eq(schema.players.id, playerId))
        .limit(1)

      if (classroomInfo && playerInfo) {
        // Get parent IDs to notify
        const parentIds = await getLinkedParentIds(playerId)

        await emitStudentUnenrolled(
          {
            classroomId,
            classroomName: classroomInfo.name,
            playerId,
            playerName: playerInfo.name,
            unenrolledBy: isTeacher ? 'teacher' : 'parent',
          },
          {
            classroomId, // Teacher sees student removed
            userIds: parentIds, // Parents see child is no longer enrolled
            playerIds: [playerId], // Student sees they're no longer in classroom
          }
        )
      }
    } catch (socketError) {
      console.error('[Unenroll] Failed to emit socket event:', socketError)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to unenroll student:', error)
    return NextResponse.json({ error: 'Failed to unenroll student' }, { status: 500 })
  }
})
