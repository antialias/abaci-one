import { and, eq } from 'drizzle-orm'
import { type NextRequest, NextResponse } from 'next/server'
import { db, schema } from '@/db'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/flowcharts/[id]
 * Get a flowchart by ID from the database.
 *
 * NOTE: Built-in flowcharts must be seeded via the Seed Manager
 * (debug mode on /flowchart) before they can be fetched.
 *
 * Returns: { flowchart: { definition, mermaid, meta, source } } or 404
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params

    // Load from database only
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
