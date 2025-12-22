import { eq } from 'drizzle-orm'
import { type NextRequest, NextResponse } from 'next/server'
import { db, schema } from '@/db'
import { unenrollStudent, getTeacherClassroom, isParent } from '@/lib/classroom'
import { getViewerId } from '@/lib/viewer'

/**
 * Get or create user record for a viewerId (guestId)
 */
async function getOrCreateUser(viewerId: string) {
  let user = await db.query.users.findFirst({
    where: eq(schema.users.guestId, viewerId),
  })

  if (!user) {
    const [newUser] = await db.insert(schema.users).values({ guestId: viewerId }).returning()
    user = newUser
  }

  return user
}

interface RouteParams {
  params: Promise<{ classroomId: string; playerId: string }>
}

/**
 * DELETE /api/classrooms/[classroomId]/enrollments/[playerId]
 * Unenroll student from classroom (teacher or parent)
 *
 * Returns: { success: true }
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const { classroomId, playerId } = await params
    const viewerId = await getViewerId()
    const user = await getOrCreateUser(viewerId)

    // Check authorization: must be teacher of classroom OR parent of student
    const classroom = await getTeacherClassroom(user.id)
    const isTeacher = classroom?.id === classroomId
    const parentCheck = await isParent(user.id, playerId)

    if (!isTeacher && !parentCheck) {
      return NextResponse.json(
        { error: 'Must be the classroom teacher or a parent of the student' },
        { status: 403 }
      )
    }

    await unenrollStudent(classroomId, playerId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to unenroll student:', error)
    return NextResponse.json({ error: 'Failed to unenroll student' }, { status: 500 })
  }
}
