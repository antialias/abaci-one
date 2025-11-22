import type { MapData, MapRegion } from './types'

/**
 * Type definition for @svg-maps packages
 */
interface SvgMapData {
  label: string
  viewBox: string
  locations: Array<{ id: string; name: string; path: string }>
}

/**
 * Cached map data - will be populated either via static imports (browser)
 * or dynamic imports (Node.js server)
 */
let worldMapSource: SvgMapData | null = null
let usaMapSource: SvgMapData | null = null

/**
 * Load map sources dynamically (async - for server-side)
 * In browser, this is called eagerly at module load time
 * In Node.js server, this is called on-demand
 */
async function ensureMapSourcesLoaded(): Promise<void> {
  if (worldMapSource && usaMapSource) {
    return // Already loaded
  }

  // Dynamic import works in both browser (via Next.js bundler) and Node.js (native ESM support)
  const [worldModule, usaModule] = await Promise.all([
    import('@svg-maps/world'),
    import('@svg-maps/usa')
  ])

  worldMapSource = worldModule.default
  usaMapSource = usaModule.default

  console.log('[Maps] Loaded via dynamic import:', {
    world: worldMapSource?.locations?.length,
    usa: usaMapSource?.locations?.length,
    env: typeof window === 'undefined' ? 'server' : 'browser'
  })
}

/**
 * In browser context, load maps immediately at module initialization
 * This allows synchronous access in client components
 */
let browserMapsLoadingPromise: Promise<void> | null = null
if (typeof window !== 'undefined') {
  // Browser: Start loading immediately and cache the promise
  browserMapsLoadingPromise = (async () => {
    await ensureMapSourcesLoaded()
    // Populate the caches eagerly
    await getWorldMapData()
    await getUSAMapData()
  })().catch(err => {
    console.error('[Maps] Failed to load map data in browser:', err)
    throw err
  })
}

/**
 * Difficulty level configuration for a map
 */
export interface DifficultyLevel {
  id: string // e.g., 'easy', 'medium', 'hard', 'standard'
  label: string // Display name
  emoji?: string // Optional emoji
  description?: string // Optional description for UI
  // Filtering: either explicit exclusions OR percentage
  excludeRegions?: string[] // Explicit region IDs to exclude
  keepPercentile?: number // 0-1, keep this % of largest regions (default 1.0)
}

/**
 * Per-map difficulty configuration
 */
export interface MapDifficultyConfig {
  levels: DifficultyLevel[]
  defaultLevel: string // ID of default level
}

/**
 * Global default difficulty config for maps without custom config
 */
export const DEFAULT_DIFFICULTY_CONFIG: MapDifficultyConfig = {
  levels: [
    {
      id: 'easy',
      label: 'Easy',
      emoji: '😊',
      description: '85% largest regions',
      keepPercentile: 0.85,
    },
    {
      id: 'medium',
      label: 'Medium',
      emoji: '🙂',
      description: '98% largest regions',
      keepPercentile: 0.98,
    },
    {
      id: 'hard',
      label: 'Hard',
      emoji: '😰',
      description: 'All regions',
      keepPercentile: 1.0,
    },
  ],
  defaultLevel: 'medium',
}

/**
 * USA map difficulty config - single level, all regions
 */
export const USA_DIFFICULTY_CONFIG: MapDifficultyConfig = {
  levels: [
    {
      id: 'standard',
      label: 'All States',
      emoji: '🗺️',
      description: 'All 50 states + DC',
      keepPercentile: 1.0,
    },
  ],
  defaultLevel: 'standard',
}

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
    const params =
      match[2]
        .trim()
        .match(/-?\d+\.?\d*/g)
        ?.map(Number) || []

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
 * Cached MapData instances (after conversion)
 */
let worldMapDataCache: MapData | null = null
let usaMapDataCache: MapData | null = null

/**
 * Get World map data (async)
 */
async function getWorldMapData(): Promise<MapData> {
  if (worldMapDataCache) {
    return worldMapDataCache
  }

  await ensureMapSourcesLoaded()

  if (!worldMapSource) {
    throw new Error('[Maps] World map source not loaded')
  }

  worldMapDataCache = {
    id: 'world',
    name: worldMapSource.label || 'Map of World',
    viewBox: worldMapSource.viewBox,
    regions: convertToMapRegions(worldMapSource.locations || []),
  }

  return worldMapDataCache
}

/**
 * Get USA map data (async)
 */
async function getUSAMapData(): Promise<MapData> {
  if (usaMapDataCache) {
    return usaMapDataCache
  }

  await ensureMapSourcesLoaded()

  if (!usaMapSource) {
    throw new Error('[Maps] USA map source not loaded')
  }

  usaMapDataCache = {
    id: 'usa',
    name: usaMapSource.label || 'Map of USA',
    viewBox: usaMapSource.viewBox,
    regions: convertToMapRegions(usaMapSource.locations || []),
    difficultyConfig: USA_DIFFICULTY_CONFIG,
  }

  return usaMapDataCache
}

/**
 * Get map data synchronously (for client components)
 * In browser, throws a promise to trigger React Suspense if not loaded yet
 */
function getMapDataSync(mapId: 'world' | 'usa'): MapData {
  const cache = mapId === 'world' ? worldMapDataCache : usaMapDataCache

  if (!cache) {
    // In browser, if maps are still loading, throw the promise to trigger Suspense
    if (typeof window !== 'undefined' && browserMapsLoadingPromise) {
      throw browserMapsLoadingPromise
    }
    throw new Error(`[Maps] ${mapId} map not yet loaded. Use await getMapData() or ensure maps are preloaded.`)
  }

  return cache
}

/**
 * Synchronous exports for client components
 * These proxy to the cache and throw if accessed before loading
 */
export const WORLD_MAP: MapData = new Proxy({} as MapData, {
  get(target, prop) {
    return getMapDataSync('world')[prop as keyof MapData]
  }
})

export const USA_MAP: MapData = new Proxy({} as MapData, {
  get(target, prop) {
    return getMapDataSync('usa')[prop as keyof MapData]
  }
})

/**
 * Get map data by ID (async - for server-side code)
 */
export async function getMapData(mapId: 'world' | 'usa'): Promise<MapData> {
  return mapId === 'world' ? await getWorldMapData() : await getUSAMapData()
}

/**
 * Get a specific region by ID from a map (async)
 */
export async function getRegionById(mapId: 'world' | 'usa', regionId: string) {
  const mapData = await getMapData(mapId)
  return mapData.regions.find((r) => r.id === regionId)
}

/**
 * Calculate bounding box for a set of SVG paths
 */
export interface BoundingBox {
  minX: number
  maxX: number
  minY: number
  maxY: number
  width: number
  height: number
}

function calculateBoundingBox(paths: string[]): BoundingBox {
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity

  for (const pathString of paths) {
    // Parse SVG path commands properly (similar to calculatePathCenter)
    const commandRegex = /([MmLlHhVvCcSsQqTtAaZz])([^MmLlHhVvCcSsQqTtAaZz]*)/g
    let currentX = 0
    let currentY = 0
    let match

    while ((match = commandRegex.exec(pathString)) !== null) {
      const command = match[1]
      const params =
        match[2]
          .trim()
          .match(/-?\d+\.?\d*/g)
          ?.map(Number) || []

      switch (command) {
        case 'M': // Move to (absolute)
          if (params.length >= 2) {
            currentX = params[0]
            currentY = params[1]
            minX = Math.min(minX, currentX)
            maxX = Math.max(maxX, currentX)
            minY = Math.min(minY, currentY)
            maxY = Math.max(maxY, currentY)
          }
          break

        case 'm': // Move to (relative)
          if (params.length >= 2) {
            currentX += params[0]
            currentY += params[1]
            minX = Math.min(minX, currentX)
            maxX = Math.max(maxX, currentX)
            minY = Math.min(minY, currentY)
            maxY = Math.max(maxY, currentY)
          }
          break

        case 'L': // Line to (absolute)
          for (let i = 0; i < params.length - 1; i += 2) {
            currentX = params[i]
            currentY = params[i + 1]
            minX = Math.min(minX, currentX)
            maxX = Math.max(maxX, currentX)
            minY = Math.min(minY, currentY)
            maxY = Math.max(maxY, currentY)
          }
          break

        case 'l': // Line to (relative)
          for (let i = 0; i < params.length - 1; i += 2) {
            currentX += params[i]
            currentY += params[i + 1]
            minX = Math.min(minX, currentX)
            maxX = Math.max(maxX, currentX)
            minY = Math.min(minY, currentY)
            maxY = Math.max(maxY, currentY)
          }
          break

        case 'H': // Horizontal line (absolute)
          for (const x of params) {
            currentX = x
            minX = Math.min(minX, currentX)
            maxX = Math.max(maxX, currentX)
          }
          break

        case 'h': // Horizontal line (relative)
          for (const dx of params) {
            currentX += dx
            minX = Math.min(minX, currentX)
            maxX = Math.max(maxX, currentX)
          }
          break

        case 'V': // Vertical line (absolute)
          for (const y of params) {
            currentY = y
            minY = Math.min(minY, currentY)
            maxY = Math.max(maxY, currentY)
          }
          break

        case 'v': // Vertical line (relative)
          for (const dy of params) {
            currentY += dy
            minY = Math.min(minY, currentY)
            maxY = Math.max(maxY, currentY)
          }
          break

        case 'C': // Cubic Bezier (absolute)
          for (let i = 0; i < params.length - 1; i += 6) {
            if (i + 5 < params.length) {
              // Check all control points and endpoint
              for (let j = 0; j < 6; j += 2) {
                const x = params[i + j]
                const y = params[i + j + 1]
                minX = Math.min(minX, x)
                maxX = Math.max(maxX, x)
                minY = Math.min(minY, y)
                maxY = Math.max(maxY, y)
              }
              currentX = params[i + 4]
              currentY = params[i + 5]
            }
          }
          break

        case 'c': // Cubic Bezier (relative)
          for (let i = 0; i < params.length - 1; i += 6) {
            if (i + 5 < params.length) {
              // Check all control points and endpoint (converted to absolute)
              for (let j = 0; j < 6; j += 2) {
                const x = currentX + params[i + j]
                const y = currentY + params[i + j + 1]
                minX = Math.min(minX, x)
                maxX = Math.max(maxX, x)
                minY = Math.min(minY, y)
                maxY = Math.max(maxY, y)
              }
              currentX += params[i + 4]
              currentY += params[i + 5]
            }
          }
          break

        case 'Q': // Quadratic Bezier (absolute)
          for (let i = 0; i < params.length - 1; i += 4) {
            if (i + 3 < params.length) {
              // Check control point and endpoint
              for (let j = 0; j < 4; j += 2) {
                const x = params[i + j]
                const y = params[i + j + 1]
                minX = Math.min(minX, x)
                maxX = Math.max(maxX, x)
                minY = Math.min(minY, y)
                maxY = Math.max(maxY, y)
              }
              currentX = params[i + 2]
              currentY = params[i + 3]
            }
          }
          break

        case 'q': // Quadratic Bezier (relative)
          for (let i = 0; i < params.length - 1; i += 4) {
            if (i + 3 < params.length) {
              // Check control point and endpoint (converted to absolute)
              for (let j = 0; j < 4; j += 2) {
                const x = currentX + params[i + j]
                const y = currentY + params[i + j + 1]
                minX = Math.min(minX, x)
                maxX = Math.max(maxX, x)
                minY = Math.min(minY, y)
                maxY = Math.max(maxY, y)
              }
              currentX += params[i + 2]
              currentY += params[i + 3]
            }
          }
          break

        case 'Z':
        case 'z':
          // Close path - no new point needed
          break
      }
    }
  }

  return {
    minX,
    maxX,
    minY,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  }
}

/**
 * Filter world map regions by continent
 */
import { getContinentForCountry, type ContinentId } from './continents'

export function filterRegionsByContinent(
  regions: MapRegion[],
  continentId: ContinentId | 'all'
): MapRegion[] {
  if (continentId === 'all') {
    return regions
  }

  return regions.filter((region) => {
    const continent = getContinentForCountry(region.id)
    return continent === continentId
  })
}

/**
 * Calculate adjusted viewBox for a continent
 * Adds padding around the bounding box
 */
export function calculateContinentViewBox(
  regions: MapRegion[],
  continentId: ContinentId | 'all',
  originalViewBox: string
): string {
  if (continentId === 'all') {
    return originalViewBox
  }

  const filteredRegions = filterRegionsByContinent(regions, continentId)

  if (filteredRegions.length === 0) {
    return originalViewBox
  }

  const paths = filteredRegions.map((r) => r.path)
  const bbox = calculateBoundingBox(paths)

  // Add 10% padding on each side
  const paddingX = bbox.width * 0.1
  const paddingY = bbox.height * 0.1

  const newMinX = bbox.minX - paddingX
  const newMinY = bbox.minY - paddingY
  const newWidth = bbox.width + 2 * paddingX
  const newHeight = bbox.height + 2 * paddingY

  return `${newMinX} ${newMinY} ${newWidth} ${newHeight}`
}

/**
 * Calculate SVG bounding box area for a region path
 */
function calculateRegionArea(pathString: string): number {
  const numbers = pathString.match(/-?\d+\.?\d*/g)?.map(Number) || []

  if (numbers.length === 0) {
    return 0
  }

  const xCoords: number[] = []
  const yCoords: number[] = []

  for (let i = 0; i < numbers.length; i += 2) {
    xCoords.push(numbers[i])
    if (i + 1 < numbers.length) {
      yCoords.push(numbers[i + 1])
    }
  }

  if (xCoords.length === 0 || yCoords.length === 0) {
    return 0
  }

  const minX = Math.min(...xCoords)
  const maxX = Math.max(...xCoords)
  const minY = Math.min(...yCoords)
  const maxY = Math.max(...yCoords)

  const width = maxX - minX
  const height = maxY - minY

  return width * height
}

/**
 * Filter regions based on difficulty level configuration
 * Supports both explicit region exclusions and percentile-based filtering
 */
function filterRegionsByDifficulty(regions: MapRegion[], level: DifficultyLevel): MapRegion[] {
  // Explicit exclusions take priority
  if (level.excludeRegions && level.excludeRegions.length > 0) {
    const filtered = regions.filter((r) => !level.excludeRegions!.includes(r.id))
    console.log(
      `[Difficulty Filter] ${level.id} mode: ${filtered.length}/${regions.length} regions (excluded: ${level.excludeRegions.join(', ')})`
    )
    return filtered
  }

  // Use percentile filtering
  const percentile = level.keepPercentile ?? 1.0
  if (percentile >= 1.0) {
    return regions // Include all regions
  }

  // Calculate areas for all regions
  const regionsWithAreas = regions.map((region) => ({
    region,
    area: calculateRegionArea(region.path),
  }))

  // Sort by area (largest first)
  regionsWithAreas.sort((a, b) => b.area - a.area)

  // Keep top N% of largest regions
  const keepCount = Math.ceil(regions.length * percentile)
  const filtered = regionsWithAreas.slice(0, keepCount).map((item) => item.region)

  // Debug logging
  const excluded = regionsWithAreas.slice(keepCount)
  if (excluded.length > 0) {
    console.log(
      `[Difficulty Filter] EXCLUDED (smallest ${excluded.length}):`,
      excluded.map((item) => `${item.region.name} (${item.area.toFixed(0)} units²)`)
    )
  }

  console.log(
    `[Difficulty Filter] ${level.id} mode: ${filtered.length}/${regions.length} regions (top ${(percentile * 100).toFixed(0)}%)`
  )
  return filtered
}

/**
 * Get filtered map data for a continent and difficulty (async - for server-side)
 */
export async function getFilteredMapData(
  mapId: 'world' | 'usa',
  continentId: ContinentId | 'all',
  difficultyLevelId?: string // Optional difficulty level ID (uses map's default if not provided)
): Promise<MapData> {
  const mapData = await getMapData(mapId)

  // Get difficulty config for this map (or use global default)
  const difficultyConfig = mapData.difficultyConfig || DEFAULT_DIFFICULTY_CONFIG

  // Find the difficulty level by ID (or use default)
  const levelId = difficultyLevelId || difficultyConfig.defaultLevel
  const difficultyLevel = difficultyConfig.levels.find((level) => level.id === levelId)

  if (!difficultyLevel) {
    console.warn(
      `[getFilteredMapData] Difficulty level "${levelId}" not found for map "${mapId}". Using default.`
    )
    const defaultLevel = difficultyConfig.levels.find(
      (level) => level.id === difficultyConfig.defaultLevel
    )
    if (!defaultLevel) {
      throw new Error(`Invalid difficulty config for map "${mapId}": no default level found`)
    }
  }

  const level = difficultyLevel || difficultyConfig.levels[0]

  let filteredRegions = mapData.regions
  let adjustedViewBox = mapData.viewBox

  // Apply continent filtering for world map
  if (mapId === 'world' && continentId !== 'all') {
    filteredRegions = filterRegionsByContinent(filteredRegions, continentId)
    adjustedViewBox = calculateContinentViewBox(mapData.regions, continentId, mapData.viewBox)
  }

  // Apply difficulty filtering
  filteredRegions = filterRegionsByDifficulty(filteredRegions, level)

  return {
    ...mapData,
    regions: filteredRegions,
    viewBox: adjustedViewBox,
  }
}

/**
 * Get filtered map data synchronously (for client components)
 * Uses the synchronous WORLD_MAP/USA_MAP proxies
 */
export function getFilteredMapDataSync(
  mapId: 'world' | 'usa',
  continentId: ContinentId | 'all',
  difficultyLevelId?: string
): MapData {
  const mapData = mapId === 'world' ? WORLD_MAP : USA_MAP

  // Get difficulty config for this map (or use global default)
  const difficultyConfig = mapData.difficultyConfig || DEFAULT_DIFFICULTY_CONFIG

  // Find the difficulty level by ID (or use default)
  const levelId = difficultyLevelId || difficultyConfig.defaultLevel
  const difficultyLevel = difficultyConfig.levels.find((level) => level.id === levelId)

  if (!difficultyLevel) {
    console.warn(
      `[getFilteredMapDataSync] Difficulty level "${levelId}" not found for map "${mapId}". Using default.`
    )
    const defaultLevel = difficultyConfig.levels.find(
      (level) => level.id === difficultyConfig.defaultLevel
    )
    if (!defaultLevel) {
      throw new Error(`Invalid difficulty config for map "${mapId}": no default level found`)
    }
  }

  const level = difficultyLevel || difficultyConfig.levels[0]

  let filteredRegions = mapData.regions
  let adjustedViewBox = mapData.viewBox

  // Apply continent filtering for world map
  if (mapId === 'world' && continentId !== 'all') {
    filteredRegions = filterRegionsByContinent(filteredRegions, continentId)
    adjustedViewBox = calculateContinentViewBox(mapData.regions, continentId, mapData.viewBox)
  }

  // Apply difficulty filtering
  filteredRegions = filterRegionsByDifficulty(filteredRegions, level)

  return {
    ...mapData,
    regions: filteredRegions,
    viewBox: adjustedViewBox,
  }
}
