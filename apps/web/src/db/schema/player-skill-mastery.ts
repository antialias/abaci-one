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

    // ---- Reinforcement Tracking (for help system feedback loop) ----

    /**
     * Whether this skill needs reinforcement
     * Set to true when student uses heavy help (level 2+) or has multiple incorrect attempts
     * Cleared after N consecutive correct answers without help
     */
    needsReinforcement: integer('needs_reinforcement', { mode: 'boolean' })
      .notNull()
      .default(false),

    /**
     * Last help level used on this skill (0-3)
     * Used to track struggling patterns
     */
    lastHelpLevel: integer('last_help_level').notNull().default(0),

    /**
     * Consecutive correct answers without heavy help since reinforcement was flagged
     * Resets to 0 when reinforcement is cleared or when help level 2+ is used
     */
    reinforcementStreak: integer('reinforcement_streak').notNull().default(0),

    // ---- Response Time Tracking (for skill-level performance analysis) ----

    /**
     * Total response time in milliseconds across all attempts
     * Used with responseTimeCount to calculate average: totalResponseTimeMs / responseTimeCount
     */
    totalResponseTimeMs: integer('total_response_time_ms').notNull().default(0),

    /**
     * Number of attempts with recorded response times
     * May differ from `attempts` if some early data didn't track time
     */
    responseTimeCount: integer('response_time_count').notNull().default(0),
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
 * Reinforcement configuration constants
 */
export const REINFORCEMENT_CONFIG = {
  /**
   * Help level threshold that triggers reinforcement flag
   * Level 2+ (decomposition or bead arrows) indicates the student needed significant help
   */
  helpLevelThreshold: 2,

  /**
   * Number of consecutive correct answers without heavy help to clear reinforcement
   */
  streakToClear: 3,

  /**
   * Maximum help level that still counts toward clearing reinforcement
   * Level 1 (hints) is OK, but Level 2+ resets the streak
   */
  maxHelpLevelToCount: 1,

  /**
   * Mastery credit multipliers based on help level
   * Used when updating skill mastery after a correct answer
   */
  creditMultipliers: {
    0: 1.0, // No help: full credit
    1: 1.0, // Hint only: full credit
    2: 0.5, // Decomposition: half credit
    3: 0.25, // Bead arrows: quarter credit
  } as Record<0 | 1 | 2 | 3, number>,
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
