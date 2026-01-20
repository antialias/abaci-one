import { eq, isNotNull } from 'drizzle-orm'
import { db, schema } from '@/db'
import { FLOWCHARTS, type FlowchartMeta } from './definitions'
import { bufferToEmbedding, generateEmbedding, EMBEDDING_VERSION } from './embedding'

/**
 * In-memory cache for flowchart embeddings.
 * Maps flowchart ID to { embedding, promptEmbedding, timestamp }
 * Cache is invalidated after 5 minutes.
 */
interface CachedEmbedding {
  /** Full content embedding (title + description + topic + difficulty) */
  embedding: Float32Array
  /** Prompt-only embedding (just the original topic description) - better for short queries */
  promptEmbedding: Float32Array | null
  timestamp: number
  source: 'hardcoded' | 'database'
  meta: FlowchartMeta
}

const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes
let embeddingCache: Map<string, CachedEmbedding> | null = null
let cacheTimestamp = 0

/**
 * Calculate cosine similarity between two embedding vectors.
 * Returns a value between -1 and 1, where 1 means identical.
 */
export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) {
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

  const denominator = Math.sqrt(normA) * Math.sqrt(normB)
  if (denominator === 0) {
    return 0
  }

  return dotProduct / denominator
}

/**
 * Get all flowchart embeddings from both hardcoded definitions and database.
 * Uses in-memory caching with 5 minute TTL.
 */
export async function getAllFlowchartEmbeddings(): Promise<Map<string, CachedEmbedding>> {
  const now = Date.now()

  // Return cached embeddings if still valid
  if (embeddingCache && now - cacheTimestamp < CACHE_TTL_MS) {
    return embeddingCache
  }

  const cache = new Map<string, CachedEmbedding>()

  // Get hardcoded flowchart embeddings from database
  const hardcodedEmbeddings = await db.query.flowchartEmbeddings.findMany()

  for (const row of hardcodedEmbeddings) {
    const hardcoded = FLOWCHARTS[row.id]
    if (hardcoded && row.embedding) {
      cache.set(row.id, {
        embedding: bufferToEmbedding(row.embedding),
        promptEmbedding: null, // Hardcoded flowcharts don't have prompt embeddings
        timestamp: now,
        source: 'hardcoded',
        meta: hardcoded.meta,
      })
    }
  }

  // Get published teacher flowcharts with embeddings
  const teacherFlowcharts = await db.query.teacherFlowcharts.findMany({
    where: (fields) => {
      return eq(fields.status, 'published')
    },
    columns: {
      id: true,
      title: true,
      description: true,
      emoji: true,
      difficulty: true,
      embedding: true,
      promptEmbedding: true,
      embeddingVersion: true,
    },
  })

  for (const fc of teacherFlowcharts) {
    // Only include if has valid embedding
    if (fc.embedding && fc.embeddingVersion === EMBEDDING_VERSION) {
      cache.set(fc.id, {
        embedding: bufferToEmbedding(fc.embedding),
        promptEmbedding: fc.promptEmbedding ? bufferToEmbedding(fc.promptEmbedding) : null,
        timestamp: now,
        source: 'database',
        meta: {
          id: fc.id,
          title: fc.title,
          description: fc.description || '',
          emoji: fc.emoji || '📊',
          difficulty: (fc.difficulty as FlowchartMeta['difficulty']) || 'Beginner',
        },
      })
    }
  }

  embeddingCache = cache
  cacheTimestamp = now

  return cache
}

/**
 * Search result from similarity search
 */
export interface FlowchartSearchResult {
  id: string
  title: string
  description: string
  emoji: string
  difficulty: string
  similarity: number
  source: 'hardcoded' | 'database'
}

/**
 * Search options
 */
export interface SearchOptions {
  /** Maximum number of results to return (default: 5) */
  limit?: number
  /** Minimum similarity threshold (default: 0.5) */
  minSimilarity?: number
  /** Flowchart ID to exclude from results (for finding related flowcharts) */
  excludeId?: string
}

/**
 * Search for similar flowcharts using a text query.
 *
 * Compares the query against both the full content embedding and the prompt
 * embedding (if available), returning the higher similarity score. This improves
 * matching for short queries that resemble user prompts.
 *
 * @param query - The search query text
 * @param options - Search options
 * @returns Array of matching flowcharts sorted by similarity
 */
export async function searchSimilarFlowcharts(
  query: string,
  options: SearchOptions = {}
): Promise<FlowchartSearchResult[]> {
  const { limit = 5, minSimilarity = 0.5, excludeId } = options

  // Generate embedding for the query
  const queryEmbedding = await generateEmbedding(query)

  // Get all flowchart embeddings
  const embeddings = await getAllFlowchartEmbeddings()

  // Calculate similarity for each flowchart
  const results: FlowchartSearchResult[] = []

  for (const [id, cached] of embeddings) {
    if (excludeId && id === excludeId) {
      continue
    }

    // Compare against full content embedding
    const contentSimilarity = cosineSimilarity(queryEmbedding, cached.embedding)

    // Compare against prompt embedding if available (better for short queries)
    const promptSimilarity = cached.promptEmbedding
      ? cosineSimilarity(queryEmbedding, cached.promptEmbedding)
      : 0

    // Take the higher similarity score
    const similarity = Math.max(contentSimilarity, promptSimilarity)

    if (similarity >= minSimilarity) {
      results.push({
        id,
        title: cached.meta.title,
        description: cached.meta.description,
        emoji: cached.meta.emoji,
        difficulty: cached.meta.difficulty,
        similarity,
        source: cached.source,
      })
    }
  }

  // Sort by similarity (highest first) and limit results
  results.sort((a, b) => b.similarity - a.similarity)

  return results.slice(0, limit)
}

/**
 * Search for flowcharts related to a specific flowchart.
 *
 * @param flowchartId - The ID of the flowchart to find related items for
 * @param options - Search options
 * @returns Array of related flowcharts sorted by similarity
 */
export async function findRelatedFlowcharts(
  flowchartId: string,
  options: SearchOptions = {}
): Promise<FlowchartSearchResult[]> {
  const embeddings = await getAllFlowchartEmbeddings()

  const targetCached = embeddings.get(flowchartId)
  if (!targetCached) {
    return []
  }

  const { limit = 5, minSimilarity = 0.4 } = options

  const results: FlowchartSearchResult[] = []

  for (const [id, cached] of embeddings) {
    if (id === flowchartId) {
      continue
    }

    const similarity = cosineSimilarity(targetCached.embedding, cached.embedding)

    if (similarity >= minSimilarity) {
      results.push({
        id,
        title: cached.meta.title,
        description: cached.meta.description,
        emoji: cached.meta.emoji,
        difficulty: cached.meta.difficulty,
        similarity,
        source: cached.source,
      })
    }
  }

  // Sort by similarity (highest first) and limit results
  results.sort((a, b) => b.similarity - a.similarity)

  return results.slice(0, limit)
}

/**
 * Invalidate the embedding cache.
 * Call this after generating new embeddings to force a refresh.
 */
export function invalidateEmbeddingCache(): void {
  embeddingCache = null
  cacheTimestamp = 0
}
