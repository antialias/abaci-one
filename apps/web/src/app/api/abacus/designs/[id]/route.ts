/**
 * GET /api/abacus/designs/[id] (Gitea #22) — read back a persisted design
 * snapshot for `?design=<id>` hydration.
 *
 * Owner-or-admin for v1 (operator decision 2026-07-28; cross-account read is
 * the #24 sharing ticket). A denied read and an unknown id answer the SAME
 * 404 so existence is never leaked; the studio degrades both to the
 * "design unavailable" notice. The stored envelope is re-parsed through the
 * same guard the POST used — schema drift degrades to unavailable instead of
 * hydrating garbage. Provenance is never returned: it's a record of what was
 * printed, not part of the restorable design.
 */
import { eq, sql } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db, schema } from '@/db'
import { parseDesignSnapshot } from '@/lib/abacus/design-snapshot'
import { withAuth } from '@/lib/auth/withAuth'
import { getUserId } from '@/lib/viewer'

const notFound = () => NextResponse.json({ error: 'Design not found' }, { status: 404 })

export const GET = withAuth(async (_request, { userRole, params }) => {
  try {
    const { id } = await params
    const designId = typeof id === 'string' ? id : ''
    if (!designId) return notFound()

    const row = await db.query.abacusDesigns.findFirst({
      where: eq(schema.abacusDesigns.id, designId),
    })
    if (!row) return notFound()

    if (userRole !== 'admin') {
      // A signed-out visitor (getUserId throws) simply isn't the owner.
      const userId = await getUserId().catch(() => null)
      if (userId === null || row.createdBy !== userId) return notFound()
    }

    const design = parseDesignSnapshot(row.design)
    if (!design) {
      console.error(`[abacus-designs] stored envelope ${row.id} no longer parses — serving 404`)
      return notFound()
    }

    // Best-effort access stats — never fail the read over bookkeeping.
    try {
      await db
        .update(schema.abacusDesigns)
        .set({ views: sql`${schema.abacusDesigns.views} + 1`, lastAccessedAt: new Date() })
        .where(eq(schema.abacusDesigns.id, row.id))
    } catch (error) {
      console.error('[abacus-designs] view-count update failed:', error)
    }

    return NextResponse.json({ design })
  } catch (error) {
    console.error('[abacus-designs] read failed:', error)
    return NextResponse.json({ error: 'Failed to load design' }, { status: 500 })
  }
})
