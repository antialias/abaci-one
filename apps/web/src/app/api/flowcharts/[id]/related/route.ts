import { type NextRequest, NextResponse } from 'next/server'
import { findRelatedFlowcharts } from '@/lib/flowcharts/embedding-search'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/flowcharts/[id]/related
 *
 * Get flowcharts related to a specific flowchart.
 * Uses semantic similarity based on embeddings.
 *
 * Response: { related: FlowchartSearchResult[] }
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params

    const related = await findRelatedFlowcharts(id, {
      limit: 5,
      minSimilarity: 0.4, // Lower threshold for related items
    })

    return NextResponse.json({ related })
  } catch (error) {
    console.error('Failed to find related flowcharts:', error)
    return NextResponse.json({ error: 'Failed to find related flowcharts' }, { status: 500 })
  }
}
