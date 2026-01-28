import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db, schema } from '@/db'
import {
  generateFlowchartEmbeddings,
  EMBEDDING_VERSION,
} from '@/lib/flowcharts/embedding'
import { invalidateEmbeddingCache } from '@/lib/flowcharts/embedding-search'

/**
 * POST /api/flowcharts/seed-embeddings
 *
 * Generate and store embeddings for all published flowcharts that are missing them.
 * Writes to teacher_flowcharts.embedding / promptEmbedding / embeddingVersion columns
 * (the same place the publish endpoint writes, and getAllFlowchartEmbeddings reads from).
 */
export async function POST() {
  try {
    // Get all published flowcharts from database
    const dbFlowcharts = await db.query.teacherFlowcharts.findMany({
      where: eq(schema.teacherFlowcharts.status, 'published'),
      columns: {
        id: true,
        title: true,
        description: true,
        difficulty: true,
        embeddingVersion: true,
      },
    })

    // Only process flowcharts missing embeddings or with outdated version
    const needsEmbedding = dbFlowcharts.filter(
      (fc) => !fc.embeddingVersion || fc.embeddingVersion !== EMBEDDING_VERSION
    )

    const results = []
    for (const fc of needsEmbedding) {
      const { embedding, promptEmbedding } = await generateFlowchartEmbeddings({
        title: fc.title,
        description: fc.description,
        topicDescription: null,
        difficulty: fc.difficulty,
      })

      // Update the teacher_flowcharts row directly
      await db
        .update(schema.teacherFlowcharts)
        .set({
          embedding,
          promptEmbedding,
          embeddingVersion: EMBEDDING_VERSION,
        })
        .where(eq(schema.teacherFlowcharts.id, fc.id))

      results.push({
        id: fc.id,
        title: fc.title,
      })
    }

    // Invalidate the cache so new embeddings are picked up
    invalidateEmbeddingCache()

    return NextResponse.json({
      success: true,
      seeded: results,
      skipped: dbFlowcharts.length - needsEmbedding.length,
    })
  } catch (error) {
    console.error('Failed to seed embeddings:', error)
    return NextResponse.json(
      { error: 'Failed to seed embeddings', details: String(error) },
      { status: 500 }
    )
  }
}
