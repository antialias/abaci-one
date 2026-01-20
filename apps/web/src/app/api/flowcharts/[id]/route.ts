import { and, eq, or } from 'drizzle-orm'
import { type NextRequest, NextResponse } from 'next/server'
import { db, schema } from '@/db'
import { getFlowchart } from '@/lib/flowcharts/definitions'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/flowcharts/[id]
 * Get any flowchart by ID (hardcoded or user-created)
 *
 * For hardcoded flowcharts: Returns the definition and mermaid content
 * For user-created: Returns published flowcharts (or owner's drafts)
 *
 * Returns: { flowchart: { definition, mermaid, meta, source } } or 404
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params

    // First check hardcoded flowcharts
    const hardcoded = getFlowchart(id)
    if (hardcoded) {
      return NextResponse.json({
        flowchart: {
          definition: hardcoded.definition,
          mermaid: hardcoded.mermaid,
          meta: hardcoded.meta,
          source: 'hardcoded',
        },
      })
    }

    // Check database for published flowcharts
    const dbFlowchart = await db.query.teacherFlowcharts.findFirst({
      where: and(
        eq(schema.teacherFlowcharts.id, id),
        eq(schema.teacherFlowcharts.status, 'published')
      ),
    })

    if (dbFlowchart) {
      let definition
      try {
        definition = JSON.parse(dbFlowchart.definitionJson)
      } catch {
        return NextResponse.json({ error: 'Invalid flowchart definition' }, { status: 500 })
      }

      return NextResponse.json({
        flowchart: {
          definition,
          mermaid: dbFlowchart.mermaidContent,
          meta: {
            id: dbFlowchart.id,
            title: dbFlowchart.title,
            description: dbFlowchart.description || '',
            emoji: dbFlowchart.emoji || '📊',
            difficulty: dbFlowchart.difficulty as 'Beginner' | 'Intermediate' | 'Advanced',
          },
          source: 'database',
          authorId: dbFlowchart.userId,
          version: dbFlowchart.version,
          publishedAt: dbFlowchart.publishedAt,
        },
      })
    }

    return NextResponse.json({ error: 'Flowchart not found' }, { status: 404 })
  } catch (error) {
    console.error('Failed to fetch flowchart:', error)
    return NextResponse.json({ error: 'Failed to fetch flowchart' }, { status: 500 })
  }
}
