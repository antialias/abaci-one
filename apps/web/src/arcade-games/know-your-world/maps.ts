import { getCustomCrop } from './customCrops'
import type { MapData, MapRegion } from './types'

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
  id: 'learning' | 'guided' | 'helpful' | 'standard' | 'none'
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
    id: 'learning',
    label: 'Learning',
    emoji: '📚',
    description:
      'Type first 3 letters to unlock hints, maximum feedback, best for memorizing names',
    hotColdEnabled: true,
    hintsMode: 'onRequest',
    autoHintDefault: true,
    struggleHintEnabled: true,
    giveUpMode: 'reaskSoon',
    wrongClickShowsName: true,
    nameConfirmationLetters: 3, // Must type first 3 letters to unlock hints
  },
  {
    id: 'guided',
    label: 'Guided',
    emoji: '🎓',
    description: 'Maximum help - auto hints, hot/cold feedback, shows names on wrong clicks',
    hotColdEnabled: true,
    hintsMode: 'onRequest',
    autoHintDefault: true,
    struggleHintEnabled: true,
    giveUpMode: 'reaskSoon',
    wrongClickShowsName: true,
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
 * Geopolitical importance category for filtering
 * Based on international influence (G7/G20/UNSC membership, regional power, etc.)
 */
export type ImportanceLevel = 'superpower' | 'major' | 'regional' | 'standard' | 'minor'

/**
 * Geopolitical importance categories for world map
 * Curated based on international influence and diplomatic standing
 * ISO 3166-1 alpha-2 codes (lowercase)
 */
const REGION_IMPORTANCE_CATEGORIES: Record<ImportanceLevel, Set<string>> = {
  // Superpower: UNSC P5 + G7 (~9 countries)
  superpower: new Set([
    'us', // United States - superpower
    'cn', // China - superpower
    'ru', // Russia - UNSC P5
    'gb', // United Kingdom - UNSC P5, G7
    'fr', // France - UNSC P5, G7
    'de', // Germany - G7
    'jp', // Japan - G7
    'it', // Italy - G7
    'ca', // Canada - G7
  ]),

  // Major: G20 members and other major economies (~15)
  major: new Set([
    'in', // India - G20, rising power
    'br', // Brazil - G20, regional power
    'au', // Australia - G20
    'kr', // South Korea - G20
    'mx', // Mexico - G20
    'id', // Indonesia - G20
    'tr', // Turkey - G20, NATO
    'sa', // Saudi Arabia - G20, OPEC leader
    'ar', // Argentina - G20
    'za', // South Africa - G20, BRICS
    'es', // Spain - EU major
    'nl', // Netherlands - EU founding
    'pl', // Poland - EU major
    'se', // Sweden - EU
    'ch', // Switzerland - financial hub
  ]),

  // Regional: Significant regional powers and influential nations (~45)
  regional: new Set([
    // Europe
    'at',
    'be',
    'dk',
    'fi',
    'gr',
    'ie',
    'no',
    'pt',
    'cz',
    'ro',
    'hu',
    // Middle East
    'ae',
    'il',
    'eg',
    'ir',
    'iq',
    'pk',
    'qa',
    'kw',
    // Asia
    'th',
    'my',
    'sg',
    'vn',
    'ph',
    'bd',
    'tw',
    'hk',
    // Africa
    'ng',
    'ke',
    'et',
    'dz',
    'ma',
    'gh',
    // Americas
    'cl',
    'co',
    'pe',
    've',
    'cu',
    // Oceania
    'nz',
  ]),

  // Standard: Most UN member states with moderate influence (~100)
  standard: new Set([
    // Europe
    'ua',
    'by',
    'sk',
    'bg',
    'hr',
    'rs',
    'lt',
    'lv',
    'ee',
    'si',
    'ba',
    'mk',
    'al',
    'me',
    'xk',
    'md',
    'is',
    'cy',
    'mt',
    'lu',
    // Asia
    'af',
    'kz',
    'uz',
    'tm',
    'kg',
    'tj',
    'mn',
    'np',
    'lk',
    'mm',
    'kh',
    'la',
    'kp',
    'bt',
    'bn',
    // Middle East
    'jo',
    'lb',
    'sy',
    'ye',
    'om',
    'bh',
    'az',
    'ge',
    'am',
    'ps',
    // Africa
    'tz',
    'ug',
    'zm',
    'zw',
    'sd',
    'ss',
    'cd',
    'ao',
    'mz',
    'mg',
    'cm',
    'ci',
    'sn',
    'ml',
    'bf',
    'ne',
    'td',
    'cf',
    'cg',
    'ga',
    'gq',
    'bj',
    'tg',
    'gn',
    'sl',
    'lr',
    'gm',
    'gw',
    'mr',
    'tn',
    'ly',
    'so',
    'er',
    'dj',
    'rw',
    'bi',
    'mw',
    'bw',
    'na',
    'sz',
    'ls',
    // Americas
    'ec',
    'bo',
    'py',
    'uy',
    'gy',
    'sr',
    'pa',
    'cr',
    'ni',
    'hn',
    'gt',
    'sv',
    'bz',
    'do',
    'ht',
    'jm',
    'tt',
    'bs',
    // Oceania
    'pg',
    'fj',
  ]),

  // Minor: Small states, territories, and dependencies (~80+)
  minor: new Set([
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
    'gf',
    // Europe
    'li',
    'ad',
    'mc',
    'sm',
    'va',
    'gi',
    'fo',
    'ax',
    'gg',
    'im',
    'je',
    // Pacific
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
    'mh',
    'ki',
    'nr',
    'tv',
    'nu',
    'tk',
    'ck',
    'wf',
    'pn',
    // Indian Ocean
    'mv',
    'sc',
    'mu',
    'km',
    'yt',
    're',
    // African territories
    'cv',
    'st',
    'sh',
    'eh',
    // Asian territories
    'mo',
    'tl',
    'io',
    'cx',
    'cc',
    'nf',
    // Other
    'gl',
    'pm',
    'hm',
    'bv',
    'sj',
    'fk',
    'gs',
    'aq',
    'tf',
    'go',
    'ju',
    'um-dq',
    'um-fq',
    'um-hq',
    'um-jq',
    'um-mq',
    'um-wq',
  ]),
}

/**
 * Display configuration for each importance level
 */
export const IMPORTANCE_LEVEL_CONFIG: Record<
  ImportanceLevel,
  { label: string; emoji: string; description: string }
> = {
  superpower: {
    label: 'Superpower',
    emoji: '🌟',
    description: 'G7 and UNSC permanent members',
  },
  major: {
    label: 'Major',
    emoji: '🏛️',
    description: 'G20 members and major economies',
  },
  regional: {
    label: 'Regional',
    emoji: '🌐',
    description: 'Regional powers and influential nations',
  },
  standard: {
    label: 'Standard',
    emoji: '🏳️',
    description: 'Most UN member states',
  },
  minor: {
    label: 'Minor',
    emoji: '🏝️',
    description: 'Small states and territories',
  },
}

/**
 * All importance levels in order from most to least important
 */
export const ALL_IMPORTANCE_LEVELS: ImportanceLevel[] = [
  'superpower',
  'major',
  'regional',
  'standard',
  'minor',
]

/**
 * Population category for filtering
 */
export type PopulationLevel = 'huge' | 'large' | 'medium' | 'small' | 'tiny'

/**
 * Population categories for world map
 * Based on approximate population (2024 estimates)
 * ISO 3166-1 alpha-2 codes (lowercase)
 */
const REGION_POPULATION_CATEGORIES: Record<PopulationLevel, Set<string>> = {
  // Huge: 100M+ population (~13 countries)
  huge: new Set([
    'cn', // China - 1.4B
    'in', // India - 1.4B
    'us', // United States - 335M
    'id', // Indonesia - 277M
    'pk', // Pakistan - 235M
    'br', // Brazil - 216M
    'ng', // Nigeria - 224M
    'bd', // Bangladesh - 173M
    'ru', // Russia - 144M
    'mx', // Mexico - 130M
    'jp', // Japan - 125M
    'et', // Ethiopia - 126M
    'ph', // Philippines - 117M
  ]),

  // Large: 30-100M population (~30 countries)
  large: new Set([
    'eg', // Egypt - 105M
    'vn', // Vietnam - 99M
    'cd', // DR Congo - 99M
    'tr', // Turkey - 85M
    'ir', // Iran - 87M
    'de', // Germany - 84M
    'th', // Thailand - 72M
    'gb', // United Kingdom - 67M
    'fr', // France - 68M
    'it', // Italy - 59M
    'za', // South Africa - 60M
    'tz', // Tanzania - 65M
    'mm', // Myanmar - 54M
    'kr', // South Korea - 52M
    'co', // Colombia - 52M
    'ke', // Kenya - 54M
    'es', // Spain - 48M
    'ar', // Argentina - 46M
    'ug', // Uganda - 48M
    'dz', // Algeria - 45M
    'sd', // Sudan - 46M
    'ua', // Ukraine - 38M
    'iq', // Iraq - 43M
    'af', // Afghanistan - 41M
    'pl', // Poland - 38M
    'ca', // Canada - 40M
    'ma', // Morocco - 37M
    'sa', // Saudi Arabia - 36M
    'uz', // Uzbekistan - 35M
    'pe', // Peru - 34M
    'my', // Malaysia - 34M
    'ao', // Angola - 35M
  ]),

  // Medium: 10-30M population (~50 countries)
  medium: new Set([
    've',
    'np',
    'gh',
    'mz',
    'ye',
    'mg',
    'kp',
    'au',
    'cm',
    'ci',
    'tw',
    'ne',
    'lk',
    'bf',
    'ml',
    'sy',
    'mw',
    'ro',
    'cl',
    'kz',
    'zm',
    'ec',
    'sn',
    'td',
    'nl',
    'so',
    'gt',
    'zw',
    'rw',
    'gn',
    'bj',
    'bi',
    'tn',
    'be',
    'bo',
    'ht',
    'cu',
    'cz',
    'jo',
    'gr',
    'do',
    'se',
    'pt',
    'az',
    'ae',
    'hn',
    'hu',
    'tj',
    'by',
    'at',
    'ch',
    'pg',
    'il',
    'tg',
    'sl',
    'ss',
  ]),

  // Small: 1-10M population (~60 countries)
  small: new Set([
    'hk',
    'la',
    'ly',
    'rs',
    'bg',
    'pa',
    'lb',
    'lr',
    'cf',
    'ni',
    'ie',
    'cr',
    'cg',
    'ps',
    'nz',
    'sk',
    'ge',
    'hr',
    'om',
    'pr',
    'dk',
    'no',
    'sg',
    'er',
    'fi',
    'ky',
    'mr',
    'kw',
    'bi',
    'md',
    'ja',
    'na',
    'mk',
    'bw',
    'lt',
    'gm',
    'ga',
    'si',
    'qa',
    'xk',
    'ba',
    'lv',
    'gw',
    'ee',
    'mu',
    'tt',
    'tl',
    'cy',
    'fj',
    'dj',
    'km',
    'bt',
    'gq',
    'ls',
    'sz',
    'bh',
    'mn',
    'me',
    'al',
    'arm',
    'jm',
    'kg',
    'tm',
  ]),

  // Tiny: <1M population (~60+ countries/territories)
  tiny: new Set([
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
    'ai',
    'ms',
    'bm',
    'gp',
    'mq',
    'gf',
    // Europe
    'lu',
    'mt',
    'is',
    'li',
    'ad',
    'mc',
    'sm',
    'va',
    'gi',
    'fo',
    'ax',
    'gg',
    'im',
    'je',
    // Pacific
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
    'mh',
    'ki',
    'nr',
    'tv',
    'nu',
    'tk',
    'ck',
    'wf',
    'pn',
    // Indian Ocean
    'mv',
    'sc',
    're',
    'yt',
    // Africa
    'cv',
    'st',
    'sh',
    'eh',
    // Asian/Other
    'mo',
    'bn',
    'pm',
    'io',
    'cx',
    'cc',
    'nf',
    'gl',
    'hm',
    'bv',
    'sj',
    'fk',
    'gs',
    'aq',
    'tf',
    'go',
    'ju',
    'um-dq',
    'um-fq',
    'um-hq',
    'um-jq',
    'um-mq',
    'um-wq',
  ]),
}

/**
 * Display configuration for each population level
 */
export const POPULATION_LEVEL_CONFIG: Record<
  PopulationLevel,
  { label: string; emoji: string; description: string }
> = {
  huge: {
    label: 'Huge',
    emoji: '🏙️',
    description: 'Countries with 100M+ people',
  },
  large: {
    label: 'Large',
    emoji: '🌆',
    description: 'Countries with 30-100M people',
  },
  medium: {
    label: 'Medium',
    emoji: '🏘️',
    description: 'Countries with 10-30M people',
  },
  small: {
    label: 'Small',
    emoji: '🏡',
    description: 'Countries with 1-10M people',
  },
  tiny: {
    label: 'Tiny',
    emoji: '🏝️',
    description: 'Countries with <1M people',
  },
}

/**
 * All population levels in order from largest to smallest
 */
export const ALL_POPULATION_LEVELS: PopulationLevel[] = ['huge', 'large', 'medium', 'small', 'tiny']

/**
 * Filter criteria type - which dimension to filter regions by
 */
export type FilterCriteria = 'size' | 'importance' | 'population'

/**
 * Display configuration for filter criteria tabs
 */
export const FILTER_CRITERIA_CONFIG: Record<
  FilterCriteria,
  { label: string; emoji: string; description: string }
> = {
  size: {
    label: 'Size',
    emoji: '📏',
    description: 'Filter by geographic size',
  },
  importance: {
    label: 'Importance',
    emoji: '🏛️',
    description: 'Filter by geopolitical importance',
  },
  population: {
    label: 'Population',
    emoji: '👥',
    description: 'Filter by population',
  },
}

/**
 * Get the importance category for a region ID
 */
export function getRegionImportanceCategory(regionId: string): ImportanceLevel | null {
  for (const [level, ids] of Object.entries(REGION_IMPORTANCE_CATEGORIES)) {
    if (ids.has(regionId)) {
      return level as ImportanceLevel
    }
  }
  return null
}

/**
 * Get the population category for a region ID
 */
export function getRegionPopulationCategory(regionId: string): PopulationLevel | null {
  for (const [level, ids] of Object.entries(REGION_POPULATION_CATEGORIES)) {
    if (ids.has(regionId)) {
      return level as PopulationLevel
    }
  }
  return null
}

/**
 * Check if a region should be included based on importance requirements
 */
export function shouldIncludeRegionByImportance(
  regionId: string,
  includeLevels: ImportanceLevel[]
): boolean {
  const category = getRegionImportanceCategory(regionId)
  if (!category) {
    // If no category found, include by default (for regions not in our list)
    return true
  }
  return includeLevels.includes(category)
}

/**
 * Check if a region should be included based on population requirements
 */
export function shouldIncludeRegionByPopulation(
  regionId: string,
  includeLevels: PopulationLevel[]
): boolean {
  const category = getRegionPopulationCategory(regionId)
  if (!category) {
    // If no category found, include by default (for regions not in our list)
    return true
  }
  return includeLevels.includes(category)
}

/**
 * Filter regions by importance levels
 */
export function filterRegionsByImportance(
  regions: MapRegion[],
  includeLevels: ImportanceLevel[]
): MapRegion[] {
  if (includeLevels.length === 0 || includeLevels.length === ALL_IMPORTANCE_LEVELS.length) {
    return regions
  }
  return regions.filter((r) => shouldIncludeRegionByImportance(r.id, includeLevels))
}

/**
 * Filter regions by population levels
 */
export function filterRegionsByPopulation(
  regions: MapRegion[],
  includeLevels: PopulationLevel[]
): MapRegion[] {
  if (includeLevels.length === 0 || includeLevels.length === ALL_POPULATION_LEVELS.length) {
    return regions
  }
  return regions.filter((r) => shouldIncludeRegionByPopulation(r.id, includeLevels))
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
 * Parse SVG path into subpaths (separated by M commands, closed by Z)
 * Returns array of point arrays, one per subpath
 */
function parsePathToSubpaths(pathString: string): Array<Array<[number, number]>> {
  const subpaths: Array<Array<[number, number]>> = []
  let currentSubpath: Array<[number, number]> = []
  let currentX = 0
  let currentY = 0
  let subpathStartX = 0
  let subpathStartY = 0

  const commandRegex = /([MmLlHhVvCcSsQqTtAaZz])([^MmLlHhVvCcSsQqTtAaZz]*)/g
  let match

  while ((match = commandRegex.exec(pathString)) !== null) {
    const command = match[1]
    const params =
      match[2]
        .trim()
        .match(/-?\d+\.?\d*/g)
        ?.map(Number) || []

    switch (command) {
      case 'M':
        if (currentSubpath.length > 0) subpaths.push(currentSubpath)
        currentSubpath = []
        for (let i = 0; i < params.length - 1; i += 2) {
          currentX = params[i]
          currentY = params[i + 1]
          if (i === 0) {
            subpathStartX = currentX
            subpathStartY = currentY
          }
          currentSubpath.push([currentX, currentY])
        }
        break
      case 'm':
        if (currentSubpath.length > 0) subpaths.push(currentSubpath)
        currentSubpath = []
        for (let i = 0; i < params.length - 1; i += 2) {
          currentX += params[i]
          currentY += params[i + 1]
          if (i === 0) {
            subpathStartX = currentX
            subpathStartY = currentY
          }
          currentSubpath.push([currentX, currentY])
        }
        break
      case 'L':
        for (let i = 0; i < params.length - 1; i += 2) {
          currentX = params[i]
          currentY = params[i + 1]
          currentSubpath.push([currentX, currentY])
        }
        break
      case 'l':
        for (let i = 0; i < params.length - 1; i += 2) {
          currentX += params[i]
          currentY += params[i + 1]
          currentSubpath.push([currentX, currentY])
        }
        break
      case 'H':
        for (const x of params) {
          currentX = x
          currentSubpath.push([currentX, currentY])
        }
        break
      case 'h':
        for (const dx of params) {
          currentX += dx
          currentSubpath.push([currentX, currentY])
        }
        break
      case 'V':
        for (const y of params) {
          currentY = y
          currentSubpath.push([currentX, currentY])
        }
        break
      case 'v':
        for (const dy of params) {
          currentY += dy
          currentSubpath.push([currentX, currentY])
        }
        break
      case 'C':
        for (let i = 0; i < params.length - 5; i += 6) {
          currentX = params[i + 4]
          currentY = params[i + 5]
          currentSubpath.push([currentX, currentY])
        }
        break
      case 'c':
        for (let i = 0; i < params.length - 5; i += 6) {
          currentX += params[i + 4]
          currentY += params[i + 5]
          currentSubpath.push([currentX, currentY])
        }
        break
      case 'S':
        for (let i = 0; i < params.length - 3; i += 4) {
          currentX = params[i + 2]
          currentY = params[i + 3]
          currentSubpath.push([currentX, currentY])
        }
        break
      case 's':
        for (let i = 0; i < params.length - 3; i += 4) {
          currentX += params[i + 2]
          currentY += params[i + 3]
          currentSubpath.push([currentX, currentY])
        }
        break
      case 'Q':
        for (let i = 0; i < params.length - 3; i += 4) {
          currentX = params[i + 2]
          currentY = params[i + 3]
          currentSubpath.push([currentX, currentY])
        }
        break
      case 'q':
        for (let i = 0; i < params.length - 3; i += 4) {
          currentX += params[i + 2]
          currentY += params[i + 3]
          currentSubpath.push([currentX, currentY])
        }
        break
      case 'T':
        for (let i = 0; i < params.length - 1; i += 2) {
          currentX = params[i]
          currentY = params[i + 1]
          currentSubpath.push([currentX, currentY])
        }
        break
      case 't':
        for (let i = 0; i < params.length - 1; i += 2) {
          currentX += params[i]
          currentY += params[i + 1]
          currentSubpath.push([currentX, currentY])
        }
        break
      case 'A':
        for (let i = 0; i < params.length - 6; i += 7) {
          currentX = params[i + 5]
          currentY = params[i + 6]
          currentSubpath.push([currentX, currentY])
        }
        break
      case 'a':
        for (let i = 0; i < params.length - 6; i += 7) {
          currentX += params[i + 5]
          currentY += params[i + 6]
          currentSubpath.push([currentX, currentY])
        }
        break
      case 'Z':
      case 'z':
        currentX = subpathStartX
        currentY = subpathStartY
        if (currentSubpath.length > 0) {
          subpaths.push(currentSubpath)
          currentSubpath = []
        }
        break
    }
  }

  if (currentSubpath.length > 0) subpaths.push(currentSubpath)
  return subpaths
}

/**
 * Calculate polygon area using shoelace formula
 */
function calculatePolygonArea(points: Array<[number, number]>): number {
  if (points.length < 3) return 0
  let area = 0
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length
    area += points[i][0] * points[j][1]
    area -= points[j][0] * points[i][1]
  }
  return Math.abs(area) / 2
}

/**
 * Calculate centroid of a polygon using shoelace formula
 */
function calculatePolygonCentroid(points: Array<[number, number]>): [number, number] {
  if (points.length === 0) return [0, 0]
  if (points.length < 3) {
    const avgX = points.reduce((s, p) => s + p[0], 0) / points.length
    const avgY = points.reduce((s, p) => s + p[1], 0) / points.length
    return [avgX, avgY]
  }

  let signedArea = 0
  let cx = 0
  let cy = 0

  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length
    const cross = points[i][0] * points[j][1] - points[j][0] * points[i][1]
    signedArea += cross
    cx += (points[i][0] + points[j][0]) * cross
    cy += (points[i][1] + points[j][1]) * cross
  }

  signedArea /= 2
  if (Math.abs(signedArea) < 0.0001) {
    const avgX = points.reduce((s, p) => s + p[0], 0) / points.length
    const avgY = points.reduce((s, p) => s + p[1], 0) / points.length
    return [avgX, avgY]
  }

  return [cx / (6 * signedArea), cy / (6 * signedArea)]
}

/**
 * Get the bounding box center of the largest closed subpath in an SVG path.
 * Uses bounding box center (not geometric centroid) for more visually predictable results
 * on elongated shapes like Norway or Chile.
 * Falls back to overall path bounding box center if subpath parsing fails.
 */
export function getLargestSubpathCentroid(pathString: string): { x: number; y: number } | null {
  const subpaths = parsePathToSubpaths(pathString)

  // If no subpaths found, return null to signal fallback should be used
  if (subpaths.length === 0) {
    return null
  }

  // Find largest subpath by area
  let largestSubpath = subpaths[0]
  let largestArea = calculatePolygonArea(largestSubpath)

  for (let i = 1; i < subpaths.length; i++) {
    const area = calculatePolygonArea(subpaths[i])
    if (area > largestArea) {
      largestArea = area
      largestSubpath = subpaths[i]
    }
  }

  // If largest subpath is empty or has no area, return null
  if (largestSubpath.length === 0 || largestArea === 0) {
    return null
  }

  // Calculate bounding box center of largest subpath
  let minX = largestSubpath[0][0]
  let maxX = largestSubpath[0][0]
  let minY = largestSubpath[0][1]
  let maxY = largestSubpath[0][1]

  for (const [x, y] of largestSubpath) {
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }

  return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 }
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

export function calculateBoundingBox(paths: string[]): BoundingBox {
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity

  for (const pathString of paths) {
    // Parse SVG path commands properly (similar to calculatePathCenter)
    const commandRegex = /([MmLlHhVvCcSsQqTtAaZz])([^MmLlHhVvCcSsQqTtAaZz]*)/g
    let currentX = 0
    let currentY = 0
    // Track the start of the current subpath (for z command)
    let subpathStartX = 0
    let subpathStartY = 0
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
          // First pair is moveto, subsequent pairs are implicit lineto (absolute)
          for (let i = 0; i < params.length - 1; i += 2) {
            currentX = params[i]
            currentY = params[i + 1]
            // First coordinate pair starts a new subpath
            if (i === 0) {
              subpathStartX = currentX
              subpathStartY = currentY
            }
            minX = Math.min(minX, currentX)
            maxX = Math.max(maxX, currentX)
            minY = Math.min(minY, currentY)
            maxY = Math.max(maxY, currentY)
          }
          break

        case 'm': // Move to (relative)
          // First pair is moveto (relative), subsequent pairs are implicit lineto (relative)
          // Both use relative coordinates, so same logic applies
          for (let i = 0; i < params.length - 1; i += 2) {
            currentX += params[i]
            currentY += params[i + 1]
            // First coordinate pair starts a new subpath
            if (i === 0) {
              subpathStartX = currentX
              subpathStartY = currentY
            }
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
          // Close path - return to start of current subpath
          currentX = subpathStartX
          currentY = subpathStartY
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
import { type ContinentId, getContinentForCountry } from './continents'

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
 * Safe zone margins (in pixels) - areas reserved for UI elements
 */
export interface SafeZoneMargins {
  top: number
  right: number
  bottom: number
  left: number
}

/**
 * Calculate a viewBox that fits the crop region into the "safe zone" (viewport minus UI margins)
 * while filling the entire viewport with map content.
 *
 * This creates a layout where:
 * 1. The crop region (findable regions) fits within the leftover rectangle (viewport minus margins)
 * 2. Extra map content shows under the UI elements (no wasted space)
 * 3. The entire viewport is filled with map - no letterboxing except at map bounds
 *
 * @param viewportWidth - The viewport width in pixels
 * @param viewportHeight - The viewport height in pixels
 * @param margins - Safe zone margins in pixels (areas reserved for UI)
 * @param cropRegion - The crop region that must fit within the safe zone (in SVG coords)
 * @param originalViewBox - The full map's bounds (in SVG coords)
 * @returns The display viewBox string
 */
export function calculateSafeZoneViewBox(
  viewportWidth: number,
  viewportHeight: number,
  margins: SafeZoneMargins,
  cropRegion: { x: number; y: number; width: number; height: number },
  originalViewBox: { x: number; y: number; width: number; height: number }
): string {
  // Step 1: Calculate leftover rectangle (the area where crop must fit)
  const leftoverWidth = viewportWidth - margins.left - margins.right
  const leftoverHeight = viewportHeight - margins.top - margins.bottom

  // Guard against invalid margins
  if (leftoverWidth <= 0 || leftoverHeight <= 0) {
    // Margins exceed viewport - fallback to standard fit
    const containerAspect = viewportWidth / viewportHeight
    return calculateFitCropViewBox(originalViewBox, cropRegion, containerAspect)
  }

  // Step 2: Calculate scale to fit crop into leftover rectangle
  // This is pixels per SVG unit
  const scaleX = leftoverWidth / cropRegion.width
  const scaleY = leftoverHeight / cropRegion.height
  const scale = Math.min(scaleX, scaleY) // Use the smaller scale to ensure crop fits

  // Step 3: Calculate viewBox dimensions to fill entire viewport at this scale
  const viewBoxWidth = viewportWidth / scale
  const viewBoxHeight = viewportHeight / scale

  // Step 4: Position viewBox so crop CENTER appears at leftover CENTER
  // This is the key insight: position based on crop, not map bounds
  const leftoverCenterX = margins.left + leftoverWidth / 2
  const leftoverCenterY = margins.top + leftoverHeight / 2
  const cropCenterX = cropRegion.x + cropRegion.width / 2
  const cropCenterY = cropRegion.y + cropRegion.height / 2

  // To make crop center appear at leftover center:
  // (cropCenterX - viewBoxX) * scale = leftoverCenterX
  // viewBoxX = cropCenterX - leftoverCenterX / scale
  let viewBoxX = cropCenterX - leftoverCenterX / scale
  let viewBoxY = cropCenterY - leftoverCenterY / scale

  // Step 5: Try to shift viewBox to show more map content (reduce letterboxing)
  // but ONLY if it doesn't push the crop outside the leftover area

  // Calculate the valid range for viewBoxX that keeps crop in leftover area
  // cropLeftPx = (crop.x - vbX) * scale >= margins.left  =>  vbX <= crop.x - margins.left/scale
  // cropRightPx = (crop.x + crop.w - vbX) * scale <= viewport.w - margins.right
  //            =>  vbX >= crop.x + crop.w - (viewport.w - margins.right)/scale
  const viewBoxX_max = cropRegion.x - margins.left / scale
  const viewBoxX_min = cropRegion.x + cropRegion.width - (viewportWidth - margins.right) / scale
  const viewBoxY_max = cropRegion.y - margins.top / scale
  const viewBoxY_min = cropRegion.y + cropRegion.height - (viewportHeight - margins.bottom) / scale

  // Clamp viewBox to stay within these bounds (ensures crop stays in leftover area)
  // Note: We DON'T clamp to map bounds here - we accept letterboxing (empty space outside map)
  // to ensure the crop is correctly positioned in the leftover area
  viewBoxX = Math.max(viewBoxX_min, Math.min(viewBoxX_max, viewBoxX))
  viewBoxY = Math.max(viewBoxY_min, Math.min(viewBoxY_max, viewBoxY))

  // Debug logging for safe zone calculation
  if (process.env.NODE_ENV === 'development') {
    // Calculate where crop actually appears on screen
    const cropLeftPx = (cropRegion.x - viewBoxX) * scale
    const cropTopPx = (cropRegion.y - viewBoxY) * scale
    const cropWidthPx = cropRegion.width * scale
    const cropHeightPx = cropRegion.height * scale
    const cropRightPx = cropLeftPx + cropWidthPx
    const cropBottomPx = cropTopPx + cropHeightPx

    // Calculate leftover bounds
    const leftoverLeft = margins.left
    const leftoverTop = margins.top
    const leftoverRight = viewportWidth - margins.right
    const leftoverBottom = viewportHeight - margins.bottom

    // Check if crop fits in leftover
    const fitsLeft = cropLeftPx >= leftoverLeft
    const fitsTop = cropTopPx >= leftoverTop
    const fitsRight = cropRightPx <= leftoverRight
    const fitsBottom = cropBottomPx <= leftoverBottom
    const fitsAll = fitsLeft && fitsTop && fitsRight && fitsBottom
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
