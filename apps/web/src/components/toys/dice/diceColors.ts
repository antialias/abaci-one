import type { DiceColorScheme } from '@/components/ui/InteractiveDice'

export const DICE_COLORS: Record<string, DiceColorScheme> = {
  indigo: {
    faceLight: '#4f46e5',
    faceDark: '#818cf8',
    dotLight: 'white',
    dotDark: '#1e1b4b',
  },
  red: {
    faceLight: '#dc2626',
    faceDark: '#f87171',
    dotLight: 'white',
    dotDark: '#450a0a',
  },
  green: {
    faceLight: '#16a34a',
    faceDark: '#4ade80',
    dotLight: 'white',
    dotDark: '#052e16',
  },
  amber: {
    faceLight: '#d97706',
    faceDark: '#fbbf24',
    dotLight: 'white',
    dotDark: '#451a03',
  },
  blue: {
    faceLight: '#2563eb',
    faceDark: '#60a5fa',
    dotLight: 'white',
    dotDark: '#172554',
  },
  purple: {
    faceLight: '#9333ea',
    faceDark: '#c084fc',
    dotLight: 'white',
    dotDark: '#3b0764',
  },
}

export const COLOR_KEYS = Object.keys(DICE_COLORS)

/** Returns the next unused color key, cycling through all colors. */
export function getNextColor(existingColorKeys: string[]): string {
  for (const key of COLOR_KEYS) {
    if (!existingColorKeys.includes(key)) return key
  }
  // All colors used — cycle based on count
  return COLOR_KEYS[existingColorKeys.length % COLOR_KEYS.length]
}
