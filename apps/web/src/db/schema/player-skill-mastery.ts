import { createId } from '@paralleldrive/cuid2'
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { players } from './players'

/**
 * Player skill mastery table - tracks per-skill progress for each player
 *
 * Each row represents a player's progress with a specific abacus skill.
 * Skills are identified by their path (e.g., "fiveComplements.4=5-1").
 */
export const playerSkillMastery = sqliteTable(
  'player_skill_mastery',
  {
    /** Primary key */
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),

    /** Foreign key to players table */
    playerId: text('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),

    /**
     * Skill identifier - matches the skill paths from SkillSet type
     * Examples:
     * - "basic.directAddition"
     * - "fiveComplements.4=5-1"
     * - "tenComplements.9=10-1"
     * - "fiveComplementsSub.-4=-5+1"
     * - "tenComplementsSub.-9=+1-10"
     */
    skillId: text('skill_id').notNull(),

    // NOTE: attempts, correct, consecutiveCorrect columns REMOVED
    // These are now computed on-the-fly from session results (single source of truth)
    // See: getRecentSessionResults() in session-planner.ts

    /**
     * Whether this skill is in the student's active practice rotation.
     * Set by teacher via ManualSkillSelector checkbox.
     * Mastery is tracked via BKT (Bayesian Knowledge Tracing) using session history.
     */
    isPracticing: integer('is_practicing', { mode: 'boolean' }).notNull().default(false),

    /** When this skill was last practiced */
    lastPracticedAt: integer('last_practiced_at', { mode: 'timestamp' }),

    /** When this record was created */
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),

    /** When this record was last updated */
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),

    /**
     * Last help level used on this skill (0 = no help, 1 = used help)
     */
    lastHelpLevel: integer('last_help_level').notNull().default(0),
  },
  (table) => ({
    /** Index for fast lookups by playerId */
    playerIdIdx: index('player_skill_mastery_player_id_idx').on(table.playerId),

    /** Unique constraint: one record per player per skill */
    playerSkillUnique: uniqueIndex('player_skill_mastery_player_skill_unique').on(
      table.playerId,
      table.skillId
    ),
  })
)

export type PlayerSkillMastery = typeof playerSkillMastery.$inferSelect
export type NewPlayerSkillMastery = typeof playerSkillMastery.$inferInsert
