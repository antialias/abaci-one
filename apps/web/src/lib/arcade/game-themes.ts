/**
 * Standard color themes for arcade game cards
 *
 * Use these presets to ensure consistent, professional appearance
 * across all game cards on the /arcade game chooser.
 *
 * All gradients use Tailwind's 100-200 color range for soft pastel appearance.
 */

export interface GameTheme {
  color: string
  gradient: string
  borderColor: string
}

/**
 * Standard theme presets
 * These match Tailwind's color system and provide consistent styling
 */
export const GAME_THEMES = {
  blue: {
    color: 'blue',
    gradient: 'linear-gradient(135deg, #dbeafe, #bfdbfe)', // blue-100 to blue-200
    borderColor: 'blue.200',
  },
  purple: {
    color: 'purple',
    gradient: 'linear-gradient(135deg, #e9d5ff, #ddd6fe)', // purple-100 to purple-200
    borderColor: 'purple.200',
  },
  green: {
    color: 'green',
    gradient: 'linear-gradient(135deg, #d1fae5, #a7f3d0)', // green-100 to green-200
    borderColor: 'green.200',
  },
  teal: {
    color: 'teal',
    gradient: 'linear-gradient(135deg, #ccfbf1, #99f6e4)', // teal-100 to teal-200
    borderColor: 'teal.200',
  },
  indigo: {
    color: 'indigo',
    gradient: 'linear-gradient(135deg, #e0e7ff, #c7d2fe)', // indigo-100 to indigo-200
    borderColor: 'indigo.200',
  },
  pink: {
    color: 'pink',
    gradient: 'linear-gradient(135deg, #fce7f3, #fbcfe8)', // pink-100 to pink-200
    borderColor: 'pink.200',
  },
  orange: {
    color: 'orange',
    gradient: 'linear-gradient(135deg, #ffedd5, #fed7aa)', // orange-100 to orange-200
    borderColor: 'orange.200',
  },
  yellow: {
    color: 'yellow',
    gradient: 'linear-gradient(135deg, #fef3c7, #fde68a)', // yellow-100 to yellow-200
    borderColor: 'yellow.200',
  },
  red: {
    color: 'red',
    gradient: 'linear-gradient(135deg, #fee2e2, #fecaca)', // red-100 to red-200
    borderColor: 'red.200',
  },
  gray: {
    color: 'gray',
    gradient: 'linear-gradient(135deg, #f3f4f6, #e5e7eb)', // gray-100 to gray-200
    borderColor: 'gray.200',
  },
} as const satisfies Record<string, GameTheme>

export type GameThemeName = keyof typeof GAME_THEMES

/**
 * Get a standard theme by name
 * Use this in your game manifest instead of hardcoding gradients
 *
 * @example
 * const manifest: GameManifest = {
 *   name: 'my-game',
 *   // ... other fields
 *   ...getGameTheme('blue')
 * }
 */
export function getGameTheme(themeName: GameThemeName): GameTheme {
  return GAME_THEMES[themeName]
}
