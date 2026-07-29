/**
 * Design sharing (Gitea #24) — the ACCESS sub-resource of an immutable design.
 *
 *   GET    → { shared, sharedAt }   owner-or-admin
 *   POST   → share    (idempotent: an already-shared design keeps its first
 *                      sharedAt — a re-share records nothing new)
 *   DELETE → un-share (sharedAt = NULL; the SAME id can be re-shared to the
 *                      SAME url, which is what makes the toggle its own undo)
 *
 * Every denial — not yours, unknown id — answers the byte-identical 404 the
 * design read gives, so a stranger can never probe which designs exist or
 * which are shared. Guest-first like the rest of the studio (a guest can save
 * and print, so a guest can share); because the flag rides the design row,
 * mergeGuestIntoUser's existing reparent carries the share on sign-in.
 *
 * Deliberately NOT folded into GET /api/abacus/designs/[id]: that response
 * feeds a staleTime-Infinity cache of immutable content, and share state is
 * mutable. Two resources, two lifetimes.
 */
import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db, schema } from '@/db'
import { withAuth } from '@/lib/auth/withAuth'
import { getUserId } from '@/lib/viewer'

const notFound = () => NextResponse.json({ error: 'Design not found' }, { status: 404 })

const state = (sharedAt: Date | null) =>
  NextResponse.json({ shared: sharedAt !== null, sharedAt: sharedAt ? sharedAt.getTime() : null })

/** The row, but only for someone allowed to MANAGE its sharing (owner or
 *  admin). Null means "answer 404" — the caller never learns which of
 *  unknown / not-yours it was. */
async function manageable(designId: string, userRole: string) {
  if (!designId) return null
  const row = await db.query.abacusDesigns.findFirst({
    where: eq(schema.abacusDesigns.id, designId),
  })
  if (!row) return null
  if (userRole === 'admin') return row
  // A signed-out visitor (getUserId throws) simply isn't the owner.
  const userId = await getUserId().catch(() => null)
  if (userId === null || row.createdBy !== userId) return null
  return row
}

export const GET = withAuth(async (_request, { userRole, params }) => {
  try {
    const { id } = await params
    const row = await manageable(typeof id === 'string' ? id : '', userRole)
    if (!row) return notFound()
    return state(row.sharedAt)
  } catch (error) {
    console.error('[abacus-designs] share read failed:', error)
    return NextResponse.json({ error: 'Failed to load sharing' }, { status: 500 })
  }
})

export const POST = withAuth(async (_request, { userRole, params }) => {
  try {
    const { id } = await params
    const row = await manageable(typeof id === 'string' ? id : '', userRole)
    if (!row) return notFound()
    if (row.sharedAt !== null) return state(row.sharedAt) // already shared — nothing to record

    // Drizzle's timestamp mode persists whole seconds, so truncate at the
    // source: the value this response reports is then byte-for-byte the value
    // a later read gives back, and "already shared" is genuinely idempotent.
    const sharedAt = new Date(Math.floor(Date.now() / 1000) * 1000)
    await db
      .update(schema.abacusDesigns)
      .set({ sharedAt })
      .where(eq(schema.abacusDesigns.id, row.id))
    return state(sharedAt)
  } catch (error) {
    console.error('[abacus-designs] share failed:', error)
    return NextResponse.json({ error: 'Failed to share design' }, { status: 500 })
  }
})

export const DELETE = withAuth(async (_request, { userRole, params }) => {
  try {
    const { id } = await params
    const row = await manageable(typeof id === 'string' ? id : '', userRole)
    if (!row) return notFound()

    await db
      .update(schema.abacusDesigns)
      .set({ sharedAt: null })
      .where(eq(schema.abacusDesigns.id, row.id))
    return state(null)
  } catch (error) {
    console.error('[abacus-designs] un-share failed:', error)
    return NextResponse.json({ error: 'Failed to un-share design' }, { status: 500 })
  }
})
