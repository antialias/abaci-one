/**
 * Practice App Theme - Centralized color definitions
 *
 * This module provides a single source of truth for all colors used
 * in the practice app components, with automatic dark/light mode support.
 */

import type { PracticeTypeId } from '@/constants/practiceTypes'

// Color scheme type for consistent structure
interface ThemedColor {
  light: string
  dark: string
}

/**
 * Complete color palette for practice app
 * Each color has light and dark mode variants using Panda CSS tokens
 */
export const practiceColors = {
  // ============================================================================
  // Base Surfaces
  // ============================================================================
  surface: { light: 'white', dark: 'gray.800' },
  surfaceMuted: { light: 'gray.50', dark: 'gray.700' },
  surfaceElevated: { light: 'white', dark: 'gray.800' },
  surfaceInverse: { light: 'gray.900', dark: 'gray.100' },

  // ============================================================================
  // Borders
  // ============================================================================
  border: { light: 'gray.200', dark: 'gray.600' },
  borderMuted: { light: 'gray.100', dark: 'gray.700' },
  borderStrong: { light: 'gray.300', dark: 'gray.500' },
  borderFocus: { light: 'blue.400', dark: 'blue.400' },

  // ============================================================================
  // Text
  // ============================================================================
  text: { light: 'gray.800', dark: 'gray.100' },
  textMuted: { light: 'gray.600', dark: 'gray.400' },
  textSubtle: { light: 'gray.500', dark: 'gray.500' },
  textInverse: { light: 'white', dark: 'gray.900' },

  // ============================================================================
  // Success (green) - correct answers, mastered skills, high accuracy
  // ============================================================================
  success: { light: 'green.50', dark: 'green.900' },
  successMuted: { light: 'green.100', dark: 'green.800' },
  successText: { light: 'green.700', dark: 'green.200' },
  successTextStrong: { light: 'green.600', dark: 'green.300' },
  successBorder: { light: 'green.200', dark: 'green.700' },
  successSolid: { light: 'green.500', dark: 'green.400' },

  // ============================================================================
  // Warning (yellow) - practicing skills, medium accuracy
  // ============================================================================
  warning: { light: 'yellow.50', dark: 'yellow.900' },
  warningMuted: { light: 'yellow.100', dark: 'yellow.800' },
  warningText: { light: 'yellow.700', dark: 'yellow.200' },
  warningTextStrong: { light: 'yellow.600', dark: 'yellow.300' },
  warningBorder: { light: 'yellow.200', dark: 'yellow.700' },
  warningSolid: { light: 'yellow.500', dark: 'yellow.400' },

  // ============================================================================
  // Error (red) - incorrect answers, low accuracy
  // ============================================================================
  error: { light: 'red.50', dark: 'red.900' },
  errorMuted: { light: 'red.100', dark: 'red.800' },
  errorText: { light: 'red.700', dark: 'red.200' },
  errorTextStrong: { light: 'red.600', dark: 'red.300' },
  errorBorder: { light: 'red.200', dark: 'red.700' },
  errorSolid: { light: 'red.500', dark: 'red.400' },

  // ============================================================================
  // Info (blue) - focus problems, primary actions
  // ============================================================================
  info: { light: 'blue.50', dark: 'blue.900' },
  infoMuted: { light: 'blue.100', dark: 'blue.800' },
  infoText: { light: 'blue.700', dark: 'blue.200' },
  infoTextStrong: { light: 'blue.600', dark: 'blue.300' },
  infoBorder: { light: 'blue.200', dark: 'blue.700' },
  infoSolid: { light: 'blue.500', dark: 'blue.400' },

  // ============================================================================
  // Purple - help mode, visualization part
  // ============================================================================
  purple: { light: 'purple.50', dark: 'purple.900' },
  purpleMuted: { light: 'purple.100', dark: 'purple.800' },
  purpleText: { light: 'purple.700', dark: 'purple.200' },
  purpleTextStrong: { light: 'purple.600', dark: 'purple.300' },
  purpleBorder: { light: 'purple.200', dark: 'purple.700' },
  purpleSolid: { light: 'purple.500', dark: 'purple.400' },

  // ============================================================================
  // Orange - reinforce problems, linear part
  // ============================================================================
  orange: { light: 'orange.50', dark: 'orange.900' },
  orangeMuted: { light: 'orange.100', dark: 'orange.800' },
  orangeText: { light: 'orange.700', dark: 'orange.200' },
  orangeTextStrong: { light: 'orange.600', dark: 'orange.300' },
  orangeBorder: { light: 'orange.200', dark: 'orange.700' },
  orangeSolid: { light: 'orange.500', dark: 'orange.400' },
} as const satisfies Record<string, ThemedColor>

export type PracticeColorKey = keyof typeof practiceColors

/**
 * Get the appropriate color token for current theme
 *
 * @example
 * themed('surface', isDark) // returns 'white' or 'gray.800'
 * themed('successText', isDark) // returns 'green.700' or 'green.200'
 */
export function themed(key: PracticeColorKey, isDark: boolean): string {
  return practiceColors[key][isDark ? 'dark' : 'light']
}

/**
 * Get multiple themed colors at once
 *
 * @example
 * const { bg, text, border } = themedColors(isDark, {
 *   bg: 'success',
 *   text: 'successText',
 *   border: 'successBorder'
 * })
 */
export function themedColors<T extends Record<string, PracticeColorKey>>(
  isDark: boolean,
  colorMap: T
): Record<keyof T, string> {
  const result = {} as Record<keyof T, string>
  for (const [key, colorKey] of Object.entries(colorMap)) {
    result[key as keyof T] = themed(colorKey, isDark)
  }
  return result
}

// ============================================================================
// Semantic Helpers
// ============================================================================

/**
 * BKT-based mastery classification to semantic color mapping
 *
 * Maps BKT classifications to visual treatment:
 * - "strong" (pKnown >= 0.8) → success (green)
 * - "developing" (0.5 <= pKnown < 0.8) → warning (yellow)
 * - "weak" (pKnown < 0.5) → error (red)
 */
export type BktClassification = 'strong' | 'developing' | 'weak'

export function getMasteryColors(
  classification: BktClassification | null,
  isDark: boolean
): { bg: string; text: string } {
  switch (classification) {
    case 'strong':
      return {
        bg: themed('success', isDark),
        text: themed('successText', isDark),
      }
    case 'developing':
      return {
        bg: themed('warning', isDark),
        text: themed('warningText', isDark),
      }
    case 'weak':
      return {
        bg: themed('error', isDark),
        text: themed('errorText', isDark),
      }
    default:
      // null = insufficient data for classification
      return {
        bg: themed('surfaceMuted', isDark),
        text: themed('textMuted', isDark),
      }
  }
}

/**
 * Session part type to color mapping
 */
export function getPartTypeColors(
  type: PracticeTypeId,
  isDark: boolean
): { bg: string; text: string; border: string } {
  switch (type) {
    case 'abacus':
      return {
        bg: themed('info', isDark),
        text: themed('infoText', isDark),
        border: themed('infoBorder', isDark),
      }
    case 'visualization':
      return {
        bg: themed('purple', isDark),
        text: themed('purpleText', isDark),
        border: themed('purpleBorder', isDark),
      }
    case 'linear':
      return {
        bg: themed('orange', isDark),
        text: themed('orangeText', isDark),
        border: themed('orangeBorder', isDark),
      }
    default:
      // Default colors for new practice types (add specific colors as needed)
      return {
        bg: themed('surfaceMuted', isDark),
        text: themed('textMuted', isDark),
        border: themed('borderMuted', isDark),
      }
  }
}

/**
 * Problem purpose to color mapping
 */
export type ProblemPurpose = 'focus' | 'reinforce' | 'review' | 'challenge'

export function getPurposeColors(
  purpose: ProblemPurpose,
  isDark: boolean
): { bg: string; text: string } {
  switch (purpose) {
    case 'focus':
      return { bg: themed('info', isDark), text: themed('infoText', isDark) }
    case 'reinforce':
      return {
        bg: themed('orange', isDark),
        text: themed('orangeText', isDark),
      }
    case 'review':
      return {
        bg: themed('success', isDark),
        text: themed('successText', isDark),
      }
    case 'challenge':
      return {
        bg: themed('purple', isDark),
        text: themed('purpleText', isDark),
      }
  }
}
