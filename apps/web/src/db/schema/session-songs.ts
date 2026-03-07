import { createId } from '@paralleldrive/cuid2'
import { index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { relations } from 'drizzle-orm'
import { sessionPlans } from './session-plans'
import { players } from './players'
import { backgroundTasks } from './background-tasks'

// ============================================================================
// Session Songs table
// ============================================================================

/**
 * Session songs table - stores AI-generated celebration songs for practice sessions.
 *
 * Songs are generated via ElevenLabs Music API with lyrics crafted by LLM based
 * on session performance data. Generation is triggered mid-session so the song
 * is ready when the kid finishes.
 */
export const sessionSongs = sqliteTable(
  'session_songs',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),

    /** The session plan this song celebrates */
    sessionPlanId: text('session_plan_id')
      .notNull()
      .references(() => sessionPlans.id, { onDelete: 'cascade' }),

    /** The player who earned this song */
    playerId: text('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),

    /**
     * Song generation status:
     * - pending: record created, awaiting processing
     * - prompt_generating: LLM is generating lyrics/style
     * - generating: ElevenLabs is generating the music
     * - completed: MP3 saved locally, ready to play
     * - failed: generation failed at some step
     */
    status: text('status').notNull().default('pending'),

    /** @deprecated Previously used for Suno task tracking */
    sunoTaskId: text('suno_task_id'),

    /** JSON: session stats fed to LLM for prompt generation */
    promptInput: text('prompt_input', { mode: 'json' }),

    /** JSON: { lyrics, style, title } output from LLM */
    llmOutput: text('llm_output', { mode: 'json' }),

    /** @deprecated Previously used for Suno CDN URL */
    audioUrl: text('audio_url'),

    /** Local file path: data/audio/songs/{id}.mp3 */
    localFilePath: text('local_file_path'),

    /** Song duration in seconds */
    durationSeconds: real('duration_seconds'),

    /** Error message if generation failed */
    errorMessage: text('error_message'),

    /** FK to background_tasks.id for progress tracking */
    backgroundTaskId: text('background_task_id').references(() => backgroundTasks.id),

    /** How the song generation was triggered */
    triggerSource: text('trigger_source'), // 'smart_trigger' | 'completion_fallback'

    /** When the song record was created */
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),

    /** @deprecated Previously used for Suno submission time */
    submittedAt: integer('submitted_at', { mode: 'timestamp' }),

    /** When the song was fully downloaded and ready */
    completedAt: integer('completed_at', { mode: 'timestamp' }),
  },
  (table) => ({
    sessionPlanIdx: index('session_songs_session_plan_id_idx').on(table.sessionPlanId),
    playerIdx: index('session_songs_player_id_idx').on(table.playerId),
    statusIdx: index('session_songs_status_idx').on(table.status),
  })
)

// ============================================================================
// Relations
// ============================================================================

export const sessionSongsRelations = relations(sessionSongs, ({ one }) => ({
  sessionPlan: one(sessionPlans, {
    fields: [sessionSongs.sessionPlanId],
    references: [sessionPlans.id],
  }),
  player: one(players, {
    fields: [sessionSongs.playerId],
    references: [players.id],
  }),
  backgroundTask: one(backgroundTasks, {
    fields: [sessionSongs.backgroundTaskId],
    references: [backgroundTasks.id],
  }),
}))

// ============================================================================
// Types
// ============================================================================

export type SessionSong = typeof sessionSongs.$inferSelect
export type NewSessionSong = typeof sessionSongs.$inferInsert

export type SessionSongStatus =
  | 'pending'
  | 'prompt_generating'
  | 'generating'
  | 'completed'
  | 'failed'

export type SessionSongTriggerSource = 'smart_trigger' | 'completion_fallback'

export interface SessionSongLLMOutput {
  title: string
  plan: {
    positive_global_styles: string[]
    negative_global_styles: string[]
    sections: Array<{
      section_name: string
      positive_local_styles: string[]
      negative_local_styles: string[]
      duration_ms: number
      lines: string[]
    }>
  }
}
