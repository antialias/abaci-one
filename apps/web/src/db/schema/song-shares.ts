import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { relations } from 'drizzle-orm'
import { sessionSongs } from './session-songs'
import { players } from './players'

/**
 * Song shares table — permanent, revocable public links to a celebration song.
 *
 * A parent generates a share for a completed song; anyone with the short code
 * can view a public keepsake page (no login). What the page reveals about the
 * child is opt-in per share via the `visibility` toggles — the default exposes
 * only first name + emoji, the song, its musical style, and the lyrics.
 *
 * Modeled on `worksheet_shares` (stable short base62 code, view counter) rather
 * than the time-limited `session_observation_shares`.
 */

/**
 * Per-share visibility + playback toggles. Privacy toggles (the `show*` keys)
 * default to false; `autoPlay` is a UX preference that defaults to true so the
 * keepsake link feels alive when opened. Browsers may still block autoplay —
 * the player surfaces a tappable button when that happens.
 */
export interface SongShareVisibility {
  /** Reveal the child's age */
  showAge: boolean
  /** Reveal session accuracy / score */
  showAccuracy: boolean
  /** Reveal specific problem detail (the comeback problem, etc.) */
  showProblemDetail: boolean
  /** Reveal best streak and skill spotlights */
  showStreakSkills: boolean
  /** Attempt to autoplay when the public page opens (default true). */
  autoPlay: boolean
}

export const DEFAULT_SONG_SHARE_VISIBILITY: SongShareVisibility = {
  showAge: false,
  showAccuracy: false,
  showProblemDetail: false,
  showStreakSkills: false,
  autoPlay: true,
}

export const songShares = sqliteTable(
  'song_shares',
  {
    /** Short base62 code via generateShareId() — clean URL /song/{id} */
    id: text('id').primaryKey(),

    /** The song this link shares */
    songId: text('song_id')
      .notNull()
      .references(() => sessionSongs.id, { onDelete: 'cascade' }),

    /** Player the song was made for (denormalized for owner lookup / revoke-all) */
    playerId: text('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),

    /** User who created the share (must be a parent of the player) */
    createdBy: text('created_by').notNull(),

    /** JSON SongShareVisibility — opt-in toggles, all false by default */
    visibility: text('visibility', { mode: 'json' })
      .$type<SongShareVisibility>()
      .notNull()
      .$defaultFn(() => DEFAULT_SONG_SHARE_VISIBILITY),

    /** active: link works; revoked: link 404s (manual revoke) */
    status: text('status', { enum: ['active', 'revoked'] })
      .notNull()
      .default('active'),

    /** View counter — incremented on each public page load */
    views: integer('views').notNull().default(0),

    /** Last time the public page was loaded */
    lastViewedAt: integer('last_viewed_at', { mode: 'timestamp' }),

    /** When the share was created */
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    songIdx: index('song_shares_song_id_idx').on(table.songId),
    playerIdx: index('song_shares_player_id_idx').on(table.playerId),
    statusIdx: index('song_shares_status_idx').on(table.status),
  })
)

export const songSharesRelations = relations(songShares, ({ one }) => ({
  song: one(sessionSongs, {
    fields: [songShares.songId],
    references: [sessionSongs.id],
  }),
  player: one(players, {
    fields: [songShares.playerId],
    references: [players.id],
  }),
}))

export type SongShare = typeof songShares.$inferSelect
export type NewSongShare = typeof songShares.$inferInsert
