import { and, eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/withAuth'
import { db, schema } from '@/db'

/**
 * GET /api/flowcharts/[id]
 * Get a flowchart by ID from the database.
 *
 * NOTE: Built-in flowcharts must be seeded via the Seed Manager
 * (debug mode on /flowchart) before they can be fetched.
 *
 * Returns: { flowchart: { definition, mermaid, meta, source } } or 404
 */
export const GET = withAuth(async (_request, { params }) => {
  try {
    const { id } = (await params) as { id: string }

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
})
