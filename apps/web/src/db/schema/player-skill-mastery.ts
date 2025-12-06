import { createId } from '@paralleldrive/cuid2'
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { players } from './players'

/**
 * Mastery level enum values
 * - learning: Just started, fewer than 5 attempts
 * - practicing: 5+ attempts, working toward mastery
 * - mastered: Achieved mastery criteria (consecutive correct + accuracy)
 */
export type MasteryLevel = 'learning' | 'practicing' | 'mastered'

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

    /** Total number of problems where this skill was required */
    attempts: integer('attempts').notNull().default(0),

    /** Number of problems solved correctly */
    correct: integer('correct').notNull().default(0),

    /**
     * Current consecutive correct streak
     * Resets to 0 on any incorrect answer
     * Used for mastery determination
     */
    consecutiveCorrect: integer('consecutive_correct').notNull().default(0),

    /**
     * Current mastery level for this skill
     * - 'learning': < 5 attempts
     * - 'practicing': >= 5 attempts, not yet mastered
     * - 'mastered': >= 10 attempts, >= 5 consecutive correct, >= 85% accuracy
     */
    masteryLevel: text('mastery_level', {
      enum: ['learning', 'practicing', 'mastered'],
    })
      .notNull()
      .default('learning'),

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

/**
 * Mastery configuration constants
 */
export const MASTERY_CONFIG = {
  /** Number of consecutive correct answers required for mastery */
  consecutiveForMastery: 5,

  /** Minimum total attempts before mastery can be achieved */
  minimumAttempts: 10,

  /** Minimum accuracy (correct/attempts) for mastery */
  accuracyThreshold: 0.85,

  /** Minimum attempts to transition from 'learning' to 'practicing' */
  minimumForPracticing: 5,
} as const

/**
 * Calculate the mastery level based on current stats
 */
export function calculateMasteryLevel(
  attempts: number,
  correct: number,
  consecutiveCorrect: number
): MasteryLevel {
  const accuracy = attempts > 0 ? correct / attempts : 0

  if (
    consecutiveCorrect >= MASTERY_CONFIG.consecutiveForMastery &&
    attempts >= MASTERY_CONFIG.minimumAttempts &&
    accuracy >= MASTERY_CONFIG.accuracyThreshold
  ) {
    return 'mastered'
  }

  if (attempts >= MASTERY_CONFIG.minimumForPracticing) {
    return 'practicing'
  }

  return 'learning'
}
