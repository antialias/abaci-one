import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db, schema } from '@/db'
import { leaveSpecificClassroom, getTeacherClassroom, isParent } from '@/lib/classroom'
import { getViewerId } from '@/lib/viewer'
import { withAuth } from '@/lib/auth/withAuth'

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

/**
 * DELETE /api/classrooms/[classroomId]/presence/[playerId]
 * Remove student from classroom (teacher or parent)
 *
 * Returns: { success: true }
 */
export const DELETE = withAuth(async (_request, { params }) => {
  try {
    const { classroomId, playerId } = (await params) as { classroomId: string; playerId: string }
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

    // Pass 'teacher' if removed by teacher, 'self' otherwise (parent removing their child)
    await leaveSpecificClassroom(playerId, classroomId, isTeacher ? 'teacher' : 'self')

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to remove student from classroom:', error)
    return NextResponse.json({ error: 'Failed to remove student from classroom' }, { status: 500 })
  }
})
