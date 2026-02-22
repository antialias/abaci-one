import { createId } from '@paralleldrive/cuid2'
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { users } from './users'

/**
 * Help mode for practice sessions
 * - 'auto': Help automatically appears after timeout
 * - 'manual': Help only appears when student clicks for it
 * - 'teacher-approved': Student can request help, but teacher must approve
 */
export type HelpMode = 'auto' | 'manual' | 'teacher-approved'

/**
 * Settings that control help behavior during practice sessions
 *
 * Note: Help is now boolean (used or not used). BKT uses 0.5x evidence weight
 * for problems where help was used.
 */
export interface StudentHelpSettings {
  /** How help is triggered */
  helpMode: HelpMode

  /** For beginners: help doesn't count against mastery */
  beginnerFreeHelp: boolean

  /** For advanced students: help requires teacher approval */
  advancedRequiresApproval: boolean
}

/**
 * Default help settings for new students
 */
export const DEFAULT_HELP_SETTINGS: StudentHelpSettings = {
  helpMode: 'auto',
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

    /**
     * Whether this student is archived (hidden from default view)
     * Archived students are not deleted but don't appear in normal lists
     */
    isArchived: integer('is_archived', { mode: 'boolean' }).notNull().default(false),

    /**
     * Whether this player is a practice student (appears in practice system).
     * Arcade-only players have this set to false — they don't count toward
     * the practice student limit and don't appear in the practice UI.
     */
    isPracticeStudent: integer('is_practice_student', { mode: 'boolean' }).notNull().default(true),

    /**
     * Child's age in years (optional, set by parent/teacher)
     * Used to adapt voice agent conversations to appropriate level
     */
    age: integer('age'),

    /**
     * Family code for sharing access to this player with other parents
     * Format: FAM-XXXXXX (6 alphanumeric chars)
     */
    familyCode: text('family_code').unique(),

    /**
     * When the current family code was generated.
     * Codes expire after 7 days — expired codes are rejected at link time.
     */
    familyCodeGeneratedAt: integer('family_code_generated_at', { mode: 'timestamp' }),
  },
  (table) => ({
    /** Index for fast lookups by userId */
    userIdIdx: index('players_user_id_idx').on(table.userId),
  })
)

export type Player = typeof players.$inferSelect
export type NewPlayer = typeof players.$inferInsert

/**
 * Generate a unique family code for sharing player access with other parents
 * Format: FAM-XXXXXX (6 alphanumeric characters, no confusing chars like 0/O, 1/I)
 */
export function generateFamilyCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = 'FAM-'
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}
