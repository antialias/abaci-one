import { existsSync, statSync } from 'fs'
import { NextResponse } from 'next/server'
import { join } from 'path'
import { withAuth } from '@/lib/auth/withAuth'
import { getImageClassStatus } from '@/lib/images/switch-images'
import { loadPageSpotConfig, spotImageExists, spotImageUrl } from '@/lib/page-spots/loadSpotConfig'
import { getSpotComponentList } from '@/lib/page-spots/spotComponentList'
import { getAllPageSpotGroups } from '@/lib/page-spots/spotDefinitions'

const CONTENT_DIR = join(process.cwd(), 'content', 'page-spots')
const PUBLIC_DIR = join(process.cwd(), 'public', 'page-spots')

/**
 * GET /api/admin/page-spots/status
 *
 * Returns all pages/spots with their config state, image/html existence,
 * available image classes, and component list.
 */
export const GET = withAuth(
  async () => {
    const groups = getAllPageSpotGroups()

    const pages = groups.map((group) => {
      const configMap = loadPageSpotConfig(group.pageId)

      const spots = group.spots.map((def) => {
        const config = configMap[def.id] ?? null

        let imageUrl: string | null = null
        let imageSizeBytes: number | undefined
        let htmlExists = false

        if (config?.type === 'generated' && spotImageExists(group.pageId, def.id)) {
          imageUrl = spotImageUrl(group.pageId, def.id)
          const imgPath = join(PUBLIC_DIR, group.pageId, `${def.id}.png`)
          if (existsSync(imgPath)) {
            imageSizeBytes = statSync(imgPath).size
          }
        }

        if (config?.type === 'html') {
          const htmlPath = join(CONTENT_DIR, group.pageId, `${def.id}.html`)
          htmlExists = existsSync(htmlPath)
        }

        return {
          id: def.id,
          label: def.label,
          description: def.description,
          aspectRatio: def.aspectRatio ?? null,
          config,
          imageUrl,
          imageSizeBytes,
          htmlExists,
        }
      })

      return {
        pageId: group.pageId,
        label: group.label,
        spots,
      }
    })

    const components = getSpotComponentList()

    return NextResponse.json({ pages, components, ...(await getImageClassStatus()) })
  },
  { role: 'admin' }
)
