import { createId } from '@paralleldrive/cuid2'
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
// Import tunable constants from centralized config
import { FLUENCY_RECENCY, FLUENCY_THRESHOLDS } from '@/lib/curriculum/config'
import { players } from './players'

/**
 * Fluency state - computed from practice history, NOT stored in database
 * - practicing: isPracticing=true but hasn't achieved fluency criteria yet
 * - effortless: fluent + practiced within 14 days
 * - fluent: high accuracy (85%+), 5+ consecutive correct, practiced within 30 days
 * - rusty: was fluent but >30 days since practice
 */
export type FluencyState = 'practicing' | 'effortless' | 'fluent' | 'rusty'

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
     * Whether this skill is in the student's active practice rotation.
     * Set by teacher via ManualSkillSelector checkbox.
     * Fluency state (effortless/fluent/rusty/practicing) is computed from
     * attempts, correct, consecutiveCorrect, and lastPracticedAt.
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
 * Fluency configuration constants
 * Used to determine if a student has achieved fluency in a skill
 *
 * Composed from centralized config values.
 * See @/lib/curriculum/config/fluency-thresholds.ts for tuning.
 */
export const FLUENCY_CONFIG = {
  ...FLUENCY_THRESHOLDS,
  ...FLUENCY_RECENCY,
} as const

/**
 * Check if a student has achieved fluency in a skill based on their practice history.
 * Fluency = high accuracy + consistent performance (consecutive correct answers)
 */
export function hasFluency(attempts: number, correct: number, consecutiveCorrect: number): boolean {
  const accuracy = attempts > 0 ? correct / attempts : 0
  return (
    consecutiveCorrect >= FLUENCY_CONFIG.consecutiveForFluency &&
    attempts >= FLUENCY_CONFIG.minimumAttempts &&
    accuracy >= FLUENCY_CONFIG.accuracyThreshold
  )
}

/**
 * Calculate the fluency state for a skill based on practice history and recency.
 * Only call this for skills where isPracticing=true.
 *
 * @param attempts - Total number of attempts
 * @param correct - Number of correct answers
 * @param consecutiveCorrect - Current consecutive correct streak
 * @param daysSinceLastPractice - Days since lastPracticedAt (undefined if never practiced)
 * @returns FluencyState: 'practicing' | 'effortless' | 'fluent' | 'rusty'
 */
export function calculateFluencyState(
  attempts: number,
  correct: number,
  consecutiveCorrect: number,
  daysSinceLastPractice?: number
): FluencyState {
  // Not yet fluent - still practicing
  if (!hasFluency(attempts, correct, consecutiveCorrect)) {
    return 'practicing'
  }

  // Fluent - now check recency
  if (daysSinceLastPractice === undefined) {
    return 'fluent' // Never practiced = assume fluent (teacher marked it)
  }

  if (daysSinceLastPractice <= FLUENCY_CONFIG.effortlessDays) {
    return 'effortless'
  }

  if (daysSinceLastPractice <= FLUENCY_CONFIG.fluentDays) {
    return 'fluent'
  }

  return 'rusty'
}
