import { createId } from '@paralleldrive/cuid2'
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

// ── Manifest types (serialized as JSON in the manifest column) ──

export interface MomentSnapshot {
  viewport: { center: number; pixelsPerUnit: number }
  highlights?: number[]
  indicatorRange?: { from: number; to: number }
  activeGameId?: string | null
  activeExplorationId?: string | null
  conferenceNumbers?: number[]
  timestamp: number // ms since call start
}

export interface RankedMoment {
  rank: number
  caption: string
  category: 'question' | 'discovery' | 'game' | 'exploration' | 'conversation' | 'conference'
  snapshot: MomentSnapshot
  transcriptExcerpt: string // 2-4 lines around the moment
}

export interface PostcardManifest {
  callerNumber: number
  callerPersonality: string // from getTraitSummary(n)
  childName: string
  childEmoji: string
  moments: RankedMoment[]
  sessionSummary: string // brief agent-generated summary
}

// ── Table ──

export const numberLinePostcards = sqliteTable(
  'number_line_postcards',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),

    userId: text('user_id').notNull(),
    playerId: text('player_id'),
    callerNumber: integer('caller_number', { mode: 'number' }).notNull(),
    sessionId: text('session_id'),

    /** pending | generating | ready | failed */
    status: text('status').notNull().default('pending'),

    /** JSON-serialized PostcardManifest */
    manifest: text('manifest', { mode: 'json' }).$type<PostcardManifest>().notNull(),

    imageUrl: text('image_url'),
    thumbnailUrl: text('thumbnail_url'),

    isRead: integer('is_read', { mode: 'boolean' }).notNull().default(false),
    taskId: text('task_id'),

    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' }),
  },
  (table) => ({
    userIdx: index('postcards_user_idx').on(table.userId),
    playerIdx: index('postcards_player_idx').on(table.playerId),
    statusIdx: index('postcards_status_idx').on(table.status),
  })
)

export type NumberLinePostcard = typeof numberLinePostcards.$inferSelect
export type NewNumberLinePostcard = typeof numberLinePostcards.$inferInsert
