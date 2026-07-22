/**
 * GET /api/abacus/print/jobs (Abacus Studio #8.3; scoped to owned jobs in #16)
 *
 * Ownership-scoped job roster. The print-service token is shared across every
 * app paired to it, so a raw pass-through would surface other integrators' jobs
 * and other abaci users' jobs (and 404 on any of them the moment the panel
 * opened one). This route intersects the upstream list with the caller's
 * ownership rows — the same tenancy rule `jobs/[id]` already enforces per job.
 */
import { withAuth } from '@/lib/auth/withAuth'
import { getUserId } from '@/lib/viewer'
import { proxyRosterForOwner } from '@/lib/abacus/print/proxy'

export const GET = withAuth(async (request) => {
  const userId = await getUserId()
  return proxyRosterForOwner(request, userId)
})
