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
   * Clips are stored at data/audio/{voice}/{filename}.
   */
  audioVoice: text('audio_voice').notNull().default('nova'),

  /**
   * Voice chain configuration (JSON-encoded).
   *
   * An ordered array of VoiceSource objects defining the fallback chain
   * for audio playback. Each entry is either:
   *   { type: 'pregenerated', name: '<voice>' }
   *   { type: 'browser-tts' }
   */
  voiceChain: text('voice_chain').default(
    JSON.stringify([{ type: 'pregenerated', name: 'nova' }, { type: 'browser-tts' }])
  ),

  /**
   * Term count scaling configuration (JSON-encoded).
   *
   * Controls how many terms per problem a student gets based on comfort level.
   * When null, uses hardcoded defaults from DEFAULT_TERM_COUNT_SCALING.
   * When set, contains a TermCountScalingConfig JSON object with per-mode
   * floor/ceiling ranges.
   */
  termCountScaling: text('term_count_scaling'),

  /**
   * Pricing configuration (JSON-encoded).
   *
   * Stores active Stripe price IDs and amounts for each billing interval.
   * When null, falls back to STRIPE_FAMILY_MONTHLY_PRICE_ID / STRIPE_FAMILY_ANNUAL_PRICE_ID env vars.
   * When set, contains a PricingConfig JSON object with family plan pricing.
   *
   * Shape: { family: { monthly: { amount, priceId }, annual: { amount, priceId } } }
   */
  pricing: text('pricing'),
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
  voiceChain: JSON.stringify([{ type: 'pregenerated', name: 'nova' }, { type: 'browser-tts' }]),
  termCountScaling: null,
  pricing: null,
}

/**
 * Shape of the pricing JSON stored in app_settings.pricing
 */
export interface PricingConfig {
  family: {
    monthly: { amount: number; priceId: string }
    annual: { amount: number; priceId: string }
  }
}
