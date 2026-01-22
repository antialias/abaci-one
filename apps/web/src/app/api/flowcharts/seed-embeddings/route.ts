import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db, schema } from '@/db'
import {
  buildEmbeddingContent,
  generateContentHash,
  generateEmbeddings,
  embeddingToBuffer,
  EMBEDDING_VERSION,
} from '@/lib/flowcharts/embedding'
import { invalidateEmbeddingCache } from '@/lib/flowcharts/embedding-search'

/**
 * POST /api/flowcharts/seed-embeddings
 *
 * Generate and store embeddings for all published flowcharts in the database.
 * This is an admin endpoint that can be called to populate or refresh embeddings.
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
      },
    })

    const flowchartData = dbFlowcharts.map((fc) => ({
      id: fc.id,
      meta: {
        title: fc.title,
        description: fc.description || '',
        difficulty: fc.difficulty || 'Beginner',
      },
    }))

    // Build content for each flowchart
    const contents = flowchartData.map((fc) =>
      buildEmbeddingContent({
        title: fc.meta.title,
        description: fc.meta.description,
        difficulty: fc.meta.difficulty,
      })
    )

    // Generate embeddings in batch
    const embeddings = await generateEmbeddings(contents)

    // Insert/update embeddings in database
    const results = []
    for (let i = 0; i < flowchartData.length; i++) {
      const fc = flowchartData[i]
      const content = contents[i]
      const embedding = embeddings[i]

      const contentHash = generateContentHash(content)
      const embeddingBuffer = embeddingToBuffer(embedding)

      // Upsert the embedding
      await db
        .insert(schema.flowchartEmbeddings)
        .values({
          id: fc.id,
          embedding: embeddingBuffer,
          embeddingVersion: EMBEDDING_VERSION,
          contentHash,
          createdAt: new Date(),
        })
        .onConflictDoUpdate({
          target: schema.flowchartEmbeddings.id,
          set: {
            embedding: embeddingBuffer,
            embeddingVersion: EMBEDDING_VERSION,
            contentHash,
            createdAt: new Date(),
          },
        })

      results.push({
        id: fc.id,
        title: fc.meta.title,
        contentHash,
      })
    }

    // Invalidate the cache so new embeddings are picked up
    invalidateEmbeddingCache()

    return NextResponse.json({
      success: true,
      seeded: results,
    })
  } catch (error) {
    console.error('Failed to seed embeddings:', error)
    return NextResponse.json(
      { error: 'Failed to seed embeddings', details: String(error) },
      { status: 500 }
    )
  }
}
