import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { users } from './users'

/**
 * Abacus display settings table - UI preferences per user
 *
 * One-to-one with users table. Stores abacus display configuration.
 * Deleted when user is deleted (cascade).
 */
export const abacusSettings = sqliteTable('abacus_settings', {
  /** Primary key and foreign key to users table */
  userId: text('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),

  /** Color scheme for beads */
  colorScheme: text('color_scheme', {
    enum: ['monochrome', 'place-value', 'heaven-earth', 'alternating'],
  })
    .notNull()
    .default('place-value'),

  /** Bead shape */
  beadShape: text('bead_shape', {
    enum: ['diamond', 'circle', 'square'],
  })
    .notNull()
    .default('diamond'),

  /** Color palette */
  colorPalette: text('color_palette', {
    enum: ['default', 'colorblind', 'mnemonic', 'grayscale', 'nature'],
  })
    .notNull()
    .default('default'),

  /** Hide inactive beads */
  hideInactiveBeads: integer('hide_inactive_beads', { mode: 'boolean' }).notNull().default(false),

  /** Color numerals based on place value */
  coloredNumerals: integer('colored_numerals', { mode: 'boolean' }).notNull().default(false),

  /** Scale factor for abacus size */
  scaleFactor: real('scale_factor').notNull().default(1.0),

  /** Show numbers below abacus */
  showNumbers: integer('show_numbers', { mode: 'boolean' }).notNull().default(true),

  /** Enable animations */
  animated: integer('animated', { mode: 'boolean' }).notNull().default(true),

  /** Enable interaction */
  interactive: integer('interactive', { mode: 'boolean' }).notNull().default(false),

  /** Enable gesture controls */
  gestures: integer('gestures', { mode: 'boolean' }).notNull().default(false),

  /** Enable sound effects */
  soundEnabled: integer('sound_enabled', { mode: 'boolean' }).notNull().default(true),

  /** Sound volume (0.0 - 1.0) */
  soundVolume: real('sound_volume').notNull().default(0.8),
})

export type AbacusSettings = typeof abacusSettings.$inferSelect
export type NewAbacusSettings = typeof abacusSettings.$inferInsert
