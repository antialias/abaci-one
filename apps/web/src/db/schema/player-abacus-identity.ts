import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { ABACUS_COLOR_PALETTES, ABACUS_COLOR_SCHEMES } from '@/lib/abacus/identity'
import { players } from './players'

/**
 * Player abacus identity table - the player-bound "my abacus" style and form
 *
 * One row per player, absent row = default identity. Stores exactly the
 * identity triple the Abacus Studio projects into print params
 * (paramsFromDisplayConfig): color scheme + palette (style) and column count
 * (form). Display-behavior preferences (animation, sound, bead shape, ...)
 * stay per-USER in abacus_settings — they are how an account likes abaci
 * rendered, not who a student's abacus is.
 *
 * Shared vocabulary (enums, AbacusIdentity type, defaults, parse guard)
 * lives drizzle-free in @/lib/abacus/identity for client-side reuse.
 *
 * Cascade-deletes when the player is deleted; rides along on guest→user
 * merges because players themselves are reparented.
 */
export const playerAbacusIdentity = sqliteTable('player_abacus_identity', {
  /** Player ID (primary key, FK → players) */
  playerId: text('player_id')
    .primaryKey()
    .references(() => players.id, { onDelete: 'cascade' }),

  /** Color scheme for beads */
  colorScheme: text('color_scheme', { enum: ABACUS_COLOR_SCHEMES })
    .notNull()
    .default('place-value'),

  /** Color palette */
  colorPalette: text('color_palette', { enum: ABACUS_COLOR_PALETTES }).notNull().default('default'),

  /** Physical column count (1-21; the studio clamps its own floor to 3) */
  columns: integer('columns').notNull().default(4),

  /** Timestamp of last update (unix ms) */
  updatedAt: integer('updated_at').notNull(),
})

export type PlayerAbacusIdentity = typeof playerAbacusIdentity.$inferSelect
export type NewPlayerAbacusIdentity = typeof playerAbacusIdentity.$inferInsert
