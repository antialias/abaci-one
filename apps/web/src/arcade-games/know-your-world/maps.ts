// @ts-ignore - ESM/CommonJS compatibility
import World from '@svg-maps/world'
// @ts-ignore - ESM/CommonJS compatibility
import USA from '@svg-maps/usa'
import type { MapData, MapRegion } from './types'

/**
 * Calculate the centroid (center of mass) of an SVG path
 * Properly parses SVG path commands to extract endpoint coordinates only
 */
function calculatePathCenter(pathString: string): [number, number] {
  const points: Array<[number, number]> = []

  // Parse SVG path commands to extract endpoint coordinates
  // Regex matches: command letter followed by numbers
  const commandRegex = /([MmLlHhVvCcSsQqTtAaZz])([^MmLlHhVvCcSsQqTtAaZz]*)/g
  let currentX = 0
  let currentY = 0
  let match

  while ((match = commandRegex.exec(pathString)) !== null) {
    const command = match[1]
    const params = match[2].trim().match(/-?\d+\.?\d*/g)?.map(Number) || []

    switch (command) {
      case 'M': // Move to (absolute)
        if (params.length >= 2) {
          currentX = params[0]
          currentY = params[1]
          points.push([currentX, currentY])
        }
        break

      case 'm': // Move to (relative)
        if (params.length >= 2) {
          currentX += params[0]
          currentY += params[1]
          points.push([currentX, currentY])
        }
        break

      case 'L': // Line to (absolute)
        for (let i = 0; i < params.length - 1; i += 2) {
          currentX = params[i]
          currentY = params[i + 1]
          points.push([currentX, currentY])
        }
        break

      case 'l': // Line to (relative)
        for (let i = 0; i < params.length - 1; i += 2) {
          currentX += params[i]
          currentY += params[i + 1]
          points.push([currentX, currentY])
        }
        break

      case 'H': // Horizontal line (absolute)
        for (const x of params) {
          currentX = x
          points.push([currentX, currentY])
        }
        break

      case 'h': // Horizontal line (relative)
        for (const dx of params) {
          currentX += dx
          points.push([currentX, currentY])
        }
        break

      case 'V': // Vertical line (absolute)
        for (const y of params) {
          currentY = y
          points.push([currentX, currentY])
        }
        break

      case 'v': // Vertical line (relative)
        for (const dy of params) {
          currentY += dy
          points.push([currentX, currentY])
        }
        break

      case 'C': // Cubic Bezier (absolute) - take only the endpoint (last 2 params)
        for (let i = 0; i < params.length - 1; i += 6) {
          if (i + 5 < params.length) {
            currentX = params[i + 4]
            currentY = params[i + 5]
            points.push([currentX, currentY])
          }
        }
        break

      case 'c': // Cubic Bezier (relative) - take only the endpoint
        for (let i = 0; i < params.length - 1; i += 6) {
          if (i + 5 < params.length) {
            currentX += params[i + 4]
            currentY += params[i + 5]
            points.push([currentX, currentY])
          }
        }
        break

      case 'Q': // Quadratic Bezier (absolute) - take only the endpoint (last 2 params)
        for (let i = 0; i < params.length - 1; i += 4) {
          if (i + 3 < params.length) {
            currentX = params[i + 2]
            currentY = params[i + 3]
            points.push([currentX, currentY])
          }
        }
        break

      case 'q': // Quadratic Bezier (relative) - take only the endpoint
        for (let i = 0; i < params.length - 1; i += 4) {
          if (i + 3 < params.length) {
            currentX += params[i + 2]
            currentY += params[i + 3]
            points.push([currentX, currentY])
          }
        }
        break

      case 'Z':
      case 'z':
        // Close path - no new point needed
        break
    }
  }

  if (points.length === 0) {
    return [0, 0]
  }

  if (points.length < 3) {
    // Not enough points for a polygon, fallback to average
    const avgX = points.reduce((sum, p) => sum + p[0], 0) / points.length
    const avgY = points.reduce((sum, p) => sum + p[1], 0) / points.length
    return [avgX, avgY]
  }

  // Calculate polygon centroid using shoelace formula
  let signedArea = 0
  let cx = 0
  let cy = 0

  for (let i = 0; i < points.length; i++) {
    const [x0, y0] = points[i]
    const [x1, y1] = points[(i + 1) % points.length]

    const crossProduct = x0 * y1 - x1 * y0
    signedArea += crossProduct
    cx += (x0 + x1) * crossProduct
    cy += (y0 + y1) * crossProduct
  }

  signedArea *= 0.5

  // Avoid division by zero
  if (Math.abs(signedArea) < 0.0001) {
    // Fallback to average of all points
    const avgX = points.reduce((sum, p) => sum + p[0], 0) / points.length
    const avgY = points.reduce((sum, p) => sum + p[1], 0) / points.length
    return [avgX, avgY]
  }

  cx = cx / (6 * signedArea)
  cy = cy / (6 * signedArea)

  return [cx, cy]
}

/**
 * Convert @svg-maps location data to our MapRegion format
 */
function convertToMapRegions(
  locations: Array<{ id: string; name: string; path: string }>
): MapRegion[] {
  return locations.map((location) => ({
    id: location.id,
    name: location.name,
    path: location.path,
    center: calculatePathCenter(location.path),
  }))
}

/**
 * World map with all countries
 * Data from @svg-maps/world package
 */
export const WORLD_MAP: MapData = {
  id: 'world',
  name: World.label || 'Map of World',
  viewBox: World.viewBox,
  regions: convertToMapRegions(World.locations || []),
}

/**
 * USA map with all states
 * Data from @svg-maps/usa package
 */
export const USA_MAP: MapData = {
  id: 'usa',
  name: USA.label || 'Map of USA',
  viewBox: USA.viewBox,
  regions: convertToMapRegions(USA.locations || []),
}

// Log to help debug if data is missing
if (typeof window === 'undefined') {
  // Server-side
  console.log('[KnowYourWorld] Server: World regions loaded:', WORLD_MAP.regions.length)
  console.log('[KnowYourWorld] Server: USA regions loaded:', USA_MAP.regions.length)
} else {
  // Client-side
  console.log('[KnowYourWorld] Client: World regions loaded:', WORLD_MAP.regions.length)
  console.log('[KnowYourWorld] Client: USA regions loaded:', USA_MAP.regions.length)
}

/**
 * Get map data by ID
 */
export function getMapData(mapId: 'world' | 'usa'): MapData {
  switch (mapId) {
    case 'world':
      return WORLD_MAP
    case 'usa':
      return USA_MAP
    default:
      return WORLD_MAP
  }
}

/**
 * Get a specific region by ID from a map
 */
export function getRegionById(mapId: 'world' | 'usa', regionId: string) {
  const mapData = getMapData(mapId)
  return mapData.regions.find((r) => r.id === regionId)
}
