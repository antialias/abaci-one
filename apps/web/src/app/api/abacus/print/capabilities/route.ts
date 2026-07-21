/**
 * GET /api/abacus/print/capabilities (Abacus Studio #8.3)
 *
 * Pass-through to the service's capability document. If-None-Match is
 * forwarded and ETag/304 relayed so the @eink/print-dialog client's ETag
 * revalidation works through the proxy.
 */
import { withAuth } from '@/lib/auth/withAuth'
import { getUserId } from '@/lib/viewer'
import { proxyPass } from '@/lib/abacus/print/proxy'

export const GET = withAuth(async (request) => {
  const userId = await getUserId()
  return proxyPass(request, userId, '/capabilities')
})
