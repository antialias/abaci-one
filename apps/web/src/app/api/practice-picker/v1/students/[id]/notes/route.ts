import { NextResponse } from 'next/server'
import { db } from '@/db'
import { withAuth } from '@/lib/auth/withAuth'
import { isParentOf } from '@/lib/classroom/access-control'
import { PRACTICE_PICKER_API_VERSION } from '@/lib/practice-picker/contract'
import { getUserId } from '@/lib/viewer'

/** GET /api/practice-picker/v1/students/[id]/notes */
export const GET = withAuth(async (_request, { params }) => {
  try {
    const { id } = (await params) as { id: string }
    const userId = await getUserId()

    if (!(await isParentOf(userId, id))) {
      return NextResponse.json({ error: 'Student not found or unauthorized' }, { status: 404 })
    }

    const student = await db.query.players.findFirst({
      where: (players, { eq }) => eq(players.id, id),
      columns: { id: true, notes: true },
    })

    if (!student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 })
    }

    return NextResponse.json({
      version: PRACTICE_PICKER_API_VERSION,
      studentId: student.id,
      notes: student.notes,
    })
  } catch (error) {
    console.error('Failed to fetch practice picker notes:', error)
    return NextResponse.json({ error: 'Failed to fetch student notes' }, { status: 500 })
  }
})
