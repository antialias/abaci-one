/**
 * Know Your World translations aggregated by locale
 * Co-located with the game code
 */

// Import existing locale files
import en from './i18n/locales/en.json'
import de from './i18n/locales/de.json'
import es from './i18n/locales/es.json'
import goh from './i18n/locales/goh.json'
import hi from './i18n/locales/hi.json'
import ja from './i18n/locales/ja.json'
import la from './i18n/locales/la.json'

export const knowYourWorldMessages = {
  en: { knowYourWorld: en },
  de: { knowYourWorld: de },
  es: { knowYourWorld: es },
  goh: { knowYourWorld: goh },
  hi: { knowYourWorld: hi },
  ja: { knowYourWorld: ja },
  la: { knowYourWorld: la },
} as const

/**
 * Type for hint lookup
 */
export type HintMap = 'usa' | 'world' | 'europe' | 'africa'
export type HintsData = {
  hints: {
    usa: Record<string, string[]>
    world: Record<string, string[]>
    europe: Record<string, string[]>
    africa: Record<string, string[]>
  }
}

/**
 * Get all hints for a region in the specified locale
 * Returns undefined if no hints exist
 */
export function getHints(
  locale: keyof typeof knowYourWorldMessages,
  map: HintMap,
  regionId: string
): string[] | undefined {
  const localeData = knowYourWorldMessages[locale]?.knowYourWorld as HintsData | undefined
  const hints = localeData?.hints?.[map]?.[regionId]
  // Return undefined if no hints or empty array
  return hints && hints.length > 0 ? hints : undefined
}

/**
 * Check if hints exist for a region in the specified locale
 */
export function hasHints(
  locale: keyof typeof knowYourWorldMessages,
  map: HintMap,
  regionId: string
): boolean {
  return getHints(locale, map, regionId) !== undefined
}
