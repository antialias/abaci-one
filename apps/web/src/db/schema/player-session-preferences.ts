import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { players } from './players'

/**
 * Configuration stored in the player_session_preferences JSON config column.
 * These are the settings that persist between StartPracticeModal opens.
 */
export interface PlayerSessionPreferencesConfig {
  durationMinutes: number
  problemLengthPreference: 'shorter' | 'recommended' | 'longer'
  partWeights: { abacus: number; visualization: number; linear: number }
  purposeWeights: { focus: number; reinforce: number; review: number; challenge: number }
  shufflePurposes: boolean
  gameBreakEnabled: boolean
  gameBreakMinutes: number
  gameBreakSelectionMode: string
  gameBreakSelectedGame: string | null
  gameBreakDifficultyPreset: string | null
  gameBreakEnabledGames?: string[]
  /** Optional narration level for kid-facing explanations. */
  kidLanguageStyle?: KidLanguageStyle
  /** Whether celebration songs are enabled for this student. Defaults to true when feature flag is on. */
  sessionSongEnabled?: boolean
  /** Preferred genre for celebration songs. 'any' rotates genres. */
  sessionSongGenre?: SessionSongGenre
}

export type KidLanguageStyle = 'simple' | 'standard' | 'classical'

/**
 * Song genre preference — any string is valid (custom genres supported).
 * Preset IDs are convenience values shown in the UI picker.
 */
export type SessionSongGenre = string

export const SESSION_SONG_GENRES: { id: string; label: string }[] = [
  { id: 'any', label: 'Any (rotate)' },
  // Pop / Electronic
  { id: 'pop', label: 'Pop' },
  { id: 'disco', label: 'Disco' },
  { id: 'edm', label: 'EDM' },
  { id: 'chiptune', label: '8-Bit' },
  // Soul / Groove
  { id: 'funk', label: 'Funk' },
  { id: 'hip-hop', label: 'Hip-Hop' },
  { id: 'reggae', label: 'Reggae' },
  { id: 'jazz', label: 'Jazz' },
  // World / Latin
  { id: 'afrobeat', label: 'Afrobeat' },
  { id: 'salsa', label: 'Salsa' },
  { id: 'bossa-nova', label: 'Bossa Nova' },
  { id: 'bollywood', label: 'Bollywood' },
  // Rock / Acoustic
  { id: 'rock', label: 'Rock' },
  { id: 'folk', label: 'Folk' },
  { id: 'country', label: 'Country' },
  // Fun / Theatrical
  { id: 'musical-theater', label: 'Broadway' },
  { id: 'marching-band', label: 'Marching Band' },
  { id: 'electro-swing', label: 'Electro Swing' },
]

export const DEFAULT_SESSION_PREFERENCES: PlayerSessionPreferencesConfig = {
  durationMinutes: 10,
  problemLengthPreference: 'recommended',
  partWeights: { abacus: 2, visualization: 1, linear: 0 },
  purposeWeights: { focus: 3, reinforce: 1, review: 1, challenge: 1 },
  shufflePurposes: true,
  gameBreakEnabled: true,
  gameBreakMinutes: 5,
  gameBreakSelectionMode: 'kid-chooses',
  gameBreakSelectedGame: null,
  gameBreakDifficultyPreset: 'medium',
  gameBreakEnabledGames: [],
}

/**
 * Player session preferences table - persists StartPracticeModal settings per student
 *
 * One row per player. Config is a JSON blob containing all persisted settings.
 * Cascade-deletes when the player is deleted.
 */
export const playerSessionPreferences = sqliteTable('player_session_preferences', {
  /** Player ID (primary key, FK → players) */
  playerId: text('player_id')
    .primaryKey()
    .references(() => players.id, { onDelete: 'cascade' }),

  /** JSON blob containing session preferences */
  config: text('config').notNull(),

  /** Timestamp of last update (unix ms) */
  updatedAt: integer('updated_at').notNull(),
})

export type PlayerSessionPreferences = typeof playerSessionPreferences.$inferSelect
export type NewPlayerSessionPreferences = typeof playerSessionPreferences.$inferInsert
