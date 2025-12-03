/**
 * RegionLayer Component
 *
 * Renders all map regions (SVG paths) with their visual states:
 * - Found/unfound coloring
 * - Hover effects
 * - Network cursor hover effects
 * - Give-up reveal animation
 * - Hint highlight animation
 * - Celebration animation
 * - Player-specific patterns for found regions
 *
 * Uses MapRendererContext for shared state (isDark, pointerLocked).
 */

'use client'

import { memo } from 'react'
import { useMapRendererContext } from '../map-renderer'
import { getRegionColor, getRegionStroke } from '../../mapColors'
import type { MapRegion } from '../../types'

// ============================================================================
// Types
// ============================================================================

export interface NetworkHoverInfo {
  playerId: string
  color: string
}

export interface GiveUpRevealState {
  regionId: string
  regionName: string
}

export interface HintActiveState {
  regionId: string
}

export interface CelebrationState {
  regionId: string
}

export interface RegionLayerProps {
  /** All regions to render (included + excluded) */
  regions: MapRegion[]
  /** Set of excluded region IDs */
  excludedRegionIds: Set<string>
  /** Array of found region IDs */
  regionsFound: string[]
  /** Currently hovered region ID */
  hoveredRegion: string | null
  /** Setter for hovered region */
  setHoveredRegion: (regionId: string | null) => void
  /** Network cursor hover states by region ID */
  networkHoveredRegions: Record<string, NetworkHoverInfo>
  /** Give up reveal state */
  giveUpReveal: GiveUpRevealState | null
  /** Give up flash animation progress (0-1) */
  giveUpFlashProgress: number
  /** Whether give up animation is active */
  isGiveUpAnimating: boolean
  /** Hint state */
  hintActive: HintActiveState | null
  /** Hint flash animation progress (0-1) */
  hintFlashProgress: number
  /** Celebration state */
  celebration: CelebrationState | null
  /** Celebration flash animation progress (0-1) */
  celebrationFlashProgress: number
  /** Whether device has fine pointer (desktop) */
  hasAnyFinePointer: boolean
  /** Function to check if region should show outline */
  showOutline: (region: MapRegion) => boolean
  /** Function to get player who found a region */
  getPlayerWhoFoundRegion: (regionId: string) => string | null
  /** Click handler for region */
  onRegionClick: (regionId: string, regionName: string) => void
}

// ============================================================================
// Component
// ============================================================================

/**
 * Renders all map regions with visual states and interactions.
 */
export const RegionLayer = memo(function RegionLayer({
  regions,
  excludedRegionIds,
  regionsFound,
  hoveredRegion,
  setHoveredRegion,
  networkHoveredRegions,
  giveUpReveal,
  giveUpFlashProgress,
  isGiveUpAnimating,
  hintActive,
  hintFlashProgress,
  celebration,
  celebrationFlashProgress,
  hasAnyFinePointer,
  showOutline,
  getPlayerWhoFoundRegion,
  onRegionClick,
}: RegionLayerProps) {
  // Get shared state from context
  const { isDark, pointerLocked } = useMapRendererContext()

  return (
    <>
      {regions.map((region) => {
        const isExcluded = excludedRegionIds.has(region.id)
        const isFound = regionsFound.includes(region.id) || isExcluded // Treat excluded as pre-found
        const playerId = !isExcluded && isFound ? getPlayerWhoFoundRegion(region.id) : null
        const isBeingRevealed = giveUpReveal?.regionId === region.id
        const isBeingHinted = hintActive?.regionId === region.id
        const isCelebrating = celebration?.regionId === region.id

        // Special styling for excluded regions (grayed out, pre-labeled)
        // Bright gold flash for give up reveal, celebration, and hint
        const fill = isCelebrating
          ? `rgba(255, 215, 0, ${0.7 + celebrationFlashProgress * 0.3})` // Bright gold celebration flash
          : isBeingRevealed
            ? `rgba(255, 200, 0, ${0.6 + giveUpFlashProgress * 0.4})` // Brighter gold, higher base opacity
            : isExcluded
              ? isDark
                ? '#374151' // gray-700
                : '#d1d5db' // gray-300
              : isFound && playerId
                ? `url(#player-pattern-${playerId})`
                : getRegionColor(region.id, isFound, hoveredRegion === region.id, isDark)

        // During give-up animation, dim all non-revealed regions
        const dimmedOpacity = isGiveUpAnimating && !isBeingRevealed ? 0.25 : 1

        // Revealed/celebrating region gets a prominent stroke
        // Unfound regions get thicker borders for better visibility against sea
        const stroke = isCelebrating
          ? `rgba(255, 180, 0, ${0.8 + celebrationFlashProgress * 0.2})` // Gold stroke for celebration
          : isBeingRevealed
            ? `rgba(255, 140, 0, ${0.8 + giveUpFlashProgress * 0.2})` // Orange stroke for contrast
            : getRegionStroke(isFound, isDark)
        const strokeWidth = isCelebrating ? 4 : isBeingRevealed ? 3 : isFound ? 1 : 1.5

        // Check if a network cursor is hovering over this region
        const networkHover = networkHoveredRegions[region.id]

        return (
          <g key={region.id} style={{ opacity: dimmedOpacity }}>
            {/* Glow effect for network-hovered region (other player's cursor) */}
            {networkHover && !isBeingRevealed && (
              <path
                d={region.path}
                fill="none"
                stroke={networkHover.color}
                strokeWidth={6}
                vectorEffect="non-scaling-stroke"
                opacity={0.5}
                style={{ filter: 'blur(3px)' }}
                pointerEvents="none"
              />
            )}
            {/* Glow effect for revealed region */}
            {isBeingRevealed && (
              <path
                d={region.path}
                fill="none"
                stroke={`rgba(255, 215, 0, ${0.3 + giveUpFlashProgress * 0.5})`}
                strokeWidth={8}
                vectorEffect="non-scaling-stroke"
                style={{ filter: 'blur(4px)' }}
              />
            )}
            {/* Glow effect for hint - cyan pulsing outline */}
            {isBeingHinted && (
              <path
                d={region.path}
                fill={`rgba(0, 200, 255, ${0.1 + hintFlashProgress * 0.3})`}
                stroke={`rgba(0, 200, 255, ${0.4 + hintFlashProgress * 0.6})`}
                strokeWidth={6}
                vectorEffect="non-scaling-stroke"
                style={{ filter: 'blur(3px)' }}
                pointerEvents="none"
              />
            )}
            {/* Glow effect for celebration - bright gold pulsing */}
            {isCelebrating && (
              <path
                d={region.path}
                fill={`rgba(255, 215, 0, ${0.2 + celebrationFlashProgress * 0.4})`}
                stroke={`rgba(255, 215, 0, ${0.4 + celebrationFlashProgress * 0.6})`}
                strokeWidth={10}
                vectorEffect="non-scaling-stroke"
                style={{ filter: 'blur(6px)' }}
                pointerEvents="none"
              />
            )}
            {/* Network hover border (crisp outline in player color) */}
            {networkHover && !isBeingRevealed && (
              <path
                d={region.path}
                fill="none"
                stroke={networkHover.color}
                strokeWidth={2}
                vectorEffect="non-scaling-stroke"
                opacity={0.8}
                strokeDasharray="4,2"
                pointerEvents="none"
              />
            )}
            {/* Region path */}
            <path
              data-region-id={region.id}
              d={region.path}
              fill={fill}
              stroke={stroke}
              strokeWidth={strokeWidth}
              vectorEffect="non-scaling-stroke"
              opacity={showOutline(region) ? 1 : 0.7} // Increased from 0.3 to 0.7 for better visibility
              // When pointer lock is active, hover is controlled by cursor position tracking
              // Otherwise, use native mouse events
              onMouseEnter={() => !isExcluded && !pointerLocked && setHoveredRegion(region.id)}
              onMouseLeave={() => !pointerLocked && setHoveredRegion(null)}
              onClick={() => {
                if (!isExcluded && !celebration) {
                  onRegionClick(region.id, region.name)
                }
              }} // Disable clicks on excluded regions and during celebration
              style={{
                // Hide native cursor on desktop (custom crosshair shown instead)
                cursor: hasAnyFinePointer ? 'none' : isExcluded ? 'default' : 'pointer',
                transition: 'all 0.2s ease',
                // Ensure entire path interior is clickable, not just visible fill
                pointerEvents: isExcluded ? 'none' : 'all',
              }}
            />

            {/* Ghost element for region center position tracking */}
            <circle
              cx={region.center[0]}
              cy={region.center[1]}
              r={0.1}
              fill="none"
              pointerEvents="none"
              data-ghost-region={region.id}
            />
          </g>
        )
      })}
    </>
  )
})
