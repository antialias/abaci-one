import '@testing-library/jest-dom'
import 'vitest-axe/extend-expect'
import React from 'react'
import { vi } from 'vitest'

// Mock @/db to prevent SQLite access in unit tests
// The db module creates a real SQLite connection which fails in CI (no database file)
// Tests that need a real database are excluded via vitest.config.ts
function createChainableDbMock(): any {
  const chain = (): any =>
    new Proxy(() => Promise.resolve([]), {
      get: (_target, prop) => {
        if (prop === 'then') return undefined // not a thenable until awaited
        if (prop === 'all') return () => Promise.resolve([])
        if (prop === 'get') return () => Promise.resolve(undefined)
        if (prop === 'values') return () => Promise.resolve([])
        if (prop === 'run') return () => Promise.resolve()
        if (prop === 'execute') return () => Promise.resolve()
        return chain()
      },
      apply: () => chain(),
    })
  return new Proxy(
    {},
    {
      get: (_target, prop) => {
        if (prop === 'transaction') return (fn: any) => fn(chain())
        return chain()
      },
    }
  )
}
vi.mock('@/db', () => ({
  db: createChainableDbMock(),
  schema: new Proxy(
    {},
    {
      get: () =>
        new Proxy(
          {},
          {
            get: () => Symbol('column'),
          }
        ),
    }
  ),
}))

// Polyfill window.matchMedia for jsdom (used by useDeviceCapabilities)
if (typeof window !== 'undefined' && !window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  })
}

// Polyfill React.cache for tests (server component feature not available in jsdom)
if (typeof (React as any).cache !== 'function') {
  ;(React as any).cache = <T extends (...args: any[]) => any>(fn: T): T => fn
}

// Mock next-intl for tests
// This provides a passthrough translation function that returns the key
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'en',
  useNow: () => new Date(),
  useTimeZone: () => 'America/Los_Angeles',
  useFormatter: () => ({
    dateTime: (date: Date) => date.toISOString(),
    number: (num: number) => String(num),
    relativeTime: () => 'some time ago',
  }),
  NextIntlClientProvider: ({ children }: { children: React.ReactNode }) => children,
}))

// Mock device capability hooks to prevent uncaught matchMedia exceptions
// These hooks use setTimeout callbacks that fire after test cleanup in jsdom
vi.mock('@/hooks/useDeviceCapabilities', () => ({
  useIsTouchDevice: () => false,
  useHasAnyFinePointer: () => true,
  useHasPhysicalKeyboard: () => true,
}))

// Mock @soroban/abacus-react for tests
// This provides mock implementations of abacus display context and components
const mockAbacusConfig = {
  colorScheme: 'place-value' as const,
  beadShape: 'diamond' as const,
  colorPalette: 'default' as const,
  hideInactiveBeads: false,
  coloredNumerals: false,
  scaleFactor: 1.0,
  showNumbers: true,
  animated: true,
  interactive: false,
  gestures: false,
  soundEnabled: false,
  soundVolume: 0.8,
  physicalAbacusColumns: 4,
}

vi.mock('@soroban/abacus-react', () => ({
  AbacusReact: ({ value }: { value: number }) =>
    React.createElement('div', {
      'data-testid': 'abacus',
      'data-value': value,
    }),
  AbacusStatic: ({ value }: { value: number }) =>
    React.createElement('div', {
      'data-testid': 'abacus-static',
      'data-value': value,
    }),
  StandaloneBead: () => React.createElement('div', { 'data-testid': 'standalone-bead' }),
  AbacusDisplayProvider: ({ children }: { children: React.ReactNode }) => children,
  useAbacusConfig: () => mockAbacusConfig,
  useAbacusDisplay: () => ({
    config: mockAbacusConfig,
    updateConfig: vi.fn(),
    resetToDefaults: vi.fn(),
  }),
  getDefaultAbacusConfig: () => mockAbacusConfig,
  useAbacusDiff: () => ({ beads: [], changes: [] }),
  useAbacusState: (value: number) => ({
    state: { columns: [] },
    setValue: vi.fn(),
    value,
  }),
  useSystemTheme: () => 'light',
  ABACUS_THEMES: {},
  // Utility functions
  numberToAbacusState: vi.fn(() => ({ columns: [] })),
  abacusStateToNumber: vi.fn(() => 0),
  calculateBeadChanges: vi.fn(() => []),
  calculateBeadDiff: vi.fn(() => ({ additions: [], removals: [] })),
  calculateBeadDiffFromValues: vi.fn(() => ({ additions: [], removals: [] })),
  validateAbacusValue: vi.fn(() => true),
  areStatesEqual: vi.fn(() => true),
  calculateAbacusDimensions: vi.fn(() => ({ width: 100, height: 200 })),
  calculateStandardDimensions: vi.fn(() => ({})),
  calculateBeadPosition: vi.fn(() => ({ x: 0, y: 0 })),
  calculateBeadDimensions: vi.fn(() => ({ width: 10, height: 10 })),
  calculateActiveBeadsBounds: vi.fn(() => ({
    x: 0,
    y: 0,
    width: 100,
    height: 200,
  })),
  calculateAbacusCrop: vi.fn(() => ({})),
}))

// Mock canvas Image constructor to prevent jsdom errors when rendering
// images with data URIs (e.g., data:image/jpeg;base64,...)
// This works by patching HTMLImageElement.prototype before jsdom uses it
// Guard for node environment where HTMLImageElement doesn't exist
if (typeof HTMLImageElement !== 'undefined') {
  const originalSetAttribute = HTMLImageElement.prototype.setAttribute
  HTMLImageElement.prototype.setAttribute = function (name: string, value: string) {
    if (name === 'src' && value.startsWith('data:image/')) {
      // Store the value but don't trigger jsdom's image loading
      Object.defineProperty(this, 'src', {
        value,
        writable: true,
        configurable: true,
      })
      return
    }
    return originalSetAttribute.call(this, name, value)
  }
}
