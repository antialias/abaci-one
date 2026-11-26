import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/withAuth'
import {
  type FlowchartSearchResult,
  MAX_SEARCH_QUERY_CHARS,
  searchSimilarFlowcharts,
} from '@/lib/flowcharts/embedding-search'

/**
 * POST /api/flowcharts/suggest
 *
 * Search for existing flowcharts similar to a user's topic description.
 * Used in the CreateFlowchartModal to suggest existing flowcharts before
 * generating a new one, and on the browse page for search.
 *
 * Request body: { query: string, limit?: number }. Open to guests, so the body is
 * capped (413 past MAX_BODY_BYTES) and the query is cut to MAX_SEARCH_QUERY_CHARS
 * before it is embedded.
 * Response: { suggestions: FlowchartSearchResult[] }
 */
const MAX_BODY_BYTES = 16 * 1024

export const POST = withAuth(async (request) => {
  try {
    if (Number(request.headers.get('content-length') ?? 0) > MAX_BODY_BYTES) {
      return NextResponse.json({ error: 'Request too large' }, { status: 413 })
    }
    const raw = await request.text()
    if (raw.length > MAX_BODY_BYTES) {
      return NextResponse.json({ error: 'Request too large' }, { status: 413 })
    }
    let body: { query?: unknown; limit?: unknown }
    try {
      body = JSON.parse(raw)
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }
    const { query, limit } = body

    if (!query || typeof query !== 'string') {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 })
    }

    if (query.trim().length < 3) {
      return NextResponse.json({ suggestions: [] })
    }

    // Default to 3 for create modal, allow up to 20 for browse page
    const resultLimit = typeof limit === 'number' ? Math.min(Math.max(1, limit), 20) : 3

    const suggestions = await searchSimilarFlowcharts(query.slice(0, MAX_SEARCH_QUERY_CHARS), {
      limit: resultLimit,
      minSimilarity: 0.3, // scripts/eval-embedding-models.ts
    })

    return NextResponse.json({ suggestions })
  } catch (error) {
    console.error('Failed to search flowcharts:', error)
    return NextResponse.json({ error: 'Failed to search flowcharts' }, { status: 500 })
  }
})
