import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { players } from './players'
import {
  DEFAULT_PROBLEM_GENERATION_MODE,
  type ProblemGenerationMode,
} from '@/lib/curriculum/config'

/**
 * Player curriculum table - tracks a player's position in the soroban curriculum
 *
 * One-to-one with players table. Stores the student's current level,
 * phase, and learning preferences. Deleted when player is deleted (cascade).
 */
export const playerCurriculum = sqliteTable('player_curriculum', {
  /** Primary key and foreign key to players table */
  playerId: text('player_id')
    .primaryKey()
    .references(() => players.id, { onDelete: 'cascade' }),

  /**
   * Current curriculum level (1, 2, or 3)
   * - Level 1: No regrouping (single column operations)
   * - Level 2: Addition with regrouping (friends of 10)
   * - Level 3: Subtraction with regrouping (friends of 10)
   */
  currentLevel: integer('current_level').notNull().default(1),

  /**
   * Current phase ID within the level
   * Format: "L{level}.{operation}.{number}.{technique}"
   * Examples:
   * - "L1.add.+3.direct" = Level 1, adding 3, without friends of 5
   * - "L1.add.+3.five" = Level 1, adding 3, with friends of 5
   * - "L2.add.+7.ten" = Level 2, adding 7, with friends of 10
   * - "L3.sub.-6.ten" = Level 3, subtracting 6, with friends of 10
   */
  currentPhaseId: text('current_phase_id').notNull().default('L1.add.+1.direct'),

  /**
   * Worksheet preset ID for generating worksheets at this student's level
   * Maps to a saved worksheet configuration
   */
  worksheetPreset: text('worksheet_preset'),

  /**
   * Whether visualization mode is enabled (practice without visible abacus)
   * This is the "mental math" mode for developing anzan skills
   */
  visualizationMode: integer('visualization_mode', { mode: 'boolean' }).notNull().default(false),

  /**
   * Problem generation mode preference:
   * - 'adaptive': BKT-based continuous scaling (recommended, default)
   * - 'classic': Fluency-based discrete states
   */
  problemGenerationMode: text('problem_generation_mode')
    .$type<ProblemGenerationMode>()
    .notNull()
    .default(DEFAULT_PROBLEM_GENERATION_MODE),

  /** When this record was created */
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),

  /** When this record was last updated */
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
})

export type PlayerCurriculum = typeof playerCurriculum.$inferSelect
export type NewPlayerCurriculum = typeof playerCurriculum.$inferInsert
