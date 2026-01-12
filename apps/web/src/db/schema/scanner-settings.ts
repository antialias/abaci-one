import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { users } from './users'

/**
 * Scanner settings table - document scanner configuration per user
 *
 * One-to-one with users table. Stores quad detector configuration.
 * Deleted when user is deleted (cascade).
 */
export const scannerSettings = sqliteTable('scanner_settings', {
  /** Primary key and foreign key to users table */
  userId: text('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),

  /** Preprocessing strategy */
  preprocessing: text('preprocessing', {
    enum: ['standard', 'enhanced', 'adaptive', 'multi'],
  })
    .notNull()
    .default('multi'),

  /** Enable histogram equalization - improves contrast in low light */
  enableHistogramEqualization: integer('enable_histogram_equalization', { mode: 'boolean' })
    .notNull()
    .default(true),

  /** Enable adaptive threshold - better for uneven lighting */
  enableAdaptiveThreshold: integer('enable_adaptive_threshold', { mode: 'boolean' })
    .notNull()
    .default(true),

  /** Enable morphological gradient - enhances document edges */
  enableMorphGradient: integer('enable_morph_gradient', { mode: 'boolean' })
    .notNull()
    .default(true),

  /** Canny edge detection low threshold */
  cannyLow: integer('canny_low').notNull().default(50),

  /** Canny edge detection high threshold */
  cannyHigh: integer('canny_high').notNull().default(150),

  /** Adaptive threshold block size (must be odd) */
  adaptiveBlockSize: integer('adaptive_block_size').notNull().default(11),

  /** Adaptive threshold constant C */
  adaptiveC: real('adaptive_c').notNull().default(2),

  /** Enable Hough line detection - helps with finger occlusion */
  enableHoughLines: integer('enable_hough_lines', { mode: 'boolean' }).notNull().default(true),
})

export type ScannerSettings = typeof scannerSettings.$inferSelect
export type NewScannerSettings = typeof scannerSettings.$inferInsert
