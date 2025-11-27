'use client'

import { useMemo } from 'react'
import { css } from '@styled/css'
import { useTheme } from '@/contexts/ThemeContext'
import type { MapData } from '../types'
import { getRegionColor } from '../mapColors'

interface MapSelectorMapProps {
  /** Map data to display */
  mapData: MapData
  /** ViewBox for the SVG (may be cropped for continent views) */
  viewBox: string
  /** Callback when a region is clicked */
  onRegionClick: (regionId: string) => void
  /** Callback when hover state changes */
  onRegionHover: (regionId: string | null) => void
  /** Currently hovered region ID */
  hoveredRegion: string | null
  /** Regions with sub-maps available (get special styling) */
  highlightedRegions?: string[]
  /** Render only regions whose IDs are in this list (undefined = show all) */
  visibleRegions?: string[]
  /**
   * Region grouping for hover highlighting.
   * When hovering a region, all regions in the same group get highlighted.
   * Map from region ID to group ID.
   */
  regionGroups?: Map<string, string>
  /**
   * Currently selected group ID (e.g., selected continent).
   * Regions in this group get persistent selection styling.
   */
  selectedGroup?: string | null
  /**
   * Limit hover highlighting to only these regions.
   * If undefined, all regions are hoverable.
   * Use this to disable hover on non-interactive regions.
   */
  hoverableRegions?: string[]
}

export function MapSelectorMap({
  mapData,
  viewBox,
  onRegionClick,
  onRegionHover,
  hoveredRegion,
  highlightedRegions = [],
  visibleRegions,
  regionGroups,
  selectedGroup,
  hoverableRegions,
}: MapSelectorMapProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  // Filter regions if visibleRegions is provided
  const displayRegions = visibleRegions
    ? mapData.regions.filter((r) => visibleRegions.includes(r.id))
    : mapData.regions

  // Compute which group is currently hovered (if using groups)
  const hoveredGroup = useMemo(() => {
    if (!hoveredRegion || !regionGroups) return null
    return regionGroups.get(hoveredRegion) ?? null
  }, [hoveredRegion, regionGroups])

  // Check if a region is in the hovered group
  const isRegionHighlighted = (regionId: string): boolean => {
    if (!hoveredRegion) return false

    // If hoverableRegions is specified, only those regions can be highlighted
    if (hoverableRegions && !hoverableRegions.includes(regionId)) {
      return false
    }

    // If we have groups, check if this region is in the same group as hovered
    if (regionGroups && hoveredGroup) {
      const thisGroup = regionGroups.get(regionId)
      return thisGroup === hoveredGroup
    }

    // No groups - just check direct hover
    return regionId === hoveredRegion
  }

  // Check if a region is in the selected group
  const isRegionSelected = (regionId: string): boolean => {
    if (!selectedGroup || !regionGroups) return false
    const thisGroup = regionGroups.get(regionId)
    return thisGroup === selectedGroup
  }

  // Get fill color for a region
  const getRegionFill = (regionId: string): string => {
    const isHovered = isRegionHighlighted(regionId)
    const isSelected = isRegionSelected(regionId)
    const hasSubMap = highlightedRegions.includes(regionId)

    // Use the game's color algorithm
    const baseColor = getRegionColor(regionId, false, isHovered, isDark)

    // Hover takes precedence
    if (isHovered) {
      return baseColor
    }

    // Selected regions get a distinct color
    if (isSelected) {
      return isDark ? '#065f46' : '#a7f3d0' // Green tint for selection
    }

    // If this region has a sub-map, give it a subtle glow effect
    if (hasSubMap) {
      // Slightly brighter to indicate drillable
      return isDark ? '#4a5568' : '#c4b39a'
    }

    return baseColor
  }

  // Get stroke color for a region
  const getRegionStroke = (regionId: string): string => {
    const isHovered = isRegionHighlighted(regionId)
    const isSelected = isRegionSelected(regionId)
    const hasSubMap = highlightedRegions.includes(regionId)

    if (isHovered) {
      return isDark ? '#60a5fa' : '#1d4ed8'
    }

    if (isSelected) {
      return isDark ? '#10b981' : '#059669' // Green border for selection
    }

    if (hasSubMap) {
      // Subtle highlight for drillable regions
      return isDark ? '#60a5fa40' : '#1d4ed840'
    }

    return isDark ? '#374151' : '#9ca3af'
  }

  // Get stroke width for a region
  const getRegionStrokeWidth = (regionId: string): number => {
    const isHovered = isRegionHighlighted(regionId)
    const isSelected = isRegionSelected(regionId)
    const hasSubMap = highlightedRegions.includes(regionId)

    if (isHovered) return 2
    if (isSelected) return 1.5
    if (hasSubMap) return 1.5
    return 0.5
  }

  return (
    <div
      data-component="map-selector-map"
      className={css({
        width: '100%',
        aspectRatio: '16 / 9', // Fixed aspect ratio - doesn't change when drilling down
        bg: isDark ? 'gray.900' : 'gray.50',
        rounded: 'xl',
        border: '2px solid',
        borderColor: isDark ? 'gray.700' : 'gray.200',
        overflow: 'hidden',
        position: 'relative',
      })}
    >
      <svg
        viewBox={viewBox}
        className={css({
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          cursor: 'crosshair',
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

        {/* Render each region */}
        {displayRegions.map((region) => (
          <path
            key={region.id}
            data-region={region.id}
            d={region.path}
            fill={getRegionFill(region.id)}
            stroke={getRegionStroke(region.id)}
            strokeWidth={getRegionStrokeWidth(region.id)}
            onMouseEnter={() => onRegionHover(region.id)}
            onMouseLeave={() => onRegionHover(null)}
            onClick={(e) => {
              e.stopPropagation()
              onRegionClick(region.id)
            }}
            style={{
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              pointerEvents: 'all',
            }}
          />
        ))}
      </svg>
    </div>
  )
}
