/**
 * Abacus design snapshots (Gitea #22)
 *
 * POST /api/abacus/designs — persist the studio's current design as a
 * restorable snapshot and answer its id (the `?design=<id>` deep link, and
 * the THH `authoring.editUrl` hand-off, things-haunt-house#408).
 *
 * GET /api/abacus/designs — the caller's designs: "my abacuses" (#11), and the
 * single source of a design's mutable metadata (its name, whether it's shared).
 *
 * It began as #24's shared-only ledger, which existed because the studio's
 * share toggle can only address the design on screen: edit past a shared design
 * and it is stranded, still public with no control naming it. That promise is
 * now an invariant of the wider list — a SHARED design is listed even when the
 * owner has hidden it, because letting a hide remove a public design would
 * reopen exactly the hole the ledger closed. Un-sharing is what finally lets a
 * hidden design go.
 *
 * Everything you own is here, link-chip saves and print submits alike: the
 * design behind a failed print is the one you are most likely to come looking
 * for.
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
import { and, desc, eq, isNotNull, isNull, or } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db, schema } from '@/db'
import { normalizeDesignName } from '@/lib/abacus/design-name'
import {
  type AbacusDesignProvenance,
  canonicalDesignSnapshot,
  parseDesignSnapshot,
} from '@/lib/abacus/design-snapshot'
import { withAuth } from '@/lib/auth/withAuth'
import { getUserId } from '@/lib/viewer'

/** Enough rows to be a real list, few enough to stay a rail affordance. Past
 *  this the response says so rather than silently pretending it is complete. */
const LIST_LIMIT = 50

export const GET = withAuth(async () => {
  try {
    // A signed-out visitor has no designs of their own — an empty list, not
    // an error, and no lazily-provisioned guest row just to say so.
    const userId = await getUserId().catch(() => null)
    if (userId === null) return NextResponse.json({ designs: [], truncated: false })

    const rows = await db.query.abacusDesigns.findMany({
      // Owner-scoped even for admins: this answers "what have I made", and an
      // admin's takedown path stays the per-id share resource.
      //
      // A hidden design is gone from the list UNLESS it is shared. That is the
      // #24 invariant: a public design must always have a control naming it, so
      // hiding cannot be a way to lose track of something strangers can open.
      where: and(
        eq(schema.abacusDesigns.createdBy, userId),
        or(isNull(schema.abacusDesigns.hiddenAt), isNotNull(schema.abacusDesigns.sharedAt))
      ),
      // Saved order, not shared order: this is a list of what you made.
      orderBy: desc(schema.abacusDesigns.createdAt),
      limit: LIST_LIMIT + 1,
    })

    const designs = rows.slice(0, LIST_LIMIT).map((row) => {
      // A stored envelope that no longer parses is still listed — if it is
      // shared, an un-openable design you cannot un-share would be the exact
      // hole this endpoint exists to close. It just goes undescribed.
      const design = parseDesignSnapshot(row.design)
      const engraved = design?.params.top_text?.trim()
      return {
        id: row.id,
        name: row.name,
        sharedAt: row.sharedAt ? row.sharedAt.getTime() : null,
        createdAt: row.createdAt.getTime(),
        cols: design ? design.params.cols : null,
        label: engraved ? engraved : null,
      }
    })
    return NextResponse.json({ designs, truncated: rows.length > LIST_LIMIT })
  } catch (error) {
    console.error('[abacus-designs] list failed:', error)
    return NextResponse.json({ error: 'Failed to load designs' }, { status: 500 })
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

    // A name may ride along (#11): the studio passes the name of the design an
    // edit came FROM, so "Ada's abacus" survives being tweaked. Deliberately
    // NOT part of the hash below — see lib/abacus/design-name.ts. An unusable
    // name is ignored rather than refused: this route's contract is that a
    // snapshot never blocks a print, and a lost name costs one rename.
    const name = normalizeDesignName(raw.name) ?? null

    const contentHash = createHash('sha256')
      .update(`${userId}\n${canonicalDesignSnapshot(design)}`)
      .digest('hex')

    const [inserted] = await db
      .insert(schema.abacusDesigns)
      .values({ contentHash, design, provenance, createdBy: userId, name })
      .onConflictDoNothing({ target: schema.abacusDesigns.contentHash })
      .returning({ id: schema.abacusDesigns.id })
    if (inserted) return NextResponse.json({ id: inserted.id }, { status: 201 })

    const existing = await db.query.abacusDesigns.findFirst({
      where: eq(schema.abacusDesigns.contentHash, contentHash),
      columns: { id: true, name: true },
    })
    if (!existing) throw new Error('conflict on insert but no row by that hash')
    // On a dedup hit an offered name FILLS a blank, and never overwrites one
    // the owner chose — same rule provenance follows (the first submit wins).
    if (name !== null && existing.name === null) {
      await db
        .update(schema.abacusDesigns)
        .set({ name })
        .where(eq(schema.abacusDesigns.id, existing.id))
    }
    return NextResponse.json({ id: existing.id }, { status: 200 })
  } catch (error) {
    console.error('[abacus-designs] create failed:', error)
    return NextResponse.json({ error: 'Failed to save design' }, { status: 500 })
  }
})
