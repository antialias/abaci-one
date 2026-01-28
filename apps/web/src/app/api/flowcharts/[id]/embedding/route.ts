import { eq } from 'drizzle-orm'
import { type NextRequest, NextResponse } from 'next/server'
import { db, schema } from '@/db'
import {
  generateFlowchartEmbeddings,
  EMBEDDING_VERSION,
} from '@/lib/flowcharts/embedding'
import { invalidateEmbeddingCache } from '@/lib/flowcharts/embedding-search'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * POST /api/flowcharts/[id]/embedding
 *
 * Generate and store embeddings for a single published flowchart.
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params

    const fc = await db.query.teacherFlowcharts.findFirst({
      where: eq(schema.teacherFlowcharts.id, id),
      columns: {
        id: true,
        title: true,
        description: true,
        difficulty: true,
        status: true,
      },
    })

    if (!fc || fc.status !== 'published') {
      return NextResponse.json({ error: 'Flowchart not found' }, { status: 404 })
    }

    const { embedding, promptEmbedding } = await generateFlowchartEmbeddings({
      title: fc.title,
      description: fc.description,
      topicDescription: null,
      difficulty: fc.difficulty,
    })

    await db
      .update(schema.teacherFlowcharts)
      .set({
        embedding,
        promptEmbedding,
        embeddingVersion: EMBEDDING_VERSION,
      })
      .where(eq(schema.teacherFlowcharts.id, id))

    invalidateEmbeddingCache()

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to generate embedding:', error)
    return NextResponse.json(
      { error: 'Failed to generate embedding', details: String(error) },
      { status: 500 }
    )
  }
}
