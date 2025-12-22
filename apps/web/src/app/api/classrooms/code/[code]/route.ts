import { type NextRequest, NextResponse } from 'next/server'
import { getClassroomByCode } from '@/lib/classroom'

interface RouteParams {
  params: Promise<{ code: string }>
}

/**
 * GET /api/classrooms/code/[code]
 * Look up classroom by join code
 *
 * Returns: { classroom, teacher } or 404
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { code } = await params

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
}
