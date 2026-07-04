import { createId } from '@paralleldrive/cuid2'
import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { players } from './players'

/**
 * Linear-readiness veto table (L3).
 *
 * Linear-readiness (which skills are "aged out" onto number sentences) is DERIVED
 * fresh at plan time and never persisted — see `lib/curriculum/linear-readiness.ts`.
 * The ONLY persisted piece is this veto: a teacher saying "not yet" for a whole
 * skill category.
 *
 * Semantics: a row's PRESENCE means the category is vetoed (kept off number
 * sentences); its ABSENCE means linear-readiness is auto-conferred. The veto is
 * sticky (no expiry) — the model is "the teacher only vetoes," so it persists until
 * lifted. Because the derivation only ever READS this table, a veto can never be
 * silently re-overridden by a later derivation run.
 *
 * Grain is per-CATEGORY (a `SkillCategoryKey`, e.g. "tenComplements"), deliberately
 * coarser than per-skill: the frontier crosses a whole category at once, and this
 * keeps the teacher's decision one tap, not a per-skill chore.
 */
export const linearReadinessVeto = sqliteTable(
  'linear_readiness_veto',
  {
    /** Primary key */
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),

    /** Player this veto applies to */
    playerId: text('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),

    /** The vetoed skill category (a `SkillCategoryKey`, e.g. "tenComplements") */
    category: text('category').notNull(),

    /** Optional teacher note explaining the veto */
    reason: text('reason'),

    /** When the veto was created */
    vetoedAt: integer('vetoed_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    /** Only one veto per player per category */
    playerCategoryUnique: uniqueIndex('linear_readiness_veto_player_category_unique').on(
      table.playerId,
      table.category
    ),
  })
)

export type LinearReadinessVeto = typeof linearReadinessVeto.$inferSelect
export type NewLinearReadinessVeto = typeof linearReadinessVeto.$inferInsert
