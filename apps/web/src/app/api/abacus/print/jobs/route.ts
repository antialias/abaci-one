/**
 * GET /api/abacus/print/jobs (Abacus Studio #8.3)
 *
 * Pass-through job list for the resolved connection. The connection is the
 * tenant boundary here — everything its token can see, its owner may see.
 * Individual `jobs/[id]` reads are additionally gated by the ownership map.
 */
import { withAuth } from '@/lib/auth/withAuth'
import { getUserId } from '@/lib/viewer'
import { proxyPass } from '@/lib/abacus/print/proxy'

export const GET = withAuth(async (request) => {
  const userId = await getUserId()
  return proxyPass(request, userId, '/jobs')
})
