import { existsSync, statSync } from 'fs'
import { join } from 'path'
import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/withAuth'
import { getAllPageSpotGroups } from '@/lib/page-spots/spotDefinitions'
import { loadPageSpotConfig, spotImageExists, spotImageUrl } from '@/lib/page-spots/loadSpotConfig'
import { IMAGE_PROVIDERS } from '@/lib/tasks/blog-image-generate'
import { getSpotComponentList } from '@/lib/page-spots/spotComponentList'

const CONTENT_DIR = join(process.cwd(), 'content', 'page-spots')
const PUBLIC_DIR = join(process.cwd(), 'public', 'page-spots')

/**
 * GET /api/admin/page-spots/status
 *
 * Returns all pages/spots with their config state, image/html existence,
 * available providers, and component list.
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

    const providers = IMAGE_PROVIDERS.map((p) => {
      const hasKey =
        'envKeyAlt' in p
          ? !!(process.env[p.envKey] || process.env[p.envKeyAlt!])
          : !!process.env[p.envKey]

      return {
        id: p.id,
        name: p.name,
        available: hasKey,
        models: p.models.map((m) => ({ id: m.id, name: m.name })),
      }
    })

    const components = getSpotComponentList()

    return NextResponse.json({ pages, providers, components })
  },
  { role: 'admin' }
)
