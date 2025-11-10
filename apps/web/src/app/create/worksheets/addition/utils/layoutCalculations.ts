/**
 * Layout calculation utilities for worksheet grid sizing
 */

/**
 * Get default number of columns based on problems per page and orientation
 * @param problemsPerPage - Number of problems per page
 * @param orientation - Page orientation
 * @returns Optimal number of columns for the layout
 */
export function getDefaultColsForProblemsPerPage(
  problemsPerPage: number,
  orientation: 'portrait' | 'landscape'
): number {
  if (orientation === 'portrait') {
    if (problemsPerPage === 6) return 2
    if (problemsPerPage === 8) return 2
    if (problemsPerPage === 10) return 2
    if (problemsPerPage === 12) return 3
    if (problemsPerPage === 15) return 3
    return 2
  } else {
    if (problemsPerPage === 8) return 4
    if (problemsPerPage === 10) return 5
    if (problemsPerPage === 12) return 4
    if (problemsPerPage === 15) return 5
    if (problemsPerPage === 16) return 4
    if (problemsPerPage === 20) return 5
    return 4
  }
}

/**
 * Calculate derived state from worksheet layout parameters
 * @param problemsPerPage - Number of problems per page
 * @param pages - Number of pages
 * @param cols - Number of columns
 * @returns Calculated rows and total problems
 */
export function calculateDerivedState(
  problemsPerPage: number,
  pages: number,
  cols: number
): { rows: number; total: number } {
  const total = problemsPerPage * pages
  const rows = Math.ceil(total / cols)
  return { rows, total }
}
