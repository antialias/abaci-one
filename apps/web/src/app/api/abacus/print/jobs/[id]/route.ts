/**
 * GET /api/abacus/print/jobs/[id] (Abacus Studio #8.3)
 *
 * Job detail pass-through, authorized by the ownership map recorded at
 * submit. The response body (including `sidecar.versionMatch`) relays
 * byte-faithfully — surfacing a version mismatch as a warning is UI work.
 */
import { withAuth } from '@/lib/auth/withAuth'
import { getUserId } from '@/lib/viewer'
import { proxyPassForJob } from '@/lib/abacus/print/proxy'

export const GET = withAuth(async (request, { params }) => {
  const { id } = (await params) as { id: string }
  const userId = await getUserId()
  return proxyPassForJob(request, userId, id, (jobId) => `/jobs/${jobId}`)
})
