import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './locales/en.json'
import de from './locales/de.json'
import ja from './locales/ja.json'
import hi from './locales/hi.json'
import es from './locales/es.json'
import la from './locales/la.json'

export const defaultNS = 'translation'
export const resources = {
  en: { translation: en },
  de: { translation: de },
  ja: { translation: ja },
  hi: { translation: hi },
  es: { translation: es },
  la: { translation: la },
} as const

i18n.use(initReactI18next).init({
  lng: 'en',
  fallbackLng: 'en',
  defaultNS,
  resources,
  interpolation: {
    escapeValue: false, // React already escapes
  },
})

export default i18n
