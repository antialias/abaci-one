import { integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core'

/**
 * Runtime-collected TTS clips.
 *
 * Each row represents a unique clip ID observed during app usage.
 * The client flushes its in-memory collection here periodically.
 * The admin page reads from this table to decide which clips to generate.
 */
export const ttsCollectedClips = sqliteTable('tts_collected_clips', {
  /** Human-readable clip ID (e.g. "student-name", "five-plus-three") */
  id: text('id').primaryKey(),
  /** Freeform tone/instruction string for TTS generation */
  tone: text('tone').notNull(),
  /** Cumulative play count */
  playCount: integer('play_count').notNull().default(0),
  /** ISO timestamp of first observation */
  firstSeenAt: text('first_seen_at').notNull(),
  /** ISO timestamp of most recent observation */
  lastSeenAt: text('last_seen_at').notNull(),
})

/**
 * Per-locale fallback text for collected clips.
 *
 * Each row maps a (clipId, locale) pair to the text that should be spoken
 * when the clip mp3 isn't available and the voice chain falls through to
 * browser TTS. Also used as input text for TTS mp3 generation.
 */
export const ttsCollectedClipSay = sqliteTable(
  'tts_collected_clip_say',
  {
    /** References tts_collected_clips.id */
    clipId: text('clip_id').notNull(),
    /** BCP 47 locale tag (e.g. "en-US", "ja") */
    locale: text('locale').notNull(),
    /** The text to speak in this locale */
    text: text('text').notNull(),
  },
  (table) => [primaryKey({ columns: [table.clipId, table.locale] })]
)

export type TtsCollectedClip = typeof ttsCollectedClips.$inferSelect
export type NewTtsCollectedClip = typeof ttsCollectedClips.$inferInsert
export type TtsCollectedClipSay = typeof ttsCollectedClipSay.$inferSelect
export type NewTtsCollectedClipSay = typeof ttsCollectedClipSay.$inferInsert
