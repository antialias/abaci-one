'use client'

import { useLocale } from 'next-intl'
import { useLocaleContext } from '@/contexts/LocaleContext'
import { locales } from '@/i18n/routing'

interface LanguageSelectorProps {
  variant?: 'dropdown-item' | 'inline'
  isFullscreen?: boolean
}

const LANGUAGE_LABELS: Record<string, string> = {
  en: 'English',
  de: 'Deutsch',
  ja: '日本語',
  hi: 'हिन्दी',
  es: 'Español',
  la: 'Latina',
}

const LANGUAGE_FLAGS: Record<string, string> = {
  en: '🇬🇧',
  de: '🇩🇪',
  ja: '🇯🇵',
  hi: '🇮🇳',
  es: '🇪🇸',
  la: '🏛️',
}

export function LanguageSelector({
  variant = 'inline',
  isFullscreen = false,
}: LanguageSelectorProps) {
  const locale = useLocale()
  const { changeLocale } = useLocaleContext()

  if (variant === 'dropdown-item') {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '10px 14px',
          borderRadius: '8px',
          cursor: 'default',
        }}
      >
        <span style={{ fontSize: '16px' }}>🌐</span>
        <select
          value={locale}
          onChange={(e) => changeLocale(e.target.value as (typeof locales)[number])}
          style={{
            flex: 1,
            background: 'rgba(31, 41, 55, 0.6)',
            border: '1px solid rgba(75, 85, 99, 0.5)',
            borderRadius: '6px',
            color: 'rgba(209, 213, 219, 1)',
            fontSize: '14px',
            padding: '6px 10px',
            cursor: 'pointer',
            outline: 'none',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(31, 41, 55, 0.8)'
            e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.5)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(31, 41, 55, 0.6)'
            e.currentTarget.style.borderColor = 'rgba(75, 85, 99, 0.5)'
          }}
        >
          {locales.map((langCode) => (
            <option key={langCode} value={langCode}>
              {LANGUAGE_FLAGS[langCode]} {LANGUAGE_LABELS[langCode]}
            </option>
          ))}
        </select>
      </div>
    )
  }

  // Inline variant for full navbar
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}
    >
      <select
        value={locale}
        onChange={(e) => changeLocale(e.target.value as (typeof locales)[number])}
        style={{
          background: isFullscreen ? 'rgba(0, 0, 0, 0.85)' : 'rgba(17, 24, 39, 0.5)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(139, 92, 246, 0.3)',
          borderRadius: '8px',
          color: 'rgba(209, 213, 219, 0.9)',
          fontSize: '14px',
          fontWeight: '500',
          padding: '8px 12px',
          cursor: 'pointer',
          outline: 'none',
          transition: 'all 0.2s ease',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(139, 92, 246, 0.25)'
          e.currentTarget.style.color = 'rgba(196, 181, 253, 1)'
          e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.5)'
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = isFullscreen
            ? 'rgba(0, 0, 0, 0.85)'
            : 'rgba(17, 24, 39, 0.5)'
          e.currentTarget.style.color = 'rgba(209, 213, 219, 0.9)'
          e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.3)'
          e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.2)'
        }}
      >
        {locales.map((langCode) => (
          <option key={langCode} value={langCode}>
            {LANGUAGE_FLAGS[langCode]} {LANGUAGE_LABELS[langCode]}
          </option>
        ))}
      </select>
    </div>
  )
}
