import { real, sqliteTable, text } from 'drizzle-orm/sqlite-core'

/**
 * App-wide settings table
 *
 * Singleton table with a fixed key for global application configuration.
 * These settings affect all users/students in the app.
 */
export const appSettings = sqliteTable('app_settings', {
  /**
   * Setting ID - use 'default' for the singleton row
   */
  id: text('id').primaryKey().default('default'),

  /**
   * BKT confidence threshold for skill classification.
   *
   * Controls when BKT estimates are trusted:
   * - Lower values (0.3) = more aggressive, ~7 attempts needed
   * - Higher values (0.5) = more conservative, ~14 attempts needed
   *
   * Skills with confidence below this threshold are classified as 'learning'
   * regardless of their pKnown value.
   */
  bktConfidenceThreshold: real('bkt_confidence_threshold').notNull().default(0.3),

  /**
   * Active TTS voice for audio help.
   *
   * Matches an OpenAI TTS voice name (e.g. 'nova', 'shimmer', 'alloy').
   * Clips are stored at public/audio/{voice}/{filename}.
   */
  audioVoice: text('audio_voice').notNull().default('nova'),
})

export type AppSettings = typeof appSettings.$inferSelect
export type NewAppSettings = typeof appSettings.$inferInsert

/**
 * Default app settings values
 */
export const DEFAULT_APP_SETTINGS: AppSettings = {
  id: 'default',
  bktConfidenceThreshold: 0.3,
  audioVoice: 'nova',
}
