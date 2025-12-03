/**
 * Viewport utilities for SVG coordinate calculations
 *
 * These functions handle the conversion between screen coordinates
 * and SVG viewBox coordinates, accounting for preserveAspectRatio
 * letterboxing.
 */

import type { CursorPosition, SVGPosition, ViewBoxComponents, ViewportInfo } from './types'

/**
 * Parse a viewBox string into its components
 *
 * @param viewBox - SVG viewBox string (e.g., "0 0 1000 500")
 * @returns Parsed components with defaults for missing values
 */
export function parseViewBox(viewBox: string): ViewBoxComponents {
  const parts = viewBox.split(' ').map(Number)
  return {
    x: parts[0] || 0,
    y: parts[1] || 0,
    width: parts[2] || 1000,
    height: parts[3] || 1000,
  }
}

/**
 * Calculate the actual rendered viewport dimensions accounting for letterboxing.
 *
 * When an SVG uses preserveAspectRatio="xMidYMid meet" (the default), the viewBox
 * content is scaled uniformly to fit within the SVG element, potentially creating
 * letterboxing (empty space on sides or top/bottom).
 *
 * @param svgRect - Bounding rect of the SVG element
 * @param viewBoxX - ViewBox X origin
 * @param viewBoxY - ViewBox Y origin
 * @param viewBoxWidth - ViewBox width
 * @param viewBoxHeight - ViewBox height
 * @returns Viewport info including letterbox offsets and scale
 */
export function getRenderedViewport(
  svgRect: DOMRect,
  viewBoxX: number,
  viewBoxY: number,
  viewBoxWidth: number,
  viewBoxHeight: number
): ViewportInfo {
  const svgAspect = svgRect.width / svgRect.height
  const viewBoxAspect = viewBoxWidth / viewBoxHeight

  let renderedWidth: number
  let renderedHeight: number
  let letterboxX: number
  let letterboxY: number

  if (svgAspect > viewBoxAspect) {
    // SVG element is wider than viewBox - letterboxing on sides
    renderedHeight = svgRect.height
    renderedWidth = renderedHeight * viewBoxAspect
    letterboxX = (svgRect.width - renderedWidth) / 2
    letterboxY = 0
  } else {
    // SVG element is taller than viewBox - letterboxing on top/bottom
    renderedWidth = svgRect.width
    renderedHeight = renderedWidth / viewBoxAspect
    letterboxX = 0
    letterboxY = (svgRect.height - renderedHeight) / 2
  }

  // Scale factor is uniform (same for X and Y due to preserveAspectRatio)
  const scale = renderedWidth / viewBoxWidth

  return {
    renderedWidth,
    renderedHeight,
    letterboxX,
    letterboxY,
    scale,
    viewBoxX,
    viewBoxY,
  }
}

/**
 * Convert screen/container coordinates to SVG viewBox coordinates
 *
 * @param cursorPosition - Position in container coordinates (pixels)
 * @param containerRect - Container element's bounding rect
 * @param svgRect - SVG element's bounding rect
 * @param viewBox - Parsed viewBox components
 * @returns Position in SVG coordinate space
 */
export function screenToSVG(
  cursorPosition: CursorPosition,
  containerRect: DOMRect,
  svgRect: DOMRect,
  viewBox: ViewBoxComponents
): SVGPosition {
  const viewport = getRenderedViewport(
    svgRect,
    viewBox.x,
    viewBox.y,
    viewBox.width,
    viewBox.height
  )

  // Calculate offset from container origin to SVG rendered content
  const svgOffsetX = svgRect.left - containerRect.left + viewport.letterboxX
  const svgOffsetY = svgRect.top - containerRect.top + viewport.letterboxY

  // Convert screen position to SVG coordinates
  const svgX = (cursorPosition.x - svgOffsetX) / viewport.scale + viewBox.x
  const svgY = (cursorPosition.y - svgOffsetY) / viewport.scale + viewBox.y

  return { svgX, svgY }
}

/**
 * Convert SVG viewBox coordinates to screen/container coordinates
 *
 * @param svgPosition - Position in SVG coordinate space
 * @param containerRect - Container element's bounding rect
 * @param svgRect - SVG element's bounding rect
 * @param viewBox - Parsed viewBox components
 * @returns Position in container coordinates (pixels)
 */
export function svgToScreen(
  svgPosition: SVGPosition,
  containerRect: DOMRect,
  svgRect: DOMRect,
  viewBox: ViewBoxComponents
): CursorPosition {
  const viewport = getRenderedViewport(
    svgRect,
    viewBox.x,
    viewBox.y,
    viewBox.width,
    viewBox.height
  )

  // Calculate offset from container origin to SVG rendered content
  const svgOffsetX = svgRect.left - containerRect.left + viewport.letterboxX
  const svgOffsetY = svgRect.top - containerRect.top + viewport.letterboxY

  // Convert SVG coordinates to screen position
  const x = (svgPosition.svgX - viewBox.x) * viewport.scale + svgOffsetX
  const y = (svgPosition.svgY - viewBox.y) * viewport.scale + svgOffsetY

  return { x, y }
}

/**
 * Get viewport info from refs and viewBox string
 *
 * Convenience function that handles the common pattern of getting
 * viewport info from refs and a viewBox string.
 *
 * @param containerRef - Container element ref
 * @param svgRef - SVG element ref
 * @param viewBoxString - ViewBox string
 * @returns ViewportInfo or null if refs not available
 */
export function getViewportFromRefs(
  containerRef: React.RefObject<HTMLDivElement>,
  svgRef: React.RefObject<SVGSVGElement>,
  viewBoxString: string
): ViewportInfo | null {
  if (!containerRef.current || !svgRef.current) {
    return null
  }

  const svgRect = svgRef.current.getBoundingClientRect()
  const viewBox = parseViewBox(viewBoxString)

  return getRenderedViewport(svgRect, viewBox.x, viewBox.y, viewBox.width, viewBox.height)
}

/**
 * Calculate the leftover rectangle dimensions (area not covered by safe zones)
 *
 * @param containerWidth - Container width in pixels
 * @param containerHeight - Container height in pixels
 * @param margins - Safe zone margins
 * @returns Width and height of the leftover area
 */
export function getLeftoverDimensions(
  containerWidth: number,
  containerHeight: number,
  margins: { top: number; right: number; bottom: number; left: number }
): { width: number; height: number } {
  return {
    width: containerWidth - margins.left - margins.right,
    height: containerHeight - margins.top - margins.bottom,
  }
}
