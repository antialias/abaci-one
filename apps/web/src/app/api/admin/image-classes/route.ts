import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/withAuth'
import { getImageClassStatus } from '@/lib/images/switch-images'

/**
 * GET /api/admin/image-classes
 *
 * The switch proxy's image classes, for admin pages that have no status
 * route of their own. Response: { imageClasses, defaultImageClass, configured }
 */
export const GET = withAuth(async () => NextResponse.json(await getImageClassStatus()), {
  role: 'admin',
})
