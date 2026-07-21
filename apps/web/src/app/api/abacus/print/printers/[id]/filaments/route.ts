/**
 * GET /api/abacus/print/printers/[id]/filaments (Abacus Studio #8.3)
 *
 * Pass-through of the printer's loaded filament roster (THH wire shape:
 * `{printerId, filaments: [{slotId, colorHex, …}]}`) — the studio's
 * catalog projection consumes this verbatim.
 */
import { withAuth } from '@/lib/auth/withAuth'
import { getUserId } from '@/lib/viewer'
import { proxyPass } from '@/lib/abacus/print/proxy'

export const GET = withAuth(async (request, { params }) => {
  const { id } = (await params) as { id: string }
  const userId = await getUserId()
  return proxyPass(request, userId, `/printers/${encodeURIComponent(id)}/filaments`)
})
