import { blob, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

/**
 * Flowchart Embeddings table - Stores embeddings for hardcoded flowcharts
 *
 * This table stores semantic embeddings for the hardcoded flowcharts (those defined
 * in src/lib/flowcharts/definitions/index.ts). User-created flowcharts store their
 * embeddings in the teacher_flowcharts table instead.
 *
 * The embeddings enable:
 * - Suggesting existing flowcharts when user enters a topic
 * - Finding related flowcharts on browse/detail pages
 * - Avoiding duplicate work by surfacing similar content
 */
export const flowchartEmbeddings = sqliteTable('flowchart_embeddings', {
  /** Primary key - matches the hardcoded flowchart ID (e.g., 'subtraction-regrouping') */
  id: text('id').primaryKey(),

  /** Semantic embedding vector (1536 floats stored as binary buffer) */
  embedding: blob('embedding', { mode: 'buffer' }).notNull(),

  /** Version of the embedding model used (e.g., '1.0.0') for cache invalidation */
  embeddingVersion: text('embedding_version').notNull(),

  /** Hash of the content used to generate the embedding (for cache invalidation) */
  contentHash: text('content_hash').notNull(),

  /** When this embedding was created */
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
})

export type FlowchartEmbedding = typeof flowchartEmbeddings.$inferSelect
export type NewFlowchartEmbedding = typeof flowchartEmbeddings.$inferInsert
