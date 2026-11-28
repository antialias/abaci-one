import { createId } from '@paralleldrive/cuid2'
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { players } from './players'
import { sessionPlans } from './session-plans'

/**
 * Practice glitches (practice-kinds plan of record §8 A23.3, K5a-3c): one row
 * per way a try's round trip went wrong that the screen told the kid about
 * (a corrected verdict, a stale screen, a refused do-over, a rejected save, a
 * try lost at the end) or that the outbox noticed (a delayed save, one row
 * per outage episode).
 *
 * A row is a display-bug report, never a second opinion on an answer: the
 * stored try's verdict is the only one (A1, A11). It names the student by id
 * only, and lives and dies with its session (cascade; no TTL). The reference
 * is minted in the browser (`GL-` + 4 characters) and is unique per session,
 * not globally: the lookup by reference returns every match.
 */
export const practiceGlitches = sqliteTable(
  'practice_glitches',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),

    /** `GL-XXXX`, as the browser minted it */
    ref: text('ref').notNull(),

    sessionPlanId: text('session_plan_id')
      .notNull()
      .references(() => sessionPlans.id, { onDelete: 'cascade' }),

    playerId: text('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),

    /** One of `GLITCH_KINDS` (`lib/curriculum/glitches.ts`); the route refuses any other */
    kind: text('kind').notNull(),

    /** The kind's whitelisted detail (≤ 4 KB as JSON) */
    detail: text('detail', { mode: 'json' }).$type<Record<string, unknown>>().notNull(),

    /** The bundle's build (`lib/build-id.ts`), as the client sent it */
    clientBuild: text('client_build'),

    /** The server's build, stamped by the route */
    serverBuild: text('server_build'),

    /** The request's User-Agent, cut at 256 */
    userAgent: text('user_agent'),

    /** The browser's clock when the glitch happened (epoch ms) */
    clientAt: integer('client_at').notNull(),

    /** The server's clock on store (epoch ms) */
    createdAt: integer('created_at').notNull(),
  },
  (table) => ({
    sessionRefIdx: uniqueIndex('practice_glitches_session_ref_idx').on(
      table.sessionPlanId,
      table.ref
    ),
    refIdx: index('practice_glitches_ref_idx').on(table.ref),
    createdAtIdx: index('practice_glitches_created_at_idx').on(table.createdAt),
  })
)

export type PracticeGlitch = typeof practiceGlitches.$inferSelect
export type NewPracticeGlitch = typeof practiceGlitches.$inferInsert
