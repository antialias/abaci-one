import { type NextRequest, NextResponse } from 'next/server'
import {
  searchSimilarFlowcharts,
  type FlowchartSearchResult,
} from '@/lib/flowcharts/embedding-search'

/**
 * POST /api/flowcharts/suggest
 *
 * Search for existing flowcharts similar to a user's topic description.
 * Used in the CreateFlowchartModal to suggest existing flowcharts before
 * generating a new one, and on the browse page for search.
 *
 * Request body: { query: string, limit?: number }
 * Response: { suggestions: FlowchartSearchResult[] }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { query, limit } = body

    if (!query || typeof query !== 'string') {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 })
    }

    if (query.trim().length < 3) {
      return NextResponse.json({ suggestions: [] })
    }

    // Default to 3 for create modal, allow up to 20 for browse page
    const resultLimit = typeof limit === 'number' ? Math.min(Math.max(1, limit), 20) : 3

    const suggestions = await searchSimilarFlowcharts(query, {
      limit: resultLimit,
      minSimilarity: 0.3,
    })

    return NextResponse.json({ suggestions })
  } catch (error) {
    console.error('Failed to search flowcharts:', error)
    return NextResponse.json({ error: 'Failed to search flowcharts' }, { status: 500 })
  }
}
