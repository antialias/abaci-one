/**
 * Who may MANAGE a design — its sharing (#24) and its name/listing (#11).
 *
 * Extracted from the share route so the PATCH that renames a design cannot
 * drift from the POST that shares it: both are "the owner, or an admin", and
 * both must answer the byte-identical 404 the design read gives when they say
 * no. That identical answer is the point — a caller can never distinguish
 * "not yours" from "no such design", so neither existence nor share state is
 * probeable. (Deliberately unlike the euclid creations route, which splits
 * 403/404 and thereby confirms which ids exist.)
 *
 * Server-only: it touches the db and the viewer session.
 */
import { eq } from 'drizzle-orm'
import { db, schema } from '@/db'
import { getUserId } from '@/lib/viewer'

/** The row, but only for someone allowed to manage it. Null means "answer 404"
 *  — the caller never learns which of unknown / not-yours it was. */
export async function manageableDesign(designId: string, userRole: string) {
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
