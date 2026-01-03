'use client'

import { createContext, useContext, useState, type ReactNode } from 'react'
import { getMessages, type Locale } from '@/i18n/messages'
import { LOCALE_COOKIE_NAME } from '@/i18n/routing'

interface LocaleContextValue {
  locale: Locale
  messages: Record<string, any>
  changeLocale: (newLocale: Locale) => Promise<void>
}

const LocaleContext = createContext<LocaleContextValue | undefined>(undefined)

interface LocaleProviderProps {
  children: ReactNode
  initialLocale: Locale
  initialMessages: Record<string, any>
}

export function LocaleProvider({ children, initialLocale, initialMessages }: LocaleProviderProps) {
  const [locale, setLocale] = useState<Locale>(initialLocale)
  const [messages, setMessages] = useState<Record<string, any>>(initialMessages)

  const changeLocale = async (newLocale: Locale) => {
    // Update cookie
    document.cookie = `${LOCALE_COOKIE_NAME}=${newLocale}; path=/; max-age=${60 * 60 * 24 * 365}`

    // Load new messages
    const newMessages = await getMessages(newLocale)

    // Update state
    setLocale(newLocale)
    setMessages(newMessages)
  }

  return (
    <LocaleContext.Provider value={{ locale, messages, changeLocale }}>
      {children}
    </LocaleContext.Provider>
  )
}

export function useLocaleContext() {
  const context = useContext(LocaleContext)
  if (!context) {
    throw new Error('useLocaleContext must be used within LocaleProvider')
  }
  return context
}
