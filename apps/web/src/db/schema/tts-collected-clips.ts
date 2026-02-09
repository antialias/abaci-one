import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

/**
 * Runtime-collected TTS clips.
 *
 * Each row represents a unique (text, tone) pair observed during app usage.
 * The client flushes its in-memory collection here periodically.
 * The admin page reads from this table to decide which clips to generate.
 */
export const ttsCollectedClips = sqliteTable('tts_collected_clips', {
  /** Deterministic key: hash of text+tone */
  id: text('id').primaryKey(),
  /** The text to speak */
  text: text('text').notNull(),
  /** Freeform tone/instruction string */
  tone: text('tone').notNull(),
  /** Cumulative play count */
  playCount: integer('play_count').notNull().default(0),
  /** ISO timestamp of first observation */
  firstSeenAt: text('first_seen_at').notNull(),
  /** ISO timestamp of most recent observation */
  lastSeenAt: text('last_seen_at').notNull(),
})

export type TtsCollectedClip = typeof ttsCollectedClips.$inferSelect
export type NewTtsCollectedClip = typeof ttsCollectedClips.$inferInsert
