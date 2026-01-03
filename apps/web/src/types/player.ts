/**
 * Default player colors (used during player creation)
 */
export const DEFAULT_PLAYER_COLORS = [
  '#3b82f6', // Blue
  '#8b5cf6', // Purple
  '#10b981', // Green
  '#f59e0b', // Orange
  '#ef4444', // Red
  '#14b8a6', // Teal
  '#f97316', // Deep Orange
  '#6366f1', // Indigo
  '#ec4899', // Pink
  '#84cc16', // Lime
]

/**
 * Client-side Player type (for contexts/components)
 * Matches database Player type but with flexible createdAt
 */
export interface Player {
  id: string
  name: string
  emoji: string
  color: string
  createdAt: Date | number
  isActive?: boolean
  isLocal?: boolean
  /** Teacher notes about this student */
  notes?: string | null
}

/**
 * Get a color for a new player (cycles through defaults)
 */
export function getNextPlayerColor(existingPlayers: Player[]): string {
  const usedColors = new Set(existingPlayers.map((p) => p.color))

  // Find first unused color
  for (const color of DEFAULT_PLAYER_COLORS) {
    if (!usedColors.has(color)) {
      return color
    }
  }

  // If all colors used, cycle back
  return DEFAULT_PLAYER_COLORS[existingPlayers.length % DEFAULT_PLAYER_COLORS.length]
}
