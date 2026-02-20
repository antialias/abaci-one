import { NextResponse } from 'next/server'
import { searchProfiles } from '@/lib/seed/embedding-search'
import { withAuth } from '@/lib/auth/withAuth'

/**
 * GET /api/debug/seed-students/search?q=...
 *
 * Natural language search over seed student profiles using embeddings.
 * Returns profile names ranked by semantic similarity to the query.
 */
export const GET = withAuth(
  async (req: Request) => {
    const { searchParams } = new URL(req.url)
    const query = searchParams.get('q')?.trim()

    if (!query || query.length < 3) {
      return NextResponse.json({ results: [] })
    }

    try {
      const results = await searchProfiles(query)
      return NextResponse.json({ results })
    } catch (error) {
      console.error('[seed-students/search] Failed:', error)
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Search failed' },
        { status: 500 }
      )
    }
  },
  { role: 'admin' }
)
