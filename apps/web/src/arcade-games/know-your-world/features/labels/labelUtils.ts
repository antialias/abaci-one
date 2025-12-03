/**
 * Label utility functions
 *
 * Pure functions for label positioning calculations
 */

import type { RenderedViewport } from './types'

// Label fade settings: labels fade near cursor to reduce clutter
export const LABEL_FADE_RADIUS = 150 // pixels - labels within this radius fade
export const LABEL_MIN_OPACITY = 0.08 // minimum opacity for faded labels

/**
 * Get the actual rendered viewport dimensions accounting for preserveAspectRatio letterboxing
 *
 * When an SVG uses preserveAspectRatio="xMidYMid meet" (the default), the viewBox content
 * is scaled uniformly to fit within the SVG element, potentially creating letterboxing.
 * This function calculates the actual rendered area and offset from the SVG element origin.
 */
export function getRenderedViewport(
  svgRect: DOMRect,
  viewBoxX: number,
  viewBoxY: number,
  viewBoxWidth: number,
  viewBoxHeight: number
): RenderedViewport {
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
    letterboxX, // Offset from SVG element left edge to rendered content
    letterboxY, // Offset from SVG element top edge to rendered content
    scale, // Pixels per viewBox unit
    viewBoxX,
    viewBoxY,
  }
}

/**
 * Calculate label opacity based on cursor proximity
 *
 * Labels fade as the cursor approaches to reduce visual clutter during gameplay.
 * This creates a "spotlight" effect where labels near the cursor become semi-transparent.
 *
 * @param labelX - Label X position in pixels
 * @param labelY - Label Y position in pixels
 * @param labelRegionId - ID of the region this label belongs to
 * @param cursorPosition - Current cursor position or null if no cursor
 * @param hoveredRegion - ID of currently hovered region or null
 * @param regionsFound - Array of found region IDs
 * @param isGiveUpAnimating - Whether the give-up animation is playing
 * @returns Opacity value between LABEL_MIN_OPACITY and 1
 */
export function calculateLabelOpacity(
  labelX: number,
  labelY: number,
  labelRegionId: string,
  cursorPosition: { x: number; y: number } | null,
  hoveredRegion: string | null,
  regionsFound: string[],
  isGiveUpAnimating: boolean
): number {
  // During give-up animation, hide all labels so the flashing region is clearly visible
  if (isGiveUpAnimating) return 0

  // No cursor position = full opacity
  if (!cursorPosition) return 1

  // If hovering over this label's region AND it's been found, show at full opacity
  if (hoveredRegion === labelRegionId && regionsFound.includes(labelRegionId)) {
    return 1
  }

  // Calculate distance from cursor to label
  const dx = labelX - cursorPosition.x
  const dy = labelY - cursorPosition.y
  const distance = Math.sqrt(dx * dx + dy * dy)

  // Outside fade radius = full opacity
  if (distance >= LABEL_FADE_RADIUS) return 1

  // Inside fade radius = interpolate from min to full based on distance
  const t = distance / LABEL_FADE_RADIUS
  return LABEL_MIN_OPACITY + t * (1 - LABEL_MIN_OPACITY)
}

/**
 * Calculate the arrow start point on the label edge closest to the target region
 *
 * This finds the intersection point of a line from the label center to the region
 * center with the label's bounding box. Used for drawing connecting arrows.
 */
export function getArrowStartPoint(
  labelX: number,
  labelY: number,
  labelWidth: number,
  labelHeight: number,
  targetX: number,
  targetY: number
): { x: number; y: number } {
  // Direction from label to region
  const dx = targetX - labelX
  const dy = targetY - labelY

  // Label edges
  const halfWidth = labelWidth / 2
  const halfHeight = labelHeight / 2

  // Calculate intersection with label box
  // Use parametric line equation: point = (labelX, labelY) + t * (dx, dy)
  // Find t where line intersects rectangle edges

  let bestT = 0
  const epsilon = 1e-10

  // Check each edge
  if (Math.abs(dx) > epsilon) {
    // Right edge: x = labelX + halfWidth
    const tRight = halfWidth / dx
    if (tRight > 0 && tRight <= 1) {
      const y = labelY + tRight * dy
      if (Math.abs(y - labelY) <= halfHeight) {
        bestT = tRight
      }
    }
    // Left edge: x = labelX - halfWidth
    const tLeft = -halfWidth / dx
    if (tLeft > 0 && tLeft <= 1) {
      const y = labelY + tLeft * dy
      if (Math.abs(y - labelY) <= halfHeight) {
        if (bestT === 0 || tLeft < bestT) bestT = tLeft
      }
    }
  }

  if (Math.abs(dy) > epsilon) {
    // Bottom edge: y = labelY + halfHeight
    const tBottom = halfHeight / dy
    if (tBottom > 0 && tBottom <= 1) {
      const x = labelX + tBottom * dx
      if (Math.abs(x - labelX) <= halfWidth) {
        if (bestT === 0 || tBottom < bestT) bestT = tBottom
      }
    }
    // Top edge: y = labelY - halfHeight
    const tTop = -halfHeight / dy
    if (tTop > 0 && tTop <= 1) {
      const x = labelX + tTop * dx
      if (Math.abs(x - labelX) <= halfWidth) {
        if (bestT === 0 || tTop < bestT) bestT = tTop
      }
    }
  }

  return {
    x: labelX + bestT * dx,
    y: labelY + bestT * dy,
  }
}
