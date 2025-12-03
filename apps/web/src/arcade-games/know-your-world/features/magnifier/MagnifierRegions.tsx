/**
 * Magnifier Regions Component
 *
 * Renders all map regions inside the magnified SVG view.
 * Handles region coloring, celebration/give-up animations,
 * and player attribution for found regions.
 */

'use client'

import { memo } from 'react'
import type { MapRegion } from '../../types'

// ============================================================================
// Types
// ============================================================================

// Re-export MapRegion for convenience
export type { MapRegion }

export interface RegionState {
  /** IDs of regions that have been found */
  regionsFound: string[]
  /** Currently hovered region ID */
  hoveredRegion: string | null
  /** Region currently celebrating (just found) */
  celebrationRegionId: string | null
  /** Region being revealed in give-up animation */
  giveUpRegionId: string | null
  /** Whether give-up animation is playing */
  isGiveUpAnimating: boolean
}

export interface FlashProgress {
  /** Celebration flash animation progress (0-1) */
  celebrationFlash: number
  /** Give-up flash animation progress (0-1) */
  giveUpFlash: number
}

export interface MagnifierRegionsProps {
  /** All regions to render */
  regions: MapRegion[]
  /** Current region state */
  regionState: RegionState
  /** Animation progress for flashing effects */
  flashProgress: FlashProgress
  /** Whether dark mode is active */
  isDark: boolean
  /** Get player ID who found a region */
  getPlayerWhoFoundRegion: (regionId: string) => string | null
  /** Get region fill color */
  getRegionColor: (regionId: string, isFound: boolean, isHovered: boolean, isDark: boolean) => string
  /** Get region stroke color */
  getRegionStroke: (isFound: boolean, isDark: boolean) => string
  /** Whether to show region outline */
  showOutline: (region: MapRegion) => boolean
}

// ============================================================================
// Component
// ============================================================================

/**
 * Renders regions inside the magnifier's SVG view.
 *
 * Features:
 * - Celebration glow effect for just-found regions
 * - Give-up reveal animation with pulsing
 * - Player pattern fill for found regions
 * - Dimming of non-revealed regions during give-up
 */
export const MagnifierRegions = memo(function MagnifierRegions({
  regions,
  regionState,
  flashProgress,
  isDark,
  getPlayerWhoFoundRegion,
  getRegionColor,
  getRegionStroke,
  showOutline,
}: MagnifierRegionsProps) {
  const {
    regionsFound,
    hoveredRegion,
    celebrationRegionId,
    giveUpRegionId,
    isGiveUpAnimating,
  } = regionState
  const { celebrationFlash, giveUpFlash } = flashProgress

  return (
    <>
      {regions.map((region) => {
        const isFound = regionsFound.includes(region.id)
        const playerId = isFound ? getPlayerWhoFoundRegion(region.id) : null
        const isBeingRevealed = giveUpRegionId === region.id
        const isCelebrating = celebrationRegionId === region.id

        // Bright gold flash for celebration and give up reveal
        const fill = isCelebrating
          ? `rgba(255, 215, 0, ${0.7 + celebrationFlash * 0.3})`
          : isBeingRevealed
            ? `rgba(255, 200, 0, ${0.6 + giveUpFlash * 0.4})`
            : isFound && playerId
              ? `url(#player-pattern-${playerId})`
              : getRegionColor(region.id, isFound, hoveredRegion === region.id, isDark)

        // During give-up animation, dim all non-revealed regions
        const dimmedOpacity = isGiveUpAnimating && !isBeingRevealed ? 0.25 : 1

        // Revealed/celebrating region gets a prominent stroke
        // Unfound regions get thicker borders for better visibility against sea
        const stroke = isCelebrating
          ? `rgba(255, 180, 0, ${0.8 + celebrationFlash * 0.2})`
          : isBeingRevealed
            ? `rgba(255, 140, 0, ${0.8 + giveUpFlash * 0.2})`
            : getRegionStroke(isFound, isDark)
        const strokeWidth = isCelebrating ? 3 : isBeingRevealed ? 2 : isFound ? 0.5 : 1

        return (
          <g key={`mag-${region.id}`} style={{ opacity: dimmedOpacity }}>
            {/* Glow effect for revealed region */}
            {isBeingRevealed && (
              <path
                d={region.path}
                fill="none"
                stroke={`rgba(255, 215, 0, ${0.3 + giveUpFlash * 0.5})`}
                strokeWidth={5}
                vectorEffect="non-scaling-stroke"
                style={{ filter: 'blur(2px)' }}
              />
            )}
            {/* Glow effect for celebrating region */}
            {isCelebrating && (
              <path
                d={region.path}
                fill={`rgba(255, 215, 0, ${0.2 + celebrationFlash * 0.4})`}
                stroke={`rgba(255, 215, 0, ${0.4 + celebrationFlash * 0.6})`}
                strokeWidth={8}
                vectorEffect="non-scaling-stroke"
                style={{ filter: 'blur(4px)' }}
              />
            )}
            {/* Main region path */}
            <path
              d={region.path}
              fill={fill}
              stroke={stroke}
              strokeWidth={strokeWidth}
              vectorEffect="non-scaling-stroke"
              opacity={showOutline(region) ? 1 : 0.3}
            />
          </g>
        )
      })}
    </>
  )
})
