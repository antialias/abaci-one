import { getPageSpotGroup } from './spotDefinitions'
import { loadPageSpotConfig, loadSpotHtml, spotImageExists, spotImageUrl } from './loadSpotConfig'
import type { ResolvedSpot } from './types'

/**
 * Resolve all spots for a page — loads config, HTML, and image URLs so that
 * a server component can pass fully-resolved data to client components.
 */
export function resolvePageSpots(
  pageId: string
): Array<{ spotId: string; resolved: ResolvedSpot | null }> {
  const group = getPageSpotGroup(pageId)
  if (!group) return []

  const configMap = loadPageSpotConfig(pageId)

  return group.spots.map((def) => {
    const config = configMap[def.id]
    if (!config) return { spotId: def.id, resolved: null }

    switch (config.type) {
      case 'generated':
        return {
          spotId: def.id,
          resolved: {
            type: 'generated',
            config,
            imageUrl: spotImageExists(pageId, def.id) ? spotImageUrl(pageId, def.id) : null,
          },
        }
      case 'component':
        return {
          spotId: def.id,
          resolved: { type: 'component', config },
        }
      case 'html':
        return {
          spotId: def.id,
          resolved: {
            type: 'html',
            config,
            html: loadSpotHtml(pageId, def.id),
          },
        }
    }
  })
}
