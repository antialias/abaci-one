/**
 * Standard color themes for arcade game cards
 *
 * Use these presets to ensure consistent, professional appearance
 * across all game cards on the /arcade game chooser.
 *
 * All gradients use Panda CSS's 100-200 color range for soft pastel appearance.
 */

export interface GameTheme {
  color: string;
  gradient: string;
  borderColor: string;
}

/**
 * Standard theme presets with vibrant gradients
 * Updated for eye-catching game cards on the homepage
 */
export const GAME_THEMES = {
  blue: {
    color: "blue",
    gradient: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)", // Vibrant cyan
    borderColor: "#00f2fe",
  },
  purple: {
    color: "purple",
    gradient: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", // Vibrant purple
    borderColor: "#764ba2",
  },
  green: {
    color: "green",
    gradient: "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)", // Vibrant green/teal
    borderColor: "#38f9d7",
  },
  teal: {
    color: "teal",
    gradient: "linear-gradient(135deg, #11998e 0%, #38ef7d 100%)", // Vibrant teal
    borderColor: "#38ef7d",
  },
  indigo: {
    color: "indigo",
    gradient: "linear-gradient(135deg, #5f72bd 0%, #9b23ea 100%)", // Vibrant indigo
    borderColor: "#9b23ea",
  },
  pink: {
    color: "pink",
    gradient: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)", // Vibrant pink
    borderColor: "#f5576c",
  },
  orange: {
    color: "orange",
    gradient: "linear-gradient(135deg, #fa709a 0%, #fee140 100%)", // Vibrant orange/coral
    borderColor: "#fee140",
  },
  yellow: {
    color: "yellow",
    gradient: "linear-gradient(135deg, #ffd89b 0%, #19547b 100%)", // Vibrant yellow/blue
    borderColor: "#ffd89b",
  },
  red: {
    color: "red",
    gradient: "linear-gradient(135deg, #f85032 0%, #e73827 100%)", // Vibrant red
    borderColor: "#e73827",
  },
  gray: {
    color: "gray",
    gradient: "linear-gradient(135deg, #868f96 0%, #596164 100%)", // Vibrant gray
    borderColor: "#596164",
  },
} as const satisfies Record<string, GameTheme>;

export type GameThemeName = keyof typeof GAME_THEMES;

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
  return GAME_THEMES[themeName];
}
