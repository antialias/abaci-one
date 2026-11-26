import { eq } from 'drizzle-orm'
import { db, schema } from '@/db'
import { isCurrentDimension } from '@/lib/embeddings/model'
import { cosineSimilarity } from '@/lib/embeddings/similarity'
import type { FlowchartMeta } from './definitions'
import { bufferToEmbedding, EMBEDDING_VERSION, generateEmbedding } from './embedding'

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
  source: 'database'
  meta: FlowchartMeta
}

const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes
let embeddingCache: Map<string, CachedEmbedding> | null = null
let cacheTimestamp = 0

export { cosineSimilarity }

/**
 * Get all published flowchart embeddings from the database.
 * Uses in-memory caching with 5 minute TTL.
 *
 * NOTE: All flowcharts (including built-in ones) must be seeded to
 * the database to appear in search results.
 */
export async function getAllFlowchartEmbeddings(): Promise<Map<string, CachedEmbedding>> {
  const now = Date.now()

  // Return cached embeddings if still valid
  if (embeddingCache && now - cacheTimestamp < CACHE_TTL_MS) {
    return embeddingCache
  }

  const cache = new Map<string, CachedEmbedding>()

  // Get all published flowcharts with embeddings
  const flowcharts = await db.query.teacherFlowcharts.findMany({
    where: eq(schema.teacherFlowcharts.status, 'published'),
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

  for (const fc of flowcharts) {
    // Only vectors from the current model: the version stamp says which model
    // wrote the row, and the length check catches a mislabelled row. Anything
    // else (e.g. old OpenAI vectors awaiting re-embedding) is left out of search
    // rather than compared against vectors from a different space.
    if (
      fc.embedding &&
      fc.embeddingVersion === EMBEDDING_VERSION &&
      isCurrentDimension(fc.embedding)
    ) {
      const promptOk = fc.promptEmbedding && isCurrentDimension(fc.promptEmbedding)
      cache.set(fc.id, {
        embedding: bufferToEmbedding(fc.embedding),
        promptEmbedding: promptOk ? bufferToEmbedding(fc.promptEmbedding!) : null,
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
  source: 'database'
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
/**
 * Longest search query that is embedded; longer ones are cut to this. A search is
 * a topic, not a document, and the suggest route is open to guests.
 */
export const MAX_SEARCH_QUERY_CHARS = 300

export async function searchSimilarFlowcharts(
  query: string,
  options: SearchOptions = {}
): Promise<FlowchartSearchResult[]> {
  // 0.3 separates true matches from no-match queries best for all-MiniLM-L6-v2
  // (scripts/eval-embedding-models.ts: 84% decided right at 0.30–0.32).
  const { limit = 5, minSimilarity = 0.3, excludeId } = options

  // Generate embedding for the query
  const queryEmbedding = await generateEmbedding(query.slice(0, MAX_SEARCH_QUERY_CHARS))

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

  // Related flowchart pairs score 0.29–0.55 and unrelated ones ≤ 0.23 under
  // all-MiniLM-L6-v2 (scripts/eval-embedding-models.ts).
  const { limit = 5, minSimilarity = 0.3 } = options

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
