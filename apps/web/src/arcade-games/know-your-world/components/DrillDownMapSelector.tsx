'use client'

import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import * as Checkbox from '@radix-ui/react-checkbox'
import { css } from '@styled/css'
import { useTheme } from '@/contexts/ThemeContext'
import { MapSelectorMap } from './MapSelectorMap'
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
  getFilteredMapDataBySizesSync,
  REGION_SIZE_CONFIG,
  ALL_REGION_SIZES,
} from '../maps'
import type { RegionSize } from '../maps'
import {
  CONTINENTS,
  getContinentForCountry,
  COUNTRY_TO_CONTINENT,
  type ContinentId,
} from '../continents'

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
  { id: 'jupiter', name: 'Jupiter', color: '#d8ca9d', size: 2.0, hasStripes: true },
  { id: 'saturn', name: 'Saturn', color: '#ead6b8', size: 1.7, hasRings: true },
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
  const [containerDimensions, setContainerDimensions] = useState({ width: 0, height: 0 })
  const containerRef = useRef<HTMLDivElement>(null)

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

    // Calculate viewBox for continent (or full world)
    // For the selector, we zoom out a bit more than gameplay for better context
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
  }, [currentLevel, path, containerDimensions])

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

  // Calculate excluded regions based on includeSizes
  // These are regions that exist but are filtered out by size settings
  const excludedRegions = useMemo(() => {
    // Determine which map we're looking at
    const mapId = currentLevel === 2 && path[1] ? 'usa' : 'world'
    const continentId: ContinentId | 'all' =
      currentLevel >= 1 && path[0] ? path[0] : selectedContinent

    // Get all regions (unfiltered by size)
    const allRegionsMapData = getFilteredMapDataBySizesSync(
      mapId as 'world' | 'usa',
      continentId,
      ['huge', 'large', 'medium', 'small', 'tiny'] // All sizes
    )
    const allRegionIds = new Set(allRegionsMapData.regions.map((r) => r.id))

    // Get filtered regions (based on current includeSizes)
    const filteredMapData = getFilteredMapDataBySizesSync(
      mapId as 'world' | 'usa',
      continentId,
      includeSizes
    )
    const filteredRegionIds = new Set(filteredMapData.regions.map((r) => r.id))

    // Excluded = all regions minus filtered regions
    const excluded: string[] = []
    for (const regionId of allRegionIds) {
      if (!filteredRegionIds.has(regionId)) {
        excluded.push(regionId)
      }
    }
    return excluded
  }, [currentLevel, path, selectedContinent, includeSizes])

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
        .filter(Boolean) as Array<{ id: string; label: string; emoji: string; path: SelectionPath }>
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
    <div data-component="drill-down-map-selector" className={css({ width: '100%' })}>
      {/* Breadcrumb Navigation */}
      <div
        data-element="breadcrumbs"
        className={css({
          display: 'flex',
          alignItems: 'center',
          gap: '2',
          marginBottom: '3',
          fontSize: 'sm',
          flexWrap: 'wrap',
        })}
      >
        {breadcrumbs.map((crumb, index) => (
          <span
            key={crumb.label}
            className={css({ display: 'flex', alignItems: 'center', gap: '1' })}
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

      {/* Interactive Map - wrapped in ref'd container for dimension measurement */}
      <div
        ref={containerRef}
        data-element="map-container"
        className={css({ position: 'relative' })}
      >
        <MapSelectorMap
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
        />

        {/* Zoom Out Button - positioned inside map, upper right */}
        {currentLevel > 0 &&
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

        {/* Region Size Filters - positioned inside map, right side as column */}
        <div
          data-element="region-size-filters"
          className={css({
            position: 'absolute',
            top: '3',
            right: '3',
            bottom: '3',
            display: 'flex',
            flexDirection: 'column',
            gap: '1',
            padding: '2',
            bg: isDark ? 'gray.800/90' : 'white/90',
            backdropFilter: 'blur(4px)',
            rounded: 'lg',
            border: '1px solid',
            borderColor: isDark ? 'gray.700' : 'gray.300',
            boxShadow: 'md',
            zIndex: 10,
          })}
        >
          {/* Select All button */}
          <button
            data-action="select-all-sizes"
            onClick={() => onRegionSizesChange([...ALL_REGION_SIZES])}
            disabled={includeSizes.length === ALL_REGION_SIZES.length}
            className={css({
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '1',
              paddingX: '2',
              paddingY: '1',
              bg: isDark ? 'green.800' : 'green.500',
              color: 'white',
              border: '1px solid',
              borderColor: isDark ? 'green.600' : 'green.600',
              rounded: 'md',
              cursor: includeSizes.length === ALL_REGION_SIZES.length ? 'default' : 'pointer',
              opacity: includeSizes.length === ALL_REGION_SIZES.length ? 0.5 : 1,
              transition: 'all 0.15s',
              fontSize: 'xs',
              fontWeight: '600',
              _hover:
                includeSizes.length === ALL_REGION_SIZES.length
                  ? {}
                  : {
                      bg: isDark ? 'green.700' : 'green.600',
                    },
            })}
          >
            <span>✓</span>
            <span>All</span>
          </button>

          {/* Size checkboxes in a column */}
          <div
            className={css({
              display: 'flex',
              flexDirection: 'column',
              gap: '1',
              flex: 1,
            })}
          >
            {ALL_REGION_SIZES.map((size) => {
              const config = REGION_SIZE_CONFIG[size]
              const isChecked = includeSizes.includes(size)
              const isOnlyOne = includeSizes.length === 1 && isChecked
              const count = regionCountsBySize[size] || 0

              const handleToggle = () => {
                if (isOnlyOne) return
                if (isChecked) {
                  onRegionSizesChange(includeSizes.filter((s) => s !== size))
                } else {
                  onRegionSizesChange([...includeSizes, size])
                }
              }

              return (
                <Checkbox.Root
                  key={size}
                  checked={isChecked}
                  onCheckedChange={handleToggle}
                  disabled={isOnlyOne}
                  className={css({
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1',
                    paddingX: '2',
                    paddingY: '1',
                    bg: isChecked
                      ? isDark
                        ? 'blue.800'
                        : 'blue.500'
                      : isDark
                        ? 'gray.700'
                        : 'gray.100',
                    border: '1px solid',
                    borderColor: isChecked
                      ? isDark
                        ? 'blue.600'
                        : 'blue.600'
                      : isDark
                        ? 'gray.600'
                        : 'gray.300',
                    rounded: 'full',
                    cursor: isOnlyOne ? 'not-allowed' : 'pointer',
                    opacity: isOnlyOne ? 0.5 : 1,
                    transition: 'all 0.15s',
                    fontSize: 'xs',
                    _hover: isOnlyOne
                      ? {}
                      : {
                          bg: isChecked
                            ? isDark
                              ? 'blue.700'
                              : 'blue.600'
                            : isDark
                              ? 'gray.600'
                              : 'gray.200',
                        },
                  })}
                >
                  <span>{config.emoji}</span>
                  <span
                    className={css({
                      fontWeight: '500',
                      color: isChecked
                        ? 'white'
                        : isDark
                          ? 'gray.200'
                          : 'gray.700',
                    })}
                  >
                    {config.label}
                  </span>
                  <span
                    className={css({
                      fontWeight: '600',
                      color: isChecked
                        ? isDark
                          ? 'blue.200'
                          : 'blue.100'
                        : isDark
                          ? 'gray.400'
                          : 'gray.500',
                      bg: isChecked
                        ? isDark
                          ? 'blue.700'
                          : 'blue.600'
                        : isDark
                          ? 'gray.600'
                          : 'gray.200',
                      paddingX: '1',
                      rounded: 'full',
                      minWidth: '4',
                      textAlign: 'center',
                    })}
                  >
                    {count}
                  </span>
                </Checkbox.Root>
              )
            })}
          </div>
        </div>
      </div>

      {/* Peer Navigation - Mini-map thumbnails below main map (or planets at world level) */}
      {peers.length > 0 && (
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
            const planetData =
              'planetData' in peer ? (peer.planetData as PlanetData | null) : null

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
