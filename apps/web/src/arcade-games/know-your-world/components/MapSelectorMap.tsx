'use client'

import { useMemo, memo } from 'react'
import { css } from '@styled/css'
import { animated, useSpring } from '@react-spring/web'
import { useTheme } from '@/contexts/ThemeContext'
import type { MapData } from '../types'
import { getRegionColor } from '../mapColors'

/**
 * Animated SVG path component for smooth color/style transitions
 */
interface AnimatedRegionProps {
  id: string
  path: string
  fill: string
  stroke: string
  strokeWidth: number
  opacity: number
  isExcluded: boolean
  isPreviewAdd: boolean
  isPreviewRemove: boolean
  onMouseEnter: () => void
  onMouseLeave: () => void
  onClick: (e: React.MouseEvent) => void
}

const AnimatedRegion = memo(function AnimatedRegion({
  id,
  path,
  fill,
  stroke,
  strokeWidth,
  opacity,
  isExcluded,
  isPreviewAdd,
  isPreviewRemove,
  onMouseEnter,
  onMouseLeave,
  onClick,
}: AnimatedRegionProps) {
  const springProps = useSpring({
    fill,
    stroke,
    strokeWidth,
    opacity,
    config: { duration: 400 },
  })

  return (
    <animated.path
      data-region={id}
      data-excluded={isExcluded ? 'true' : undefined}
      data-preview-add={isPreviewAdd ? 'true' : undefined}
      data-preview-remove={isPreviewRemove ? 'true' : undefined}
      d={path}
      fill={springProps.fill}
      stroke={springProps.stroke}
      strokeWidth={springProps.strokeWidth}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
      style={{
        cursor: 'pointer',
        pointerEvents: 'all',
        opacity: springProps.opacity,
      }}
    />
  )
})

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
  /**
   * Regions that are excluded by region size filtering.
   * These will be shown dimmed/grayed out.
   */
  excludedRegions?: string[]
  /**
   * Regions that would be ADDED to the selection if the user clicks.
   * Shown with a distinct "preview add" style (e.g., green tint).
   */
  previewAddRegions?: string[]
  /**
   * Regions that would be REMOVED from the selection if the user clicks.
   * Shown with a distinct "preview remove" style (e.g., red/orange tint).
   */
  previewRemoveRegions?: string[]
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
  excludedRegions = [],
  previewAddRegions = [],
  previewRemoveRegions = [],
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

  // Check if a region is excluded by size filtering
  const isRegionExcluded = (regionId: string): boolean => {
    return excludedRegions.includes(regionId)
  }

  // Check if a region would be added in a preview
  const isRegionPreviewAdd = (regionId: string): boolean => {
    return previewAddRegions.includes(regionId)
  }

  // Check if a region would be removed in a preview
  const isRegionPreviewRemove = (regionId: string): boolean => {
    return previewRemoveRegions.includes(regionId)
  }

  // Get fill color for a region
  const getRegionFill = (regionId: string): string => {
    const isExcluded = isRegionExcluded(regionId)
    const isPreviewAdd = isRegionPreviewAdd(regionId)
    const isPreviewRemove = isRegionPreviewRemove(regionId)
    const isHovered = isRegionHighlighted(regionId)
    const isSelected = isRegionSelected(regionId)
    const hasSubMap = highlightedRegions.includes(regionId)

    // Preview states take precedence - show what would happen on click
    if (isPreviewAdd) {
      // Region would be ADDED - show with green/teal tint
      return isDark ? '#065f46' : '#a7f3d0'
    }
    if (isPreviewRemove) {
      // Region would be REMOVED - show with amber/orange tint
      return isDark ? '#78350f' : '#fde68a'
    }

    // Excluded regions are dimmed (but not if preview is showing something else)
    if (isExcluded) {
      return isDark ? '#1f2937' : '#e5e7eb' // Gray out excluded regions
    }

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
    const isExcluded = isRegionExcluded(regionId)
    const isPreviewAdd = isRegionPreviewAdd(regionId)
    const isPreviewRemove = isRegionPreviewRemove(regionId)
    const isHovered = isRegionHighlighted(regionId)
    const isSelected = isRegionSelected(regionId)
    const hasSubMap = highlightedRegions.includes(regionId)

    // Preview states take precedence
    if (isPreviewAdd) {
      return isDark ? '#10b981' : '#059669' // Green border
    }
    if (isPreviewRemove) {
      return isDark ? '#f59e0b' : '#d97706' // Amber border
    }

    // Excluded regions get subtle stroke
    if (isExcluded) {
      return isDark ? '#374151' : '#d1d5db'
    }

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
    const isPreviewAdd = isRegionPreviewAdd(regionId)
    const isPreviewRemove = isRegionPreviewRemove(regionId)
    const isHovered = isRegionHighlighted(regionId)
    const isSelected = isRegionSelected(regionId)
    const hasSubMap = highlightedRegions.includes(regionId)

    if (isPreviewAdd || isPreviewRemove) return 1.5
    if (isHovered) return 2
    if (isSelected) return 1.5
    if (hasSubMap) return 1.5
    return 0.5
  }

  // Get opacity for a region (preview regions should be fully visible)
  const getRegionOpacity = (regionId: string): number => {
    const isExcluded = isRegionExcluded(regionId)
    const isPreviewAdd = isRegionPreviewAdd(regionId)
    const isPreviewRemove = isRegionPreviewRemove(regionId)

    // Preview states override excluded opacity
    if (isPreviewAdd || isPreviewRemove) return 1
    if (isExcluded) return 0.5
    return 1
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

        {/* Render each region with smooth animations */}
        {displayRegions.map((region) => {
          const isExcluded = excludedRegions.includes(region.id)
          const isPreviewAdd = previewAddRegions.includes(region.id)
          const isPreviewRemove = previewRemoveRegions.includes(region.id)
          return (
            <AnimatedRegion
              key={region.id}
              id={region.id}
              path={region.path}
              fill={getRegionFill(region.id)}
              stroke={getRegionStroke(region.id)}
              strokeWidth={getRegionStrokeWidth(region.id)}
              opacity={getRegionOpacity(region.id)}
              isExcluded={isExcluded}
              isPreviewAdd={isPreviewAdd}
              isPreviewRemove={isPreviewRemove}
              onMouseEnter={() => onRegionHover(region.id)}
              onMouseLeave={() => onRegionHover(null)}
              onClick={(e) => {
                e.stopPropagation()
                onRegionClick(region.id)
              }}
            />
          )
        })}
      </svg>
    </div>
  )
}
