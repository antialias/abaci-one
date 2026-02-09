/**
 * Calculate the current streak of consecutive correct answers from the end of the results array.
 */
export function calculateStreak(results: boolean[]): number {
  let streak = 0
  for (let i = results.length - 1; i >= 0; i--) {
    if (results[i]) {
      streak++
    } else {
      break
    }
  }
  return streak
}
