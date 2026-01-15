/**
 * Date formatting utilities for worksheet generation
 */

/**
 * Get current date formatted as "Month Day, Year"
 * @example "November 7, 2025"
 */
export function getDefaultDate(): string {
  const now = new Date()
  return now.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}
