import { createHash } from 'crypto'
import { LLMClient } from '@soroban/llm-client'

/**
 * Current embedding version - increment when changing embedding strategy
 * (e.g., changing the content format, model, or dimensions)
 */
export const EMBEDDING_VERSION = '2.0.0'

/**
 * Embedding model to use
 * Using text-embedding-3-large for better semantic understanding
 */
export const EMBEDDING_MODEL = 'text-embedding-3-large'

/**
 * Embedding dimensions (3072 for text-embedding-3-large)
 */
export const EMBEDDING_DIMENSIONS = 3072

/**
 * Data structure for building embedding content
 */
interface FlowchartEmbeddingInput {
  title: string
  description?: string | null
  /** Original topic description from workshop session (captures user intent) */
  topicDescription?: string | null
  difficulty?: string | null
}

/**
 * Build the text content to embed for a flowchart.
 *
 * Includes the original topic description when available because it captures
 * the user's natural language intent, which helps with semantic matching
 * when other users search with similar phrasing.
 *
 * @example
 * buildEmbeddingContent({
 *   title: 'Fraction Addition & Subtraction',
 *   description: 'Add and subtract fractions with different denominators',
 *   topicDescription: 'How to add and subtract fractions when they have different denominators',
 *   difficulty: 'Intermediate'
 * })
 * // Returns:
 * // "Title: Fraction Addition & Subtraction
 * // Description: Add and subtract fractions with different denominators
 * // Original Topic: How to add and subtract fractions when they have different denominators
 * // Difficulty: Intermediate"
 */
export function buildEmbeddingContent(flowchart: FlowchartEmbeddingInput): string {
  const parts: string[] = [`Title: ${flowchart.title}`]

  if (flowchart.description) {
    parts.push(`Description: ${flowchart.description}`)
  }

  if (flowchart.topicDescription) {
    parts.push(`Original Topic: ${flowchart.topicDescription}`)
  }

  if (flowchart.difficulty) {
    parts.push(`Difficulty: ${flowchart.difficulty}`)
  }

  return parts.join('\n')
}

/**
 * Generate a content hash for cache invalidation.
 * Used to detect when a flowchart's content has changed and needs re-embedding.
 */
export function generateContentHash(content: string): string {
  return createHash('sha256').update(content).digest('hex').slice(0, 16)
}

/**
 * Generate an embedding for flowchart content.
 *
 * @param content - The text content to embed (from buildEmbeddingContent)
 * @returns Float32Array containing the embedding vector
 */
export async function generateEmbedding(content: string): Promise<Float32Array> {
  const llm = new LLMClient()

  const response = await llm.embed({
    input: content,
    model: EMBEDDING_MODEL,
  })

  return response.embeddings[0]
}

/**
 * Generate embeddings for multiple flowcharts efficiently (batched API call).
 *
 * @param contents - Array of text contents to embed
 * @returns Array of Float32Array embeddings in the same order
 */
export async function generateEmbeddings(contents: string[]): Promise<Float32Array[]> {
  if (contents.length === 0) {
    return []
  }

  const llm = new LLMClient()

  const response = await llm.embed({
    input: contents,
    model: EMBEDDING_MODEL,
  })

  return response.embeddings
}

/**
 * Convert a Float32Array embedding to a Buffer for database storage.
 */
export function embeddingToBuffer(embedding: Float32Array): Buffer {
  return Buffer.from(embedding.buffer)
}

/**
 * Convert a Buffer from the database back to a Float32Array.
 */
export function bufferToEmbedding(buffer: Buffer): Float32Array {
  return new Float32Array(
    buffer.buffer,
    buffer.byteOffset,
    buffer.byteLength / Float32Array.BYTES_PER_ELEMENT
  )
}

/**
 * Generate and store an embedding for a teacher flowchart.
 * Called when a flowchart is published.
 *
 * @param flowchart - The flowchart data
 * @returns The embedding buffer and content hash
 */
export async function generateFlowchartEmbedding(
  flowchart: FlowchartEmbeddingInput
): Promise<{ embedding: Buffer; contentHash: string }> {
  const content = buildEmbeddingContent(flowchart)
  const contentHash = generateContentHash(content)
  const embeddingVector = await generateEmbedding(content)
  const embedding = embeddingToBuffer(embeddingVector)

  return { embedding, contentHash }
}

/**
 * Result from generating both content and prompt embeddings
 */
export interface FlowchartEmbeddingsResult {
  /** Embedding of full content (title + description + topic + difficulty) */
  embedding: Buffer
  /** Embedding of just the original prompt/topic description */
  promptEmbedding: Buffer | null
  /** Hash of the full content for cache invalidation */
  contentHash: string
}

/**
 * Generate both content and prompt embeddings for a flowchart.
 * Uses a single batched API call for efficiency.
 *
 * - Content embedding: title + description + topic + difficulty (good for detailed queries)
 * - Prompt embedding: just the topic description (good for short, natural language queries)
 *
 * @param flowchart - The flowchart data
 * @returns Both embeddings and content hash
 */
export async function generateFlowchartEmbeddings(
  flowchart: FlowchartEmbeddingInput
): Promise<FlowchartEmbeddingsResult> {
  const content = buildEmbeddingContent(flowchart)
  const contentHash = generateContentHash(content)

  // If we have a topic description, generate both embeddings in one batch call
  if (flowchart.topicDescription) {
    const embeddings = await generateEmbeddings([content, flowchart.topicDescription])
    return {
      embedding: embeddingToBuffer(embeddings[0]),
      promptEmbedding: embeddingToBuffer(embeddings[1]),
      contentHash,
    }
  }

  // No topic description - just generate the content embedding
  const embeddingVector = await generateEmbedding(content)
  return {
    embedding: embeddingToBuffer(embeddingVector),
    promptEmbedding: null,
    contentHash,
  }
}
