import { rithmomachiaMessages } from '@/arcade-games/rithmomachia/messages'
import { homeMessages } from '@/i18n/locales/home/messages'

export type Locale = 'en' | 'de' | 'ja' | 'hi' | 'es' | 'la'

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
  return mergeMessages(common, { home: homeMessages[locale] }, rithmomachiaMessages[locale])
}
