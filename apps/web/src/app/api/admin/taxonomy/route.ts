import { NextResponse } from 'next/server'
import { regenerateTaxonomy } from '@/lib/flowcharts/generate-taxonomy'
import { withAuth } from '@/lib/auth/withAuth'

/**
 * POST /api/admin/taxonomy
 *
 * Regenerate the topic taxonomy for cluster labeling.
 *
 * This endpoint:
 * 1. Analyzes word frequencies from existing published flowcharts
 * 2. Uses an LLM to generate ~200 topic labels at multiple specificity levels
 * 3. Embeds all labels via OpenAI text-embedding-3-large with educational context
 * 4. Stores the labels and embeddings in the topic_taxonomy database table
 * 5. Clears the in-memory taxonomy cache
 *
 * The new taxonomy will be used immediately by the browse API.
 */
export const POST = withAuth(async () => {
  try {
    const result = await regenerateTaxonomy()

    return NextResponse.json({
      success: true,
      labelCount: result.labelCount,
      labels: result.labels,
    })
  } catch (error) {
    console.error('Failed to regenerate taxonomy:', error)
    return NextResponse.json(
      { error: 'Failed to regenerate taxonomy', details: String(error) },
      { status: 500 }
    )
  }
}, { role: 'admin' })

/**
 * GET /api/admin/taxonomy
 *
 * Get the current taxonomy status.
 */
export const GET = withAuth(async () => {
  try {
    const { db, schema } = await import('@/db')
    const { count } = await import('drizzle-orm')

    const [result] = await db.select({ count: count() }).from(schema.topicTaxonomy)

    const labels = await db.select({ label: schema.topicTaxonomy.label }).from(schema.topicTaxonomy)

    return NextResponse.json({
      labelCount: result.count,
      labels: labels.map((r) => r.label),
    })
  } catch (error) {
    console.error('Failed to get taxonomy:', error)
    return NextResponse.json(
      { error: 'Failed to get taxonomy', details: String(error) },
      { status: 500 }
    )
  }
}, { role: 'admin' })
