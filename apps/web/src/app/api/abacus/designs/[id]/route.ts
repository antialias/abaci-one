/**
 * GET /api/abacus/designs/[id] (Gitea #22) — read back a persisted design
 * snapshot for `?design=<id>` hydration.
 *
 * Readable by anyone holding the link once the owner shares it (#24), and by
 * the owner or an admin always. A denied read, an unshared design and an
 * unknown id all answer the SAME 404 so neither existence nor share state is
 * ever leaked; the studio degrades all of them to the
 * "design unavailable" notice. The stored envelope is re-parsed through the
 * same guard the POST used — schema drift degrades to unavailable instead of
 * hydrating garbage. Provenance is never returned: it's a record of what was
 * printed, not part of the restorable design.
 *
 * PATCH /api/abacus/designs/[id] (Gitea #11) — the design's METADATA: its name
 * and whether it appears in the owner's list. Never its content, which is
 * immutable by construction (the id is a hash of it). Owner-or-admin, and every
 * denial is the same 404 the read gives.
 *
 * The response deliberately does NOT carry the name: this one feeds a
 * `staleTime: Infinity` cache of immutable content, and a name is mutable — the
 * same separation #24 made for share state. The list route owns the name.
 */
import { eq, sql } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db, schema } from '@/db'
import { manageableDesign } from '@/lib/abacus/design-access'
import { normalizeDesignName } from '@/lib/abacus/design-name'
import { parseDesignSnapshot } from '@/lib/abacus/design-snapshot'
import { withAuth } from '@/lib/auth/withAuth'
import { getUserId } from '@/lib/viewer'

const notFound = () => NextResponse.json({ error: 'Design not found' }, { status: 404 })

const badRequest = () => NextResponse.json({ error: 'Not a valid design update' }, { status: 400 })

export const GET = withAuth(async (_request, { userRole, params }) => {
  try {
    const { id } = await params
    const designId = typeof id === 'string' ? id : ''
    if (!designId) return notFound()

    const row = await db.query.abacusDesigns.findFirst({
      where: eq(schema.abacusDesigns.id, designId),
    })
    if (!row) return notFound()

    // A shared design (#24) is readable by anyone holding the link — and the
    // check short-circuits before getUserId(), so a stranger's read no longer
    // lazily provisions a guest user row just to be told they're allowed.
    if (row.sharedAt === null && userRole !== 'admin') {
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

export const PATCH = withAuth(async (request, { userRole, params }) => {
  try {
    const { id } = await params
    const row = await manageableDesign(typeof id === 'string' ? id : '', userRole)
    if (!row) return notFound()

    const body: unknown = await request.json().catch(() => null)
    const raw =
      typeof body === 'object' && body !== null && !Array.isArray(body)
        ? (body as Record<string, unknown>)
        : null
    if (!raw) return badRequest()

    const updates: { name?: string | null; hiddenAt?: Date | null } = {}
    if ('name' in raw) {
      // Naming IS the request here, so an unusable name is a refusal — never a
      // silent truncation of what the caller asked for.
      const name = normalizeDesignName(raw.name)
      if (name === undefined) return badRequest()
      updates.name = name
    }
    if ('hidden' in raw) {
      if (typeof raw.hidden !== 'boolean') return badRequest()
      // Whole seconds, matching the share stamp: Drizzle's timestamp mode
      // truncates anyway, and truncating at the source keeps what we report
      // byte-identical to what a later read gives back.
      updates.hiddenAt = raw.hidden ? new Date(Math.floor(Date.now() / 1000) * 1000) : null
    }
    // An update that asks for nothing is a caller bug, not a no-op success.
    if (Object.keys(updates).length === 0) return badRequest()

    await db.update(schema.abacusDesigns).set(updates).where(eq(schema.abacusDesigns.id, row.id))

    const name = 'name' in updates ? (updates.name ?? null) : row.name
    const hiddenAt = 'hiddenAt' in updates ? (updates.hiddenAt ?? null) : row.hiddenAt
    return NextResponse.json({ id: row.id, name, hidden: hiddenAt !== null })
  } catch (error) {
    console.error('[abacus-designs] update failed:', error)
    return NextResponse.json({ error: 'Failed to update design' }, { status: 500 })
  }
})
