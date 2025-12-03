/**
 * DebugAutoZoomPanel Component
 *
 * Debug panel for visualizing auto-zoom detection and decision process.
 * Shows detection box around cursor and detailed zoom/region analysis.
 *
 * Uses MapRendererContext for containerRef.
 */

'use client'

import { memo } from 'react'
import type { RegionDetectionResult } from '../../hooks/useRegionDetection'
import type { AdaptiveZoomSearchResult } from '../../utils/adaptiveZoomSearch'
import { useMapRendererContext } from '../map-renderer'

// ============================================================================
// Types
// ============================================================================

export interface DebugAutoZoomPanelProps {
  /** Whether to show the debug panel */
  visible: boolean
  /** Current cursor position in container coordinates */
  cursorPosition: { x: number; y: number } | null
  /** Function to detect regions at cursor position */
  detectRegions: (cursorX: number, cursorY: number) => RegionDetectionResult
  /** Magnifier left position (for positioning info overlay on opposite side) */
  targetLeft: number
  /** Zoom search debug info from adaptive zoom algorithm */
  zoomSearchDebugInfo: AdaptiveZoomSearchResult | null
  /** Function to get current zoom level */
  getCurrentZoom: () => number
  /** Target zoom level */
  targetZoom: number
}

// ============================================================================
// Component
// ============================================================================

/**
 * Renders debug visualization for auto-zoom detection.
 */
export const DebugAutoZoomPanel = memo(function DebugAutoZoomPanel({
  visible,
  cursorPosition,
  detectRegions,
  targetLeft,
  zoomSearchDebugInfo,
  getCurrentZoom,
  targetZoom,
}: DebugAutoZoomPanelProps) {
  // Get containerRef from context
  const { containerRef } = useMapRendererContext()

  // Don't render if not visible or no cursor position
  if (!visible || !cursorPosition || !containerRef.current) return null

  // Run region detection at cursor position
  const { detectedRegions, hasSmallRegion, detectedSmallestSize } = detectRegions(
    cursorPosition.x,
    cursorPosition.y
  )

  // Position info overlay on opposite side from magnifier
  const containerWidth = containerRef.current.getBoundingClientRect().width
  const magnifierOnLeft = targetLeft < containerWidth / 2

  return (
    <>
      {/* Detection box - 50px box around cursor */}
      <div
        data-element="debug-detection-box"
        style={{
          position: 'absolute',
          left: `${cursorPosition.x - 25}px`,
          top: `${cursorPosition.y - 25}px`,
          width: '50px',
          height: '50px',
          border: '2px dashed yellow',
          pointerEvents: 'none',
          zIndex: 150,
        }}
      />

      {/* Detection info overlay */}
      <div
        data-element="debug-auto-zoom-info"
        style={{
          position: 'absolute',
          bottom: '10px',
          left: magnifierOnLeft ? undefined : '10px',
          right: magnifierOnLeft ? '10px' : undefined,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          color: 'white',
          padding: '10px',
          borderRadius: '4px',
          fontSize: '12px',
          fontFamily: 'monospace',
          pointerEvents: 'none',
          zIndex: 150,
          maxWidth: '300px',
        }}
      >
        <div>
          <strong>Detection Box (50px)</strong>
        </div>
        <div>Regions detected: {detectedRegions.length}</div>
        <div>Has small region: {hasSmallRegion ? 'YES' : 'NO'}</div>
        <div>
          Smallest size:{' '}
          {detectedSmallestSize === Infinity ? '∞' : `${detectedSmallestSize.toFixed(1)}px`}
        </div>

        {/* Zoom Decision Details */}
        {zoomSearchDebugInfo && (
          <>
            <div
              style={{
                marginTop: '8px',
                paddingTop: '8px',
                borderTop: '1px solid #444',
              }}
            >
              <strong>Zoom Decision:</strong>
            </div>
            <div style={{ fontSize: '10px', marginLeft: '8px' }}>
              Final zoom: <strong>{zoomSearchDebugInfo.zoom.toFixed(1)}×</strong>
              {!zoomSearchDebugInfo.foundGoodZoom && ' (fallback to min)'}
            </div>
            <div style={{ fontSize: '10px', marginLeft: '8px' }}>
              Accepted: <strong>{zoomSearchDebugInfo.acceptedRegionId || 'none'}</strong>
            </div>
            <div style={{ fontSize: '10px', marginLeft: '8px' }}>
              Thresholds: {(zoomSearchDebugInfo.acceptanceThresholds.min * 100).toFixed(0)}% -{' '}
              {(zoomSearchDebugInfo.acceptanceThresholds.max * 100).toFixed(0)}% of magnifier
            </div>

            <div style={{ marginTop: '8px' }}>
              <strong>Region Analysis (top 3):</strong>
            </div>
            {Array.from(
              new Map(zoomSearchDebugInfo.regionDecisions.map((d) => [d.regionId, d])).values()
            )
              .sort((a, b) => b.importance - a.importance)
              .slice(0, 3)
              .map((decision) => {
                const marker = decision.wasAccepted ? '✓' : '✗'
                const color = decision.wasAccepted ? '#0f0' : '#888'
                return (
                  <div
                    key={`decision-${decision.regionId}`}
                    style={{
                      fontSize: '9px',
                      marginLeft: '8px',
                      color,
                    }}
                  >
                    {marker} {decision.regionId}: {decision.currentSize.width.toFixed(0)}×
                    {decision.currentSize.height.toFixed(0)}px
                    {decision.rejectionReason && ` (${decision.rejectionReason})`}
                  </div>
                )
              })}
          </>
        )}

        <div
          style={{
            marginTop: '8px',
            paddingTop: '8px',
            borderTop: '1px solid #444',
          }}
        >
          <strong>Detected Regions ({detectedRegions.length}):</strong>
        </div>
        {detectedRegions.map((region) => (
          <div key={region.id} style={{ fontSize: '10px', marginLeft: '8px' }}>
            • {region.id}: {region.pixelWidth.toFixed(1)}×{region.pixelHeight.toFixed(1)}px
            {region.isVerySmall ? ' (SMALL)' : ''}
          </div>
        ))}
        <div style={{ marginTop: '8px' }}>
          <strong>Current Zoom:</strong> {getCurrentZoom().toFixed(1)}×
        </div>
        <div>
          <strong>Target Zoom:</strong> {targetZoom.toFixed(1)}×
        </div>
      </div>
    </>
  )
})
