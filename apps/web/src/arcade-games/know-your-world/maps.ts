import type { MapData, MapRegion } from './types'
import { getCustomCrop } from './customCrops'

/**
 * Convert a 2-letter country code to a flag emoji
 * Uses Unicode Regional Indicator Symbols
 * @param countryCode - ISO 3166-1 alpha-2 country code (e.g., "us", "fr")
 * @returns Flag emoji string (e.g., "🇺🇸", "🇫🇷") or empty string if invalid
 */
export function getCountryFlagEmoji(countryCode: string): string {
  if (!countryCode || countryCode.length !== 2) return ''

  const code = countryCode.toUpperCase()
  // Regional Indicator Symbols start at U+1F1E6 (A) and go to U+1F1FF (Z)
  // Formula: 0x1F1E6 + (letterIndex) where A=0, B=1, etc.
  const firstChar = code.charCodeAt(0)
  const secondChar = code.charCodeAt(1)

  // Validate both chars are A-Z
  if (firstChar < 65 || firstChar > 90 || secondChar < 65 || secondChar > 90) {
    return ''
  }

  const firstSymbol = String.fromCodePoint(0x1f1e6 + (firstChar - 65))
  const secondSymbol = String.fromCodePoint(0x1f1e6 + (secondChar - 65))

  return firstSymbol + secondSymbol
}

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
    import('@svg-maps/usa'),
  ])

  worldMapSource = worldModule.default
  usaMapSource = usaModule.default

  console.log('[Maps] Loaded via dynamic import:', {
    world: worldMapSource?.locations?.length,
    usa: usaMapSource?.locations?.length,
    env: typeof window === 'undefined' ? 'server' : 'browser',
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
  })().catch((err) => {
    console.error('[Maps] Failed to load map data in browser:', err)
    throw err
  })
}

/**
 * Region size category for difficulty-based filtering
 */
export type RegionSize = 'huge' | 'large' | 'medium' | 'small' | 'tiny'

/**
 * Hints mode for difficulty levels
 */
export type HintsMode = 'onRequest' | 'limited' | 'none'

/**
 * Give up behavior mode
 */
export type GiveUpMode = 'reaskSoon' | 'reaskEnd' | 'countsAgainst' | 'skipEntirely'

/**
 * Difficulty level configuration for a map
 */
export interface DifficultyLevel {
  id: string // e.g., 'learning', 'easy', 'normal', 'expert'
  label: string // Display name
  emoji?: string // Optional emoji
  description?: string // Short description for UI
  detailedDescription?: string // Longer description for tooltip/modal

  // Region filtering (new size-based system)
  includeSizes?: RegionSize[] // Which size categories to include

  // Legacy filtering (for backwards compatibility)
  excludeRegions?: string[] // Explicit region IDs to exclude
  keepPercentile?: number // 0-1, keep this % of largest regions (default 1.0)

  // Feature flags
  hotColdEnabled?: boolean // Hot/cold feedback when clicking wrong regions
  hintsMode?: HintsMode // How hints work
  hintLimit?: number // For 'limited' mode, how many hints per game
  autoHintDefault?: boolean // Default state of auto-hint checkbox
  struggleHintEnabled?: boolean // Show hint after struggling (timer-based)
  giveUpMode?: GiveUpMode // What happens when player gives up
  wrongClickShowsName?: boolean // Show "That was [name]" vs just "Wrong!"
}

/**
 * Per-map difficulty configuration
 * @deprecated Use AssistanceLevelConfig instead - difficulty conflated region filtering with assistance
 */
export interface MapDifficultyConfig {
  levels: DifficultyLevel[]
  defaultLevel: string // ID of default level
}

/**
 * Assistance level configuration - controls gameplay features separate from region filtering
 */
export interface AssistanceLevelConfig {
  id: 'guided' | 'helpful' | 'standard' | 'none'
  label: string
  emoji: string
  description: string
  // Feature flags
  hotColdEnabled: boolean
  hintsMode: HintsMode
  hintLimit?: number // For 'limited' mode
  autoHintDefault: boolean
  struggleHintEnabled: boolean
  giveUpMode: GiveUpMode
  wrongClickShowsName: boolean
  // Name reinforcement
  nameConfirmationLetters?: number // If set, require typing first N letters before hints unlock
}

/**
 * Assistance levels - separate from region filtering
 */
export const ASSISTANCE_LEVELS: AssistanceLevelConfig[] = [
  {
    id: 'guided',
    label: 'Guided',
    emoji: '🎓',
    description:
      'Maximum help - type name to unlock hints, hot/cold feedback, shows names on wrong clicks',
    hotColdEnabled: true,
    hintsMode: 'onRequest',
    autoHintDefault: true,
    struggleHintEnabled: true,
    giveUpMode: 'reaskSoon',
    wrongClickShowsName: true,
    nameConfirmationLetters: 3, // Must type first 3 letters to unlock hints
  },
  {
    id: 'helpful',
    label: 'Helpful',
    emoji: '💡',
    description: 'Hot/cold feedback and hints available on request',
    hotColdEnabled: true,
    hintsMode: 'onRequest',
    autoHintDefault: false,
    struggleHintEnabled: false,
    giveUpMode: 'reaskEnd',
    wrongClickShowsName: true,
  },
  {
    id: 'standard',
    label: 'Standard',
    emoji: '🎯',
    description: 'Limited hints (3), no hot/cold feedback',
    hotColdEnabled: false,
    hintsMode: 'limited',
    hintLimit: 3,
    autoHintDefault: false,
    struggleHintEnabled: false,
    giveUpMode: 'countsAgainst',
    wrongClickShowsName: false,
  },
  {
    id: 'none',
    label: 'No Assistance',
    emoji: '🏆',
    description: 'Pure challenge - no hints or feedback',
    hotColdEnabled: false,
    hintsMode: 'none',
    autoHintDefault: false,
    struggleHintEnabled: false,
    giveUpMode: 'skipEntirely',
    wrongClickShowsName: false,
  },
]

/**
 * Get assistance level config by ID
 */
export function getAssistanceLevel(id: string): AssistanceLevelConfig {
  return ASSISTANCE_LEVELS.find((l) => l.id === id) || ASSISTANCE_LEVELS[1] // Default to 'helpful'
}

/**
 * Default region sizes to include (all sizes = complete set)
 */
export const ALL_REGION_SIZES: RegionSize[] = ['huge', 'large', 'medium', 'small', 'tiny']

/**
 * Display configuration for each region size
 */
export const REGION_SIZE_CONFIG: Record<
  RegionSize,
  { label: string; emoji: string; description: string }
> = {
  huge: {
    label: 'Major',
    emoji: '🌍',
    description: 'Large, well-known countries/states',
  },
  large: {
    label: 'Large',
    emoji: '🗺️',
    description: 'Large territories',
  },
  medium: {
    label: 'Medium',
    emoji: '📍',
    description: 'Mid-sized territories',
  },
  small: {
    label: 'Small',
    emoji: '🏝️',
    description: 'Small territories and islands',
  },
  tiny: {
    label: 'Tiny',
    emoji: '🔍',
    description: 'Microstates and remote territories',
  },
}

/**
 * Default assistance level
 */
export const DEFAULT_ASSISTANCE_LEVEL = 'helpful'

/**
 * Default region sizes (medium difficulty - most regions)
 */
export const DEFAULT_REGION_SIZES: RegionSize[] = ['huge', 'large', 'medium']

/**
 * Global default difficulty config for maps without custom config
 * @deprecated - kept for backwards compatibility, use ASSISTANCE_LEVELS instead
 * New 4-level system: Learning, Easy, Normal, Expert
 */
export const DEFAULT_DIFFICULTY_CONFIG: MapDifficultyConfig = {
  levels: [
    {
      id: 'learning',
      label: 'Learning',
      emoji: '🌱',
      description: 'Guided exploration with maximum help',
      detailedDescription:
        'Large countries only (~57). Hot/cold feedback guides you. Hints auto-open and appear if stuck.',
      includeSizes: ['huge', 'large'],
      hotColdEnabled: true,
      hintsMode: 'onRequest',
      autoHintDefault: true,
      struggleHintEnabled: true,
      giveUpMode: 'reaskSoon',
      wrongClickShowsName: true,
    },
    {
      id: 'easy',
      label: 'Easy',
      emoji: '😊',
      description: 'Helpful feedback as you learn',
      detailedDescription: 'Most countries (~163). Hot/cold feedback. Press H for hints anytime.',
      includeSizes: ['huge', 'large', 'medium'],
      hotColdEnabled: true,
      hintsMode: 'onRequest',
      autoHintDefault: false,
      struggleHintEnabled: false,
      giveUpMode: 'reaskEnd',
      wrongClickShowsName: true,
    },
    {
      id: 'normal',
      label: 'Normal',
      emoji: '🎯',
      description: 'Standard challenge',
      detailedDescription: 'Nearly all countries (~223). No hot/cold. 3 hints per game.',
      includeSizes: ['huge', 'large', 'medium', 'small'],
      hotColdEnabled: false,
      hintsMode: 'limited',
      hintLimit: 3,
      autoHintDefault: false,
      struggleHintEnabled: false,
      giveUpMode: 'countsAgainst',
      wrongClickShowsName: false,
    },
    {
      id: 'expert',
      label: 'Expert',
      emoji: '🏆',
      description: 'Test your knowledge',
      detailedDescription: 'All countries including tiny islands (256). No hints. Pure geography.',
      includeSizes: ['huge', 'large', 'medium', 'small', 'tiny'],
      hotColdEnabled: false,
      hintsMode: 'none',
      autoHintDefault: false,
      struggleHintEnabled: false,
      giveUpMode: 'skipEntirely',
      wrongClickShowsName: false,
    },
  ],
  defaultLevel: 'easy',
}

/**
 * USA state size categories (by geographic area and recognition)
 * Uses state abbreviations (lowercase) from @svg-maps/usa
 */
const USA_STATE_SIZE_CATEGORIES: Record<RegionSize, Set<string>> = {
  // Huge: Instantly recognizable, largest states (~8)
  huge: new Set([
    'ca', // California
    'tx', // Texas
    'fl', // Florida
    'ny', // New York
    'ak', // Alaska
    'mt', // Montana
    'az', // Arizona
    'nv', // Nevada
  ]),

  // Large: Major states, clearly visible (~10)
  large: new Set([
    'nm', // New Mexico
    'co', // Colorado
    'or', // Oregon
    'wa', // Washington
    'ut', // Utah
    'wy', // Wyoming
    'mi', // Michigan
    'il', // Illinois
    'pa', // Pennsylvania
    'oh', // Ohio
  ]),

  // Medium: Recognizable states, moderate size (~17)
  medium: new Set([
    'id', // Idaho
    'nd', // North Dakota
    'sd', // South Dakota
    'ne', // Nebraska
    'ks', // Kansas
    'ok', // Oklahoma
    'mn', // Minnesota
    'ia', // Iowa
    'mo', // Missouri
    'ar', // Arkansas
    'la', // Louisiana
    'wi', // Wisconsin
    'in', // Indiana
    'ga', // Georgia
    'nc', // North Carolina
    'va', // Virginia
    'tn', // Tennessee
  ]),

  // Small: Smaller states (~10)
  small: new Set([
    'sc', // South Carolina
    'al', // Alabama
    'ms', // Mississippi
    'ky', // Kentucky
    'wv', // West Virginia
    'md', // Maryland
    'nj', // New Jersey
    'ma', // Massachusetts
    'me', // Maine
    'hi', // Hawaii
  ]),

  // Tiny: Small states, harder to find (~6)
  tiny: new Set([
    'vt', // Vermont
    'nh', // New Hampshire
    'ct', // Connecticut
    'ri', // Rhode Island
    'de', // Delaware
    'dc', // District of Columbia
  ]),
}

/**
 * Get the size category for a US state
 */
function getUSAStateSizeCategory(stateId: string): RegionSize | null {
  for (const [size, ids] of Object.entries(USA_STATE_SIZE_CATEGORIES)) {
    if (ids.has(stateId)) {
      return size as RegionSize
    }
  }
  return null
}

/**
 * Check if a US state should be included based on difficulty level's size requirements
 */
function shouldIncludeUSAState(stateId: string, includeSizes: RegionSize[]): boolean {
  const category = getUSAStateSizeCategory(stateId)
  if (!category) {
    // If no category found, include by default
    return true
  }
  return includeSizes.includes(category)
}

/**
 * USA map difficulty config - 4 levels like world map
 */
export const USA_DIFFICULTY_CONFIG: MapDifficultyConfig = {
  levels: [
    {
      id: 'learning',
      label: 'Learning',
      emoji: '🌱',
      description: 'Guided exploration with maximum help',
      detailedDescription:
        'Major states only (~18). Hot/cold feedback guides you. Hints auto-open and appear if stuck.',
      includeSizes: ['huge', 'large'],
      hotColdEnabled: true,
      hintsMode: 'onRequest',
      autoHintDefault: true,
      struggleHintEnabled: true,
      wrongClickShowsName: true,
      giveUpMode: 'reaskSoon',
    },
    {
      id: 'easy',
      label: 'Easy',
      emoji: '😊',
      description: 'Comfortable challenge with guidance',
      detailedDescription: 'Most states (~35). Hot/cold feedback. Press H for hints anytime.',
      includeSizes: ['huge', 'large', 'medium'],
      hotColdEnabled: true,
      hintsMode: 'onRequest',
      autoHintDefault: false,
      struggleHintEnabled: false,
      wrongClickShowsName: true,
      giveUpMode: 'reaskEnd',
    },
    {
      id: 'normal',
      label: 'Normal',
      emoji: '🎯',
      description: 'Standard challenge with limited hints',
      detailedDescription: 'Nearly all states (~45). No hot/cold. 3 hints per game.',
      includeSizes: ['huge', 'large', 'medium', 'small'],
      hotColdEnabled: false,
      hintsMode: 'limited',
      hintLimit: 3,
      autoHintDefault: false,
      struggleHintEnabled: false,
      giveUpMode: 'countsAgainst',
      wrongClickShowsName: false,
    },
    {
      id: 'expert',
      label: 'Expert',
      emoji: '🏆',
      description: 'Full challenge, no assistance',
      detailedDescription: 'All 51 states/territories. No hints. Pure geography.',
      includeSizes: ['huge', 'large', 'medium', 'small', 'tiny'],
      hotColdEnabled: false,
      hintsMode: 'none',
      autoHintDefault: false,
      struggleHintEnabled: false,
      giveUpMode: 'skipEntirely',
      wrongClickShowsName: false,
    },
  ],
  defaultLevel: 'easy',
}

/**
 * Region size categories for world map
 * Curated based on actual geographic size and prominence (not bounding box area)
 * ISO 3166-1 alpha-2 codes (lowercase)
 */
const REGION_SIZE_CATEGORIES: Record<RegionSize, Set<string>> = {
  // Huge: Major powers, instantly recognizable (~15)
  huge: new Set([
    'ru', // Russia
    'cn', // China
    'us', // United States
    'ca', // Canada
    'br', // Brazil
    'au', // Australia
    'in', // India
    'ar', // Argentina
    'kz', // Kazakhstan
    'dz', // Algeria
    'cd', // DR Congo
    'sa', // Saudi Arabia
    'mx', // Mexico
    'id', // Indonesia
    'ly', // Libya
  ]),

  // Large: Major countries, clearly visible (~42)
  large: new Set([
    'sd',
    'ir',
    'mn',
    'pe',
    'td',
    'ne',
    'ao',
    'ml',
    'za',
    'co',
    've',
    'et',
    'eg',
    'mr',
    'bo',
    'ng',
    'tz',
    'cl',
    'zm',
    'mm',
    'af',
    'so',
    'cf',
    'ss',
    'mg',
    'mz',
    'pk',
    'tr',
    'ke',
    'fr',
    'th',
    'es',
    'cm',
    'pg',
    'ma',
    'ua',
    'jp',
    'de',
    'pl',
    'no',
    'se',
    'fi',
  ]),

  // Medium: Recognizable countries, moderate size (~106)
  medium: new Set([
    // Europe
    'gb',
    'it',
    'ro',
    'gr',
    'bg',
    'hu',
    'by',
    'at',
    'cz',
    'rs',
    'ie',
    'lt',
    'lv',
    'hr',
    'ba',
    'sk',
    'ee',
    'dk',
    'nl',
    'be',
    'ch',
    'pt',
    'al',
    'md',
    'mk',
    'si',
    'me',
    'xk',
    'is',
    // Asia
    'vn',
    'my',
    'ph',
    'np',
    'bd',
    'kh',
    'la',
    'kp',
    'kr',
    'tw',
    'uz',
    'tm',
    'kg',
    'tj',
    'iq',
    'sy',
    'jo',
    'il',
    'lb',
    'az',
    'ge',
    'am',
    'ye',
    'om',
    'ae',
    'bt',
    'ps',
    'tl',
    // Africa
    'ci',
    'bf',
    'gh',
    'gn',
    'sn',
    'ug',
    'ga',
    'tg',
    'bj',
    'er',
    'mw',
    'ls',
    'sz',
    'rw',
    'bi',
    'sl',
    'lr',
    'gm',
    'gw',
    'cg',
    'gq',
    'dj',
    'tn',
    'bw',
    'na',
    'zw',
    'eh',
    // Americas
    'ec',
    'py',
    'uy',
    'sr',
    'gy',
    'pa',
    'cr',
    'ni',
    'hn',
    'gt',
    'bz',
    'sv',
    'cu',
    'do',
    'ht',
    'jm',
    'bs',
    'tt',
    'gf',
    'gl',
    // Oceania
    'nz',
    'fj',
  ]),

  // Small: Smaller countries, harder to find (~60)
  small: new Set([
    // Caribbean
    'bb',
    'ag',
    'dm',
    'lc',
    'vc',
    'gd',
    'kn',
    'aw',
    'cw',
    'bq',
    'sx',
    'mf',
    'bl',
    'tc',
    'vg',
    'vi',
    'ky',
    'ai',
    'ms',
    'pr',
    'bm',
    'gp',
    'mq',
    // Europe
    'lu',
    'cy',
    'mt',
    'ax',
    'fo',
    'gg',
    'im',
    'je',
    // Middle East
    'kw',
    'qa',
    'bh',
    // Africa
    'cv',
    'st',
    'km',
    'mu',
    're',
    'yt',
    'sc',
    'sh',
    // Asia
    'bn',
    'sg',
    'hk',
    'mo',
    'mv',
    'lk',
    'pm',
    // Oceania
    'ws',
    'to',
    'vu',
    'sb',
    'nc',
    'pf',
    'gu',
    'as',
    'mp',
    'pw',
    'fm',
  ]),

  // Tiny: Microstates and tiny islands, very hard to find (~33)
  tiny: new Set([
    // Europe
    'va',
    'mc',
    'sm',
    'ad',
    'li',
    'gi',
    // Pacific
    'nr',
    'tv',
    'mh',
    'ki',
    'nu',
    'tk',
    'ck',
    'wf',
    'pn',
    // Other territories
    'io',
    'cx',
    'cc',
    'nf',
    'hm',
    'bv',
    'sj',
    'fk',
    'gs',
    'aq',
    'tf',
    'go',
    'ju', // French territories
    'um-dq',
    'um-fq',
    'um-hq',
    'um-jq',
    'um-mq',
    'um-wq', // US Minor Outlying Islands
  ]),
}

/**
 * Get the size category for a region ID
 */
export function getRegionSizeCategory(regionId: string): RegionSize | null {
  for (const [size, ids] of Object.entries(REGION_SIZE_CATEGORIES)) {
    if (ids.has(regionId)) {
      return size as RegionSize
    }
  }
  return null // Region not categorized (shouldn't happen for world map)
}

/**
 * Check if a region should be included based on difficulty level's size requirements
 */
export function shouldIncludeRegion(regionId: string, includeSizes: RegionSize[]): boolean {
  const category = getRegionSizeCategory(regionId)
  if (!category) {
    // If no category found, include by default (for regions not in our list)
    return true
  }
  return includeSizes.includes(category)
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
    originalViewBox: worldMapSource.viewBox, // Same as viewBox for base map
    customCrop: null, // No custom crop for base map
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
    originalViewBox: usaMapSource.viewBox, // Same as viewBox for base map
    customCrop: null, // No custom crop for base map
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
    throw new Error(
      `[Maps] ${mapId} map not yet loaded. Use await getMapData() or ensure maps are preloaded.`
    )
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
  },
})

export const USA_MAP: MapData = new Proxy({} as MapData, {
  get(target, prop) {
    return getMapDataSync('usa')[prop as keyof MapData]
  },
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
 * Uses custom crop if available, otherwise calculates from bounding box with padding
 */
export function calculateContinentViewBox(
  regions: MapRegion[],
  continentId: ContinentId | 'all',
  originalViewBox: string,
  mapId: string = 'world'
): string {
  if (continentId === 'all') {
    return originalViewBox
  }

  // Check for custom crop override first
  const customCrop = getCustomCrop(mapId, continentId)
  if (customCrop) {
    return customCrop
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
 * Parse a viewBox string into numeric components
 */
export function parseViewBox(viewBox: string): {
  x: number
  y: number
  width: number
  height: number
} {
  const parts = viewBox.split(' ').map(Number)
  return {
    x: parts[0] || 0,
    y: parts[1] || 0,
    width: parts[2] || 1000,
    height: parts[3] || 500,
  }
}

/**
 * Calculate a display viewBox that:
 * 1. Guarantees the crop region is fully visible and centered
 * 2. Fills any remaining viewport space with more of the map (no letterboxing)
 * 3. Stays within the original map's bounds
 *
 * This creates a "fit crop with fill" effect - the crop region is the minimum
 * visible area, but we expand to fill the container's aspect ratio.
 *
 * @param originalViewBox - The full map's viewBox (bounds)
 * @param cropRegion - The custom crop that MUST be visible
 * @param containerAspect - The container's width/height ratio
 * @returns The display viewBox string
 */
export function calculateFitCropViewBox(
  originalViewBox: { x: number; y: number; width: number; height: number },
  cropRegion: { x: number; y: number; width: number; height: number },
  containerAspect: number // width / height
): string {
  const cropAspect = cropRegion.width / cropRegion.height

  let viewBoxWidth: number
  let viewBoxHeight: number

  // Step 1: Calculate dimensions to fill container while containing crop
  if (containerAspect > cropAspect) {
    // Container is WIDER than crop - expand horizontally
    viewBoxHeight = cropRegion.height
    viewBoxWidth = viewBoxHeight * containerAspect
  } else {
    // Container is TALLER than crop - expand vertically
    viewBoxWidth = cropRegion.width
    viewBoxHeight = viewBoxWidth / containerAspect
  }

  // Step 2: Center on crop region
  const cropCenterX = cropRegion.x + cropRegion.width / 2
  const cropCenterY = cropRegion.y + cropRegion.height / 2

  let viewBoxX = cropCenterX - viewBoxWidth / 2
  let viewBoxY = cropCenterY - viewBoxHeight / 2

  // Step 3: Clamp to original map bounds (shift if needed, don't resize)

  // Clamp X
  if (viewBoxX < originalViewBox.x) {
    viewBoxX = originalViewBox.x
  } else if (viewBoxX + viewBoxWidth > originalViewBox.x + originalViewBox.width) {
    viewBoxX = originalViewBox.x + originalViewBox.width - viewBoxWidth
  }

  // Clamp Y
  if (viewBoxY < originalViewBox.y) {
    viewBoxY = originalViewBox.y
  } else if (viewBoxY + viewBoxHeight > originalViewBox.y + originalViewBox.height) {
    viewBoxY = originalViewBox.y + originalViewBox.height - viewBoxHeight
  }

  // Step 4: Handle case where expanded viewBox exceeds map bounds
  // (show entire map dimension, may result in letterboxing on that axis)
  if (viewBoxWidth > originalViewBox.width) {
    viewBoxWidth = originalViewBox.width
    viewBoxX = originalViewBox.x
  }
  if (viewBoxHeight > originalViewBox.height) {
    viewBoxHeight = originalViewBox.height
    viewBoxY = originalViewBox.y
  }

  return `${viewBoxX.toFixed(2)} ${viewBoxY.toFixed(2)} ${viewBoxWidth.toFixed(2)} ${viewBoxHeight.toFixed(2)}`
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
 * Filter regions by size categories (primary filtering function)
 * This is the new clean API that takes sizes directly
 */
export function filterRegionsBySizes(
  regions: MapRegion[],
  includeSizes: RegionSize[],
  mapId: 'world' | 'usa' = 'world'
): MapRegion[] {
  // If all sizes included or empty array, return all regions
  if (includeSizes.length === 0 || includeSizes.length === ALL_REGION_SIZES.length) {
    return regions
  }

  // Use appropriate size checker based on map
  const shouldInclude =
    mapId === 'usa'
      ? (id: string) => shouldIncludeUSAState(id, includeSizes)
      : (id: string) => shouldIncludeRegion(id, includeSizes)

  const filtered = regions.filter((r) => shouldInclude(r.id))
  return filtered
}

/**
 * Filter regions based on difficulty level configuration
 * @deprecated Use filterRegionsBySizes instead
 * Supports: 1) Size-based filtering (new), 2) Explicit exclusions, 3) Percentile-based (legacy)
 */
function filterRegionsByDifficulty(
  regions: MapRegion[],
  level: DifficultyLevel,
  mapId: 'world' | 'usa' = 'world'
): MapRegion[] {
  // 1. Size-based filtering (new system - highest priority)
  if (level.includeSizes && level.includeSizes.length > 0) {
    return filterRegionsBySizes(regions, level.includeSizes, mapId)
  }

  // 2. Explicit exclusions
  if (level.excludeRegions && level.excludeRegions.length > 0) {
    const filtered = regions.filter((r) => !level.excludeRegions!.includes(r.id))
    console.log(
      `[Difficulty Filter] ${level.id} mode: ${filtered.length}/${regions.length} regions (excluded: ${level.excludeRegions.join(', ')})`
    )
    return filtered
  }

  // 3. Legacy percentile filtering
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
  let customCrop: string | null = null

  // Apply continent filtering for world map
  if (mapId === 'world' && continentId !== 'all') {
    filteredRegions = filterRegionsByContinent(filteredRegions, continentId)
    // Check for custom crop - this is what we'll use for fit-crop-with-fill
    customCrop = getCustomCrop(mapId, continentId)
    adjustedViewBox = calculateContinentViewBox(
      mapData.regions,
      continentId,
      mapData.viewBox,
      mapId
    )
  }

  // Apply difficulty filtering
  filteredRegions = filterRegionsByDifficulty(filteredRegions, level, mapId)

  return {
    ...mapData,
    regions: filteredRegions,
    viewBox: adjustedViewBox,
    originalViewBox: mapData.viewBox, // Always the base map's viewBox
    customCrop, // The custom crop region if any (for fit-crop-with-fill)
  }
}

/**
 * Get filtered map data by size categories (async - for server-side)
 * This is the new clean API that takes sizes directly
 */
export async function getFilteredMapDataBySizes(
  mapId: 'world' | 'usa',
  continentId: ContinentId | 'all',
  includeSizes: RegionSize[]
): Promise<MapData> {
  const mapData = await getMapData(mapId)

  let filteredRegions = mapData.regions
  let adjustedViewBox = mapData.viewBox
  let customCrop: string | null = null

  // Apply continent filtering for world map
  if (mapId === 'world' && continentId !== 'all') {
    filteredRegions = filterRegionsByContinent(filteredRegions, continentId)
    customCrop = getCustomCrop(mapId, continentId)
    adjustedViewBox = calculateContinentViewBox(
      mapData.regions,
      continentId,
      mapData.viewBox,
      mapId
    )
  }

  // Apply size filtering
  filteredRegions = filterRegionsBySizes(filteredRegions, includeSizes, mapId)

  return {
    ...mapData,
    regions: filteredRegions,
    viewBox: adjustedViewBox,
    originalViewBox: mapData.viewBox,
    customCrop,
  }
}

/**
 * Get filtered map data by size categories synchronously (for client components)
 * This is the new clean API that takes sizes directly
 */
export function getFilteredMapDataBySizesSync(
  mapId: 'world' | 'usa',
  continentId: ContinentId | 'all',
  includeSizes: RegionSize[]
): MapData {
  const mapData = mapId === 'world' ? WORLD_MAP : USA_MAP

  let filteredRegions = mapData.regions
  let adjustedViewBox = mapData.viewBox
  let customCrop: string | null = null

  // Apply continent filtering for world map
  if (mapId === 'world' && continentId !== 'all') {
    filteredRegions = filterRegionsByContinent(filteredRegions, continentId)
    customCrop = getCustomCrop(mapId, continentId)
    adjustedViewBox = calculateContinentViewBox(
      mapData.regions,
      continentId,
      mapData.viewBox,
      mapId
    )
  }

  // Apply size filtering
  filteredRegions = filterRegionsBySizes(filteredRegions, includeSizes, mapId)

  return {
    ...mapData,
    regions: filteredRegions,
    viewBox: adjustedViewBox,
    originalViewBox: mapData.viewBox,
    customCrop,
  }
}

/**
 * Sub-map registry: maps country/region IDs to their detailed sub-maps
 * For drill-down navigation in the map selector
 */
export interface SubMapEntry {
  /** Continent this region belongs to */
  continentId: ContinentId
  /** ID of the sub-map (e.g., 'usa') */
  mapId: 'usa' // Expandable to other maps in future
  /** Display name for breadcrumbs */
  name: string
  /** Emoji for UI */
  emoji: string
}

export const SUB_MAPS: Record<string, SubMapEntry> = {
  us: {
    continentId: 'north-america',
    mapId: 'usa',
    name: 'USA',
    emoji: '🇺🇸',
  },
  // Future expansions:
  // de: { continentId: 'europe', mapId: 'germany', name: 'Germany', emoji: '🇩🇪' },
  // cn: { continentId: 'asia', mapId: 'china', name: 'China', emoji: '🇨🇳' },
}

/**
 * Check if a region has a detailed sub-map available
 */
export function hasSubMap(regionId: string): boolean {
  return regionId in SUB_MAPS
}

/**
 * Get sub-map entry for a region, if available
 */
export function getSubMapEntry(regionId: string): SubMapEntry | null {
  return SUB_MAPS[regionId] ?? null
}

/**
 * Get sub-map data for a region, if available
 * Returns the actual MapData for the sub-map
 */
export function getSubMapData(regionId: string): MapData | null {
  const entry = SUB_MAPS[regionId]
  if (!entry) return null

  // Return the appropriate map data
  if (entry.mapId === 'usa') {
    return USA_MAP
  }

  return null
}

/**
 * Get all regions in a continent that have sub-maps
 */
export function getSubMapsForContinent(continentId: ContinentId): string[] {
  return Object.entries(SUB_MAPS)
    .filter(([_, entry]) => entry.continentId === continentId)
    .map(([regionId]) => regionId)
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
  let customCrop: string | null = null

  // Apply continent filtering for world map
  if (mapId === 'world' && continentId !== 'all') {
    filteredRegions = filterRegionsByContinent(filteredRegions, continentId)
    // Check for custom crop - this is what we'll use for fit-crop-with-fill
    customCrop = getCustomCrop(mapId, continentId)
    adjustedViewBox = calculateContinentViewBox(
      mapData.regions,
      continentId,
      mapData.viewBox,
      mapId
    )
  }

  // Apply difficulty filtering
  filteredRegions = filterRegionsByDifficulty(filteredRegions, level, mapId)

  return {
    ...mapData,
    regions: filteredRegions,
    viewBox: adjustedViewBox,
    originalViewBox: mapData.viewBox, // Always the base map's viewBox
    customCrop, // The custom crop region if any (for fit-crop-with-fill)
  }
}
