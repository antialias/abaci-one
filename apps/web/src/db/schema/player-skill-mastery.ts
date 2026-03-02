import { createId } from '@paralleldrive/cuid2'
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { players } from './players'

// ============================================================================
// Practice Level Types & Helpers
// ============================================================================

/**
 * Practice level for a skill:
 * - 'none': Skill is inactive (not in practice rotation)
 * - 'abacus': Skill appears in "Use Abacus" parts only
 * - 'visual': Skill appears in all parts (abacus + visualization + linear)
 *
 * Progression: none → abacus → visual
 */
export type PracticeLevel = 'none' | 'abacus' | 'visual'

/** Check if a skill is active at any level (not 'none') */
export function isActive(level: PracticeLevel): boolean {
  return level !== 'none'
}

/** Check if a skill is ready for visualization/linear parts */
export function isVisualReady(level: PracticeLevel): boolean {
  return level === 'visual'
}

/** Cycle to the next practice level: none → abacus → visual → none */
export function nextPracticeLevel(level: PracticeLevel): PracticeLevel {
  switch (level) {
    case 'none':
      return 'abacus'
    case 'abacus':
      return 'visual'
    case 'visual':
      return 'none'
  }
}

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
     * @deprecated Use practiceLevel instead. Kept in DB for migration safety.
     * Whether this skill is in the student's active practice rotation.
     */
    isPracticing: integer('is_practicing', { mode: 'boolean' }).notNull().default(false),

    /**
     * Practice level controlling which session parts this skill appears in:
     * - 'none': Skill is inactive
     * - 'abacus': Skill appears in abacus parts only
     * - 'visual': Skill appears in all parts (abacus + visualization + linear)
     *
     * Set by teacher via ManualSkillSelector 3-state toggle.
     * Mastery is tracked via BKT (Bayesian Knowledge Tracing) using session history.
     */
    practiceLevel: text('practice_level').$type<PracticeLevel>().notNull().default('none'),

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
     * Whether help was used the last time this skill was practiced
     */
    lastHadHelp: integer('last_had_help', { mode: 'boolean' }).notNull().default(false),
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
