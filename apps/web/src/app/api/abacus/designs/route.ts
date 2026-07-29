/**
 * Abacus design snapshots (Gitea #22)
 *
 * POST /api/abacus/designs — persist the studio's current design as a
 * restorable snapshot and answer its id (the `?design=<id>` deep link, and
 * the THH `authoring.editUrl` hand-off, things-haunt-house#408).
 *
 * Guest-first like the rest of the studio: a guest can print, so a guest can
 * snapshot. Dedup is on an OWNER-SCOPED content hash — an identical resubmit
 * (the retry case the dedup exists for) converges on one row, while two users
 * printing the same design each get a row they can actually read back
 * (reads are owner-or-admin, see [id]/route.ts). On a dedup hit nothing is
 * overwritten — provenance records the FIRST submit, matching the row's
 * createdAt.
 */
import { createHash } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db, schema } from '@/db'
import {
  type AbacusDesignProvenance,
  canonicalDesignSnapshot,
  parseDesignSnapshot,
} from '@/lib/abacus/design-snapshot'
import { withAuth } from '@/lib/auth/withAuth'
import { getUserId } from '@/lib/viewer'

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
      typeof raw.provenance === 'object' && raw.provenance !== null && !Array.isArray(raw.provenance)
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
