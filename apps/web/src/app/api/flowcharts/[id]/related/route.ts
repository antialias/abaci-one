import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/withAuth'
import { findRelatedFlowcharts } from '@/lib/flowcharts/embedding-search'

/**
 * GET /api/flowcharts/[id]/related
 *
 * Get flowcharts related to a specific flowchart.
 * Uses semantic similarity based on embeddings.
 *
 * Response: { related: FlowchartSearchResult[] }
 */
export const GET = withAuth(async (_request, { params }) => {
  try {
    const { id } = (await params) as { id: string }

    const related = await findRelatedFlowcharts(id, {
      limit: 5,
      minSimilarity: 0.4, // Lower threshold for related items
    })

    return NextResponse.json({ related })
  } catch (error) {
    console.error('Failed to find related flowcharts:', error)
    return NextResponse.json({ error: 'Failed to find related flowcharts' }, { status: 500 })
  }
})
