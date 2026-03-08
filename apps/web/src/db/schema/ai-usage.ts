import { createId } from '@paralleldrive/cuid2'
import { integer, real, sqliteTable, text, index } from 'drizzle-orm/sqlite-core'

/**
 * AI usage tracking table — records every external AI/ML API call with
 * the user who triggered it, the provider, model, and cost-relevant metrics.
 *
 * Raw metrics only — no dollar amounts stored. A reporting layer applies
 * current prices at query time.
 */
export const aiUsage = sqliteTable(
  'ai_usage',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),

    /** User who triggered the usage */
    userId: text('user_id').notNull(),

    /** Feature that caused the usage — typed by AiFeature const */
    feature: text('feature').notNull(),

    /** AI provider: 'openai' | 'anthropic' | 'gemini' | 'elevenlabs' */
    provider: text('provider').notNull(),

    /** Model used: 'gpt-5.2', 'gpt-4o-mini', 'gpt-image-1', etc. */
    model: text('model').notNull(),

    /**
     * API type for grouping:
     * 'chat_completions' | 'responses' | 'responses_streaming' |
     * 'realtime' | 'tts' | 'image' | 'embedding' | 'music'
     */
    apiType: text('api_type').notNull(),

    // --- Token metrics (null when not applicable) ---
    inputTokens: integer('input_tokens'),
    outputTokens: integer('output_tokens'),
    reasoningTokens: integer('reasoning_tokens'),

    // --- Audio metrics ---
    /** Audio input duration (e.g. user speaking in realtime session) */
    audioInputSeconds: real('audio_input_seconds'),
    /** Audio output duration (e.g. model speaking in realtime session) */
    audioOutputSeconds: real('audio_output_seconds'),

    // --- Image metrics ---
    imageCount: integer('image_count'),

    // --- Text metrics (for TTS input) ---
    inputCharacters: integer('input_characters'),

    // --- Music/general audio duration ---
    audioDurationSeconds: real('audio_duration_seconds'),

    // --- Optional link to background task ---
    backgroundTaskId: text('background_task_id'),

    // --- Freeform metadata (size, quality, voice session state, etc.) ---
    metadata: text('metadata', { mode: 'json' }),

    /** When this record was created */
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    userIdx: index('ai_usage_user_idx').on(table.userId),
    featureIdx: index('ai_usage_feature_idx').on(table.feature),
    createdAtIdx: index('ai_usage_created_at_idx').on(table.createdAt),
    userFeatureIdx: index('ai_usage_user_feature_idx').on(table.userId, table.feature),
  })
)

export type AiUsageRecord = typeof aiUsage.$inferSelect
export type NewAiUsageRecord = typeof aiUsage.$inferInsert
