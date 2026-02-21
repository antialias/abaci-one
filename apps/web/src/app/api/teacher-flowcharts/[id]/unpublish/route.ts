import { and, eq } from 'drizzle-orm'
import { type NextRequest, NextResponse } from 'next/server'
import { db, schema } from '@/db'
import { getUserId } from '@/lib/viewer'
import { withAuth } from '@/lib/auth/withAuth'

/**
 * POST /api/teacher-flowcharts/[id]/unpublish
 * Revert a published flowchart back to draft status
 *
 * Returns: { flowchart: TeacherFlowchart }
 */
export const POST = withAuth(async (_request, { params }) => {
  try {
    const { id } = (await params) as { id: string }
    const userId = await getUserId()

    // Find the flowchart
    const existing = await db.query.teacherFlowcharts.findFirst({
      where: and(eq(schema.teacherFlowcharts.id, id), eq(schema.teacherFlowcharts.userId, userId)),
    })

    if (!existing) {
      return NextResponse.json({ error: 'Flowchart not found' }, { status: 404 })
    }

    if (existing.status !== 'published') {
      return NextResponse.json({ error: 'Flowchart is not published' }, { status: 400 })
    }

    const [flowchart] = await db
      .update(schema.teacherFlowcharts)
      .set({
        status: 'draft',
        publishedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(schema.teacherFlowcharts.id, id))
      .returning()

    return NextResponse.json({ flowchart })
  } catch (error) {
    console.error('Failed to unpublish teacher flowchart:', error)
    return NextResponse.json({ error: 'Failed to unpublish flowchart' }, { status: 500 })
  }
})
