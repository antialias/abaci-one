import { createId } from '@paralleldrive/cuid2'
import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { players } from './players'

/**
 * Progression deferrals table - stores teacher decisions to defer skill progression.
 *
 * When the system recommends advancing to a new skill, the teacher can click
 * "Not yet, ask again later" to defer the progression for a period.
 */
export const progressionDeferrals = sqliteTable(
  'progression_deferrals',
  {
    /** Primary key */
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),

    /** Player this deferral applies to */
    playerId: text('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),

    /** The skill being deferred */
    skillId: text('skill_id').notNull(),

    /** When the deferral was created (Unix timestamp ms) */
    deferredAt: integer('deferred_at').notNull(),

    /** When the deferral expires (Unix timestamp ms) */
    expiresAt: integer('expires_at').notNull(),
  },
  (table) => ({
    /** Only one active deferral per player per skill */
    playerSkillUnique: uniqueIndex('progression_deferrals_player_skill_idx').on(
      table.playerId,
      table.skillId
    ),
  })
)

export type ProgressionDeferral = typeof progressionDeferrals.$inferSelect
export type NewProgressionDeferral = typeof progressionDeferrals.$inferInsert
