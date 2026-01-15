/**
 * MagnifierPixelGrid Component
 *
 * Renders a grid overlay in the magnifier that shows the resolution
 * of mouse movements on the main map. Each grid cell represents one
 * screen pixel of cursor movement.
 *
 * The grid fades in/out based on proximity to the precision mode threshold,
 * providing visual feedback about when precision controls become necessary.
 */

export interface MagnifierPixelGridProps {
  /** Current zoom level */
  currentZoom: number
  /** Screen pixel ratio at current zoom */
  screenPixelRatio: number
  /** Precision mode threshold */
  precisionModeThreshold: number
  /** Cursor X position in SVG coordinates */
  cursorSvgX: number
  /** Cursor Y position in SVG coordinates */
  cursorSvgY: number
  /** ViewBox dimensions */
  viewBoxWidth: number
  viewBoxHeight: number
  /** Viewport scale from main map */
  viewportScale: number
  /** Whether dark mode is active */
  isDark: boolean
  /**
   * Whether to show the grid at all.
   * When false, the grid is hidden regardless of zoom level.
   * Use this to hide the grid on mobile where precision mode doesn't exist.
   */
  enabled?: boolean
}

export function MagnifierPixelGrid({
  currentZoom,
  screenPixelRatio,
  precisionModeThreshold,
  cursorSvgX,
  cursorSvgY,
  viewBoxWidth,
  viewBoxHeight,
  viewportScale,
  isDark,
  enabled = true,
}: MagnifierPixelGridProps) {
  // Early out if disabled (e.g., on mobile where precision mode doesn't exist)
  if (!enabled) {
    return null
  }

  // Fade grid in/out within 30% range on both sides of threshold
  // Visible from 70% to 130% of threshold (14 to 26 px/px at threshold=20)
  const fadeStartRatio = precisionModeThreshold * 0.7
  const fadeEndRatio = precisionModeThreshold * 1.3

  if (screenPixelRatio < fadeStartRatio || screenPixelRatio > fadeEndRatio) {
    return null
  }

  // Calculate opacity: 0 at edges (70% and 130%), 1 at threshold (100%)
  let gridOpacity: number
  if (screenPixelRatio <= precisionModeThreshold) {
    // Fading in: 0 at 70%, 1 at 100%
    gridOpacity = (screenPixelRatio - fadeStartRatio) / (precisionModeThreshold - fadeStartRatio)
  } else {
    // Fading out: 1 at 100%, 0 at 130%
    gridOpacity = (fadeEndRatio - screenPixelRatio) / (fadeEndRatio - precisionModeThreshold)
  }

  // Calculate grid spacing in SVG units
  // Each grid cell represents one screen pixel of mouse movement on the main map
  const mainMapSvgUnitsPerScreenPixel = 1 / viewportScale
  const gridSpacingSvgUnits = mainMapSvgUnitsPerScreenPixel

  // Calculate magnified viewport dimensions for grid bounds
  const magnifiedViewBoxWidth = viewBoxWidth / currentZoom
  const magnifiedHeight = viewBoxHeight / currentZoom

  // Calculate grid bounds (magnifier viewport)
  const gridLeft = cursorSvgX - magnifiedViewBoxWidth / 2
  const gridRight = cursorSvgX + magnifiedViewBoxWidth / 2
  const gridTop = cursorSvgY - magnifiedHeight / 2
  const gridBottom = cursorSvgY + magnifiedHeight / 2

  // Calculate grid line positions aligned with cursor (crosshair center)
  const lines: Array<{ type: 'h' | 'v'; pos: number }> = []

  // Vertical lines (aligned with cursor X)
  const firstVerticalLine =
    Math.floor((gridLeft - cursorSvgX) / gridSpacingSvgUnits) * gridSpacingSvgUnits + cursorSvgX
  for (let x = firstVerticalLine; x <= gridRight; x += gridSpacingSvgUnits) {
    lines.push({ type: 'v', pos: x })
  }

  // Horizontal lines (aligned with cursor Y)
  const firstHorizontalLine =
    Math.floor((gridTop - cursorSvgY) / gridSpacingSvgUnits) * gridSpacingSvgUnits + cursorSvgY
  for (let y = firstHorizontalLine; y <= gridBottom; y += gridSpacingSvgUnits) {
    lines.push({ type: 'h', pos: y })
  }

  // Apply opacity to grid color
  const baseOpacity = isDark ? 0.5 : 0.6
  const finalOpacity = baseOpacity * gridOpacity
  const gridColor = `rgba(251, 191, 36, ${finalOpacity})`

  return (
    <g data-element="pixel-grid-overlay">
      {lines.map((line, i) =>
        line.type === 'v' ? (
          <line
            key={`vgrid-${i}`}
            x1={line.pos}
            y1={gridTop}
            x2={line.pos}
            y2={gridBottom}
            stroke={gridColor}
            strokeWidth={viewBoxWidth / 2000}
            vectorEffect="non-scaling-stroke"
          />
        ) : (
          <line
            key={`hgrid-${i}`}
            x1={gridLeft}
            y1={line.pos}
            x2={gridRight}
            y2={line.pos}
            stroke={gridColor}
            strokeWidth={viewBoxWidth / 2000}
            vectorEffect="non-scaling-stroke"
          />
        )
      )}
    </g>
  )
}
