import { and, eq } from 'drizzle-orm'
import { type NextRequest, NextResponse } from 'next/server'
import { db, schema } from '@/db'
import { getDbUserId } from '@/lib/viewer'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * POST /api/teacher-flowcharts/[id]/publish
 * Publish a draft flowchart
 *
 * Validates the flowchart before publishing:
 * - Definition JSON must be valid
 * - Required fields must be present
 *
 * Returns: { flowchart: TeacherFlowchart }
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const userId = await getDbUserId()

    // Find the flowchart
    const existing = await db.query.teacherFlowcharts.findFirst({
      where: and(eq(schema.teacherFlowcharts.id, id), eq(schema.teacherFlowcharts.userId, userId)),
    })

    if (!existing) {
      return NextResponse.json({ error: 'Flowchart not found' }, { status: 404 })
    }

    if (existing.status === 'published') {
      return NextResponse.json({ error: 'Flowchart is already published' }, { status: 400 })
    }

    if (existing.status === 'archived') {
      return NextResponse.json({ error: 'Cannot publish an archived flowchart' }, { status: 400 })
    }

    // Validate the definition before publishing
    let definition
    try {
      definition = JSON.parse(existing.definitionJson)
    } catch {
      return NextResponse.json({ error: 'Invalid flowchart definition JSON' }, { status: 400 })
    }

    // Basic validation
    const validationErrors: string[] = []

    if (!definition.id) validationErrors.push('Missing flowchart ID in definition')
    if (!definition.title) validationErrors.push('Missing title in definition')
    if (!definition.entryNode) validationErrors.push('Missing entry node')
    if (!definition.nodes || Object.keys(definition.nodes).length === 0) {
      validationErrors.push('Flowchart must have at least one node')
    }
    if (!definition.problemInput) {
      validationErrors.push('Missing problem input schema')
    }

    if (validationErrors.length > 0) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationErrors },
        { status: 400 }
      )
    }

    // TODO: Add more comprehensive validation:
    // - Verify mermaid parses correctly
    // - Verify all node references are valid
    // - Verify expressions are valid
    // - Test with example generation

    const now = new Date()

    const [flowchart] = await db
      .update(schema.teacherFlowcharts)
      .set({
        status: 'published',
        publishedAt: now,
        updatedAt: now,
      })
      .where(eq(schema.teacherFlowcharts.id, id))
      .returning()

    return NextResponse.json({ flowchart })
  } catch (error) {
    console.error('Failed to publish teacher flowchart:', error)
    return NextResponse.json({ error: 'Failed to publish flowchart' }, { status: 500 })
  }
}
