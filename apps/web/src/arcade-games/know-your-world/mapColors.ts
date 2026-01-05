/**
 * Map coloring utilities for Know Your World game
 * Provides distinct colors for map regions to improve visual clarity
 */

// Color palette: 8 distinct, visually appealing colors
// These colors are chosen to be distinguishable and work well at different opacities
export const REGION_COLOR_PALETTE = [
  { name: 'blue', base: '#3b82f6', light: '#93c5fd', dark: '#1e40af' },
  { name: 'green', base: '#10b981', light: '#6ee7b7', dark: '#047857' },
  { name: 'purple', base: '#8b5cf6', light: '#c4b5fd', dark: '#6d28d9' },
  { name: 'orange', base: '#f97316', light: '#fdba74', dark: '#c2410c' },
  { name: 'pink', base: '#ec4899', light: '#f9a8d4', dark: '#be185d' },
  { name: 'yellow', base: '#eab308', light: '#fde047', dark: '#a16207' },
  { name: 'teal', base: '#14b8a6', light: '#5eead4', dark: '#0f766e' },
  { name: 'red', base: '#ef4444', light: '#fca5a5', dark: '#b91c1c' },
] as const

/**
 * Hash function to deterministically assign a color to a region based on its ID
 * This ensures the same region always gets the same color across sessions
 */
function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32bit integer
  }
  return Math.abs(hash)
}

/**
 * Get color index for a region ID
 */
export function getRegionColorIndex(regionId: string): number {
  return hashString(regionId) % REGION_COLOR_PALETTE.length
}

/**
 * Get color for a region based on its state
 */
export function getRegionColor(
  regionId: string,
  isFound: boolean,
  isHovered: boolean,
  isDark: boolean
): string {
  const colorIndex = getRegionColorIndex(regionId)
  const color = REGION_COLOR_PALETTE[colorIndex]

  if (isFound) {
    // Found: use base color with full opacity
    return color.base
  } else if (isHovered) {
    // Hovered: use light color with good opacity for clear feedback
    return isDark
      ? `${color.light}99` // 60% opacity in dark mode
      : `${color.base}77` // 47% opacity in light mode
  } else {
    // Not found: use earth-tone colors for land masses
    // Higher opacity and warmer colors distinguish land from sea
    return isDark
      ? '#4a5568' // Warm gray in dark mode - clearly land
      : '#d4c4a8' // Sandy/earthy beige in light mode - clearly land
  }
}

/**
 * Get stroke (border) color for a region
 */
export function getRegionStroke(isFound: boolean, isDark: boolean): string {
  if (isFound) {
    return isDark ? '#ffffff' : '#000000' // High contrast for found regions
  }
  // More visible borders for unfound regions - darker to contrast with land colors
  return isDark ? '#2d3748' : '#8b7355' // Dark gray / brown border
}

/**
 * Get stroke width for a region
 */
export function getRegionStrokeWidth(isHovered: boolean, isFound: boolean): number {
  if (isHovered) return 3
  if (isFound) return 2
  return 0.5
}

/**
 * Get text color for label based on background
 * Uses high contrast to ensure readability
 */
export function getLabelTextColor(isDark: boolean, isFound: boolean): string {
  if (isFound) {
    // For found regions with colored backgrounds, use white text
    return '#ffffff'
  }
  // For unfound regions, use standard text color
  return isDark ? '#e5e7eb' : '#1f2937'
}

/**
 * Get text shadow for label to ensure visibility
 * Creates a strong outline effect
 */
export function getLabelTextShadow(isDark: boolean, isFound: boolean): string {
  if (isFound) {
    // Strong shadow for found regions (white text on colored background)
    return `
      0 0 3px rgba(0,0,0,0.9),
      0 0 6px rgba(0,0,0,0.7),
      1px 1px 0 rgba(0,0,0,0.8),
      -1px -1px 0 rgba(0,0,0,0.8),
      1px -1px 0 rgba(0,0,0,0.8),
      -1px 1px 0 rgba(0,0,0,0.8)
    `
  }

  // Subtle shadow for unfound regions
  return isDark
    ? `
      0 0 3px rgba(0,0,0,0.8),
      0 0 6px rgba(0,0,0,0.5),
      1px 1px 0 rgba(0,0,0,0.6),
      -1px -1px 0 rgba(0,0,0,0.6)
    `
    : `
      0 0 3px rgba(255,255,255,0.9),
      0 0 6px rgba(255,255,255,0.7),
      1px 1px 0 rgba(255,255,255,0.8),
      -1px -1px 0 rgba(255,255,255,0.8)
    `
}
