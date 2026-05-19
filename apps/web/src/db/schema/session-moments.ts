import { createId } from '@paralleldrive/cuid2'
import { relations } from 'drizzle-orm'
import { index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { players } from './players'
import { sessionPlans } from './session-plans'

// ============================================================================
// Session Moments table
// ============================================================================

/**
 * Notable moments derived from a practice session, persisted with stable
 * short IDs so other systems (lyric LLM, song scene stage, future postcards)
 * can reference them by string handle.
 *
 * Moments are DERIVED, not captured live. At song-generation time we walk
 * the session plan + game results and emit moment rows for the most notable
 * events (toughest problem, comeback, game break outcome, etc.). Snapshots
 * are type-discriminated by the `type` column and each scene component in
 * the player's SceneRegistry consumes one specific snapshot shape.
 */
export const sessionMoments = sqliteTable(
  'session_moments',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),

    /** Session this moment belongs to. */
    sessionPlanId: text('session_plan_id')
      .notNull()
      .references(() => sessionPlans.id, { onDelete: 'cascade' }),

    /** Player who lived this moment. */
    playerId: text('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),

    /**
     * Short, stable, LLM-friendly identifier (e.g. `m_p1q3`, `m_break-matching`).
     * Unique per session — used in `llmOutput.plan.sections[].momentRefs` so
     * the lyric writer can attach lines to specific moments.
     */
    shortId: text('short_id').notNull(),

    /**
     * Discriminator — maps to a component in the SceneRegistry.
     * Known values: 'abacus-problem' | 'game-break'.
     * Future: 'number-line' | 'streak' | 'comeback' etc.
     */
    type: text('type').notNull(),

    /** Notability score used to rank/cull the catalog (higher = more notable). */
    significance: real('significance').notNull().default(0),

    /** Position within the session (ms since session start), best-effort. */
    timestampMs: integer('timestamp_ms').notNull().default(0),

    /** One-line human/LLM-readable description; rendered as a fallback caption. */
    summary: text('summary').notNull(),

    /**
     * Type-discriminated snapshot. JSON shape depends on `type`:
     *   abacus-problem: { problemIndex, terms[], answer, ... }
     *   game-break:     { gameName, headline, accuracy, ... }
     * See `lib/session-moments/types.ts` for canonical shapes.
     */
    snapshot: text('snapshot', { mode: 'json' }).notNull(),

    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    sessionPlanIdx: index('session_moments_session_plan_id_idx').on(table.sessionPlanId),
    playerIdx: index('session_moments_player_id_idx').on(table.playerId),
    typeIdx: index('session_moments_type_idx').on(table.type),
    sessionShortIdIdx: uniqueIndex('session_moments_session_short_id_uidx').on(
      table.sessionPlanId,
      table.shortId
    ),
  })
)

// ============================================================================
// Relations
// ============================================================================

export const sessionMomentsRelations = relations(sessionMoments, ({ one }) => ({
  sessionPlan: one(sessionPlans, {
    fields: [sessionMoments.sessionPlanId],
    references: [sessionPlans.id],
  }),
  player: one(players, {
    fields: [sessionMoments.playerId],
    references: [players.id],
  }),
}))

// ============================================================================
// Types
// ============================================================================

export type SessionMoment = typeof sessionMoments.$inferSelect
export type NewSessionMoment = typeof sessionMoments.$inferInsert

/** Known moment types. Adding a new one needs a matching SceneRegistry entry. */
export type SessionMomentType = 'abacus-problem' | 'game-break'
