import { and, eq } from 'drizzle-orm'
import { type NextRequest, NextResponse } from 'next/server'
import { db, schema } from '@/db'
import { getUserId } from '@/lib/viewer'
import { withAuth } from '@/lib/auth/withAuth'

/**
 * GET /api/teacher-flowcharts/[id]
 * Get a single teacher flowchart by ID
 *
 * Returns: { flowchart: TeacherFlowchart } or 404
 */
export const GET = withAuth(async (_request, { params }) => {
  try {
    const { id } = (await params) as { id: string }
    const userId = await getUserId()

    const flowchart = await db.query.teacherFlowcharts.findFirst({
      where: and(eq(schema.teacherFlowcharts.id, id), eq(schema.teacherFlowcharts.userId, userId)),
    })

    if (!flowchart) {
      return NextResponse.json({ error: 'Flowchart not found' }, { status: 404 })
    }

    return NextResponse.json({ flowchart })
  } catch (error) {
    console.error('Failed to fetch teacher flowchart:', error)
    return NextResponse.json({ error: 'Failed to fetch flowchart' }, { status: 500 })
  }
})

/**
 * PUT /api/teacher-flowcharts/[id]
 * Update a teacher flowchart
 *
 * If the flowchart is published, this creates a new version instead of updating in place.
 *
 * Body: {
 *   title?: string
 *   description?: string
 *   emoji?: string
 *   difficulty?: 'Beginner' | 'Intermediate' | 'Advanced'
 *   definitionJson?: string
 *   mermaidContent?: string
 *   searchKeywords?: string
 * }
 *
 * Returns: { flowchart: TeacherFlowchart }
 */
export const PUT = withAuth(async (request, { params }) => {
  try {
    const { id } = (await params) as { id: string }
    const userId = await getUserId()
    const body = await request.json()

    // Find existing flowchart
    const existing = await db.query.teacherFlowcharts.findFirst({
      where: and(eq(schema.teacherFlowcharts.id, id), eq(schema.teacherFlowcharts.userId, userId)),
    })

    if (!existing) {
      return NextResponse.json({ error: 'Flowchart not found' }, { status: 404 })
    }

    // Validate definition JSON if provided
    if (body.definitionJson) {
      try {
        JSON.parse(body.definitionJson)
      } catch {
        return NextResponse.json({ error: 'Invalid definition JSON' }, { status: 400 })
      }
    }

    // Validate difficulty if provided
    const validDifficulties = ['Beginner', 'Intermediate', 'Advanced']
    if (body.difficulty && !validDifficulties.includes(body.difficulty)) {
      return NextResponse.json({ error: 'Invalid difficulty level' }, { status: 400 })
    }

    const now = new Date()

    // If published, create a new version
    if (existing.status === 'published') {
      const [newVersion] = await db
        .insert(schema.teacherFlowcharts)
        .values({
          userId,
          title: body.title ?? existing.title,
          description: body.description ?? existing.description,
          emoji: body.emoji ?? existing.emoji,
          difficulty: body.difficulty ?? existing.difficulty,
          definitionJson: body.definitionJson ?? existing.definitionJson,
          mermaidContent: body.mermaidContent ?? existing.mermaidContent,
          searchKeywords: body.searchKeywords ?? existing.searchKeywords,
          version: existing.version + 1,
          parentVersionId: existing.id,
          status: 'draft', // New version starts as draft
          createdAt: now,
          updatedAt: now,
        })
        .returning()

      return NextResponse.json({ flowchart: newVersion, isNewVersion: true })
    }

    // Otherwise, update in place
    const updates: Partial<typeof existing> = { updatedAt: now }

    if (body.title !== undefined) updates.title = body.title
    if (body.description !== undefined) updates.description = body.description
    if (body.emoji !== undefined) updates.emoji = body.emoji
    if (body.difficulty !== undefined) updates.difficulty = body.difficulty
    if (body.definitionJson !== undefined) updates.definitionJson = body.definitionJson
    if (body.mermaidContent !== undefined) updates.mermaidContent = body.mermaidContent
    if (body.searchKeywords !== undefined) updates.searchKeywords = body.searchKeywords

    const [flowchart] = await db
      .update(schema.teacherFlowcharts)
      .set(updates)
      .where(eq(schema.teacherFlowcharts.id, id))
      .returning()

    return NextResponse.json({ flowchart })
  } catch (error) {
    console.error('Failed to update teacher flowchart:', error)
    return NextResponse.json({ error: 'Failed to update flowchart' }, { status: 500 })
  }
})

/**
 * DELETE /api/teacher-flowcharts/[id]
 * Archive a teacher flowchart (soft delete)
 *
 * Returns: { success: true }
 */
export const DELETE = withAuth(async (_request, { params }) => {
  try {
    const { id } = (await params) as { id: string }
    const userId = await getUserId()

    // Verify ownership
    const existing = await db.query.teacherFlowcharts.findFirst({
      where: and(eq(schema.teacherFlowcharts.id, id), eq(schema.teacherFlowcharts.userId, userId)),
    })

    if (!existing) {
      return NextResponse.json({ error: 'Flowchart not found' }, { status: 404 })
    }

    // Soft delete by setting status to archived
    await db
      .update(schema.teacherFlowcharts)
      .set({
        status: 'archived',
        updatedAt: new Date(),
      })
      .where(eq(schema.teacherFlowcharts.id, id))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete teacher flowchart:', error)
    return NextResponse.json({ error: 'Failed to delete flowchart' }, { status: 500 })
  }
})
