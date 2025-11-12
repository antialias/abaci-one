/**
 * Validation constants for worksheet generation
 *
 * These constants define the limits for worksheet configuration.
 * Keep these in sync across:
 * - Zod schemas (config-schemas.ts)
 * - Runtime validation (validation.ts)
 * - UI components (forms, sliders, etc.)
 */

export const WORKSHEET_LIMITS = {
  /** Maximum total problems across all pages */
  MAX_TOTAL_PROBLEMS: 2000,

  /** Maximum problems per page */
  MAX_PROBLEMS_PER_PAGE: 100,

  /** Maximum number of pages */
  MAX_PAGES: 100,

  /** Maximum columns per page */
  MAX_COLS: 10,

  /** Minimum/maximum digit range for problems */
  DIGIT_RANGE: {
    MIN: 1,
    MAX: 5,
  },

  /** Font size limits */
  FONT_SIZE: {
    MIN: 8,
    MAX: 32,
  },
} as const

/**
 * Validate that worksheet config doesn't exceed limits
 *
 * IMPORTANT: problemsPerPage * pages must not exceed MAX_TOTAL_PROBLEMS
 */
export function validateWorksheetLimits(
  problemsPerPage: number,
  pages: number
): {
  valid: boolean
  error?: string
} {
  const total = problemsPerPage * pages

  if (total > WORKSHEET_LIMITS.MAX_TOTAL_PROBLEMS) {
    return {
      valid: false,
      error: `Total problems (${total}) exceeds maximum of ${WORKSHEET_LIMITS.MAX_TOTAL_PROBLEMS}`,
    }
  }

  if (problemsPerPage > WORKSHEET_LIMITS.MAX_PROBLEMS_PER_PAGE) {
    return {
      valid: false,
      error: `Problems per page (${problemsPerPage}) exceeds maximum of ${WORKSHEET_LIMITS.MAX_PROBLEMS_PER_PAGE}`,
    }
  }

  if (pages > WORKSHEET_LIMITS.MAX_PAGES) {
    return {
      valid: false,
      error: `Pages (${pages}) exceeds maximum of ${WORKSHEET_LIMITS.MAX_PAGES}`,
    }
  }

  return { valid: true }
}
