/**
 * Vision Training Sessions Schema
 *
 * Stores training session metadata, configs, results, and model paths
 * for ML models trained through the vision training UI.
 */

import { createId } from '@paralleldrive/cuid2'
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import type {
  DatasetInfo,
  EpochData,
  ModelType,
  TrainingConfig,
  TrainingResult,
} from '@/app/vision-training/train/components/wizard/types'

/**
 * Vision training sessions table - stores training history and model references
 */
export const visionTrainingSessions = sqliteTable(
  'vision_training_sessions',
  {
    /** Primary key */
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),

    // ---- Model Identification ----

    /** Model type: 'column-classifier' | 'boundary-detector' */
    modelType: text('model_type').$type<ModelType>().notNull(),

    /** User-friendly display name for this training session */
    displayName: text('display_name').notNull(),

    // ---- Training Configuration ----

    /** Training config used for this session */
    config: text('config', { mode: 'json' }).notNull().$type<TrainingConfig>(),

    /** Dataset info at training time */
    datasetInfo: text('dataset_info', { mode: 'json' }).notNull().$type<DatasetInfo>(),

    // ---- Training Results ----

    /** Final training results */
    result: text('result', { mode: 'json' }).notNull().$type<TrainingResult>(),

    /** Epoch-by-epoch training history */
    epochHistory: text('epoch_history', { mode: 'json' }).notNull().$type<EpochData[]>(),

    // ---- Model Storage ----

    /**
     * Path to model files relative to data/vision-training/models/
     * e.g., "boundary-detector/sessions/2024-01-09_abc123"
     */
    modelPath: text('model_path').notNull(),

    /** Is this the active model for this model type? */
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(false),

    // ---- Organization ----

    /** Optional notes about this training session */
    notes: text('notes'),

    /** Tags for filtering/organization */
    tags: text('tags', { mode: 'json' }).$type<string[]>().default([]),

    // ---- Timestamps ----

    /** When this record was created */
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),

    /** When training was completed */
    trainedAt: integer('trained_at', { mode: 'timestamp' }).notNull(),
  },
  (table) => ({
    /** Index for filtering by model type */
    modelTypeIdx: index('vision_training_sessions_model_type_idx').on(table.modelType),

    /** Index for finding active models */
    isActiveIdx: index('vision_training_sessions_is_active_idx').on(table.isActive),

    /** Index for sorting by creation date */
    createdAtIdx: index('vision_training_sessions_created_at_idx').on(table.createdAt),

    /** Compound index for finding active model by type */
    activeByTypeIdx: index('vision_training_sessions_active_by_type_idx').on(
      table.modelType,
      table.isActive
    ),
  })
)

export type VisionTrainingSession = typeof visionTrainingSessions.$inferSelect
export type NewVisionTrainingSession = typeof visionTrainingSessions.$inferInsert

// ============================================================================
// Helper Types
// ============================================================================

/**
 * Summary view of a training session for list display
 */
export interface VisionTrainingSessionSummary {
  id: string
  modelType: ModelType
  displayName: string
  isActive: boolean
  trainedAt: Date
  // Key metrics extracted from result
  finalAccuracy: number
  finalLoss: number
  epochsTrained: number
  // For boundary detector
  finalPixelError?: number
}

/**
 * Convert a full session to a summary
 */
export function toVisionSessionSummary(
  session: VisionTrainingSession
): VisionTrainingSessionSummary {
  const result = session.result as TrainingResult

  return {
    id: session.id,
    modelType: session.modelType,
    displayName: session.displayName,
    isActive: session.isActive,
    trainedAt: session.trainedAt,
    finalAccuracy: result.final_accuracy,
    finalLoss: result.final_loss,
    epochsTrained: result.epochs_trained,
    finalPixelError: result.type === 'boundary-detector' ? result.final_pixel_error : undefined,
  }
}
