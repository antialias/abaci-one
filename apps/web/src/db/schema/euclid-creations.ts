import { createId } from '@paralleldrive/cuid2'
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import type { PostCompletionAction } from '../../components/toys/euclid/engine/replayConstruction'

export interface CreationData {
  /** Positions of given points at save time (e.g. pt-A) */
  givenPoints: Array<{ id: string; x: number; y: number }>
  /** All post-completion actions (circles, segments, free points, macros) */
  actions: PostCompletionAction[]
  /** Viewport state at save time */
  viewport?: { centerX: number; centerY: number; ppu: number }
}

export const euclidCreations = sqliteTable(
  'euclid_creations',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),

    /** User who created this (guests included — every visitor has a userId) */
    userId: text('user_id'),

    /** Player (kid) who created this — null when playing without a selected player */
    playerId: text('player_id'),

    /** Serialized construction state */
    data: text('data', { mode: 'json' }).$type<CreationData>().notNull(),

    /** Downsampled JPEG data URL for gallery display */
    thumbnail: text('thumbnail'),

    /** Whether this appears in the public gallery */
    isPublic: integer('is_public', { mode: 'boolean' }).notNull().default(false),

    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    userIdIdx: index('euclid_creations_user_id_idx').on(table.userId),
    publicCreatedIdx: index('euclid_creations_public_created_idx').on(
      table.isPublic,
      table.createdAt
    ),
  })
)

export type EuclidCreation = typeof euclidCreations.$inferSelect
export type NewEuclidCreation = typeof euclidCreations.$inferInsert
