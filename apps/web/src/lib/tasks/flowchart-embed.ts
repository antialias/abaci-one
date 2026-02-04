import { eq } from 'drizzle-orm'
import { db, schema } from '@/db'
import { generateFlowchartEmbeddings, EMBEDDING_VERSION } from '@/lib/flowcharts/embedding'
import { invalidateEmbeddingCache } from '@/lib/flowcharts/embedding-search'
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
}

/**
 * Start a flowchart embedding task.
 *
 * Generates embeddings for all published flowcharts missing them or with
 * an outdated version. Reports per-flowchart progress via events.
 */
export async function startFlowchartEmbedding(
  input: FlowchartEmbedInput
): Promise<string> {
  return createTask<FlowchartEmbedInput, FlowchartEmbedOutput, FlowchartEmbedEvent>(
    'flowchart-embed',
    input,
    async (handle, config) => {
      // Get all published flowcharts
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

      // Filter to those needing embedding
      let needsEmbedding = dbFlowcharts.filter(
        (fc) => !fc.embeddingVersion || fc.embeddingVersion !== EMBEDDING_VERSION
      )

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
            .where(eq(schema.teacherFlowcharts.id, fc.id))

          results.push({ id: fc.id, title: fc.title })
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

      handle.emit({
        type: 'embed_complete',
        embeddedCount: results.length,
        skippedCount,
        flowcharts: results,
      })

      handle.complete({
        embeddedCount: results.length,
        skippedCount,
        flowcharts: results,
      })
    }
  )
}
