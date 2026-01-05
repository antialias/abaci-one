/**
 * Letter Confirmation Types
 *
 * Type definitions for the letter confirmation feature used in Learning mode.
 */

// ============================================================================
// Letter Information
// ============================================================================

/**
 * Information about a specific letter in a region name.
 * Used when looking up letters by their non-space index.
 */
export interface LetterInfo {
  /** The character at this position */
  char: string;
  /** The actual index in the full string (including spaces) */
  index: number;
}

// ============================================================================
// Letter Status
// ============================================================================

/**
 * Status of a letter in the confirmation sequence.
 */
export type LetterStatus = "confirmed" | "next" | "pending" | "beyond-required";

// ============================================================================
// Hook Options and Return Types
// ============================================================================

/**
 * Options for the useLetterConfirmation hook.
 */
export interface UseLetterConfirmationOptions {
  /** The current region name to confirm */
  regionName: string | null;
  /** Number of letters required to confirm (from assistance config) */
  requiredLetters: number;
  /** Current confirmation progress from shared state */
  confirmedCount: number;
  /** Whether it's this player's turn (for turn-based mode) */
  isMyTurn: boolean;
  /** Game mode (affects turn restrictions) */
  gameMode: "cooperative" | "race" | "turn-based";
  /** Callback when a letter is confirmed */
  onConfirmLetter: (letter: string, letterIndex: number) => void;
  /** Callback when user tries to type but it's not their turn */
  onNotYourTurn?: () => void;
}

/**
 * Return type for the useLetterConfirmation hook.
 */
export interface UseLetterConfirmationReturn {
  // State
  /** Whether all required letters have been confirmed */
  isComplete: boolean;
  /** The next expected letter (for keyboard highlight) */
  nextExpectedLetter: string | null;
  /** Progress as a number 0-1 */
  progress: number;
  /** Whether name confirmation is required */
  isRequired: boolean;

  // For display
  /** Get the status of a letter at a given non-space index */
  getLetterStatus: (nonSpaceIndex: number) => LetterStatus;
}

// ============================================================================
// Letter Display Props
// ============================================================================

/**
 * Props for the LetterDisplay component.
 */
export interface LetterDisplayProps {
  /** Region name to display */
  regionName: string;
  /** Number of letters required to confirm */
  requiredLetters: number;
  /** Number of letters already confirmed */
  confirmedCount: number;
  /** Whether all required letters are confirmed */
  isComplete: boolean;
  /** Whether dark mode is active */
  isDark: boolean;
  /** Font size for the letters */
  fontSize?: string | number;
  /** Additional CSS styles */
  style?: React.CSSProperties;
}
