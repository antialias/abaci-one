/**
 * Route themes for Steam Train Journey
 * Each route has a unique name and emoji to make the journey feel varied
 */

export const ROUTE_THEMES = [
  { name: 'Prairie Express', emoji: '🌾' },
  { name: 'Mountain Climb', emoji: '⛰️' },
  { name: 'Coastal Run', emoji: '🌊' },
  { name: 'Desert Crossing', emoji: '🏜️' },
  { name: 'Forest Trail', emoji: '🌲' },
  { name: 'Canyon Route', emoji: '🏞️' },
  { name: 'River Valley', emoji: '🏞️' },
  { name: 'Highland Pass', emoji: '🗻' },
  { name: 'Lakeside Journey', emoji: '🏔️' },
  { name: 'Grand Circuit', emoji: '🎪' }
]

/**
 * Get route theme for a given route number
 * Cycles through themes if route number exceeds available themes
 */
export function getRouteTheme(routeNumber: number): { name: string; emoji: string } {
  const index = (routeNumber - 1) % ROUTE_THEMES.length
  return ROUTE_THEMES[index]
}