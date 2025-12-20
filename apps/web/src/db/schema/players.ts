import { createId } from '@paralleldrive/cuid2'
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { users } from './users'

/**
 * Help mode for practice sessions
 * - 'auto': Help automatically appears after time thresholds
 * - 'manual': Help only appears when student clicks for it
 * - 'teacher-approved': Student can request help, but teacher must approve
 */
export type HelpMode = 'auto' | 'manual' | 'teacher-approved'

/**
 * Settings that control help behavior during practice sessions
 */
export interface StudentHelpSettings {
  /** How help is triggered */
  helpMode: HelpMode

  /** For 'auto' mode: milliseconds before each help level appears */
  autoEscalationTimingMs: {
    level1: number // Default: 30000 (30s)
    level2: number // Default: 60000 (60s)
    level3: number // Default: 90000 (90s)
  }

  /** For beginners: unlimited L1-L2 help without mastery penalty */
  beginnerFreeHelp: boolean

  /** For advanced: L2+ help requires teacher approval */
  advancedRequiresApproval: boolean
}

/**
 * Default help settings for new students
 */
export const DEFAULT_HELP_SETTINGS: StudentHelpSettings = {
  helpMode: 'auto',
  autoEscalationTimingMs: {
    level1: 30000,
    level2: 60000,
    level3: 90000,
  },
  beginnerFreeHelp: true,
  advancedRequiresApproval: false,
}

/**
 * Players table - user-created player profiles for games
 *
 * Each user can have multiple players (for multi-player modes).
 * Players are scoped to a user and deleted when user is deleted.
 */
export const players = sqliteTable(
  'players',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),

    /** Foreign key to users table - cascades on delete */
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    /** Player display name */
    name: text('name').notNull(),

    /** Player emoji avatar */
    emoji: text('emoji').notNull(),

    /** Player color (hex) for UI theming */
    color: text('color').notNull(),

    /** Whether this player is currently active in games */
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(false),

    /** When this player was created */
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),

    /**
     * Help settings for practice sessions
     * Controls how help is triggered and escalated
     */
    helpSettings: text('help_settings', {
      mode: 'json',
    }).$type<StudentHelpSettings>(),

    /**
     * Teacher notes about this student
     * Free-form text for observations, reminders, etc.
     */
    notes: text('notes'),
  },
  (table) => ({
    /** Index for fast lookups by userId */
    userIdIdx: index('players_user_id_idx').on(table.userId),
  })
)

export type Player = typeof players.$inferSelect
export type NewPlayer = typeof players.$inferInsert
