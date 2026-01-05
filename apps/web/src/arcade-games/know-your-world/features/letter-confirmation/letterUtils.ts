/**
 * Letter Confirmation Utilities
 *
 * Utility functions for handling letter confirmation logic.
 * These functions handle:
 * - Finding letters by non-space index (skipping spaces)
 * - Normalizing accented characters for comparison
 */

import type { LetterInfo, LetterStatus } from "./types";

// Re-export getNthNonSpaceLetter from Validator for backward compatibility
export { getNthNonSpaceLetter } from "../../Validator";

/**
 * Normalize accented characters to their base ASCII letters.
 * e.g., 'é' → 'e', 'ñ' → 'n', 'ü' → 'u', 'ç' → 'c', 'ô' → 'o'
 *
 * This allows users to type region names like "Côte d'Ivoire" or "São Tomé"
 * using a regular keyboard without special characters.
 *
 * Uses Unicode NFD normalization to decompose characters, then strips
 * diacritical marks (combining characters in the U+0300-U+036F range).
 *
 * @param char - The character to normalize
 * @returns The base ASCII letter (lowercase)
 *
 * @example
 * normalizeToBaseLetter('é') // 'e'
 * normalizeToBaseLetter('ñ') // 'n'
 * normalizeToBaseLetter('ô') // 'o'
 * normalizeToBaseLetter('A') // 'a'
 */
export function normalizeToBaseLetter(char: string): string {
  return char
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/**
 * Count the total number of non-space characters in a string.
 *
 * @param name - The string to count
 * @returns Number of non-space characters
 */
export function countNonSpaceLetters(name: string): number {
  return name.split("").filter((char) => char !== " ").length;
}

/**
 * Get the status of a letter based on confirmation progress.
 *
 * @param nonSpaceIndex - The index of the letter (not counting spaces)
 * @param confirmedCount - How many letters have been confirmed
 * @param requiredLetters - How many letters need to be confirmed
 * @param isComplete - Whether all required letters are confirmed
 * @returns The status of the letter
 */
export function getLetterStatus(
  nonSpaceIndex: number,
  confirmedCount: number,
  requiredLetters: number,
  isComplete: boolean,
): LetterStatus {
  // Letters beyond the required count are always fully visible
  if (nonSpaceIndex >= requiredLetters) {
    return "beyond-required";
  }

  // Letters that have been confirmed
  if (nonSpaceIndex < confirmedCount) {
    return "confirmed";
  }

  // The next letter to confirm (show underline)
  if (nonSpaceIndex === confirmedCount && !isComplete) {
    return "next";
  }

  // Letters waiting to be confirmed
  return "pending";
}

/**
 * Get style properties for a letter based on its status.
 *
 * @param status - The letter status
 * @param isDark - Whether dark mode is active
 * @returns CSS properties for the letter
 */
export function getLetterStyles(
  status: LetterStatus,
  isDark: boolean,
): React.CSSProperties {
  const baseStyles: React.CSSProperties = {
    transition: "all 0.15s ease-out",
  };

  switch (status) {
    case "confirmed":
    case "beyond-required":
      return {
        ...baseStyles,
        opacity: 1,
      };

    case "next":
      return {
        ...baseStyles,
        opacity: 1,
        textDecoration: "underline",
        textDecorationColor: isDark ? "#60a5fa" : "#3b82f6",
        textUnderlineOffset: "4px",
      };

    case "pending":
      return {
        ...baseStyles,
        opacity: 0.4,
      };
  }
}

/**
 * Calculate confirmation progress as a value from 0 to 1.
 *
 * @param confirmedCount - Number of letters confirmed
 * @param requiredLetters - Number of letters required
 * @returns Progress value (0 = none, 1 = complete)
 */
export function calculateProgress(
  confirmedCount: number,
  requiredLetters: number,
): number {
  if (requiredLetters === 0) return 1;
  return Math.min(1, confirmedCount / requiredLetters);
}
