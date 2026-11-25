import { existsSync, statSync } from 'fs'
import { NextResponse } from 'next/server'
import { join } from 'path'
import { withAuth } from '@/lib/auth/withAuth'
import { PREVIEW_TARGETS } from '@/lib/homepage-previews'
import { getImageClassStatus } from '@/lib/images/switch-images'

const HOMEPAGE_IMAGES_DIR = join(process.cwd(), 'public', 'images', 'homepage')

/**
 * GET /api/admin/homepage-previews/status
 *
 * Returns all preview targets with their image existence and file size.
 */
export const GET = withAuth(
  async () => {
    const targets = PREVIEW_TARGETS.map((target) => {
      const filePath = join(HOMEPAGE_IMAGES_DIR, `${target.id}.png`)
      const exists = existsSync(filePath)

      return {
        id: target.id,
        type: target.type,
        label: target.label,
        width: target.width,
        height: target.height,
        prompt: target.type === 'ai' ? target.prompt : undefined,
        imageExists: exists,
        sizeBytes: exists ? statSync(filePath).size : undefined,
      }
    })

    return NextResponse.json({ targets, ...(await getImageClassStatus()) })
  },
  { role: 'admin' }
)
