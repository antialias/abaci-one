/**
 * Practice App Mixins - Composable style primitives
 *
 * These are simple objects that can be spread into css() calls
 * to compose common layout and typography patterns.
 */

import type { SystemStyleObject } from '../../../../styled-system/types'

// ============================================================================
// Flexbox Layout
// ============================================================================

/** Center-aligned column (most common layout) */
export const centerStack: SystemStyleObject = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
}

/** Left-aligned column */
export const stack: SystemStyleObject = {
  display: 'flex',
  flexDirection: 'column',
}

/** Horizontal row with center alignment */
export const row: SystemStyleObject = {
  display: 'flex',
  alignItems: 'center',
}

/** Row with space-between */
export const spaceBetween: SystemStyleObject = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
}

/** Row with center alignment (both axes) */
export const center: SystemStyleObject = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}

/** Flex wrap for grids */
export const wrap: SystemStyleObject = {
  display: 'flex',
  flexWrap: 'wrap',
}

/** Full width */
export const fullWidth: SystemStyleObject = {
  width: '100%',
}

// ============================================================================
// Gap Presets
// ============================================================================

export const gapXs: SystemStyleObject = { gap: '0.25rem' }
export const gapSm: SystemStyleObject = { gap: '0.5rem' }
export const gapMd: SystemStyleObject = { gap: '0.75rem' }
export const gapLg: SystemStyleObject = { gap: '1rem' }
export const gapXl: SystemStyleObject = { gap: '1.5rem' }
export const gap2xl: SystemStyleObject = { gap: '2rem' }

// ============================================================================
// Padding Presets
// ============================================================================

export const paddingXs: SystemStyleObject = { padding: '0.25rem' }
export const paddingSm: SystemStyleObject = { padding: '0.5rem' }
export const paddingMd: SystemStyleObject = { padding: '1rem' }
export const paddingLg: SystemStyleObject = { padding: '1.5rem' }
export const paddingXl: SystemStyleObject = { padding: '2rem' }

// Horizontal padding
export const paddingXSm: SystemStyleObject = { paddingLeft: '0.5rem', paddingRight: '0.5rem' }
export const paddingXMd: SystemStyleObject = { paddingLeft: '1rem', paddingRight: '1rem' }
export const paddingXLg: SystemStyleObject = { paddingLeft: '1.5rem', paddingRight: '1.5rem' }

// Vertical padding
export const paddingYSm: SystemStyleObject = { paddingTop: '0.5rem', paddingBottom: '0.5rem' }
export const paddingYMd: SystemStyleObject = { paddingTop: '1rem', paddingBottom: '1rem' }
export const paddingYLg: SystemStyleObject = { paddingTop: '1.5rem', paddingBottom: '1.5rem' }

// ============================================================================
// Margin Presets
// ============================================================================

export const marginTopXs: SystemStyleObject = { marginTop: '0.25rem' }
export const marginTopSm: SystemStyleObject = { marginTop: '0.5rem' }
export const marginTopMd: SystemStyleObject = { marginTop: '1rem' }
export const marginTopLg: SystemStyleObject = { marginTop: '1.5rem' }

export const marginBottomXs: SystemStyleObject = { marginBottom: '0.25rem' }
export const marginBottomSm: SystemStyleObject = { marginBottom: '0.5rem' }
export const marginBottomMd: SystemStyleObject = { marginBottom: '1rem' }
export const marginBottomLg: SystemStyleObject = { marginBottom: '1.5rem' }

// ============================================================================
// Border Radius Presets
// ============================================================================

export const roundedSm: SystemStyleObject = { borderRadius: '6px' }
export const roundedMd: SystemStyleObject = { borderRadius: '8px' }
export const roundedLg: SystemStyleObject = { borderRadius: '12px' }
export const roundedXl: SystemStyleObject = { borderRadius: '16px' }
export const roundedFull: SystemStyleObject = { borderRadius: '9999px' }

// ============================================================================
// Font Size Presets
// ============================================================================

export const textXs: SystemStyleObject = { fontSize: '0.625rem' }
export const textSm: SystemStyleObject = { fontSize: '0.75rem' }
export const textMd: SystemStyleObject = { fontSize: '0.875rem' }
export const textBase: SystemStyleObject = { fontSize: '1rem' }
export const textLg: SystemStyleObject = { fontSize: '1.125rem' }
export const textXl: SystemStyleObject = { fontSize: '1.25rem' }
export const text2xl: SystemStyleObject = { fontSize: '1.5rem' }
export const text3xl: SystemStyleObject = { fontSize: '1.75rem' }
export const text4xl: SystemStyleObject = { fontSize: '2rem' }

// ============================================================================
// Font Weight Presets
// ============================================================================

export const fontNormal: SystemStyleObject = { fontWeight: 'normal' }
export const fontMedium: SystemStyleObject = { fontWeight: 'medium' }
export const fontSemibold: SystemStyleObject = { fontWeight: 'semibold' }
export const fontBold: SystemStyleObject = { fontWeight: 'bold' }

// ============================================================================
// Text Alignment
// ============================================================================

export const textCenter: SystemStyleObject = { textAlign: 'center' }
export const textLeft: SystemStyleObject = { textAlign: 'left' }
export const textRight: SystemStyleObject = { textAlign: 'right' }

// ============================================================================
// Common Transitions
// ============================================================================

export const transitionFast: SystemStyleObject = { transition: 'all 0.15s ease' }
export const transitionNormal: SystemStyleObject = { transition: 'all 0.2s ease' }
export const transitionSlow: SystemStyleObject = { transition: 'all 0.3s ease' }

// ============================================================================
// Interaction States
// ============================================================================

export const cursorPointer: SystemStyleObject = { cursor: 'pointer' }
export const cursorNotAllowed: SystemStyleObject = { cursor: 'not-allowed' }

export const noSelect: SystemStyleObject = { userSelect: 'none' }

// ============================================================================
// Visibility
// ============================================================================

export const hidden: SystemStyleObject = { display: 'none' }
export const invisible: SystemStyleObject = { visibility: 'hidden' }
export const srOnly: SystemStyleObject = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  padding: '0',
  margin: '-1px',
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  border: '0',
}

// ============================================================================
// Composable Utilities
// ============================================================================

/**
 * Combine multiple style objects
 * @example
 * combine(centerStack, gapLg, paddingMd)
 */
export function combine(...styles: SystemStyleObject[]): SystemStyleObject {
  return Object.assign({}, ...styles)
}

/**
 * Conditionally include a style object
 * @example
 * when(isActive, { backgroundColor: 'blue.500' })
 */
export function when(condition: boolean, style: SystemStyleObject): SystemStyleObject {
  return condition ? style : {}
}
