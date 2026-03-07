import { createId } from '@paralleldrive/cuid2'
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { relations } from 'drizzle-orm'
import type { MomentSnapshot } from './number-line-postcards'

// ── Sessions table — one row per voice call ──

export const numberLineSessions = sqliteTable(
  'number_line_sessions',
  {
    id: text('id').primaryKey(), // cuid generated client-side at call start

    playerId: text('player_id').notNull(),
    callerNumber: integer('caller_number', { mode: 'number' }).notNull(),

    /** Has the post-call LLM cull pass completed? */
    isCulled: integer('is_culled', { mode: 'boolean' }).notNull().default(false),

    /** Background task ID for the cull job */
    cullTaskId: text('cull_task_id'),

    /** LLM-generated 1-2 sentence summary of the call from the number's perspective */
    sessionSummary: text('session_summary'),

    /** Number of moments marked during this session */
    momentCount: integer('moment_count').notNull().default(0),

    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),

    /** Set on hang_up or inferred from last moment + timeout */
    endedAt: integer('ended_at', { mode: 'timestamp' }),
  },
  (table) => ({
    playerCallerIdx: index('nl_sessions_player_caller_idx').on(table.playerId, table.callerNumber),
    isCulledIdx: index('nl_sessions_is_culled_idx').on(table.isCulled),
  })
)

// ── Moments table — individual bookmarked moments ──

export const numberLineMoments = sqliteTable(
  'number_line_moments',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),

    playerId: text('player_id').notNull(),
    callerNumber: integer('caller_number', { mode: 'number' }).notNull(),
    sessionId: text('session_id').notNull(),

    caption: text('caption').notNull(),
    category: text('category').notNull(), // question|discovery|game|exploration|conversation|conference

    /** Agent's in-the-moment significance score (1-10) */
    rawSignificance: integer('raw_significance').notNull(),

    /** LLM post-cull score (1-10), null until culled */
    longTermSignificance: integer('long_term_significance'),

    /** Survives culling? Default true until cull pass runs */
    keep: integer('keep', { mode: 'boolean' }).notNull().default(true),

    /** Viewport state at the moment */
    snapshot: text('snapshot', { mode: 'json' }).$type<MomentSnapshot>(),

    /** 2-4 transcript lines around the moment */
    transcriptExcerpt: text('transcript_excerpt'),

    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    playerCallerIdx: index('nl_moments_player_caller_idx').on(table.playerId, table.callerNumber),
    sessionIdx: index('nl_moments_session_idx').on(table.sessionId),
  })
)

// ── Relations ──

export const numberLineSessionsRelations = relations(numberLineSessions, ({ many }) => ({
  moments: many(numberLineMoments),
}))

export const numberLineMomentsRelations = relations(numberLineMoments, ({ one }) => ({
  session: one(numberLineSessions, {
    fields: [numberLineMoments.sessionId],
    references: [numberLineSessions.id],
  }),
}))

// ── Types ──

export type NumberLineSession = typeof numberLineSessions.$inferSelect
export type NewNumberLineSession = typeof numberLineSessions.$inferInsert
export type NumberLineMoment = typeof numberLineMoments.$inferSelect
export type NewNumberLineMoment = typeof numberLineMoments.$inferInsert

export type MomentCategory =
  | 'question'
  | 'discovery'
  | 'game'
  | 'exploration'
  | 'conversation'
  | 'conference'
