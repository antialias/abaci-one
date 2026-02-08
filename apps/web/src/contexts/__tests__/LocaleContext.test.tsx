import { describe, expect, it, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import React, { type ReactNode } from 'react'
import { LocaleProvider, useLocaleContext } from '../LocaleContext'

// Mock the i18n modules
vi.mock('@/i18n/messages', () => ({
  getMessages: vi.fn(async (locale: string) => ({
    greeting: locale === 'de' ? 'Hallo' : 'Hello',
  })),
}))

vi.mock('@/i18n/routing', () => ({
  LOCALE_COOKIE_NAME: 'NEXT_LOCALE',
}))

const initialMessages = { greeting: 'Hello' }

function createWrapper(locale = 'en' as const) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <LocaleProvider initialLocale={locale} initialMessages={initialMessages}>
        {children}
      </LocaleProvider>
    )
  }
}

describe('LocaleContext', () => {
  it('throws when useLocaleContext is used outside provider', () => {
    expect(() => {
      renderHook(() => useLocaleContext())
    }).toThrow('useLocaleContext must be used within LocaleProvider')
  })

  it('provides the initial locale', () => {
    const { result } = renderHook(() => useLocaleContext(), { wrapper: createWrapper('en') })
    expect(result.current.locale).toBe('en')
  })

  it('provides initial messages', () => {
    const { result } = renderHook(() => useLocaleContext(), { wrapper: createWrapper('en') })
    expect(result.current.messages).toEqual(initialMessages)
  })

  it('provides changeLocale as a function', () => {
    const { result } = renderHook(() => useLocaleContext(), { wrapper: createWrapper('en') })
    expect(typeof result.current.changeLocale).toBe('function')
  })

  it('changes locale and loads new messages', async () => {
    const { result } = renderHook(() => useLocaleContext(), { wrapper: createWrapper('en') })

    await act(async () => {
      await result.current.changeLocale('de')
    })

    expect(result.current.locale).toBe('de')
    expect(result.current.messages).toEqual({ greeting: 'Hallo' })
  })

  it('sets locale cookie on change', async () => {
    const { result } = renderHook(() => useLocaleContext(), { wrapper: createWrapper('en') })

    await act(async () => {
      await result.current.changeLocale('ja')
    })

    expect(document.cookie).toContain('NEXT_LOCALE=ja')
  })

  it('uses a different initial locale', () => {
    const { result } = renderHook(() => useLocaleContext(), { wrapper: createWrapper('de') })
    expect(result.current.locale).toBe('de')
  })
})
