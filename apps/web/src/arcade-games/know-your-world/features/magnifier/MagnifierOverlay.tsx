/**
 * Magnifier Overlay Component
 *
 * Renders the magnified view of the map centered on cursor position.
 * Includes:
 * - Zoomed SVG view of map regions
 * - Crosshair at cursor position
 * - Pixel grid for precision mode
 * - Debug bounding boxes (optional)
 * - Zoom label with precision mode indicator
 * - Mobile controls (expand, select, full map)
 *
 * Extracted from MapRenderer to improve maintainability.
 *
 * This component can consume state from:
 * - MagnifierContext (magnifier-specific state, refs, springs)
 * - MapGameContext (game state, callbacks, debug info)
 *
 * When used with context providers, most props become optional.
 */

'use client'

import { animated, type SpringValue } from '@react-spring/web'
import { getRegionColor, getRegionStroke } from '../../mapColors'
import {
  getAdjustedMagnifiedDimensions,
  getMagnifierDimensions,
} from '../../utils/magnifierDimensions'
import { calculateScreenPixelRatio, isAboveThreshold } from '../../utils/screenPixelRatio'
import { useMapGameContext } from '../game'
import { getRenderedViewport } from '../labels'
import { useMagnifierContext } from './MagnifierContext'
import { MagnifierControls } from './MagnifierControls'
import { MagnifierCrosshair } from './MagnifierCrosshair'
import { MagnifierPixelGrid } from './MagnifierPixelGrid'
import { MagnifierRegions } from './MagnifierRegions'

// ============================================================================
// Types
// ============================================================================

export interface MagnifierOverlayProps {
  // These props are ONLY needed if not using context or for overrides
  // When wrapped in MagnifierProvider + MapGameProvider, these are optional

  // Crosshair rotation (not in context - specific to this component)
  rotationAngle: SpringValue<number>

  // Touch handlers (not in context yet - will be extracted to hook)
  handleMagnifierTouchStart: (e: React.TouchEvent<HTMLDivElement>) => void
  handleMagnifierTouchMove: (e: React.TouchEvent<HTMLDivElement>) => void
  handleMagnifierTouchEnd: (e: React.TouchEvent<HTMLDivElement>) => void
}

// ============================================================================
// Component
// ============================================================================

export function MagnifierOverlay({
  rotationAngle,
  handleMagnifierTouchStart,
  handleMagnifierTouchMove,
  handleMagnifierTouchEnd,
}: MagnifierOverlayProps) {
  // -------------------------------------------------------------------------
  // Context Consumption
  // -------------------------------------------------------------------------
  const {
    magnifierRef,
    svgRef,
    containerRef,
    cursorPosition,
    zoomSpring,
    magnifierSpring,
    parsedViewBox,
    safeZoneMargins,
    isMagnifierExpanded,
    setIsMagnifierExpanded,
    isDark,
    pointerLocked,
    isTouchDevice,
    canUsePrecisionMode,
    mobileMapDragTriggeredMagnifier,
    isMobileMapDragging,
    isMagnifierDragging,
    precisionModeThreshold,
    precisionCalcs,
    getCurrentZoom,
    highZoomThreshold,
    scaleProbe1Ref,
    scaleProbe2Ref,
  } = useMagnifierContext()

  // Distance between scale probes in SVG units (must match useEmpiricalScale.ts)
  const SCALE_PROBE_DISTANCE = 100

  const {
    mapData,
    regionsFound,
    hoveredRegion,
    celebration,
    giveUpReveal,
    isGiveUpAnimating,
    celebrationFlashProgress,
    giveUpFlashProgress,
    effectiveHotColdEnabled,
    hotColdFeedbackType,
    magnifierBorderStyle,
    crosshairHeatStyle,
    effectiveShowDebugBoundingBoxes,
    effectiveShowMagnifierDebugInfo,
    debugBoundingBoxes,
    getPlayerWhoFoundRegion,
    showOutline,
    selectRegionAtCrosshairs,
    requestPointerLock,
  } = useMapGameContext()

  // -------------------------------------------------------------------------
  // Early Returns
  // -------------------------------------------------------------------------
  // Calculate magnifier size based on leftover rectangle (area not covered by UI)
  const containerRect = containerRef.current?.getBoundingClientRect()
  if (!containerRect || !svgRef.current || !cursorPosition) {
    return null
  }

  const leftoverWidth = containerRect.width - safeZoneMargins.left - safeZoneMargins.right
  const leftoverHeight = containerRect.height - safeZoneMargins.top - safeZoneMargins.bottom

  // When expanded (during/after pinch-to-zoom), use full leftover area
  // Otherwise use the normal calculated dimensions
  const { width: normalWidth, height: normalHeight } = getMagnifierDimensions(
    leftoverWidth,
    leftoverHeight
  )
  const magnifierWidthPx = isMagnifierExpanded ? leftoverWidth : normalWidth
  const magnifierHeightPx = isMagnifierExpanded ? leftoverHeight : normalHeight

  const svgRect = svgRef.current.getBoundingClientRect()
  const { x: viewBoxX, y: viewBoxY, width: viewBoxWidth, height: viewBoxHeight } = parsedViewBox

  return (
    <animated.div
      ref={magnifierRef}
      data-element="magnifier"
      onTouchStart={handleMagnifierTouchStart}
      onTouchMove={handleMagnifierTouchMove}
      onTouchEnd={handleMagnifierTouchEnd}
      onTouchCancel={handleMagnifierTouchEnd}
      style={{
        position: 'absolute',
        // When expanded, position at top-left of leftover area; otherwise use animated positioning
        top: isMagnifierExpanded ? safeZoneMargins.top : magnifierSpring.top,
        left: isMagnifierExpanded ? safeZoneMargins.left : magnifierSpring.left,
        width: magnifierWidthPx,
        height: magnifierHeightPx,
        // Border color priority: 1) Hot/cold heat colors (if enabled), 2) High zoom gold, 3) Default blue
        border: (() => {
          // When hot/cold is enabled, use heat-based colors (from memoized magnifierBorderStyle)
          if (effectiveHotColdEnabled && hotColdFeedbackType) {
            return `${magnifierBorderStyle.width}px solid ${magnifierBorderStyle.border}`
          }
          // Fall back to zoom-based coloring
          return zoomSpring.to(
            (zoom: number) =>
              zoom > highZoomThreshold
                ? `4px solid ${isDark ? '#fbbf24' : '#f59e0b'}` // gold-400/gold-500
                : `3px solid ${isDark ? '#60a5fa' : '#3b82f6'}` // blue-400/blue-600
          )
        })(),
        borderRadius: '12px',
        overflow: 'hidden',
        // Enable touch events on mobile for panning, but keep mouse events disabled
        pointerEvents: 'auto',
        touchAction: 'none', // Prevent browser handling of touch gestures
        zIndex: 100,
        // Box shadow with heat glow when hot/cold is enabled
        boxShadow: (() => {
          if (effectiveHotColdEnabled && hotColdFeedbackType) {
            return `0 10px 40px rgba(0, 0, 0, 0.3), 0 0 25px ${magnifierBorderStyle.glow}`
          }
          return zoomSpring.to((zoom: number) =>
            zoom > highZoomThreshold
              ? '0 10px 40px rgba(251, 191, 36, 0.4), 0 0 20px rgba(251, 191, 36, 0.2)' // Gold glow
              : '0 10px 40px rgba(0, 0, 0, 0.5)'
          )
        })(),
        background: isDark ? '#111827' : '#f3f4f6',
        opacity: magnifierSpring.opacity,
      }}
    >
      <animated.svg
        viewBox={zoomSpring.to((zoom: number) => {
          // Calculate magnified viewBox centered on cursor
          const viewport = getRenderedViewport(
            svgRect,
            viewBoxX,
            viewBoxY,
            viewBoxWidth,
            viewBoxHeight
          )

          // Center position relative to SVG (uses reveal center during give-up animation)
          const svgOffsetX = svgRect.left - containerRect.left + viewport.letterboxX
          const svgOffsetY = svgRect.top - containerRect.top + viewport.letterboxY
          const cursorSvgX = (cursorPosition.x - svgOffsetX) / viewport.scale + viewBoxX
          const cursorSvgY = (cursorPosition.y - svgOffsetY) / viewport.scale + viewBoxY

          // Magnified view: adjust dimensions to match magnifier container aspect ratio
          const leftoverW = containerRect.width - safeZoneMargins.left - safeZoneMargins.right
          const leftoverH = containerRect.height - safeZoneMargins.top - safeZoneMargins.bottom
          const { width: magnifiedWidth, height: magnifiedHeight } = getAdjustedMagnifiedDimensions(
            viewBoxWidth,
            viewBoxHeight,
            zoom,
            leftoverW,
            leftoverH
          )

          // Center the magnified viewBox on the cursor
          const magnifiedViewBoxX = cursorSvgX - magnifiedWidth / 2
          const magnifiedViewBoxY = cursorSvgY - magnifiedHeight / 2

          return `${magnifiedViewBoxX} ${magnifiedViewBoxY} ${magnifiedWidth} ${magnifiedHeight}`
        })}
        style={{
          width: '100%',
          height: '100%',
          // Apply "disabled" visual effect when at threshold but not in precision mode
          filter:
            precisionCalcs.isAtThreshold && !pointerLocked
              ? 'brightness(0.6) saturate(0.5)'
              : 'none',
        }}
      >
        {/* Sea/ocean background for magnifier - solid color to match container */}
        <rect
          x={parsedViewBox.x}
          y={parsedViewBox.y}
          width={parsedViewBox.width}
          height={parsedViewBox.height}
          fill={isDark ? '#1e3a5f' : '#a8d4f0'}
        />

        {/* Render all regions in magnified view */}
        <MagnifierRegions
          regions={mapData.regions}
          regionState={{
            regionsFound,
            hoveredRegion,
            celebrationRegionId: celebration?.regionId ?? null,
            giveUpRegionId: giveUpReveal?.regionId ?? null,
            isGiveUpAnimating,
          }}
          flashProgress={{
            celebrationFlash: celebrationFlashProgress,
            giveUpFlash: giveUpFlashProgress,
          }}
          isDark={isDark}
          getPlayerWhoFoundRegion={getPlayerWhoFoundRegion}
          getRegionColor={getRegionColor}
          getRegionStroke={getRegionStroke}
          showOutline={showOutline}
        />

        {/* Crosshair at center position + Scale probes for empirical measurement */}
        {(() => {
          const viewport = getRenderedViewport(
            svgRect,
            viewBoxX,
            viewBoxY,
            viewBoxWidth,
            viewBoxHeight
          )
          const svgOffsetX = svgRect.left - containerRect.left + viewport.letterboxX
          const svgOffsetY = svgRect.top - containerRect.top + viewport.letterboxY
          const cursorSvgX = (cursorPosition.x - svgOffsetX) / viewport.scale + viewBoxX
          const cursorSvgY = (cursorPosition.y - svgOffsetY) / viewport.scale + viewBoxY

          return (
            <>
              <MagnifierCrosshair
                cursorSvgX={cursorSvgX}
                cursorSvgY={cursorSvgY}
                viewBoxWidth={viewBoxWidth}
                rotationAngle={rotationAngle}
                heatStyle={crosshairHeatStyle}
              />
              {/* Scale probe circles for empirical 1:1 tracking measurement */}
              {/* These are invisible but their screen positions are measured via getBoundingClientRect */}
              <circle
                ref={scaleProbe1Ref}
                cx={cursorSvgX - SCALE_PROBE_DISTANCE / 2}
                cy={cursorSvgY}
                r={0.5}
                fill="transparent"
                stroke="none"
                pointerEvents="none"
                data-scale-probe="1"
              />
              <circle
                ref={scaleProbe2Ref}
                cx={cursorSvgX + SCALE_PROBE_DISTANCE / 2}
                cy={cursorSvgY}
                r={0.5}
                fill="transparent"
                stroke="none"
                pointerEvents="none"
                data-scale-probe="2"
              />
            </>
          )
        })()}

        {/* Pixel grid overlay - shows when approaching/at/above precision mode threshold */}
        {(() => {
          if (!viewBoxWidth || Number.isNaN(viewBoxWidth)) return null

          const currentZoom = getCurrentZoom()
          const viewport = getRenderedViewport(
            svgRect,
            viewBoxX,
            viewBoxY,
            viewBoxWidth,
            viewBoxHeight
          )
          const svgOffsetX = svgRect.left - containerRect.left + viewport.letterboxX
          const svgOffsetY = svgRect.top - containerRect.top + viewport.letterboxY
          const cursorSvgX = (cursorPosition.x - svgOffsetX) / viewport.scale + viewBoxX
          const cursorSvgY = (cursorPosition.y - svgOffsetY) / viewport.scale + viewBoxY

          return (
            <MagnifierPixelGrid
              currentZoom={currentZoom}
              screenPixelRatio={precisionCalcs.screenPixelRatio}
              precisionModeThreshold={precisionModeThreshold}
              cursorSvgX={cursorSvgX}
              cursorSvgY={cursorSvgY}
              viewBoxWidth={viewBoxWidth}
              viewBoxHeight={viewBoxHeight}
              viewportScale={viewport.scale}
              isDark={isDark}
            />
          )
        })()}

        {/* Debug: Bounding boxes for detected regions in magnifier */}
        {effectiveShowDebugBoundingBoxes &&
          debugBoundingBoxes.map((bbox) => {
            const importance = bbox.importance ?? 0
            let strokeColor = '#888888'
            if (bbox.wasAccepted) {
              strokeColor = '#00ff00'
            } else if (importance > 1.5) {
              strokeColor = '#ff6600'
            } else if (importance > 0.5) {
              strokeColor = '#ffcc00'
            }

            return (
              <rect
                key={`mag-bbox-${bbox.regionId}`}
                x={bbox.x}
                y={bbox.y}
                width={bbox.width}
                height={bbox.height}
                fill="none"
                stroke={strokeColor}
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
                pointerEvents="none"
              />
            )
          })}
      </animated.svg>

      {/* Debug: Bounding box labels as HTML overlays */}
      {effectiveShowDebugBoundingBoxes &&
        debugBoundingBoxes.map((bbox) => {
          const importance = bbox.importance ?? 0
          let strokeColor = '#888888'
          if (bbox.wasAccepted) {
            strokeColor = '#00ff00'
          } else if (importance > 1.5) {
            strokeColor = '#ff6600'
          } else if (importance > 0.5) {
            strokeColor = '#ffcc00'
          }

          const bboxCenterSvgX = bbox.x + bbox.width / 2
          const bboxCenterSvgY = bbox.y + bbox.height / 2

          return (
            <animated.div
              key={`mag-bbox-label-${bbox.regionId}`}
              style={{
                position: 'absolute',
                left: zoomSpring.to((zoom: number) => {
                  const viewport = getRenderedViewport(
                    svgRect,
                    viewBoxX,
                    viewBoxY,
                    viewBoxWidth,
                    viewBoxHeight
                  )
                  const svgOffsetX = svgRect.left - containerRect.left + viewport.letterboxX
                  const cursorSvgX = (cursorPosition.x - svgOffsetX) / viewport.scale + viewBoxX
                  const magnifiedWidth = viewBoxWidth / zoom
                  const magnifiedViewBoxX = cursorSvgX - magnifiedWidth / 2
                  const relativeX = (bboxCenterSvgX - magnifiedViewBoxX) / magnifiedWidth
                  if (relativeX < 0 || relativeX > 1) return '-9999px'

                  const { width: magnifierWidth } = getMagnifierDimensions(
                    leftoverWidth,
                    leftoverHeight
                  )
                  return `${relativeX * magnifierWidth}px`
                }),
                top: zoomSpring.to((zoom: number) => {
                  const viewport = getRenderedViewport(
                    svgRect,
                    viewBoxX,
                    viewBoxY,
                    viewBoxWidth,
                    viewBoxHeight
                  )
                  const svgOffsetY = svgRect.top - containerRect.top + viewport.letterboxY
                  const cursorSvgY = (cursorPosition.y - svgOffsetY) / viewport.scale + viewBoxY
                  const magnifiedHeight = viewBoxHeight / zoom
                  const magnifiedViewBoxY = cursorSvgY - magnifiedHeight / 2
                  const relativeY = (bboxCenterSvgY - magnifiedViewBoxY) / magnifiedHeight
                  if (relativeY < 0 || relativeY > 1) return '-9999px'

                  const { height: magnifierHeight } = getMagnifierDimensions(
                    leftoverWidth,
                    leftoverHeight
                  )
                  return `${relativeY * magnifierHeight}px`
                }),
                transform: 'translate(-50%, -50%)',
                pointerEvents: 'none',
                zIndex: 15,
                fontSize: '10px',
                fontWeight: 'bold',
                color: strokeColor,
                textAlign: 'center',
                textShadow: '0 0 2px black, 0 0 2px black, 0 0 2px black',
                whiteSpace: 'nowrap',
              }}
            >
              <div>{bbox.regionId}</div>
              <div style={{ fontSize: '8px', fontWeight: 'normal' }}>{importance.toFixed(2)}</div>
            </animated.div>
          )
        })}

      {/* Magnifier label */}
      <animated.div
        style={{
          position: 'absolute',
          top: '8px',
          left: '8px',
          padding: '4px 8px',
          background: isDark ? 'rgba(31, 41, 55, 0.9)' : 'rgba(255, 255, 255, 0.9)',
          borderRadius: '6px',
          fontSize: '11px',
          fontWeight: 'bold',
          color: isDark ? '#60a5fa' : '#3b82f6',
          pointerEvents: pointerLocked ? 'none' : 'auto',
          cursor: pointerLocked ? 'default' : 'pointer',
        }}
        onClick={(e) => {
          if (!pointerLocked) {
            e.stopPropagation()
            requestPointerLock()
          }
        }}
        data-element="magnifier-label"
      >
        {zoomSpring.to((z: number) => {
          if (pointerLocked) {
            return 'Precision mode active'
          }

          if (!viewBoxWidth || Number.isNaN(viewBoxWidth)) {
            return `${z.toFixed(1)}×`
          }

          const { width: magnifierWidth } = getMagnifierDimensions(leftoverWidth, leftoverHeight)
          const screenPixelRatio = calculateScreenPixelRatio({
            magnifierWidth,
            viewBoxWidth,
            svgWidth: svgRect.width,
            zoom: z,
          })

          if (canUsePrecisionMode && isAboveThreshold(screenPixelRatio, precisionModeThreshold)) {
            return 'Click to activate precision mode'
          }

          if (effectiveShowMagnifierDebugInfo) {
            return `${z.toFixed(1)}× | ${screenPixelRatio.toFixed(1)} px/px`
          }

          return `${z.toFixed(1)}×`
        })}
      </animated.div>

      {/* Scrim overlay - shows when at threshold to indicate barrier */}
      {precisionCalcs.isAtThreshold && !pointerLocked && (
        <div
          data-element="precision-mode-scrim"
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(251, 191, 36, 0.15)',
            pointerEvents: 'none',
            borderRadius: '12px',
          }}
        />
      )}

      {/* Mobile magnifier controls (Expand, Select, Full Map buttons) */}
      <MagnifierControls
        isTouchDevice={isTouchDevice}
        showSelectButton={
          mobileMapDragTriggeredMagnifier && !isMobileMapDragging && !isMagnifierDragging
        }
        isExpanded={isMagnifierExpanded}
        isSelectDisabled={!hoveredRegion || regionsFound.includes(hoveredRegion)}
        isDark={isDark}
        pointerLocked={pointerLocked}
        onSelect={selectRegionAtCrosshairs}
        onExitExpanded={() => setIsMagnifierExpanded(false)}
        onExpand={() => setIsMagnifierExpanded(true)}
      />
    </animated.div>
  )
}
