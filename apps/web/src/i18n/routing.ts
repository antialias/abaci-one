// Supported locales
export const locales = ['en', 'de', 'ja', 'hi', 'es', 'la'] as const
export type Locale = (typeof locales)[number]

// Default locale
export const defaultLocale: Locale = 'en'

// Locale cookie name
export const LOCALE_COOKIE_NAME = 'NEXT_LOCALE'
