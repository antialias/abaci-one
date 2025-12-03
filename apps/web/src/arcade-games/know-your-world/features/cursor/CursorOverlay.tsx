/**
 * CursorOverlay Component
 *
 * Renders the custom cursor and heat crosshair overlays on the map.
 * Shows compass-style crosshairs with heat-based effects when hot/cold is enabled.
 * Uses MapRendererContext for shared state (cursorPosition, pointerLocked, isDark).
 */

'use client'

import type { SpringValue } from '@react-spring/web'
import { memo } from 'react'
import { useMapRendererContext } from '../map-renderer'
import type { FeedbackType } from '../../utils/hotColdPhrases'
import { getHeatCrosshairStyle, type HeatCrosshairStyle } from '../../utils/hotColdStyles'
import { CompassCrosshair } from './CompassCrosshair'

// ============================================================================
// Types
// ============================================================================

export interface CursorOverlayProps {
  /** Whether device has fine pointer (desktop) */
  hasAnyFinePointer: boolean
  /** Whether hot/cold feedback is enabled */
  hotColdEnabled: boolean
  /** Current hot/cold feedback type */
  hotColdFeedbackType: FeedbackType | null
  /** Spring value for cursor squish animation */
  cursorSquish: { x: number; y: number }
  /** Spring value for crosshair rotation */
  rotationAngle: SpringValue<number>
  /** Pre-computed crosshair heat style */
  crosshairHeatStyle: HeatCrosshairStyle
  /** Current region name to display */
  currentRegionName: string | null
  /** Current region flag emoji */
  currentFlagEmoji: string | null
}

// ============================================================================
// Component
// ============================================================================

/**
 * Renders cursor and heat crosshair overlays.
 *
 * Shows:
 * - Custom cursor with compass crosshair (desktop only)
 * - "Find [region]" label under cursor
 * - Heat crosshair overlay when hot/cold enabled
 */
export const CursorOverlay = memo(function CursorOverlay({
  hasAnyFinePointer,
  hotColdEnabled,
  hotColdFeedbackType,
  cursorSquish,
  rotationAngle,
  crosshairHeatStyle,
  currentRegionName,
  currentFlagEmoji,
}: CursorOverlayProps) {
  // Get shared state from context
  const { cursorPosition, pointerLocked, isDark } = useMapRendererContext()

  if (!cursorPosition || !hasAnyFinePointer) return null

  const labelHeatStyle = getHeatCrosshairStyle(hotColdFeedbackType, isDark, hotColdEnabled)

  return (
    <>
      {/* Custom Cursor - Visible on desktop when cursor is on the map */}
      <div
        data-element="custom-cursor"
        style={{
          position: 'absolute',
          left: `${cursorPosition.x}px`,
          top: `${cursorPosition.y}px`,
          pointerEvents: 'none',
          zIndex: 200,
          transform: `translate(-50%, -50%) scale(${cursorSquish.x}, ${cursorSquish.y})`,
          transition: 'transform 0.1s ease-out',
        }}
      >
        {/* Compass-style crosshair with heat effects - ring rotates, N stays fixed */}
        <CompassCrosshair
          size={32}
          style={crosshairHeatStyle}
          rotationAngle={rotationAngle}
          dropShadow="drop-shadow(0 1px 2px rgba(0,0,0,0.5))"
        />
      </div>

      {/* Cursor region name label - shows what to find under the cursor */}
      {currentRegionName && (
        <div
          data-element="cursor-region-label"
          style={{
            position: 'absolute',
            left: `${cursorPosition.x}px`,
            top: `${cursorPosition.y + 22}px`,
            transform: 'translateX(-50%)',
            pointerEvents: 'none',
            zIndex: 201,
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '4px 8px',
            backgroundColor: isDark ? 'rgba(30, 58, 138, 0.95)' : 'rgba(219, 234, 254, 0.95)',
            border: `2px solid ${labelHeatStyle.color}`,
            borderRadius: '6px',
            boxShadow:
              labelHeatStyle.glowColor !== 'transparent'
                ? `0 2px 8px rgba(0, 0, 0, 0.3), 0 0 12px ${labelHeatStyle.glowColor}`
                : '0 2px 8px rgba(0, 0, 0, 0.3)',
            whiteSpace: 'nowrap',
            opacity: Math.max(0.5, labelHeatStyle.opacity), // Keep label visible but dimmed
          }}
        >
          <span
            style={{
              fontSize: '10px',
              fontWeight: 'bold',
              color: isDark ? '#93c5fd' : '#1e40af',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            Find
          </span>
          <span
            style={{
              fontSize: '13px',
              fontWeight: 'bold',
              color: isDark ? 'white' : '#1e3a8a',
            }}
          >
            {currentRegionName}
          </span>
          {currentFlagEmoji && <span style={{ fontSize: '14px' }}>{currentFlagEmoji}</span>}
        </div>
      )}

      {/* Heat crosshair overlay on main map - shows when hot/cold enabled (desktop non-pointer-lock) */}
      {hotColdEnabled && !pointerLocked && (
        <div
          data-element="main-map-heat-crosshair"
          style={{
            position: 'absolute',
            left: `${cursorPosition.x}px`,
            top: `${cursorPosition.y}px`,
            pointerEvents: 'none',
            zIndex: 150,
            transform: 'translate(-50%, -50%)',
          }}
        >
          {/* Compass-style crosshair with heat effects - ring rotates, N stays fixed */}
          <CompassCrosshair
            size={40}
            style={getHeatCrosshairStyle(hotColdFeedbackType, isDark, hotColdEnabled)}
            rotationAngle={rotationAngle}
            dropShadow="drop-shadow(0 1px 3px rgba(0,0,0,0.6))"
          />
        </div>
      )}
    </>
  )
})
