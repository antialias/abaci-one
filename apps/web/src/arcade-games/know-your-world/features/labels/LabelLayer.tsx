/**
 * LabelLayer - Renders labels for found regions
 *
 * This component renders two types of labels:
 * 1. Regular labels for large regions (positioned at centroid)
 * 2. Small region labels with arrows (for tiny regions like Gibraltar, DC)
 *
 * Labels fade as the cursor approaches to reduce visual clutter.
 */

import { getLabelTextColor, getLabelTextShadow } from '../../mapColors'
import { calculateLabelOpacity } from './labelUtils'
import type { PlayerMetadata, RegionLabelPosition, SmallRegionLabelPosition } from './types'

export interface LabelLayerProps {
  /** Positions for regular (large) region labels */
  labelPositions: RegionLabelPosition[]
  /** Positions for small region labels with arrows */
  smallRegionLabelPositions: SmallRegionLabelPosition[]
  /** Current cursor position in container coordinates */
  cursorPosition: { x: number; y: number } | null
  /** ID of the currently hovered region */
  hoveredRegion: string | null
  /** Array of found region IDs */
  regionsFound: string[]
  /** Whether give-up animation is playing */
  isGiveUpAnimating: boolean
  /** Whether the theme is dark mode */
  isDark: boolean
  /** Map of player IDs to metadata */
  playerMetadata: Record<string, PlayerMetadata>
  /** Whether the device has any fine pointer (for cursor style) */
  hasAnyFinePointer: boolean
  /** Whether celebration is active (disables click handling) */
  celebration: unknown
  /** Callback when a small region label is clicked */
  onRegionClick: (regionId: string, regionName: string) => void
  /** Callback when hover state changes */
  onHover: (regionId: string | null) => void
}

/**
 * Renders region labels as HTML overlays positioned absolutely over the SVG map
 */
export function LabelLayer({
  labelPositions,
  smallRegionLabelPositions,
  cursorPosition,
  hoveredRegion,
  regionsFound,
  isGiveUpAnimating,
  isDark,
  playerMetadata,
  hasAnyFinePointer,
  celebration,
  onRegionClick,
  onHover,
}: LabelLayerProps) {
  return (
    <>
      {/* HTML labels positioned absolutely over the SVG */}
      {labelPositions.map((label) => {
        const labelOpacity = calculateLabelOpacity(
          label.x,
          label.y,
          label.regionId,
          cursorPosition,
          hoveredRegion,
          regionsFound,
          isGiveUpAnimating
        )
        return (
          <div
            key={label.regionId}
            data-element="region-label"
            data-region-id={label.regionId}
            style={{
              position: 'absolute',
              left: `${label.x}px`,
              top: `${label.y}px`,
              transform: 'translate(-50%, -50%)',
              pointerEvents: 'none',
              zIndex: 10,
              opacity: labelOpacity,
              transition: 'opacity 0.15s ease-out',
            }}
          >
            {/* Region name */}
            <div
              style={{
                fontSize: '14px',
                fontWeight: 'bold',
                color: getLabelTextColor(isDark, true),
                textShadow: getLabelTextShadow(isDark, true),
                whiteSpace: 'nowrap',
                textAlign: 'center',
                pointerEvents: 'none',
              }}
            >
              {label.regionName}
            </div>

            {/* Player avatars */}
            {label.players.length > 0 && (
              <div
                style={{
                  display: 'flex',
                  gap: '2px',
                  marginTop: '2px',
                  justifyContent: 'center',
                  pointerEvents: 'none',
                }}
              >
                {label.players.map((playerId) => {
                  const player = playerMetadata[playerId]
                  if (!player) return null

                  return (
                    <div
                      key={playerId}
                      style={{
                        width: '14px',
                        height: '14px',
                        borderRadius: '50%',
                        backgroundColor: player.color || '#3b82f6',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '10px',
                        opacity: 0.9,
                        pointerEvents: 'none',
                      }}
                    >
                      {player.emoji}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}

      {/* Small region labels with arrows positioned absolutely over the SVG */}
      {smallRegionLabelPositions.map((label) => {
        const labelOpacity = calculateLabelOpacity(
          label.labelX,
          label.labelY,
          label.regionId,
          cursorPosition,
          hoveredRegion,
          regionsFound,
          isGiveUpAnimating
        )
        return (
          <div
            key={`small-${label.regionId}`}
            data-element="small-region-label"
            data-region-id={label.regionId}
            style={{
              opacity: labelOpacity,
              transition: 'opacity 0.15s ease-out',
            }}
          >
            {/* Arrow line - use SVG positioned absolutely */}
            <svg
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
                overflow: 'visible',
              }}
            >
              <line
                x1={label.lineStartX}
                y1={label.lineStartY}
                x2={label.lineEndX}
                y2={label.lineEndY}
                stroke={label.isFound ? '#16a34a' : isDark ? '#60a5fa' : '#3b82f6'}
                strokeWidth={1.5}
                vectorEffect="non-scaling-stroke"
                markerEnd={label.isFound ? 'url(#arrowhead-found)' : 'url(#arrowhead)'}
              />
              {/* Debug: Show arrow endpoint (region centroid) */}
              <circle cx={label.lineEndX} cy={label.lineEndY} r={3} fill="red" opacity={0.8} />
            </svg>

            {/* Label box and text */}
            <div
              style={{
                position: 'absolute',
                left: `${label.labelX}px`,
                top: `${label.labelY}px`,
                transform: 'translate(-50%, -50%)',
                pointerEvents: 'all',
                // Hide native cursor on desktop (custom crosshair shown instead)
                cursor: hasAnyFinePointer ? 'none' : 'pointer',
                zIndex: 20,
              }}
              onClick={() => !celebration && onRegionClick(label.regionId, label.regionName)}
              onMouseEnter={() => onHover(label.regionId)}
              onMouseLeave={() => onHover(null)}
            >
              {/* Background box */}
              <div
                style={{
                  padding: '2px 5px',
                  backgroundColor: label.isFound
                    ? isDark
                      ? '#22c55e'
                      : '#86efac'
                    : isDark
                      ? '#1f2937'
                      : '#ffffff',
                  border: `1px solid ${label.isFound ? '#16a34a' : isDark ? '#60a5fa' : '#3b82f6'}`,
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontWeight: '600',
                  color: getLabelTextColor(isDark, label.isFound),
                  textShadow: label.isFound
                    ? getLabelTextShadow(isDark, true)
                    : '0 0 2px rgba(0,0,0,0.5)',
                  whiteSpace: 'nowrap',
                  userSelect: 'none',
                  transition: 'all 0.2s ease',
                }}
              >
                {label.regionName}
              </div>
            </div>
          </div>
        )
      })}
    </>
  )
}
