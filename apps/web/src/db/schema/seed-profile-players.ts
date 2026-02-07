import { integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { players } from './players'

/**
 * Seed profile to player mapping
 *
 * Links seeded test players to the profile definition that created them.
 * A profile can be seeded multiple times (creating new players each time),
 * and this table tracks all of them.
 */
export const seedProfilePlayers = sqliteTable(
  'seed_profile_players',
  {
    /** Seed profile name (matches TestStudentProfile.name) */
    profileId: text('profile_id').notNull(),

    /** The player created from this profile */
    playerId: text('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),

    /** When this player was seeded */
    seededAt: integer('seeded_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.profileId, table.playerId] }),
  })
)

export type SeedProfilePlayer = typeof seedProfilePlayers.$inferSelect
export type NewSeedProfilePlayer = typeof seedProfilePlayers.$inferInsert
