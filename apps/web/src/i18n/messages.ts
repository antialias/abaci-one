// NOTE: Game-specific messages (knowYourWorld, rithmomachia) are now loaded
// dynamically on their respective pages to avoid bloating the global bundle.
// Do NOT import them here - they add 500KB+ of geography hints and game data.
import { calendarMessages } from '@/i18n/locales/calendar/messages'
import { createMessages } from '@/i18n/locales/create/messages'
import { gamesMessages } from '@/i18n/locales/games/messages'
import { guideMessages } from '@/i18n/locales/guide/messages'
import { homeMessages } from '@/i18n/locales/home/messages'
import { tutorialMessages } from '@/i18n/locales/tutorial/messages'
import { whyAbacusMessages } from '@/i18n/locales/why-abacus/messages'

export type Locale = 'en' | 'de' | 'ja' | 'hi' | 'es' | 'la' | 'goh'

/**
 * Deep merge messages from multiple sources
 */
function mergeMessages(...sources: Record<string, any>[]): Record<string, any> {
  return sources.reduce((acc, source) => {
    for (const [key, value] of Object.entries(source)) {
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        acc[key] = mergeMessages(acc[key] || {}, value)
      } else {
        acc[key] = value
      }
    }
    return acc
  }, {})
}

/**
 * Get all messages for a locale by aggregating co-located translations
 */
export async function getMessages(locale: Locale) {
  // Common app-wide messages (minimal for now, can expand later)
  const common = {
    common: {
      // Add app-wide translations here as needed
    },
  }

  // Merge all co-located feature messages
  // NOTE: Game-specific messages (knowYourWorld, rithmomachia) are loaded
  // dynamically on their game pages - not included here to save 500KB+
  return mergeMessages(
    common,
    { home: homeMessages[locale] },
    { games: gamesMessages[locale] },
    { guide: guideMessages[locale] },
    { tutorial: tutorialMessages[locale] },
    { calendar: calendarMessages[locale] },
    { create: createMessages[locale] },
    { whyAbacus: whyAbacusMessages[locale] }
  )
}
