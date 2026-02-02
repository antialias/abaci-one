import { type NextRequest, NextResponse } from 'next/server'
import { loadTaxonomy, labelId } from '@/lib/flowcharts/taxonomy'
import { generateEmbeddings, EMBEDDING_DIMENSIONS } from '@/lib/flowcharts/embedding'

/**
 * POST /api/admin/taxonomy/test-cluster
 *
 * Test how a set of topics would be clustered using the taxonomy.
 * Takes an array of topic strings, embeds them, and returns a distance matrix
 * that includes both the test topics and all taxonomy labels.
 *
 * The client can then use the same clustering algorithm as /flowchart
 * to see how the topics would be grouped and labeled.
 *
 * Request body:
 * { topics: string[] }
 *
 * Response:
 * {
 *   ids: string[],        // Test topic IDs (topic:0, topic:1, ...) + label IDs (label:...)
 *   matrix: number[],     // Upper-triangle distance matrix
 *   topicCount: number    // Number of test topics (first N entries in ids)
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const topics: string[] = body.topics

    if (!Array.isArray(topics) || topics.length === 0) {
      return NextResponse.json(
        { error: 'Request body must contain a non-empty "topics" array' },
        { status: 400 }
      )
    }

    if (topics.length > 50) {
      return NextResponse.json({ error: 'Maximum 50 topics allowed' }, { status: 400 })
    }

    // Filter out empty topics
    const validTopics = topics.filter((t) => t.trim().length > 0)
    if (validTopics.length === 0) {
      return NextResponse.json(
        { error: 'At least one non-empty topic is required' },
        { status: 400 }
      )
    }

    // Load taxonomy
    const taxonomy = await loadTaxonomy()

    // Generate embeddings for test topics
    const topicEmbeddings = await generateEmbeddings(validTopics)

    // Build combined IDs and embeddings array
    // First: test topics (topic:0, topic:1, ...)
    // Then: taxonomy labels (label:...)
    const allIds: string[] = []
    const allEmbeddings: Float32Array[] = []

    for (let i = 0; i < validTopics.length; i++) {
      allIds.push(`topic:${i}`)
      allEmbeddings.push(topicEmbeddings[i])
    }

    for (let i = 0; i < taxonomy.labels.length; i++) {
      allIds.push(labelId(taxonomy.labels[i]))
      allEmbeddings.push(taxonomy.embeddings[i])
    }

    // Compute upper-triangle distance matrix
    const n = allIds.length
    const matrix: number[] = []

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const dist = 1 - cosineSimilarity(allEmbeddings[i], allEmbeddings[j])
        matrix.push(dist)
      }
    }

    return NextResponse.json({
      ids: allIds,
      matrix,
      topicCount: validTopics.length,
      topics: validTopics, // Echo back the validated topics
    })
  } catch (error) {
    console.error('Failed to test clustering:', error)
    return NextResponse.json(
      { error: 'Failed to test clustering', details: String(error) },
      { status: 500 }
    )
  }
}

/**
 * Compute cosine similarity between two embedding vectors.
 */
function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length || a.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(`Embedding dimension mismatch: ${a.length} vs ${b.length}`)
  }

  let dotProduct = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }

  const magnitude = Math.sqrt(normA) * Math.sqrt(normB)
  if (magnitude === 0) return 0

  return dotProduct / magnitude
}
