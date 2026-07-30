import { createId } from '@paralleldrive/cuid2'
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import type { AbacusDesignProvenance, AbacusDesignSnapshot } from '@/lib/abacus/design-snapshot'
import { users } from './users'

/**
 * Persisted abacus design snapshots (Gitea #22).
 *
 * One row per (owner, design content): the POST route hashes the owner id +
 * the canonical serialization of the `{v, params, overrides, profileId}`
 * envelope and upserts on `contentHash`, so identical submits (and submit
 * retries) by the same user converge on one id. The hash is OWNER-scoped on
 * purpose: an unshared design reads owner-or-admin, so a global dedup would
 * hand user B a design id owned by whichever user A happened to print the same
 * design first — and B could never read it back, nor share or revoke it
 * (#24, which makes the scoping load-bearing rather than merely tidy). Rows
 * are permanent — a
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
    /** Cross-account read access (#24). NULL = private (owner-or-admin, the
     *  #22 default); a timestamp = anyone with the link may read it.
     *  Deliberately on the design row rather than in a share-code table: the
     *  id IS the capability (cuid2, far stronger than a 7-char share code),
     *  and links already stamped on THH job cards must be repairable by a
     *  later share — a new code at a new URL could never fix them. Revoking
     *  nulls this back out, and re-sharing revives the SAME url, which is what
     *  makes the toggle its own undo. Access changes; content never does. */
    sharedAt: integer('shared_at', { mode: 'timestamp' }),
    /** What the owner calls this design (#11). NULL = never named, and the UI
     *  falls back to the engraved text, then to the column count.
     *
     *  Metadata, NOT content: `name` and `hiddenAt` are both outside
     *  `contentHash`, which covers only the `{v, params, overrides, profileId}`
     *  envelope. That is load-bearing — if a name entered the hash, renaming
     *  would fork the design and orphan every `?design=` link already printed
     *  on a job card. The flip side is that one snapshot carries exactly one
     *  name: building the same design twice under two names dedups onto the
     *  first row (operator decision 2026-07-29, over a saved-designs join
     *  table). */
    name: text('name'),
    /** Taken out of the owner's "my abacuses" list (#11) — the honest form of
     *  the delete this ticket withdrew. The row itself is permanent, so every
     *  printed link keeps resolving; only the list forgets it. A SHARED design
     *  is listed even when this is set (see the collection route): hiding a
     *  public design would reopen the revocation hole #24 exists to close, so
     *  un-sharing is what finally lets it go. */
    hiddenAt: integer('hidden_at', { mode: 'timestamp' }),
  },
  (table) => ({
    createdByIdx: index('abacus_designs_created_by_idx').on(table.createdBy),
  })
)

export type AbacusDesign = typeof abacusDesigns.$inferSelect
export type NewAbacusDesign = typeof abacusDesigns.$inferInsert
