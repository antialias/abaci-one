/**
 * GET /api/abacus/print/jobs/[id]/attention-frame (Abacus Studio #8.3)
 *
 * Ownership-gated pass-through of the camera frame the service captured
 * when the job last demanded attention. Binary body streams through;
 * content-type relays.
 */
import { withAuth } from '@/lib/auth/withAuth'
import { getUserId } from '@/lib/viewer'
import { proxyPassForJob } from '@/lib/abacus/print/proxy'

export const GET = withAuth(async (request, { params }) => {
  const { id } = (await params) as { id: string }
  const userId = await getUserId()
  return proxyPassForJob(request, userId, id, (jobId) => `/jobs/${jobId}/attention-frame`)
})
