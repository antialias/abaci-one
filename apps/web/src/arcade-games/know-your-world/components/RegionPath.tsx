/**
 * Region Path Component
 *
 * Renders a single map region with all its visual states:
 * - Normal, hovered, found states
 * - Animation effects (reveal, hint, celebration)
 * - Network hover effects (multiplayer)
 * - Glow effects for various states
 *
 * This component is memoized for performance since regions
 * only need to re-render when their specific state changes.
 *
 * Global rendering state (isDark, animation progress, etc.) comes
 * from RegionRenderContext to reduce prop drilling.
 */

'use client'

import { memo } from 'react'

import { getRegionColor, getRegionStroke } from '../mapColors'
import type { MapRegion } from '../types'
import { useRegionRenderState } from './RegionRenderContext'

// ============================================================================
// Types
// ============================================================================

export interface RegionPathProps {
  /** The region data to render */
  region: MapRegion

  // -------------------------------------------------------------------------
  // Per-Region State (varies for each region)
  // -------------------------------------------------------------------------
  /** Whether this region is excluded from the game (greyed out) */
  isExcluded: boolean
  /** Whether this region has been found by any player */
  isFound: boolean
  /** Player ID who found this region (for pattern fill) */
  playerId: string | null
  /** Whether this region is currently being revealed (give-up animation) */
  isBeingRevealed: boolean
  /** Whether this region is currently being hinted */
  isBeingHinted: boolean
  /** Whether this region is currently celebrating */
  isCelebrating: boolean
  /** Whether this region is hovered by local cursor */
  isHovered: boolean
  /** Network hover info if another player is hovering this region */
  networkHover?: { color: string } | null
  /** Whether to show the region outline (based on showOutline function result) */
  showOutline: boolean

  // -------------------------------------------------------------------------
  // Callbacks
  // -------------------------------------------------------------------------
  /** Called when mouse enters region (native hover) */
  onMouseEnter: () => void
  /** Called when mouse leaves region */
  onMouseLeave: () => void
  /** Called when region is clicked */
  onClick: () => void
}

// ============================================================================
// Component
// ============================================================================

/**
 * Renders a single map region with all visual effects.
 *
 * Memoized to prevent unnecessary re-renders when other regions change.
 * Global rendering state comes from RegionRenderContext.
 *
 * @example
 * ```tsx
 * <RegionRenderProvider isDark={isDark} ... >
 *   <RegionPath
 *     region={region}
 *     isExcluded={false}
 *     isFound={true}
 *     playerId="player-1"
 *     isHovered={hoveredRegion === region.id}
 *     showOutline={showOutline(region)}
 *     onMouseEnter={() => setHoveredRegion(region.id)}
 *     onMouseLeave={() => setHoveredRegion(null)}
 *     onClick={() => handleClick(region.id)}
 *   />
 * </RegionRenderProvider>
 * ```
 */
export const RegionPath = memo(function RegionPath({
  region,
  isExcluded,
  isFound,
  playerId,
  isBeingRevealed,
  isBeingHinted,
  isCelebrating,
  isHovered,
  networkHover,
  showOutline,
  onMouseEnter,
  onMouseLeave,
  onClick,
}: RegionPathProps) {
  // Get global rendering state from context
  const {
    isDark,
    pointerLocked,
    hasAnyFinePointer,
    giveUpFlashProgress,
    hintFlashProgress,
    celebrationFlashProgress,
    isGiveUpAnimating,
    celebrationActive,
  } = useRegionRenderState()

  // -------------------------------------------------------------------------
  // Calculate Fill Color
  // -------------------------------------------------------------------------
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
          : getRegionColor(region.id, isFound, isHovered, isDark)

  // -------------------------------------------------------------------------
  // Calculate Stroke
  // -------------------------------------------------------------------------
  const stroke = isCelebrating
    ? `rgba(255, 180, 0, ${0.8 + celebrationFlashProgress * 0.2})` // Gold stroke for celebration
    : isBeingRevealed
      ? `rgba(255, 140, 0, ${0.8 + giveUpFlashProgress * 0.2})` // Orange stroke for contrast
      : getRegionStroke(isFound, isDark)

  const strokeWidth = isCelebrating ? 4 : isBeingRevealed ? 3 : isFound ? 1 : 1.5

  // -------------------------------------------------------------------------
  // Calculate Opacity (dim during give-up animation)
  // -------------------------------------------------------------------------
  const dimmedOpacity = isGiveUpAnimating && !isBeingRevealed ? 0.25 : 1

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <g data-region-group={region.id} style={{ opacity: dimmedOpacity }}>
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

      {/* Main region path */}
      <path
        data-region-id={region.id}
        d={region.path}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
        vectorEffect="non-scaling-stroke"
        opacity={showOutline ? 1 : 0.7}
        onMouseEnter={!isExcluded && !pointerLocked ? onMouseEnter : undefined}
        onMouseLeave={!pointerLocked ? onMouseLeave : undefined}
        onClick={!isExcluded && !celebrationActive ? onClick : undefined}
        style={{
          cursor: hasAnyFinePointer ? 'none' : isExcluded ? 'default' : 'pointer',
          transition: 'all 0.2s ease',
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
})
