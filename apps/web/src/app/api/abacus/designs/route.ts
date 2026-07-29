/**
 * Abacus design snapshots (Gitea #22)
 *
 * POST /api/abacus/designs — persist the studio's current design as a
 * restorable snapshot and answer its id (the `?design=<id>` deep link, and
 * the THH `authoring.editUrl` hand-off, things-haunt-house#408).
 *
 * GET /api/abacus/designs — the caller's currently-SHARED designs (#24). The
 * studio's share toggle can only address the design on screen, and a design id
 * is an immutable snapshot, so editing past a shared design would otherwise
 * strand it: still public, no longer reachable by any control. This is the
 * ledger that keeps revocation possible. Deliberately not a listing of all
 * your designs — only the ones that are public, because only those pose a
 * question you might want to answer.
 *
 * Guest-first like the rest of the studio: a guest can print, so a guest can
 * snapshot. Dedup is on an OWNER-SCOPED content hash — an identical resubmit
 * (the retry case the dedup exists for) converges on one row, while two users
 * printing the same design each get a row they can actually read back
 * (a new row starts private — see [id]/route.ts and the #24 share
 * sub-resource). On a dedup hit nothing is
 * overwritten — provenance records the FIRST submit, matching the row's
 * createdAt.
 */
import { createHash } from 'node:crypto'
import { and, desc, eq, isNotNull } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db, schema } from '@/db'
import {
  type AbacusDesignProvenance,
  canonicalDesignSnapshot,
  parseDesignSnapshot,
} from '@/lib/abacus/design-snapshot'
import { withAuth } from '@/lib/auth/withAuth'
import { getUserId } from '@/lib/viewer'

/** Enough rows to be a ledger, few enough to stay a rail affordance. Past this
 *  the response says so rather than silently pretending it is complete. */
const SHARED_LIMIT = 50

export const GET = withAuth(async () => {
  try {
    // A signed-out visitor has no designs of their own — an empty ledger, not
    // an error, and no lazily-provisioned guest row just to say so.
    const userId = await getUserId().catch(() => null)
    if (userId === null) return NextResponse.json({ designs: [], truncated: false })

    const rows = await db.query.abacusDesigns.findMany({
      // Owner-scoped even for admins: this answers "what have I made public",
      // and an admin's takedown path stays the per-id share resource.
      where: and(
        eq(schema.abacusDesigns.createdBy, userId),
        isNotNull(schema.abacusDesigns.sharedAt)
      ),
      orderBy: desc(schema.abacusDesigns.sharedAt),
      limit: SHARED_LIMIT + 1,
    })

    const designs = rows.slice(0, SHARED_LIMIT).map((row) => {
      // A stored envelope that no longer parses is still SHARED, so it still
      // gets a row — an un-openable design you cannot un-share would be the
      // exact hole this endpoint exists to close. It just goes unlabelled.
      const design = parseDesignSnapshot(row.design)
      const engraved = design?.params.top_text?.trim()
      return {
        id: row.id,
        sharedAt: row.sharedAt ? row.sharedAt.getTime() : null,
        cols: design ? design.params.cols : null,
        label: engraved ? engraved : null,
      }
    })
    return NextResponse.json({ designs, truncated: rows.length > SHARED_LIMIT })
  } catch (error) {
    console.error('[abacus-designs] shared list failed:', error)
    return NextResponse.json({ error: 'Failed to load shared designs' }, { status: 500 })
  }
})

export const POST = withAuth(async (request) => {
  try {
    const userId = await getUserId()
    const body: unknown = await request.json().catch(() => null)
    const raw = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {}
    const design = parseDesignSnapshot(raw.design)
    if (!design) {
      return NextResponse.json({ error: 'Not a valid design snapshot' }, { status: 400 })
    }
    const provenance =
      typeof raw.provenance === 'object' &&
      raw.provenance !== null &&
      !Array.isArray(raw.provenance)
        ? (raw.provenance as AbacusDesignProvenance)
        : null

    const contentHash = createHash('sha256')
      .update(`${userId}\n${canonicalDesignSnapshot(design)}`)
      .digest('hex')

    const [inserted] = await db
      .insert(schema.abacusDesigns)
      .values({ contentHash, design, provenance, createdBy: userId })
      .onConflictDoNothing({ target: schema.abacusDesigns.contentHash })
      .returning({ id: schema.abacusDesigns.id })
    if (inserted) return NextResponse.json({ id: inserted.id }, { status: 201 })

    const existing = await db.query.abacusDesigns.findFirst({
      where: eq(schema.abacusDesigns.contentHash, contentHash),
      columns: { id: true },
    })
    if (!existing) throw new Error('conflict on insert but no row by that hash')
    return NextResponse.json({ id: existing.id }, { status: 200 })
  } catch (error) {
    console.error('[abacus-designs] create failed:', error)
    return NextResponse.json({ error: 'Failed to save design' }, { status: 500 })
  }
})
