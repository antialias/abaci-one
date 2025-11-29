/**
 * Magnifier Dimension Utilities
 *
 * Shared functions for calculating magnifier dimensions that respond to
 * container aspect ratio. Used by MapRenderer and useMagnifierZoom.
 */

// Magnifier size ratios - responsive to container aspect ratio
export const MAGNIFIER_SIZE_SMALL = 1 / 3 // Used for the constrained dimension
export const MAGNIFIER_SIZE_LARGE = 1 / 2 // Used for the unconstrained dimension

/**
 * Calculate magnifier dimensions based on container aspect ratio.
 * - Landscape (wider): 1/3 width, 1/2 height (more vertical space available)
 * - Portrait (taller): 1/2 width, 1/3 height (more horizontal space available)
 */
export function getMagnifierDimensions(containerWidth: number, containerHeight: number) {
  const isLandscape = containerWidth > containerHeight
  return {
    width: containerWidth * (isLandscape ? MAGNIFIER_SIZE_SMALL : MAGNIFIER_SIZE_LARGE),
    height: containerHeight * (isLandscape ? MAGNIFIER_SIZE_LARGE : MAGNIFIER_SIZE_SMALL),
  }
}

/**
 * Calculate the magnified viewBox dimensions that match the magnifier container's aspect ratio.
 *
 * The magnifier container has a responsive aspect ratio (varies with screen orientation),
 * but the map viewBox has a fixed aspect ratio (e.g., 2:1 for world map). Without adjustment,
 * this causes letterboxing in the magnifier SVG.
 *
 * This function expands the viewBox dimensions to match the container's aspect ratio,
 * eliminating letterboxing and ensuring the outline on the main map matches exactly
 * what's visible in the magnifier.
 *
 * @param viewBoxWidth - The map's viewBox width
 * @param viewBoxHeight - The map's viewBox height
 * @param zoom - Current zoom level
 * @param containerWidth - The game container's width in pixels
 * @param containerHeight - The game container's height in pixels
 * @returns Adjusted width and height for the magnified viewBox
 */
export function getAdjustedMagnifiedDimensions(
  viewBoxWidth: number,
  viewBoxHeight: number,
  zoom: number,
  containerWidth: number,
  containerHeight: number
) {
  const { width: magWidth, height: magHeight } = getMagnifierDimensions(
    containerWidth,
    containerHeight
  )

  // Base dimensions from zoom (what we'd show without aspect ratio adjustment)
  const baseWidth = viewBoxWidth / zoom
  const baseHeight = viewBoxHeight / zoom

  // Compare aspect ratios
  const containerAspect = magWidth / magHeight
  const viewBoxAspect = baseWidth / baseHeight

  if (containerAspect > viewBoxAspect) {
    // Container is wider than viewBox aspect ratio - expand width to fill
    return {
      width: baseHeight * containerAspect,
      height: baseHeight,
    }
  } else {
    // Container is taller than viewBox aspect ratio - expand height to fill
    return {
      width: baseWidth,
      height: baseWidth / containerAspect,
    }
  }
}
