import { createId } from '@paralleldrive/cuid2'
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import type {
  AbacusDesignProvenance,
  AbacusDesignSnapshot,
} from '@/lib/abacus/design-snapshot'
import { users } from './users'

/**
 * Persisted abacus design snapshots (Gitea #22).
 *
 * One row per (owner, design content): the POST route hashes the owner id +
 * the canonical serialization of the `{v, params, overrides, profileId}`
 * envelope and upserts on `contentHash`, so identical submits (and submit
 * retries) by the same user converge on one id. The hash is OWNER-scoped on
 * purpose: reads are owner-or-admin, so a global dedup would hand user B a
 * design id owned by whichever user A happened to print the same design
 * first — and B could never read it back. Rows are permanent — a
 * `?design=<id>` link printed on a THH job card must keep resolving years
 * later (operator decision, 2026-07-28), so nothing here expires or
 * cascades away with its creator.
 *
 * `design` is the restorable envelope, re-parsed through
 * `parseDesignSnapshot` on every read. `provenance` is the submit-time AMS
 * projection (filamentMap/slotLabels) kept for the record only — it is never
 * returned by the GET route and never rehydrated.
 */
export const abacusDesigns = sqliteTable(
  'abacus_designs',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    /** sha-256 hex of `canonicalDesignSnapshot(design)` — the dedup key. */
    contentHash: text('content_hash').notNull().unique(),
    design: text('design', { mode: 'json' }).$type<AbacusDesignSnapshot>().notNull(),
    provenance: text('provenance', { mode: 'json' }).$type<AbacusDesignProvenance>(),
    /** Snapshot owner (guest-first — guests can print, so guests snapshot).
     *  Nulled if the user row goes away; the design itself is kept. */
    createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
    views: integer('views').notNull().default(0),
    lastAccessedAt: integer('last_accessed_at', { mode: 'timestamp' }),
  },
  (table) => ({
    createdByIdx: index('abacus_designs_created_by_idx').on(table.createdBy),
  })
)

export type AbacusDesign = typeof abacusDesigns.$inferSelect
export type NewAbacusDesign = typeof abacusDesigns.$inferInsert
