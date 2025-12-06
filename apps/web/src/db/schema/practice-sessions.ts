import { createId } from '@paralleldrive/cuid2'
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { players } from './players'

/**
 * Practice sessions table - historical record of practice activity
 *
 * Each row represents a single practice session for a player.
 * Used for analytics, progress tracking, and displaying practice history.
 */
export const practiceSessions = sqliteTable(
  'practice_sessions',
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
     * Curriculum phase ID that was practiced
     * Format: "L{level}.{operation}.{number}.{technique}"
     * Example: "L1.add.+3.five"
     */
    phaseId: text('phase_id').notNull(),

    /** Number of problems attempted in this session */
    problemsAttempted: integer('problems_attempted').notNull().default(0),

    /** Number of problems solved correctly */
    problemsCorrect: integer('problems_correct').notNull().default(0),

    /** Average time per problem in milliseconds */
    averageTimeMs: integer('average_time_ms'),

    /** Total session duration in milliseconds */
    totalTimeMs: integer('total_time_ms'),

    /**
     * Skills exercised during this session (JSON array)
     * Example: ["fiveComplements.4=5-1", "basic.heavenBead"]
     */
    skillsUsed: text('skills_used', { mode: 'json' }).notNull().default('[]').$type<string[]>(),

    /**
     * Whether visualization mode was enabled (no abacus visible)
     */
    visualizationMode: integer('visualization_mode', { mode: 'boolean' }).notNull().default(false),

    /** When this session started */
    startedAt: integer('started_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),

    /** When this session was completed (null if abandoned) */
    completedAt: integer('completed_at', { mode: 'timestamp' }),
  },
  (table) => ({
    /** Index for fast lookups by playerId */
    playerIdIdx: index('practice_sessions_player_id_idx').on(table.playerId),

    /** Index for queries filtering by date */
    startedAtIdx: index('practice_sessions_started_at_idx').on(table.startedAt),

    /** Composite index for player + phase queries */
    playerPhaseIdx: index('practice_sessions_player_phase_idx').on(table.playerId, table.phaseId),
  })
)

export type PracticeSession = typeof practiceSessions.$inferSelect
export type NewPracticeSession = typeof practiceSessions.$inferInsert

/**
 * Helper to calculate accuracy from a session
 */
export function getSessionAccuracy(session: PracticeSession): number {
  if (session.problemsAttempted === 0) return 0
  return session.problemsCorrect / session.problemsAttempted
}

/**
 * Session summary for display
 */
export interface PracticeSessionSummary {
  id: string
  phaseId: string
  problemsAttempted: number
  problemsCorrect: number
  accuracy: number
  averageTimeMs: number | null
  totalTimeMs: number | null
  visualizationMode: boolean
  startedAt: Date
  completedAt: Date | null
}

/**
 * Convert a session to a summary
 */
export function toSessionSummary(session: PracticeSession): PracticeSessionSummary {
  return {
    id: session.id,
    phaseId: session.phaseId,
    problemsAttempted: session.problemsAttempted,
    problemsCorrect: session.problemsCorrect,
    accuracy: getSessionAccuracy(session),
    averageTimeMs: session.averageTimeMs,
    totalTimeMs: session.totalTimeMs,
    visualizationMode: session.visualizationMode,
    startedAt: session.startedAt,
    completedAt: session.completedAt,
  }
}
