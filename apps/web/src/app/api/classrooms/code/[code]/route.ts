import { NextResponse } from 'next/server'
import { getClassroomByCode } from '@/lib/classroom'
import { withAuth } from '@/lib/auth/withAuth'

/**
 * GET /api/classrooms/code/[code]
 * Look up classroom by join code
 *
 * Returns: { classroom, teacher } or 404
 */
export const GET = withAuth(async (_request, { params }) => {
  try {
    const { code } = (await params) as { code: string }

    const classroom = await getClassroomByCode(code)

    if (!classroom) {
      return NextResponse.json({ error: 'Classroom not found' }, { status: 404 })
    }

    return NextResponse.json({
      classroom: {
        id: classroom.id,
        name: classroom.name,
        code: classroom.code,
        createdAt: classroom.createdAt,
      },
      teacher: classroom.teacher
        ? {
            id: classroom.teacher.id,
            name: classroom.teacher.name,
          }
        : null,
    })
  } catch (error) {
    console.error('Failed to lookup classroom:', error)
    return NextResponse.json({ error: 'Failed to lookup classroom' }, { status: 500 })
  }
})
