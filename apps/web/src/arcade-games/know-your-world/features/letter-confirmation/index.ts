/**
 * Letter Confirmation Feature Module
 *
 * This module handles letter confirmation functionality for Learning mode
 * in the Know Your World game:
 * - Confirmation state management
 * - Keyboard input handling
 * - Letter display with visual feedback
 * - Utility functions for letter processing
 *
 * ## Usage
 *
 * ```tsx
 * import {
 *   useLetterConfirmation,
 *   LetterDisplay,
 *   normalizeToBaseLetter,
 * } from '../features/letter-confirmation'
 *
 * function GameInfoPanel() {
 *   const confirmation = useLetterConfirmation({
 *     regionName: currentRegionName,
 *     requiredLetters: 3,
 *     confirmedCount: state.nameConfirmationProgress,
 *     isMyTurn,
 *     gameMode,
 *     onConfirmLetter: confirmLetter,
 *   })
 *
 *   return (
 *     <LetterDisplay
 *       regionName={currentRegionName}
 *       requiredLetters={3}
 *       confirmedCount={state.nameConfirmationProgress}
 *       isComplete={confirmation.isComplete}
 *       isDark={isDark}
 *     />
 *   )
 * }
 * ```
 */

// ============================================================================
// Types
// ============================================================================

export type {
  LetterInfo,
  LetterStatus,
  UseLetterConfirmationOptions,
  UseLetterConfirmationReturn,
  LetterDisplayProps,
} from './types'

// ============================================================================
// Hook
// ============================================================================

export { useLetterConfirmation } from './useLetterConfirmation'

// ============================================================================
// Components
// ============================================================================

export { LetterDisplay } from './LetterDisplay'

// ============================================================================
// Utilities
// ============================================================================

export {
  getNthNonSpaceLetter,
  normalizeToBaseLetter,
  countNonSpaceLetters,
  getLetterStatus,
  getLetterStyles,
  calculateProgress,
} from './letterUtils'
