/**
 * GET /api/abacus/print/printers (Abacus Studio #8.3) — pass-through printer list.
 */
import { withAuth } from '@/lib/auth/withAuth'
import { getUserId } from '@/lib/viewer'
import { proxyPass } from '@/lib/abacus/print/proxy'

export const GET = withAuth(async (request) => {
  const userId = await getUserId()
  return proxyPass(request, userId, '/printers')
})
