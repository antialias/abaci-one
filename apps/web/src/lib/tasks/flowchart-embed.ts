import { and, desc, eq } from 'drizzle-orm'
import { db, schema } from '@/db'
import { EMBEDDING_VERSION, generateFlowchartEmbeddings } from '@/lib/flowcharts/embedding'
import { invalidateEmbeddingCache } from '@/lib/flowcharts/embedding-search'
import { reembedTaxonomy } from '@/lib/flowcharts/generate-taxonomy'
import { createTask } from '../task-manager'
import type { FlowchartEmbedEvent } from './events'

/**
 * Input for the flowchart embedding task
 */
export interface FlowchartEmbedInput {
  /** If provided, only embed this specific flowchart */
  flowchartId?: string
}

/**
 * Output from the flowchart embedding task
 */
export interface FlowchartEmbedOutput {
  embeddedCount: number
  skippedCount: number
  flowcharts: Array<{ id: string; title: string }>
  /** Topic-taxonomy labels re-embedded because they came from an older model */
  taxonomyReembedded: number
}

/**
 * The original topic the author typed in the workshop, when the session still
 * exists. Kept in the content text and embedded on its own as the prompt
 * embedding, exactly as the publish route does.
 */
async function loadTopicDescription(flowchartId: string): Promise<string | null> {
  const session = await db.query.workshopSessions.findFirst({
    where: eq(schema.workshopSessions.flowchartId, flowchartId),
    columns: { topicDescription: true },
    orderBy: [desc(schema.workshopSessions.updatedAt)],
  })
  return session?.topicDescription || null
}

/**
 * Compute and store the current model's vectors for one flowchart.
 *
 * Reads the row itself rather than trusting a caller's copy: the task lists every
 * row up front and then embeds them one by one, so a title saved in the meantime
 * must not be overwritten by a vector of the old one. The write is conditional on
 * updatedAt too, so a save or publish that lands while this one is embedding
 * (and writes its own fresh vector) wins.
 *
 * Returns false when the row is gone or changed underneath; nothing is written.
 */
export async function reembedFlowchart(id: string): Promise<boolean> {
  const fc = await db.query.teacherFlowcharts.findFirst({
    where: eq(schema.teacherFlowcharts.id, id),
    columns: { id: true, title: true, description: true, difficulty: true, updatedAt: true },
  })
  if (!fc) return false

  const { embedding, promptEmbedding } = await generateFlowchartEmbeddings({
    title: fc.title,
    description: fc.description,
    topicDescription: await loadTopicDescription(fc.id),
    difficulty: fc.difficulty,
  })

  const result = await db
    .update(schema.teacherFlowcharts)
    .set({ embedding, promptEmbedding, embeddingVersion: EMBEDDING_VERSION })
    .where(
      and(
        eq(schema.teacherFlowcharts.id, fc.id),
        eq(schema.teacherFlowcharts.updatedAt, fc.updatedAt)
      )
    )
  return result.rowsAffected > 0
}

/**
 * Start a flowchart embedding task.
 *
 * Re-embeds, with the current model, every flowchart whose stored vector has an
 * outdated version (any status, so no old-model vector survives in drafts or
 * archived rows) plus published flowcharts with none. Then re-embeds the topic
 * taxonomy if its labels came from an older model. Reports per-flowchart progress
 * via events. This is the post-deploy step after an embedding-model change
 * (admin → Flowcharts → "Regenerate All Embeddings").
 */
export async function startFlowchartEmbedding(input: FlowchartEmbedInput): Promise<string> {
  return createTask<FlowchartEmbedInput, FlowchartEmbedOutput, FlowchartEmbedEvent>(
    'flowchart-embed',
    input,
    async (handle, config) => {
      const allFlowcharts = await db.query.teacherFlowcharts.findMany({
        columns: {
          id: true,
          title: true,
          description: true,
          difficulty: true,
          status: true,
          embeddingVersion: true,
        },
      })

      // Published rows are searchable, so they all need a current vector. Other
      // rows only matter if they hold a vector: an old-model one must not linger.
      const dbFlowcharts = allFlowcharts.filter(
        (fc) => fc.status === 'published' || fc.embeddingVersion !== null
      )

      // Filter to those needing embedding
      let needsEmbedding = dbFlowcharts.filter((fc) => fc.embeddingVersion !== EMBEDDING_VERSION)

      // If a specific flowchart was requested, filter to just that one
      if (config.flowchartId) {
        needsEmbedding = needsEmbedding.filter((fc) => fc.id === config.flowchartId)
        if (needsEmbedding.length === 0) {
          // Check if the specific flowchart exists but already has current embedding
          const existing = dbFlowcharts.find((fc) => fc.id === config.flowchartId)
          if (existing) {
            // Force re-embed it
            needsEmbedding = [existing]
          }
        }
      }

      const skippedCount = dbFlowcharts.length - needsEmbedding.length

      handle.emit({
        type: 'embed_started',
        totalFlowcharts: needsEmbedding.length,
        skippedCount,
      })

      handle.setProgress(0, `Processing 0/${needsEmbedding.length} flowcharts`)

      const results: Array<{ id: string; title: string }> = []

      for (let i = 0; i < needsEmbedding.length; i++) {
        if (handle.isCancelled()) break

        const fc = needsEmbedding[i]

        handle.emit({
          type: 'embed_progress',
          currentIndex: i,
          totalFlowcharts: needsEmbedding.length,
          flowchartId: fc.id,
          flowchartTitle: fc.title,
        })

        try {
          // false: the row was deleted, or saved meanwhile with its own fresh vector
          if (await reembedFlowchart(fc.id)) {
            results.push({ id: fc.id, title: fc.title })
          }
        } catch (err) {
          handle.emit({
            type: 'embed_error',
            flowchartId: fc.id,
            flowchartTitle: fc.title,
            error: err instanceof Error ? err.message : String(err),
          })
          // Continue with remaining flowcharts — individual failures are non-fatal
        }

        const progress = Math.round(((i + 1) / needsEmbedding.length) * 100)
        handle.setProgress(progress, `Processing ${i + 1}/${needsEmbedding.length} flowcharts`)
      }

      // Invalidate the cache so new embeddings are picked up
      invalidateEmbeddingCache()

      // Taxonomy labels share the vector space with flowcharts (browse clusters
      // compare them), so bring them onto the current model too. Cheap: ~200
      // short texts, no LLM.
      let taxonomyReembedded = 0
      if (!handle.isCancelled()) {
        handle.setProgress(100, 'Re-embedding topic taxonomy labels')
        taxonomyReembedded = (await reembedTaxonomy()).reembeddedCount
      }

      handle.emit({
        type: 'embed_complete',
        embeddedCount: results.length,
        skippedCount,
        flowcharts: results,
        taxonomyReembedded,
      })

      handle.complete({
        embeddedCount: results.length,
        skippedCount,
        flowcharts: results,
        taxonomyReembedded,
      })
    }
  )
}
