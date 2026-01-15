/**
 * Heat-based visual styling for Know Your World
 *
 * Provides color, opacity, and animation parameters for UI elements
 * based on hot/cold feedback. Used for crosshairs, magnifier borders, etc.
 */

import type { FeedbackType } from './hotColdPhrases'

// ============================================================================
// Types
// ============================================================================

/** Border styling for magnifier based on heat feedback */
export interface HeatBorderStyle {
  border: string
  glow: string
  width: number
}

/** Complete crosshair styling based on heat feedback */
export interface HeatCrosshairStyle {
  color: string
  opacity: number
  rotationSpeed: number // degrees per frame at 60fps (0 = no rotation)
  glowColor: string
  strokeWidth: number
}

// ============================================================================
// Heat Level Conversion
// ============================================================================

/**
 * Convert FeedbackType to a numeric heat level (0-1)
 * Used for continuous effects like rotation speed
 */
export function getHeatLevel(feedbackType: FeedbackType | null): number {
  switch (feedbackType) {
    case 'found_it':
      return 1.0
    case 'on_fire':
      return 0.9
    case 'hot':
      return 0.75
    case 'warmer':
      return 0.6
    case 'colder':
      return 0.4
    case 'cold':
      return 0.25
    case 'freezing':
      return 0.1
    case 'overshot':
      return 0.3
    case 'stuck':
      return 0.35
    default:
      return 0.5 // Neutral
  }
}

// ============================================================================
// Rotation Speed
// ============================================================================

/**
 * Calculate rotation speed based on heat level using 1/x backoff curve
 * - No rotation below heat 0.5
 * - Maximum rotation (1 rotation/sec = 6°/frame at 60fps) at heat 1.0
 * - Uses squared curve for rapid acceleration near found_it
 */
export function getRotationSpeed(heatLevel: number): number {
  const THRESHOLD = 0.5
  const MAX_SPEED = 6 // 1 rotation/sec at 60fps (360°/sec / 60 = 6°/frame)

  if (heatLevel <= THRESHOLD) {
    return 0
  }

  // 1/x style backoff: speed increases rapidly as heat approaches 1.0
  // Using squared curve: ((heat - 0.5) / 0.5)^2 * maxSpeed
  const normalized = (heatLevel - THRESHOLD) / (1 - THRESHOLD)
  return MAX_SPEED * normalized * normalized
}

// ============================================================================
// Border Styling (for magnifier)
// ============================================================================

/**
 * Get heat-based border color for magnifier based on hot/cold feedback
 * Returns an object with border color, glow color, and width
 */
export function getHeatBorderColors(
  feedbackType: FeedbackType | null,
  isDark: boolean
): HeatBorderStyle {
  switch (feedbackType) {
    case 'found_it':
      return {
        border: isDark ? '#fbbf24' : '#f59e0b', // gold
        glow: 'rgba(251, 191, 36, 0.6)',
        width: 4,
      }
    case 'on_fire':
      return {
        border: isDark ? '#ef4444' : '#dc2626', // red
        glow: 'rgba(239, 68, 68, 0.5)',
        width: 4,
      }
    case 'hot':
      return {
        border: isDark ? '#f97316' : '#ea580c', // orange
        glow: 'rgba(249, 115, 22, 0.4)',
        width: 3,
      }
    case 'warmer':
      return {
        border: isDark ? '#fb923c' : '#f97316', // light orange
        glow: 'rgba(251, 146, 60, 0.3)',
        width: 3,
      }
    case 'colder':
      return {
        border: isDark ? '#93c5fd' : '#60a5fa', // light blue
        glow: 'rgba(147, 197, 253, 0.3)',
        width: 3,
      }
    case 'cold':
      return {
        border: isDark ? '#60a5fa' : '#3b82f6', // blue
        glow: 'rgba(96, 165, 250, 0.4)',
        width: 3,
      }
    case 'freezing':
      return {
        border: isDark ? '#38bdf8' : '#0ea5e9', // cyan/ice blue
        glow: 'rgba(56, 189, 248, 0.5)',
        width: 4,
      }
    case 'overshot':
      return {
        border: isDark ? '#facc15' : '#eab308', // yellow
        glow: 'rgba(250, 204, 21, 0.4)',
        width: 3,
      }
    case 'stuck':
      return {
        border: isDark ? '#9ca3af' : '#6b7280', // gray
        glow: 'rgba(156, 163, 175, 0.2)',
        width: 3,
      }
    default:
      // Default blue when no hot/cold active
      return {
        border: isDark ? '#60a5fa' : '#3b82f6',
        glow: 'rgba(96, 165, 250, 0.3)',
        width: 3,
      }
  }
}

// ============================================================================
// Crosshair Styling
// ============================================================================

/**
 * Get crosshair styling based on hot/cold feedback
 * Returns color, opacity, rotation speed, and glow for heat-reactive crosshairs
 */
export function getHeatCrosshairStyle(
  feedbackType: FeedbackType | null,
  isDark: boolean,
  hotColdEnabled: boolean
): HeatCrosshairStyle {
  const heatLevel = getHeatLevel(feedbackType)
  const rotationSpeed = hotColdEnabled ? getRotationSpeed(heatLevel) : 0

  // Default styling when hot/cold not enabled
  if (!hotColdEnabled || !feedbackType) {
    return {
      color: isDark ? '#60a5fa' : '#3b82f6', // Default blue
      opacity: 1,
      rotationSpeed: 0,
      glowColor: 'transparent',
      strokeWidth: 2,
    }
  }

  switch (feedbackType) {
    case 'found_it':
      return {
        color: '#fbbf24', // Gold
        opacity: 1,
        rotationSpeed,
        glowColor: 'rgba(251, 191, 36, 0.8)',
        strokeWidth: 3,
      }
    case 'on_fire':
      return {
        color: '#ef4444', // Bright red
        opacity: 1,
        rotationSpeed,
        glowColor: 'rgba(239, 68, 68, 0.7)',
        strokeWidth: 3,
      }
    case 'hot':
      return {
        color: '#f97316', // Orange
        opacity: 1,
        rotationSpeed,
        glowColor: 'rgba(249, 115, 22, 0.5)',
        strokeWidth: 2.5,
      }
    case 'warmer':
      return {
        color: '#fb923c', // Light orange
        opacity: 0.9,
        rotationSpeed,
        glowColor: 'rgba(251, 146, 60, 0.4)',
        strokeWidth: 2,
      }
    case 'colder':
      return {
        color: '#93c5fd', // Light blue
        opacity: 0.6,
        rotationSpeed,
        glowColor: 'transparent',
        strokeWidth: 2,
      }
    case 'cold':
      return {
        color: '#60a5fa', // Blue
        opacity: 0.4,
        rotationSpeed,
        glowColor: 'transparent',
        strokeWidth: 1.5,
      }
    case 'freezing':
      return {
        color: '#38bdf8', // Ice blue/cyan
        opacity: 0.25, // Very faded
        rotationSpeed,
        glowColor: 'transparent',
        strokeWidth: 1,
      }
    case 'overshot':
      return {
        color: '#a855f7', // Purple (went past it)
        opacity: 0.8,
        rotationSpeed,
        glowColor: 'rgba(168, 85, 247, 0.4)',
        strokeWidth: 2,
      }
    case 'stuck':
      return {
        color: '#9ca3af', // Gray
        opacity: 0.5,
        rotationSpeed,
        glowColor: 'transparent',
        strokeWidth: 1.5,
      }
    default:
      return {
        color: isDark ? '#60a5fa' : '#3b82f6',
        opacity: 1,
        rotationSpeed: 0,
        glowColor: 'transparent',
        strokeWidth: 2,
      }
  }
}
