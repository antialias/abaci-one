import { desc, eq, like, or } from 'drizzle-orm'
import { type NextRequest, NextResponse } from 'next/server'
import { db, schema } from '@/db'
import { getFlowchartList } from '@/lib/flowcharts/definitions'
import { getDbUserId } from '@/lib/viewer'

/**
 * GET /api/flowcharts/browse
 * List all available flowcharts (hardcoded + published user-created)
 *
 * Query params:
 * - difficulty: 'Beginner' | 'Intermediate' | 'Advanced' (optional filter)
 * - search: string (optional search term)
 * - limit: number (optional, defaults to 50)
 * - offset: number (optional, defaults to 0)
 *
 * Returns: { flowcharts: FlowchartMeta[], total: number }
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const difficulty = url.searchParams.get('difficulty') as
      | 'Beginner'
      | 'Intermediate'
      | 'Advanced'
      | null
    const search = url.searchParams.get('search')
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100)
    const offset = parseInt(url.searchParams.get('offset') || '0')

    // Get hardcoded flowcharts
    const hardcodedFlowcharts = getFlowchartList().map((meta) => ({
      ...meta,
      source: 'hardcoded' as const,
      authorName: null,
      publishedAt: null,
    }))

    // Get published user-created flowcharts from database
    const dbConditions = eq(schema.teacherFlowcharts.status, 'published')

    // Apply filters to DB query
    const dbFlowcharts = await db.query.teacherFlowcharts.findMany({
      where: eq(schema.teacherFlowcharts.status, 'published'),
      orderBy: [desc(schema.teacherFlowcharts.publishedAt)],
      columns: {
        id: true,
        title: true,
        description: true,
        emoji: true,
        difficulty: true,
        userId: true,
        publishedAt: true,
        searchKeywords: true,
      },
      with: {
        // We'd need to add relations for this to work
        // For now, we'll just include the userId
      },
    })

    // Transform DB flowcharts to same format as hardcoded
    const userFlowcharts = dbFlowcharts.map((fc) => ({
      id: fc.id,
      title: fc.title,
      description: fc.description || '',
      emoji: fc.emoji || '📊',
      difficulty: fc.difficulty as 'Beginner' | 'Intermediate' | 'Advanced',
      source: 'database' as const,
      authorId: fc.userId, // Include author ID for ownership checks
      publishedAt: fc.publishedAt,
      searchKeywords: fc.searchKeywords,
    }))

    // Combine all flowcharts
    let allFlowcharts = [...hardcodedFlowcharts, ...userFlowcharts]

    // Apply difficulty filter
    if (difficulty) {
      allFlowcharts = allFlowcharts.filter((fc) => fc.difficulty === difficulty)
    }

    // Apply search filter
    if (search) {
      const searchLower = search.toLowerCase()
      allFlowcharts = allFlowcharts.filter((fc) => {
        const inTitle = fc.title.toLowerCase().includes(searchLower)
        const inDescription = fc.description?.toLowerCase().includes(searchLower)
        const inKeywords =
          'searchKeywords' in fc && fc.searchKeywords?.toLowerCase().includes(searchLower)
        return inTitle || inDescription || inKeywords
      })
    }

    const total = allFlowcharts.length

    // Apply pagination
    const paginatedFlowcharts = allFlowcharts.slice(offset, offset + limit)

    // Get current user ID for ownership checks (optional - doesn't fail if not logged in)
    let currentUserId: string | null = null
    try {
      currentUserId = await getDbUserId()
    } catch {
      // Not logged in, that's fine
    }

    return NextResponse.json({
      flowcharts: paginatedFlowcharts,
      total,
      limit,
      offset,
      currentUserId,
    })
  } catch (error) {
    console.error('Failed to browse flowcharts:', error)
    return NextResponse.json({ error: 'Failed to browse flowcharts' }, { status: 500 })
  }
}
