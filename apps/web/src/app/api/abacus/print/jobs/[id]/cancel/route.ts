/**
 * POST /api/abacus/print/jobs/[id]/cancel (Abacus Studio #8.3) — ownership-gated pass-through.
 */
import { withAuth } from '@/lib/auth/withAuth'
import { getUserId } from '@/lib/viewer'
import { proxyPassForJob } from '@/lib/abacus/print/proxy'

export const POST = withAuth(async (request, { params }) => {
  const { id } = (await params) as { id: string }
  const userId = await getUserId()
  return proxyPassForJob(request, userId, id, (jobId) => `/jobs/${jobId}/cancel`)
})
