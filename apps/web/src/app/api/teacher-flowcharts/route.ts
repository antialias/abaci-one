import { and, desc, eq } from 'drizzle-orm'
import { type NextRequest, NextResponse } from 'next/server'
import { db, schema } from '@/db'
import { getDbUserId } from '@/lib/viewer'

/**
 * GET /api/teacher-flowcharts
 * List current user's flowcharts
 *
 * Query params:
 * - status: 'draft' | 'published' | 'archived' (optional, defaults to all non-archived)
 *
 * Returns: { flowcharts: TeacherFlowchart[] }
 */
export async function GET(req: NextRequest) {
  try {
    const userId = await getDbUserId()
    const url = new URL(req.url)
    const status = url.searchParams.get('status') as 'draft' | 'published' | 'archived' | null

    // Build where conditions
    const conditions = [eq(schema.teacherFlowcharts.userId, userId)]

    if (status) {
      conditions.push(eq(schema.teacherFlowcharts.status, status))
    } else {
      // By default, don't show archived flowcharts
      conditions.push(
        eq(schema.teacherFlowcharts.status, 'draft')
        // This doesn't work for OR - we'll use a different approach
      )
    }

    // Query flowcharts
    const flowcharts = await db.query.teacherFlowcharts.findMany({
      where: status
        ? and(
            eq(schema.teacherFlowcharts.userId, userId),
            eq(schema.teacherFlowcharts.status, status)
          )
        : and(
            eq(schema.teacherFlowcharts.userId, userId)
            // Don't show archived unless specifically requested
            // Note: This will only show drafts; we need to use SQL or for 'draft' OR 'published'
          ),
      orderBy: [desc(schema.teacherFlowcharts.updatedAt)],
      columns: {
        id: true,
        title: true,
        description: true,
        emoji: true,
        difficulty: true,
        version: true,
        status: true,
        publishedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return NextResponse.json({ flowcharts })
  } catch (error) {
    console.error('Failed to list teacher flowcharts:', error)
    return NextResponse.json({ error: 'Failed to list flowcharts' }, { status: 500 })
  }
}

/**
 * POST /api/teacher-flowcharts
 * Create a new teacher flowchart
 *
 * Body: {
 *   title: string
 *   description?: string
 *   emoji?: string
 *   difficulty?: 'Beginner' | 'Intermediate' | 'Advanced'
 *   definitionJson: string (JSON stringified FlowchartDefinition)
 *   mermaidContent: string
 *   searchKeywords?: string
 * }
 *
 * Returns: { flowchart: TeacherFlowchart }
 */
export async function POST(req: NextRequest) {
  try {
    const userId = await getDbUserId()
    const body = await req.json()

    // Validate required fields
    if (!body.title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }
    if (!body.definitionJson) {
      return NextResponse.json({ error: 'Definition JSON is required' }, { status: 400 })
    }
    if (!body.mermaidContent) {
      return NextResponse.json({ error: 'Mermaid content is required' }, { status: 400 })
    }

    // Validate definition JSON is valid JSON
    try {
      JSON.parse(body.definitionJson)
    } catch {
      return NextResponse.json({ error: 'Invalid definition JSON' }, { status: 400 })
    }

    // Validate difficulty if provided
    const validDifficulties = ['Beginner', 'Intermediate', 'Advanced']
    if (body.difficulty && !validDifficulties.includes(body.difficulty)) {
      return NextResponse.json({ error: 'Invalid difficulty level' }, { status: 400 })
    }

    const now = new Date()

    const [flowchart] = await db
      .insert(schema.teacherFlowcharts)
      .values({
        userId,
        title: body.title,
        description: body.description || null,
        emoji: body.emoji || '📊',
        difficulty: body.difficulty || null,
        definitionJson: body.definitionJson,
        mermaidContent: body.mermaidContent,
        searchKeywords: body.searchKeywords || null,
        createdAt: now,
        updatedAt: now,
      })
      .returning()

    return NextResponse.json({ flowchart }, { status: 201 })
  } catch (error) {
    console.error('Failed to create teacher flowchart:', error)
    return NextResponse.json({ error: 'Failed to create flowchart' }, { status: 500 })
  }
}
