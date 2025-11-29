'use client'

import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import * as Tooltip from '@radix-ui/react-tooltip'
import { useSpring } from '@react-spring/web'
import { css } from '@styled/css'
import {
  RangeThermometer,
  type ThermometerOption,
  type RangePreviewState,
} from '@/components/Thermometer'
import { useTheme } from '@/contexts/ThemeContext'
import { MapSelectorMap } from './MapSelectorMap'
import { RegionListPanel } from './RegionListPanel'
import {
  WORLD_MAP,
  calculateContinentViewBox,
  filterRegionsByContinent,
  hasSubMap,
  getSubMapEntry,
  getSubMapData,
  getSubMapsForContinent,
  parseViewBox,
  calculateFitCropViewBox,
  calculateBoundingBox,
  getFilteredMapDataBySizesSync,
  REGION_SIZE_CONFIG,
  ALL_REGION_SIZES,
  IMPORTANCE_LEVEL_CONFIG,
  ALL_IMPORTANCE_LEVELS,
  POPULATION_LEVEL_CONFIG,
  ALL_POPULATION_LEVELS,
  FILTER_CRITERIA_CONFIG,
  filterRegionsByImportance,
  filterRegionsByPopulation,
  filterRegionsBySizes,
  calculateSafeZoneViewBox,
  type SafeZoneMargins,
  ASSISTANCE_LEVELS,
} from '../maps'
import { getCustomCrop } from '../customCrops'
import type { RegionSize, ImportanceLevel, PopulationLevel, FilterCriteria } from '../maps'
import {
  CONTINENTS,
  getContinentForCountry,
  COUNTRY_TO_CONTINENT,
  type ContinentId,
} from '../continents'
import {
  sizesToRange,
  rangeToSizes,
  importanceToRange,
  rangeToImportance,
  populationToRange,
  rangeToPopulation,
} from '../utils/regionSizeUtils'

/**
 * Safe zone margins - must match MapRenderer for consistent positioning
 * These define areas reserved for floating UI elements during gameplay
 */
const SAFE_ZONE_MARGINS: SafeZoneMargins = {
  top: 290, // Space for nav (~150px) + floating prompt (~140px with name input)
  right: 200, // Space for controls panel (hint, give up, hot/cold buttons)
  bottom: 0, // Error banner can overlap map
  left: 0,
}

/**
 * Size options for the range thermometer, ordered from largest to smallest
 */
const SIZE_OPTIONS: ThermometerOption<RegionSize>[] = ALL_REGION_SIZES.map((size) => ({
  value: size,
  label: REGION_SIZE_CONFIG[size].label,
  shortLabel: REGION_SIZE_CONFIG[size].label,
  emoji: REGION_SIZE_CONFIG[size].emoji,
}))

/**
 * Importance options for the range thermometer, ordered from most to least important
 */
const IMPORTANCE_OPTIONS: ThermometerOption<ImportanceLevel>[] = ALL_IMPORTANCE_LEVELS.map(
  (level) => ({
    value: level,
    label: IMPORTANCE_LEVEL_CONFIG[level].label,
    shortLabel: IMPORTANCE_LEVEL_CONFIG[level].label,
    emoji: IMPORTANCE_LEVEL_CONFIG[level].emoji,
  })
)

/**
 * Population options for the range thermometer, ordered from largest to smallest
 */
const POPULATION_OPTIONS: ThermometerOption<PopulationLevel>[] = ALL_POPULATION_LEVELS.map(
  (level) => ({
    value: level,
    label: POPULATION_LEVEL_CONFIG[level].label,
    shortLabel: POPULATION_LEVEL_CONFIG[level].label,
    emoji: POPULATION_LEVEL_CONFIG[level].emoji,
  })
)

/**
 * All filter criteria tabs
 */
const ALL_FILTER_CRITERIA: FilterCriteria[] = ['size', 'importance', 'population']

/**
 * Selection path for drill-down navigation:
 * - [] = World level
 * - [ContinentId] = Continent level (showing cropped world map)
 * - [ContinentId, SubMapId] = Sub-map level (e.g., USA states)
 */
export type SelectionPath = [] | [ContinentId] | [ContinentId, string]

/**
 * Planet data type for joke placeholder
 */
interface PlanetData {
  id: string
  name: string
  color: string
  size: number
  hasStripes?: boolean
  hasRings?: boolean
}

/**
 * Joke placeholder: Other planets for when viewing Earth (world map)
 * Just for fun - these don't actually do anything
 */
const PLANETS: PlanetData[] = [
  { id: 'mercury', name: 'Mercury', color: '#b0b0b0', size: 0.38 },
  { id: 'venus', name: 'Venus', color: '#e6c87a', size: 0.95 },
  { id: 'mars', name: 'Mars', color: '#c1440e', size: 0.53 },
  {
    id: 'jupiter',
    name: 'Jupiter',
    color: '#d8ca9d',
    size: 2.0,
    hasStripes: true,
  },
  { id: 'saturn', name: 'Saturn', color: '#ead6b8', size: 1.7, hasRings: true },
]

/** Game mode options */
type GameMode = 'cooperative' | 'race' | 'turn-based'

/** Assistance level options */
type AssistanceLevel = 'learning' | 'guided' | 'helpful' | 'standard' | 'none'

/** Game mode display options */
const GAME_MODE_OPTIONS: Array<{ value: GameMode; emoji: string; label: string }> = [
  { value: 'cooperative', emoji: '🤝', label: 'Co-op' },
  { value: 'race', emoji: '🏁', label: 'Race' },
  { value: 'turn-based', emoji: '↔️', label: 'Turns' },
]

interface DrillDownMapSelectorProps {
  /** Callback when selection changes (map/continent for game start) */
  onSelectionChange: (mapId: 'world' | 'usa', continentId: ContinentId | 'all') => void
  /** Callback when user clicks a country without sub-map (immediate game start) */
  onStartGame: () => void
  /** Current selected map (for initial state sync) */
  selectedMap: 'world' | 'usa'
  /** Current selected continent (for initial state sync) */
  selectedContinent: ContinentId | 'all'
  /** Region sizes to include (for showing excluded regions dimmed) */
  includeSizes: RegionSize[]
  /** Callback when region sizes change */
  onRegionSizesChange: (sizes: RegionSize[]) => void
  /** Region counts per size category */
  regionCountsBySize: Record<string, number>
  /** When true, fills parent container and uses overlay positioning for UI elements */
  fillContainer?: boolean
  /** Current game mode (for unified controls in fillContainer mode) */
  gameMode?: GameMode
  /** Callback when game mode changes */
  onGameModeChange?: (mode: GameMode) => void
  /** Current assistance level (for unified controls in fillContainer mode) */
  assistanceLevel?: AssistanceLevel
  /** Callback when assistance level changes */
  onAssistanceLevelChange?: (level: AssistanceLevel) => void
}

interface BreadcrumbItem {
  label: string
  emoji: string
  path: SelectionPath
  isClickable: boolean
}

export function DrillDownMapSelector({
  onSelectionChange,
  onStartGame,
  selectedMap,
  selectedContinent,
  includeSizes,
  onRegionSizesChange,
  regionCountsBySize,
  fillContainer = false,
  gameMode,
  onGameModeChange,
  assistanceLevel,
  onAssistanceLevelChange,
}: DrillDownMapSelectorProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  // Initialize path from props
  const getInitialPath = (): SelectionPath => {
    if (selectedMap === 'usa') {
      // USA sub-map selected
      return ['north-america', 'us']
    }
    if (selectedContinent !== 'all') {
      // Continent selected
      return [selectedContinent]
    }
    // World level
    return []
  }

  const [path, setPath] = useState<SelectionPath>(getInitialPath)
  const [hoveredRegion, setHoveredRegion] = useState<string | null>(null)
  const [sizeRangePreview, setSizeRangePreview] = useState<RangePreviewState<RegionSize> | null>(
    null
  )
  const [containerDimensions, setContainerDimensions] = useState({
    width: 0,
    height: 0,
  })
  const containerRef = useRef<HTMLDivElement>(null)
  // Track which region name is being hovered in the popover (for zoom preview)
  const [previewRegionName, setPreviewRegionName] = useState<string | null>(null)

  // Filter criteria tab state
  const [activeFilterCriteria, setActiveFilterCriteria] = useState<FilterCriteria>('size')

  // Local state for importance and population filters (not persisted, just for display filtering)
  const [includeImportance, setIncludeImportance] = useState<ImportanceLevel[]>([
    'superpower',
    'major',
    'regional',
  ])
  const [includePopulation, setIncludePopulation] = useState<PopulationLevel[]>([
    'huge',
    'large',
    'medium',
  ])

  // Preview states for importance and population thermometers
  const [importanceRangePreview, setImportanceRangePreview] =
    useState<RangePreviewState<ImportanceLevel> | null>(null)
  const [populationRangePreview, setPopulationRangePreview] =
    useState<RangePreviewState<PopulationLevel> | null>(null)

  // Sync local path state when props change from external sources (e.g., other players)
  useEffect(() => {
    const expectedPath = getInitialPath()
    const pathMatches =
      path.length === expectedPath.length && path.every((p, i) => p === expectedPath[i])

    if (!pathMatches) {
      setPath(expectedPath)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMap, selectedContinent])

  // Measure container dimensions for viewBox calculation
  useEffect(() => {
    const measureContainer = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        setContainerDimensions({ width: rect.width, height: rect.height })
      }
    }

    measureContainer()
    window.addEventListener('resize', measureContainer)
    return () => window.removeEventListener('resize', measureContainer)
  }, [])

  // Derived state
  const currentLevel = path.length

  // Get current map data and viewBox based on path
  const { mapData, viewBox, visibleRegions, highlightedRegions } = useMemo(() => {
    if (currentLevel === 2) {
      // Sub-map level (e.g., USA states)
      const subMapId = path[1]
      const subMapData = getSubMapData(subMapId)
      if (subMapData) {
        // For USA in fillContainer mode, use safe zone calculation to match gameplay
        if (fillContainer && containerDimensions.width > 0 && containerDimensions.height > 0) {
          const originalBounds = parseViewBox(subMapData.viewBox)
          // USA doesn't have custom crops, so use full map bounds
          const customCrop = getCustomCrop('usa', 'all')
          const cropRegion = customCrop ? parseViewBox(customCrop) : originalBounds

          const safeZoneViewBox = calculateSafeZoneViewBox(
            containerDimensions.width,
            containerDimensions.height,
            SAFE_ZONE_MARGINS,
            cropRegion,
            originalBounds
          )

          return {
            mapData: subMapData,
            viewBox: safeZoneViewBox,
            visibleRegions: undefined,
            highlightedRegions: [],
          }
        }

        return {
          mapData: subMapData,
          viewBox: subMapData.viewBox,
          visibleRegions: undefined, // Show all regions in sub-map
          highlightedRegions: [], // No further drill-down from USA states
        }
      }
    }

    // World or continent level - use world map
    // path[0] is guaranteed to be ContinentId when currentLevel >= 1
    const continentId: ContinentId | 'all' = currentLevel >= 1 && path[0] ? path[0] : 'all'

    // For fillContainer mode (playing phase), use the same safe zone calculation as MapRenderer
    // This ensures the map positioning matches exactly between setup and gameplay
    if (fillContainer && containerDimensions.width > 0 && containerDimensions.height > 0) {
      const originalBounds = parseViewBox(WORLD_MAP.viewBox)

      // Use custom crop if defined, otherwise use full map bounds (same logic as MapRenderer)
      const customCrop = continentId !== 'all' ? getCustomCrop('world', continentId) : null
      const cropRegion = customCrop ? parseViewBox(customCrop) : originalBounds

      const safeZoneViewBox = calculateSafeZoneViewBox(
        containerDimensions.width,
        containerDimensions.height,
        SAFE_ZONE_MARGINS,
        cropRegion,
        originalBounds
      )

      // Filter visible regions if on continent level
      const visible =
        continentId !== 'all'
          ? filterRegionsByContinent(WORLD_MAP.regions, continentId).map((r) => r.id)
          : undefined

      // Get regions with sub-maps for this continent (or all continents if world level)
      let highlighted: string[] = []
      if (continentId !== 'all') {
        highlighted = getSubMapsForContinent(continentId)
      } else {
        const allContinentIds: ContinentId[] = [
          'africa',
          'asia',
          'europe',
          'north-america',
          'oceania',
          'south-america',
        ]
        highlighted = allContinentIds.flatMap((cId) => getSubMapsForContinent(cId))
      }

      return {
        mapData: WORLD_MAP,
        viewBox: safeZoneViewBox,
        visibleRegions: visible,
        highlightedRegions: highlighted,
      }
    }

    // Non-fillContainer mode: use expanded viewBox for better context during setup
    // Calculate viewBox for continent (or full world)
    const gameplayViewBox = calculateContinentViewBox(
      WORLD_MAP.regions,
      continentId,
      WORLD_MAP.viewBox,
      'world'
    )

    // Expand the viewBox by 30% on each side for selector (less zoomed in)
    // But only for continent views, not world view
    let adjustedViewBox = gameplayViewBox
    if (continentId !== 'all') {
      const parsed = parseViewBox(gameplayViewBox)
      const originalParsed = parseViewBox(WORLD_MAP.viewBox)
      const expandFactor = 0.3 // 30% expansion on each side

      const expandX = parsed.width * expandFactor
      const expandY = parsed.height * expandFactor

      // Calculate expanded crop region (clamped to original map bounds)
      const cropX = Math.max(originalParsed.x, parsed.x - expandX)
      const cropY = Math.max(originalParsed.y, parsed.y - expandY)
      const cropWidth = Math.min(
        originalParsed.x + originalParsed.width - cropX,
        parsed.width + expandX * 2
      )
      const cropHeight = Math.min(
        originalParsed.y + originalParsed.height - cropY,
        parsed.height + expandY * 2
      )

      // Use calculateFitCropViewBox to adjust for container aspect ratio
      // This ensures the crop fits within the container without clipping
      if (containerDimensions.width > 0 && containerDimensions.height > 0) {
        const containerAspect = containerDimensions.width / containerDimensions.height
        adjustedViewBox = calculateFitCropViewBox(
          originalParsed,
          { x: cropX, y: cropY, width: cropWidth, height: cropHeight },
          containerAspect
        )
      } else {
        // Fallback before container is measured
        adjustedViewBox = `${cropX.toFixed(2)} ${cropY.toFixed(2)} ${cropWidth.toFixed(2)} ${cropHeight.toFixed(2)}`
      }
    }

    // Filter visible regions if on continent level
    const visible =
      continentId !== 'all'
        ? filterRegionsByContinent(WORLD_MAP.regions, continentId).map((r) => r.id)
        : undefined

    // Get regions with sub-maps for this continent (or all continents if world level)
    let highlighted: string[] = []
    if (continentId !== 'all') {
      highlighted = getSubMapsForContinent(continentId)
    } else {
      // At world level, collect all regions with sub-maps across all continents
      const allContinentIds: ContinentId[] = [
        'africa',
        'asia',
        'europe',
        'north-america',
        'oceania',
        'south-america',
      ]
      highlighted = allContinentIds.flatMap((cId) => getSubMapsForContinent(cId))
    }

    return {
      mapData: WORLD_MAP,
      viewBox: adjustedViewBox,
      visibleRegions: visible,
      highlightedRegions: highlighted,
    }
  }, [currentLevel, path, containerDimensions, fillContainer])

  // Region groups for hover highlighting at world level
  // Maps each country to its continent so hovering one country highlights all countries in that continent
  const regionGroups = useMemo(() => {
    if (currentLevel !== 0) return undefined

    // Build a Map from country ID to continent ID
    const groups = new Map<string, string>()
    for (const [countryId, continentId] of Object.entries(COUNTRY_TO_CONTINENT)) {
      groups.set(countryId, continentId)
    }
    return groups
  }, [currentLevel])

  // Get base regions for the current view (continent filtered but no criteria filtering)
  const baseRegions = useMemo(() => {
    const mapId = currentLevel === 2 && path[1] ? 'usa' : 'world'
    const continentId: ContinentId | 'all' =
      currentLevel >= 1 && path[0] ? path[0] : selectedContinent

    const allRegionsMapData = getFilteredMapDataBySizesSync(
      mapId as 'world' | 'usa',
      continentId,
      ['huge', 'large', 'medium', 'small', 'tiny'] // All sizes
    )
    return allRegionsMapData.regions
  }, [currentLevel, path, selectedContinent])

  // Get the active filter levels based on current tab
  const activeFilterLevels = useMemo(() => {
    switch (activeFilterCriteria) {
      case 'size':
        return includeSizes
      case 'importance':
        return includeImportance
      case 'population':
        return includePopulation
      default:
        return includeSizes
    }
  }, [activeFilterCriteria, includeSizes, includeImportance, includePopulation])

  // Calculate excluded regions based on active filter criteria
  const excludedRegions = useMemo(() => {
    const allRegionIds = new Set(baseRegions.map((r) => r.id))

    // Filter based on active criteria
    let filteredRegions = baseRegions
    switch (activeFilterCriteria) {
      case 'size':
        filteredRegions = filterRegionsBySizes(baseRegions, includeSizes, 'world')
        break
      case 'importance':
        filteredRegions = filterRegionsByImportance(baseRegions, includeImportance)
        break
      case 'population':
        filteredRegions = filterRegionsByPopulation(baseRegions, includePopulation)
        break
    }
    const filteredRegionIds = new Set(filteredRegions.map((r) => r.id))

    // Excluded = all regions minus filtered regions
    const excluded: string[] = []
    for (const regionId of allRegionIds) {
      if (!filteredRegionIds.has(regionId)) {
        excluded.push(regionId)
      }
    }
    return excluded
  }, [baseRegions, activeFilterCriteria, includeSizes, includeImportance, includePopulation])

  // Compute region names by size category (for tooltip display)
  const regionNamesBySize = useMemo(() => {
    const result: Partial<Record<RegionSize, string[]>> = {}
    for (const size of ALL_REGION_SIZES) {
      const filtered = filterRegionsBySizes(baseRegions, [size], 'world')
      result[size] = filtered.map((r) => r.name).sort((a, b) => a.localeCompare(b))
    }
    return result
  }, [baseRegions])

  // Compute region names by importance category
  const regionNamesByImportance = useMemo(() => {
    const result: Partial<Record<ImportanceLevel, string[]>> = {}
    for (const level of ALL_IMPORTANCE_LEVELS) {
      const filtered = filterRegionsByImportance(baseRegions, [level])
      result[level] = filtered.map((r) => r.name).sort((a, b) => a.localeCompare(b))
    }
    return result
  }, [baseRegions])

  // Compute region names by population category
  const regionNamesByPopulation = useMemo(() => {
    const result: Partial<Record<PopulationLevel, string[]>> = {}
    for (const level of ALL_POPULATION_LEVELS) {
      const filtered = filterRegionsByPopulation(baseRegions, [level])
      result[level] = filtered.map((r) => r.name).sort((a, b) => a.localeCompare(b))
    }
    return result
  }, [baseRegions])

  // Compute region counts by category for the active filter criteria
  const regionCountsByCriteria = useMemo(() => {
    switch (activeFilterCriteria) {
      case 'size':
        return Object.fromEntries(
          Object.entries(regionNamesBySize).map(([k, v]) => [k, v?.length ?? 0])
        )
      case 'importance':
        return Object.fromEntries(
          Object.entries(regionNamesByImportance).map(([k, v]) => [k, v?.length ?? 0])
        )
      case 'population':
        return Object.fromEntries(
          Object.entries(regionNamesByPopulation).map(([k, v]) => [k, v?.length ?? 0])
        )
      default:
        return {}
    }
  }, [activeFilterCriteria, regionNamesBySize, regionNamesByImportance, regionNamesByPopulation])

  // Compute all selected region names (for popover display) based on active filter
  const selectedRegionNames = useMemo(() => {
    let filteredRegions = baseRegions
    switch (activeFilterCriteria) {
      case 'size':
        filteredRegions = filterRegionsBySizes(baseRegions, includeSizes, 'world')
        break
      case 'importance':
        filteredRegions = filterRegionsByImportance(baseRegions, includeImportance)
        break
      case 'population':
        filteredRegions = filterRegionsByPopulation(baseRegions, includePopulation)
        break
    }
    return filteredRegions.map((r) => r.name)
  }, [baseRegions, activeFilterCriteria, includeSizes, includeImportance, includePopulation])

  // Create lookup map from region name → region data (for zoom preview)
  const regionsByName = useMemo(() => {
    const lookup = new Map<string, { id: string; name: string; path: string }>()
    for (const region of mapData.regions) {
      lookup.set(region.name, region)
    }
    return lookup
  }, [mapData.regions])

  // Calculate zoomed viewBox when previewing a region from the popover
  const previewViewBox = useMemo(() => {
    if (!previewRegionName) return null

    const region = regionsByName.get(previewRegionName)
    if (!region) return null

    // Calculate bounding box for the region
    const bbox = calculateBoundingBox([region.path])

    // Add substantial padding around the region (100% on each side)
    // This gives good context while still focusing on the region
    const paddingFactor = 1.0
    const paddingX = bbox.width * paddingFactor
    const paddingY = bbox.height * paddingFactor

    let cropWidth = bbox.width + paddingX * 2
    let cropHeight = bbox.height + paddingY * 2

    // Enforce minimum viewBox size to prevent over-zooming on tiny islands
    // This ensures we never zoom in more than ~10% of the original map
    const originalParsed = parseViewBox(mapData.viewBox)
    const minWidth = originalParsed.width * 0.1
    const minHeight = originalParsed.height * 0.1

    // If crop is smaller than minimum, expand it while keeping region centered
    if (cropWidth < minWidth) {
      cropWidth = minWidth
    }
    if (cropHeight < minHeight) {
      cropHeight = minHeight
    }

    // Center the crop region on the bbox center
    const bboxCenterX = bbox.minX + bbox.width / 2
    const bboxCenterY = bbox.minY + bbox.height / 2

    const cropRegion = {
      x: bboxCenterX - cropWidth / 2,
      y: bboxCenterY - cropHeight / 2,
      width: cropWidth,
      height: cropHeight,
    }

    // Use calculateFitCropViewBox to adjust for container aspect ratio
    if (containerDimensions.width > 0 && containerDimensions.height > 0) {
      const containerAspect = containerDimensions.width / containerDimensions.height
      return calculateFitCropViewBox(originalParsed, cropRegion, containerAspect)
    }

    // Fallback
    return `${cropRegion.x} ${cropRegion.y} ${cropRegion.width} ${cropRegion.height}`
  }, [previewRegionName, regionsByName, containerDimensions, mapData.viewBox])

  // Animated viewBox for smooth transitions
  const targetViewBox = previewViewBox || viewBox
  const parsedTarget = parseViewBox(targetViewBox)
  const springProps = useSpring({
    x: parsedTarget.x,
    y: parsedTarget.y,
    width: parsedTarget.width,
    height: parsedTarget.height,
    config: { tension: 200, friction: 25 },
  })
  const animatedViewBox = springProps.x.to(
    (x) =>
      `${x.toFixed(2)} ${springProps.y.get().toFixed(2)} ${springProps.width.get().toFixed(2)} ${springProps.height.get().toFixed(2)}`
  )

  // Get the region ID for the focused region name (for highlighting on the map)
  const focusedRegionId = useMemo(() => {
    if (!previewRegionName) return null
    const region = regionsByName.get(previewRegionName)
    return region?.id ?? null
  }, [previewRegionName, regionsByName])

  // Calculate preview regions based on hovering over the thermometer
  // Shows what regions would be added or removed if the user clicks
  const { previewAddRegions, previewRemoveRegions } = useMemo(() => {
    // Determine which preview state to use based on active filter criteria
    const activePreview =
      activeFilterCriteria === 'size'
        ? sizeRangePreview
        : activeFilterCriteria === 'importance'
          ? importanceRangePreview
          : populationRangePreview

    if (!activePreview) {
      return { previewAddRegions: [], previewRemoveRegions: [] }
    }

    // Get current included region IDs based on active criteria
    let currentFiltered = baseRegions
    switch (activeFilterCriteria) {
      case 'size':
        currentFiltered = filterRegionsBySizes(baseRegions, includeSizes, 'world')
        break
      case 'importance':
        currentFiltered = filterRegionsByImportance(baseRegions, includeImportance)
        break
      case 'population':
        currentFiltered = filterRegionsByPopulation(baseRegions, includePopulation)
        break
    }
    const currentIncludedIds = new Set(currentFiltered.map((r) => r.id))

    // Get preview included region IDs (if user clicked)
    let previewFiltered = baseRegions
    switch (activeFilterCriteria) {
      case 'size':
        if (sizeRangePreview) {
          const previewSizes = rangeToSizes(
            sizeRangePreview.previewMin,
            sizeRangePreview.previewMax
          )
          previewFiltered = filterRegionsBySizes(baseRegions, previewSizes, 'world')
        }
        break
      case 'importance':
        if (importanceRangePreview) {
          const previewLevels = rangeToImportance(
            importanceRangePreview.previewMin,
            importanceRangePreview.previewMax
          )
          previewFiltered = filterRegionsByImportance(baseRegions, previewLevels)
        }
        break
      case 'population':
        if (populationRangePreview) {
          const previewLevels = rangeToPopulation(
            populationRangePreview.previewMin,
            populationRangePreview.previewMax
          )
          previewFiltered = filterRegionsByPopulation(baseRegions, previewLevels)
        }
        break
    }
    const previewIncludedIds = new Set(previewFiltered.map((r) => r.id))

    // Regions that would be ADDED (in preview but not currently included)
    const addRegions: string[] = []
    for (const id of previewIncludedIds) {
      if (!currentIncludedIds.has(id)) {
        addRegions.push(id)
      }
    }

    // Regions that would be REMOVED (currently included but not in preview)
    const removeRegions: string[] = []
    for (const id of currentIncludedIds) {
      if (!previewIncludedIds.has(id)) {
        removeRegions.push(id)
      }
    }

    return {
      previewAddRegions: addRegions,
      previewRemoveRegions: removeRegions,
    }
  }, [
    activeFilterCriteria,
    sizeRangePreview,
    importanceRangePreview,
    populationRangePreview,
    baseRegions,
    includeSizes,
    includeImportance,
    includePopulation,
  ])

  // Compute the label to display for the hovered region
  // Shows the next drill-down level name, not the individual region name
  const hoveredLabel = useMemo(() => {
    if (!hoveredRegion) {
      // Not hovering - show current selection or level name
      if (currentLevel === 0) {
        // At world level - show selected continent if any, otherwise "World"
        if (selectedContinent !== 'all') {
          const continent = CONTINENTS.find((c) => c.id === selectedContinent)
          return continent?.name ?? 'World'
        }
        return 'World'
      }
      if (currentLevel === 1 && path[0]) {
        const continent = CONTINENTS.find((c) => c.id === path[0])
        return continent?.name ?? 'Continent'
      }
      if (currentLevel === 2 && path[1]) {
        const entry = getSubMapEntry(path[1])
        return entry?.name ?? 'Region'
      }
      return ''
    }

    // Hovering - show next level name
    if (currentLevel === 0) {
      // At world level, show continent name
      const continentId = getContinentForCountry(hoveredRegion)
      if (continentId) {
        const continent = CONTINENTS.find((c) => c.id === continentId)
        return continent?.name ?? continentId
      }
      return ''
    }

    if (currentLevel === 1 && path[0]) {
      // At continent level - only show name if region has a sub-map to drill into
      if (hasSubMap(hoveredRegion)) {
        const entry = getSubMapEntry(hoveredRegion)
        return entry?.name ?? hoveredRegion
      }
      // No sub-map - just show the continent name (clicking starts game with continent)
      const continent = CONTINENTS.find((c) => c.id === path[0])
      return continent?.name ?? 'Continent'
    }

    if (currentLevel === 2) {
      // At sub-map level (e.g., USA states) - show region name
      const region = mapData.regions.find((r) => r.id === hoveredRegion)
      return region?.name ?? hoveredRegion
    }

    return ''
  }, [hoveredRegion, currentLevel, path, mapData.regions, selectedContinent])

  // Compute hint text for what clicking will do
  const hoveredHint = useMemo(() => {
    if (!hoveredRegion) return null

    if (currentLevel === 0) {
      // World level - always zoom into continent
      return 'click to zoom in'
    }
    if (currentLevel === 1) {
      if (hasSubMap(hoveredRegion)) {
        return 'click to drill down'
      }
      return 'click to start game'
    }
    if (currentLevel === 2) {
      return 'click to start game'
    }
    return null
  }, [hoveredRegion, currentLevel])

  // Build breadcrumbs
  const breadcrumbs: BreadcrumbItem[] = useMemo(() => {
    const crumbs: BreadcrumbItem[] = [
      { label: 'World', emoji: '🌍', path: [], isClickable: currentLevel > 0 },
    ]

    if (currentLevel >= 1 && path[0]) {
      const continentPath = path[0]
      const continent = CONTINENTS.find((c) => c.id === continentPath)
      if (continent) {
        crumbs.push({
          label: continent.name,
          emoji: continent.emoji,
          path: [continentPath],
          isClickable: currentLevel > 1,
        })
      }
    }

    if (currentLevel >= 2 && path[0] && path[1]) {
      const subMapEntry = getSubMapEntry(path[1])
      if (subMapEntry) {
        crumbs.push({
          label: subMapEntry.name,
          emoji: subMapEntry.emoji,
          path: [path[0], path[1]] as SelectionPath,
          isClickable: false, // Current level is never clickable
        })
      }
    }

    return crumbs
  }, [currentLevel, path])

  // Get peer navigation items (or planets as joke at world level)
  const peers = useMemo(() => {
    if (currentLevel === 0) {
      // World level - show planets as joke placeholder
      return PLANETS.map((planet) => ({
        id: planet.id,
        label: planet.name,
        emoji: '', // Planets don't have emojis, we'll render SVG
        path: [] as SelectionPath, // Clicking does nothing
        isPlanet: true as const,
        planetData: planet,
      }))
    }

    if (currentLevel === 1 && path[0]) {
      const currentContinent = path[0]
      // Continent level - show other continents
      return CONTINENTS.filter((c) => c.id !== currentContinent && c.id !== 'antarctica').map(
        (c) => ({
          id: c.id,
          label: c.name,
          emoji: c.emoji,
          path: [c.id] as SelectionPath,
        })
      )
    }

    if (currentLevel === 2 && path[0] && path[1]) {
      const currentContinent = path[0]
      const currentSubMap = path[1]
      // Sub-map level - show other sub-maps in same continent (if any)
      const siblingSubMaps = getSubMapsForContinent(currentContinent)
      return siblingSubMaps
        .filter((regionId) => regionId !== currentSubMap)
        .map((regionId) => {
          const entry = getSubMapEntry(regionId)
          return entry
            ? {
                id: regionId,
                label: entry.name,
                emoji: entry.emoji,
                path: [currentContinent, regionId] as SelectionPath,
              }
            : null
        })
        .filter(Boolean) as Array<{
        id: string
        label: string
        emoji: string
        path: SelectionPath
      }>
    }

    return []
  }, [currentLevel, path])

  // Get region count for start button
  const regionCount = useMemo(() => {
    if (currentLevel === 2 && path[1]) {
      const subMapData = getSubMapData(path[1])
      return subMapData?.regions.length ?? 0
    }
    // Use selectedContinent at world level, or path[0] at continent level
    const continentId: ContinentId | 'all' =
      currentLevel >= 1 && path[0] ? path[0] : selectedContinent
    const regions = filterRegionsByContinent(WORLD_MAP.regions, continentId)
    return regions.length
  }, [currentLevel, path, selectedContinent])

  // Get context label for start button
  const contextLabel = useMemo(() => {
    if (currentLevel === 2 && path[1]) {
      const entry = getSubMapEntry(path[1])
      return entry?.name ?? 'Region'
    }
    if (currentLevel === 1 && path[0]) {
      const continent = CONTINENTS.find((c) => c.id === path[0])
      return continent?.name ?? 'Continent'
    }
    // At world level, use selectedContinent if set
    if (selectedContinent !== 'all') {
      const continent = CONTINENTS.find((c) => c.id === selectedContinent)
      return continent?.name ?? 'World'
    }
    return 'World'
  }, [currentLevel, path, selectedContinent])

  // Handle region click
  const handleRegionClick = useCallback(
    (regionId: string) => {
      if (currentLevel === 0) {
        // World level - clicking any country drills into its continent
        const continent = getContinentForCountry(regionId)
        if (continent && continent !== 'antarctica') {
          // Always drill down to continent level
          setPath([continent])
          onSelectionChange('world', continent)
        }
      } else if (currentLevel === 1 && path[0]) {
        const currentContinent = path[0]
        // Continent level - check for sub-map or start game
        if (hasSubMap(regionId)) {
          // Drill into sub-map
          setPath([currentContinent, regionId])
          // Sync selection to the sub-map
          const entry = getSubMapEntry(regionId)
          if (entry?.mapId === 'usa') {
            onSelectionChange('usa', 'all')
          }
        } else {
          // No sub-map - start game immediately
          onStartGame()
        }
      } else if (currentLevel === 2) {
        // Sub-map level (e.g., USA states) - start game immediately
        onStartGame()
      }
    },
    [currentLevel, path, onSelectionChange, onStartGame]
  )

  // Handle breadcrumb click
  const handleBreadcrumbClick = useCallback(
    (targetPath: SelectionPath) => {
      setPath(targetPath)
      // Sync selection change
      if (targetPath.length === 0) {
        onSelectionChange('world', 'all')
      } else if (targetPath.length === 1 && targetPath[0]) {
        onSelectionChange('world', targetPath[0])
      }
      // Level 2 keeps its own selection
    },
    [onSelectionChange]
  )

  // Handle peer click
  const handlePeerClick = useCallback(
    (targetPath: SelectionPath) => {
      setPath(targetPath)
      // Sync selection change
      if (targetPath.length === 1 && targetPath[0]) {
        onSelectionChange('world', targetPath[0])
      } else if (targetPath.length === 2 && targetPath[1]) {
        const entry = getSubMapEntry(targetPath[1])
        if (entry?.mapId === 'usa') {
          onSelectionChange('usa', 'all')
        }
      }
    },
    [onSelectionChange]
  )

  // Handle zoom out
  const handleZoomOut = useCallback(() => {
    if (currentLevel === 2 && path[0]) {
      const currentContinent = path[0]
      // Go back to continent
      setPath([currentContinent])
      onSelectionChange('world', currentContinent)
    } else if (currentLevel === 1) {
      // Go back to world
      setPath([])
      onSelectionChange('world', 'all')
    }
  }, [currentLevel, path, onSelectionChange])

  return (
    <div
      data-component="drill-down-map-selector"
      className={css({
        width: '100%',
        ...(fillContainer && { height: '100%', position: 'relative' }),
      })}
    >
      {/* Breadcrumb Navigation - different styles for fillContainer vs normal */}
      {fillContainer ? (
        /* Breadcrumb navigation overlay for full-screen mode */
        <div
          data-element="navigation-overlay"
          className={css({
            position: 'absolute',
            top: '164px',
            left: { base: '12px', sm: '24px' },
            zIndex: 50,
            display: 'flex',
            flexDirection: { base: 'column', sm: 'row' },
            alignItems: { base: 'flex-start', sm: 'center' },
            gap: { base: '1', sm: '2' },
            padding: '2',
            bg: isDark ? 'gray.800' : 'gray.100',
            rounded: 'xl',
            shadow: 'lg',
            fontSize: 'sm',
          })}
        >
          {breadcrumbs.map((crumb, index) => (
            <span
              key={crumb.label}
              className={css({ display: 'flex', alignItems: 'center', gap: '1' })}
            >
              {index > 0 && (
                <span
                  className={css({
                    color: isDark ? 'gray.500' : 'gray.400',
                    display: { base: 'none', sm: 'inline' },
                  })}
                >
                  ›
                </span>
              )}
              {crumb.isClickable ? (
                <button
                  data-action={`nav-${crumb.label.toLowerCase().replace(/\s/g, '-')}`}
                  onClick={() => handleBreadcrumbClick(crumb.path)}
                  className={css({
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1',
                    color: isDark ? 'blue.400' : 'blue.600',
                    cursor: 'pointer',
                    background: 'none',
                    border: 'none',
                    padding: '0',
                    font: 'inherit',
                    _hover: { textDecoration: 'underline' },
                  })}
                >
                  <span>{crumb.emoji}</span>
                  <span>{crumb.label}</span>
                </button>
              ) : (
                <span
                  className={css({
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1',
                    fontWeight: 'bold',
                    color: isDark ? 'gray.100' : 'gray.800',
                  })}
                >
                  <span>{crumb.emoji}</span>
                  <span>{crumb.label}</span>
                </span>
              )}
            </span>
          ))}
        </div>
      ) : (
        /* Normal breadcrumb for non-fillContainer mode */
        <div
          data-element="breadcrumbs"
          className={css({
            display: 'flex',
            alignItems: 'center',
            gap: '2',
            fontSize: 'sm',
            flexWrap: 'wrap',
            marginBottom: '3',
          })}
        >
          {breadcrumbs.map((crumb, index) => (
            <span
              key={crumb.label}
              className={css({
                display: 'flex',
                alignItems: 'center',
                gap: '1',
              })}
            >
              {index > 0 && (
                <span className={css({ color: isDark ? 'gray.500' : 'gray.400' })}>›</span>
              )}
              {crumb.isClickable ? (
                <button
                  data-action={`nav-${crumb.label.toLowerCase().replace(/\s/g, '-')}`}
                  onClick={() => handleBreadcrumbClick(crumb.path)}
                  className={css({
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1',
                    color: isDark ? 'blue.400' : 'blue.600',
                    cursor: 'pointer',
                    _hover: { textDecoration: 'underline' },
                  })}
                >
                  <span>{crumb.emoji}</span>
                  <span>{crumb.label}</span>
                </button>
              ) : (
                <span
                  className={css({
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1',
                    fontWeight: 'bold',
                    color: isDark ? 'gray.100' : 'gray.800',
                  })}
                >
                  <span>{crumb.emoji}</span>
                  <span>{crumb.label}</span>
                </span>
              )}
            </span>
          ))}
        </div>
      )}

      {/* Interactive Map - wrapped in ref'd container for dimension measurement */}
      <div
        ref={containerRef}
        data-element="map-container"
        className={css({
          position: 'relative',
          ...(fillContainer && { width: '100%', height: '100%' }),
        })}
      >
        <MapSelectorMap
          fillContainer={fillContainer}
          mapData={mapData}
          viewBox={viewBox}
          onRegionClick={handleRegionClick}
          onRegionHover={setHoveredRegion}
          hoveredRegion={hoveredRegion}
          highlightedRegions={highlightedRegions}
          visibleRegions={visibleRegions}
          regionGroups={regionGroups}
          selectedGroup={
            currentLevel === 0 && selectedContinent !== 'all' ? selectedContinent : null
          }
          hoverableRegions={currentLevel === 1 ? highlightedRegions : undefined}
          excludedRegions={excludedRegions}
          previewAddRegions={previewAddRegions}
          previewRemoveRegions={previewRemoveRegions}
          animatedViewBox={animatedViewBox}
          focusedRegion={focusedRegionId}
        />

        {/* Zoom Out Button - only shown when NOT in fillContainer mode (fillContainer has navigation overlay) */}
        {!fillContainer &&
          currentLevel > 0 &&
          (() => {
            // Calculate what we're going back to
            const backToWorld = currentLevel === 1
            const backToContinentId = currentLevel === 2 ? path[0] : null
            const backLabel = backToWorld
              ? 'World'
              : (CONTINENTS.find((c) => c.id === backToContinentId)?.name ?? 'Continent')

            // Get viewBox and regions for the mini-map preview
            const backViewBox = backToWorld
              ? WORLD_MAP.viewBox
              : backToContinentId
                ? calculateContinentViewBox(
                    WORLD_MAP.regions,
                    backToContinentId,
                    WORLD_MAP.viewBox,
                    'world'
                  )
                : WORLD_MAP.viewBox
            const backRegions = backToWorld
              ? WORLD_MAP.regions
              : backToContinentId
                ? filterRegionsByContinent(WORLD_MAP.regions, backToContinentId)
                : []

            return (
              <button
                data-action="zoom-out"
                onClick={handleZoomOut}
                className={css({
                  position: 'absolute',
                  top: '3',
                  left: '3',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '2',
                  padding: '2',
                  fontSize: 'sm',
                  color: isDark ? 'gray.100' : 'gray.700',
                  bg: isDark ? 'gray.800' : 'gray.100',
                  rounded: 'lg',
                  cursor: 'pointer',
                  border: '2px solid',
                  borderColor: isDark ? 'gray.700' : 'gray.300',
                  boxShadow: 'md',
                  zIndex: 10,
                  transition: 'all 0.15s',
                  _hover: {
                    borderColor: isDark ? 'blue.500' : 'blue.400',
                    bg: isDark ? 'gray.700' : 'gray.200',
                  },
                })}
              >
                <span className={css({ fontSize: 'md' })}>←</span>
                {/* Mini-map preview */}
                <div
                  className={css({
                    width: '64px',
                    aspectRatio: '16 / 10',
                    bg: isDark ? 'gray.900' : 'gray.50',
                    rounded: 'sm',
                    overflow: 'hidden',
                  })}
                >
                  <svg
                    viewBox={backViewBox}
                    className={css({
                      width: '100%',
                      height: '100%',
                      display: 'block',
                    })}
                    preserveAspectRatio="xMidYMid meet"
                  >
                    {/* Ocean background */}
                    <rect
                      x="-10000"
                      y="-10000"
                      width="30000"
                      height="30000"
                      fill={isDark ? '#111827' : '#e0f2fe'}
                    />
                    {/* Render regions */}
                    {backRegions.map((region) => (
                      <path
                        key={region.id}
                        d={region.path}
                        fill={isDark ? '#4a5568' : '#d4c4a8'}
                        stroke={isDark ? '#374151' : '#9ca3af'}
                        strokeWidth={0.5}
                      />
                    ))}
                  </svg>
                </div>
                <span className={css({ fontWeight: '600' })}>{backLabel}</span>
              </button>
            )
          })()}

        {/* Right-side controls container - region filter selector with tabs */}
        <div
          data-element="right-controls"
          className={css({
            position: 'absolute',
            top: fillContainer ? '164px' : '3',
            right: { base: '8px', sm: '24px' },
            zIndex: 10,
            transform: { base: 'scale(0.75)', sm: 'scale(1)' },
            transformOrigin: 'top right',
          })}
        >
          {/* Region Filter Selector with tabs */}
          <div
            data-element="region-filters"
            className={css({
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'stretch',
              padding: '3',
              bg: isDark ? 'gray.800' : 'gray.100',
              rounded: 'xl',
              shadow: 'lg',
              width: '205px',
              maxHeight: { base: 'none', md: fillContainer ? '550px' : 'none' },
              overflowY: 'auto',
            })}
          >
            {/* Filter Criteria Tabs */}
            <Tooltip.Provider delayDuration={200}>
              <div
                data-element="filter-tabs"
                className={css({
                  display: 'flex',
                  gap: '1px',
                  marginBottom: '2',
                  padding: '2px',
                  bg: isDark ? 'gray.700' : 'gray.200',
                  rounded: 'md',
                  width: '100%',
                })}
              >
                {ALL_FILTER_CRITERIA.map((criteria) => {
                  const isActive = activeFilterCriteria === criteria
                  const buttonContent = (
                    <button
                      data-action={`select-filter-${criteria}`}
                      onClick={() => setActiveFilterCriteria(criteria)}
                      className={css({
                        flex: isActive ? 1 : 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '1',
                        padding: '1',
                        paddingX: isActive ? '2' : '1.5',
                        fontSize: 'xs',
                        fontWeight: isActive ? 'bold' : 'normal',
                        color: isActive
                          ? isDark
                            ? 'white'
                            : 'gray.900'
                          : isDark
                            ? 'gray.400'
                            : 'gray.600',
                        bg: isActive ? (isDark ? 'gray.600' : 'white') : 'transparent',
                        rounded: 'sm',
                        cursor: 'pointer',
                        border: 'none',
                        transition: 'all 0.15s',
                        whiteSpace: 'nowrap',
                        _hover: {
                          bg: isActive
                            ? isDark
                              ? 'gray.600'
                              : 'white'
                            : isDark
                              ? 'gray.600'
                              : 'gray.100',
                        },
                      })}
                    >
                      <span>{FILTER_CRITERIA_CONFIG[criteria].emoji}</span>
                      {isActive && <span>{FILTER_CRITERIA_CONFIG[criteria].label}</span>}
                    </button>
                  )

                  // Wrap inactive tabs with tooltips
                  if (!isActive) {
                    return (
                      <Tooltip.Root key={criteria}>
                        <Tooltip.Trigger asChild>{buttonContent}</Tooltip.Trigger>
                        <Tooltip.Portal>
                          <Tooltip.Content
                            side="top"
                            sideOffset={5}
                            className={css({
                              bg: isDark ? 'gray.800' : 'gray.900',
                              color: 'white',
                              paddingX: '3',
                              paddingY: '1.5',
                              rounded: 'md',
                              fontSize: 'xs',
                              fontWeight: 'medium',
                              boxShadow: 'lg',
                              zIndex: 10001,
                              animation: 'fadeIn 0.15s ease-out',
                            })}
                          >
                            {FILTER_CRITERIA_CONFIG[criteria].label}
                            <Tooltip.Arrow
                              className={css({
                                fill: isDark ? 'gray.800' : 'gray.900',
                              })}
                            />
                          </Tooltip.Content>
                        </Tooltip.Portal>
                      </Tooltip.Root>
                    )
                  }

                  return <span key={criteria}>{buttonContent}</span>
                })}
              </div>
            </Tooltip.Provider>

            {/* Size Filter (when size tab is active) */}
            {activeFilterCriteria === 'size' && (
              <RangeThermometer
                options={SIZE_OPTIONS}
                minValue={sizesToRange(includeSizes)[0]}
                maxValue={sizesToRange(includeSizes)[1]}
                onChange={(min, max) => onRegionSizesChange(rangeToSizes(min, max))}
                orientation="vertical"
                isDark={isDark}
                counts={regionCountsByCriteria as Partial<Record<RegionSize, number>>}
                showTotalCount
                onHoverPreview={setSizeRangePreview}
                regionNamesByCategory={regionNamesBySize}
                selectedRegionNames={selectedRegionNames}
                onRegionNameHover={setPreviewRegionName}
                hideCountOnMd={fillContainer && selectedRegionNames.length > 0}
              />
            )}

            {/* Importance Filter (when importance tab is active) */}
            {activeFilterCriteria === 'importance' && (
              <RangeThermometer
                options={IMPORTANCE_OPTIONS}
                minValue={importanceToRange(includeImportance)[0]}
                maxValue={importanceToRange(includeImportance)[1]}
                onChange={(min, max) => setIncludeImportance(rangeToImportance(min, max))}
                orientation="vertical"
                isDark={isDark}
                counts={regionCountsByCriteria as Partial<Record<ImportanceLevel, number>>}
                showTotalCount
                onHoverPreview={setImportanceRangePreview}
                regionNamesByCategory={regionNamesByImportance}
                selectedRegionNames={selectedRegionNames}
                onRegionNameHover={setPreviewRegionName}
                hideCountOnMd={fillContainer && selectedRegionNames.length > 0}
              />
            )}

            {/* Population Filter (when population tab is active) */}
            {activeFilterCriteria === 'population' && (
              <RangeThermometer
                options={POPULATION_OPTIONS}
                minValue={populationToRange(includePopulation)[0]}
                maxValue={populationToRange(includePopulation)[1]}
                onChange={(min, max) => setIncludePopulation(rangeToPopulation(min, max))}
                orientation="vertical"
                isDark={isDark}
                counts={regionCountsByCriteria as Partial<Record<PopulationLevel, number>>}
                showTotalCount
                onHoverPreview={setPopulationRangePreview}
                regionNamesByCategory={regionNamesByPopulation}
                selectedRegionNames={selectedRegionNames}
                onRegionNameHover={setPreviewRegionName}
                hideCountOnMd={fillContainer && selectedRegionNames.length > 0}
              />
            )}

            {/* Inline region list - visible on larger screens only, expands below thermometer */}
            {fillContainer && selectedRegionNames.length > 0 && (
              <div
                data-element="region-list-inline"
                className={css({
                  display: { base: 'none', md: 'flex' },
                  flexDirection: 'column',
                  borderTop: '1px solid',
                  borderColor: isDark ? 'gray.700' : 'gray.300',
                  marginTop: '2',
                  paddingTop: '2',
                  width: '100%',
                  alignSelf: 'stretch',
                })}
              >
                <RegionListPanel
                  regions={selectedRegionNames}
                  onRegionHover={setPreviewRegionName}
                  maxHeight="200px"
                  isDark={isDark}
                />
              </div>
            )}

            {/* Game Mode & Assistance Level - only in fillContainer mode */}
            {fillContainer && gameMode && onGameModeChange && (
              <div
                data-element="game-settings"
                className={css({
                  borderTop: '1px solid',
                  borderColor: isDark ? 'gray.700' : 'gray.300',
                  marginTop: '2',
                  paddingTop: '2',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2',
                })}
              >
                {/* Game Mode Selector */}
                <div data-element="game-mode-selector">
                  <div
                    className={css({
                      fontSize: 'xs',
                      color: isDark ? 'gray.400' : 'gray.500',
                      marginBottom: '1',
                    })}
                  >
                    Mode
                  </div>
                  <div
                    className={css({
                      display: 'flex',
                      gap: '1px',
                      bg: isDark ? 'gray.700' : 'gray.200',
                      rounded: 'md',
                      padding: '2px',
                    })}
                  >
                    {GAME_MODE_OPTIONS.map((option) => {
                      const isActive = gameMode === option.value
                      return (
                        <button
                          key={option.value}
                          onClick={() => onGameModeChange(option.value)}
                          className={css({
                            flex: 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '1',
                            padding: '1.5',
                            fontSize: 'xs',
                            fontWeight: isActive ? 'bold' : 'normal',
                            color: isActive
                              ? isDark
                                ? 'white'
                                : 'gray.900'
                              : isDark
                                ? 'gray.400'
                                : 'gray.600',
                            bg: isActive ? (isDark ? 'gray.600' : 'white') : 'transparent',
                            rounded: 'sm',
                            cursor: 'pointer',
                            border: 'none',
                            transition: 'all 0.15s',
                            _hover: {
                              bg: isActive
                                ? isDark
                                  ? 'gray.600'
                                  : 'white'
                                : isDark
                                  ? 'gray.600/50'
                                  : 'gray.100',
                            },
                          })}
                        >
                          <span>{option.emoji}</span>
                          <span>{option.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Assistance Level Selector */}
                {assistanceLevel && onAssistanceLevelChange && (
                  <div data-element="assistance-selector">
                    <div
                      className={css({
                        fontSize: 'xs',
                        color: isDark ? 'gray.400' : 'gray.500',
                        marginBottom: '1',
                      })}
                    >
                      Assistance
                    </div>
                    <div
                      className={css({
                        display: 'flex',
                        gap: '1px',
                        bg: isDark ? 'gray.700' : 'gray.200',
                        rounded: 'md',
                        padding: '2px',
                        flexWrap: 'wrap',
                      })}
                    >
                      {ASSISTANCE_LEVELS.map((level) => {
                        const isActive = assistanceLevel === level.id
                        return (
                          <button
                            key={level.id}
                            onClick={() => onAssistanceLevelChange(level.id as AssistanceLevel)}
                            title={level.description}
                            className={css({
                              flex: '1 1 auto',
                              minWidth: '36px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              padding: '1.5',
                              fontSize: 'sm',
                              fontWeight: isActive ? 'bold' : 'normal',
                              color: isActive
                                ? isDark
                                  ? 'white'
                                  : 'gray.900'
                                : isDark
                                  ? 'gray.400'
                                  : 'gray.600',
                              bg: isActive ? (isDark ? 'gray.600' : 'white') : 'transparent',
                              rounded: 'sm',
                              cursor: 'pointer',
                              border: 'none',
                              transition: 'all 0.15s',
                              _hover: {
                                bg: isActive
                                  ? isDark
                                    ? 'gray.600'
                                    : 'white'
                                  : isDark
                                    ? 'gray.600/50'
                                    : 'gray.100',
                              },
                            })}
                          >
                            <span>{level.emoji}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Peer Navigation - Mini-map thumbnails below main map (or planets at world level) */}
      {/* Hidden in fillContainer mode since there's no space below the map */}
      {!fillContainer && peers.length > 0 && (
        <div
          data-element="peer-navigation"
          className={css({
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)', // Fixed 5 columns for max peers
            gap: '2',
            marginTop: '3',
          })}
        >
          {peers.map((peer) => {
            // Check if this is a planet (joke at world level)
            const isPlanet = 'isPlanet' in peer && peer.isPlanet
            const planetData = 'planetData' in peer ? (peer.planetData as PlanetData | null) : null

            // Calculate viewBox for this peer's continent (only for non-planets)
            const peerContinentId = peer.path[0]
            const peerViewBox =
              !isPlanet && peerContinentId
                ? calculateContinentViewBox(
                    WORLD_MAP.regions,
                    peerContinentId,
                    WORLD_MAP.viewBox,
                    'world'
                  )
                : WORLD_MAP.viewBox
            const peerRegions =
              !isPlanet && peerContinentId
                ? filterRegionsByContinent(WORLD_MAP.regions, peerContinentId)
                : []

            return (
              <div
                key={peer.id}
                data-element={isPlanet ? `planet-${peer.id}` : `peer-${peer.id}`}
                onClick={isPlanet ? undefined : () => handlePeerClick(peer.path)}
                className={css({
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '1',
                  padding: '1',
                  bg: isDark ? 'gray.800' : 'gray.100',
                  rounded: 'lg',
                  cursor: isPlanet ? 'default' : 'pointer',
                  border: '2px solid',
                  borderColor: isDark ? 'gray.700' : 'gray.300',
                  transition: 'all 0.15s',
                  opacity: isPlanet ? 0.7 : 1,
                  ...(!isPlanet && {
                    _hover: {
                      borderColor: isDark ? 'blue.500' : 'blue.400',
                      bg: isDark ? 'gray.700' : 'gray.200',
                    },
                  }),
                })}
              >
                {/* Mini-map preview or planet */}
                <div
                  className={css({
                    width: '100%',
                    aspectRatio: '16 / 10',
                    bg: isDark ? 'gray.900' : 'gray.50',
                    rounded: 'md',
                    overflow: 'hidden',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  })}
                >
                  {isPlanet && planetData ? (
                    // Render planet SVG
                    <svg
                      viewBox="0 0 100 100"
                      className={css({
                        width: '80%',
                        height: '80%',
                      })}
                    >
                      {/* Stars background */}
                      {[...Array(15)].map((_, i) => (
                        <circle
                          key={i}
                          cx={10 + ((i * 37) % 80)}
                          cy={5 + ((i * 23) % 90)}
                          r={0.5 + (i % 3) * 0.3}
                          fill="white"
                          opacity={0.4 + (i % 5) * 0.1}
                        />
                      ))}

                      {/* Saturn's rings (behind planet) */}
                      {'hasRings' in planetData && planetData.hasRings && (
                        <ellipse
                          cx="50"
                          cy="50"
                          rx={28 * planetData.size}
                          ry={8 * planetData.size}
                          fill="none"
                          stroke="#c9b896"
                          strokeWidth={3}
                          opacity={0.6}
                        />
                      )}

                      {/* Planet body */}
                      <circle cx="50" cy="50" r={15 * planetData.size} fill={planetData.color} />

                      {/* Jupiter's stripes */}
                      {'hasStripes' in planetData && planetData.hasStripes && (
                        <>
                          <ellipse
                            cx="50"
                            cy="42"
                            rx={14 * planetData.size}
                            ry={2}
                            fill="#c4a574"
                            opacity={0.5}
                          />
                          <ellipse
                            cx="50"
                            cy="48"
                            rx={14.5 * planetData.size}
                            ry={2.5}
                            fill="#b8956a"
                            opacity={0.4}
                          />
                          <ellipse
                            cx="50"
                            cy="55"
                            rx={14 * planetData.size}
                            ry={2}
                            fill="#c4a574"
                            opacity={0.5}
                          />
                          {/* Great Red Spot */}
                          <ellipse cx="58" cy="52" rx={4} ry={3} fill="#c1440e" opacity={0.6} />
                        </>
                      )}

                      {/* Saturn's rings (in front of planet) */}
                      {'hasRings' in planetData && planetData.hasRings && (
                        <path
                          d={`M ${50 - 28 * planetData.size} 50 Q 50 ${50 + 8 * planetData.size} ${50 + 28 * planetData.size} 50`}
                          fill="none"
                          stroke="#c9b896"
                          strokeWidth={3}
                          opacity={0.6}
                        />
                      )}

                      {/* Highlight/shine */}
                      <circle
                        cx={50 - 5 * planetData.size}
                        cy={50 - 5 * planetData.size}
                        r={3 * planetData.size}
                        fill="white"
                        opacity={0.2}
                      />
                    </svg>
                  ) : (
                    // Render mini-map for continents
                    <svg
                      viewBox={peerViewBox}
                      className={css({
                        width: '100%',
                        height: '100%',
                        display: 'block',
                      })}
                      preserveAspectRatio="xMidYMid meet"
                    >
                      {/* Ocean background */}
                      <rect
                        x="-10000"
                        y="-10000"
                        width="30000"
                        height="30000"
                        fill={isDark ? '#111827' : '#e0f2fe'}
                      />
                      {/* Render continent regions */}
                      {peerRegions.map((region) => (
                        <path
                          key={region.id}
                          d={region.path}
                          fill={isDark ? '#4a5568' : '#d4c4a8'}
                          stroke={isDark ? '#374151' : '#9ca3af'}
                          strokeWidth={0.5}
                        />
                      ))}
                    </svg>
                  )}
                </div>
                {/* Label */}
                <span
                  className={css({
                    fontSize: '2xs',
                    fontWeight: '600',
                    color: isDark ? 'gray.300' : 'gray.600',
                    textAlign: 'center',
                    lineHeight: 'tight',
                  })}
                >
                  {peer.label}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
