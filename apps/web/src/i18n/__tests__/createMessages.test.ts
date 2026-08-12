import { describe, expect, it } from 'vitest'
import { CREATE_TOOLS } from '@/lib/create-tools/createToolList'
import de from '../locales/create/de.json'
import en from '../locales/create/en.json'
import es from '../locales/create/es.json'
import goh from '../locales/create/goh.json'
import hi from '../locales/create/hi.json'
import ja from '../locales/create/ja.json'
import la from '../locales/create/la.json'

type Json = Record<string, unknown>

const LOCALES = { en, de, es, goh, hi, ja, la } as unknown as Record<string, Json>

/**
 * Keys that are knowingly English-only. Each entry is a debt, not a pass —
 * delete the entry once the translations land rather than widening the rule.
 */
const EN_ONLY_ALLOWLIST = [
  // The addition-worksheet builder UI was never localized.
  'create.worksheets.addition',
]

/** Every dotted path to a leaf (non-object) value. */
function leafPaths(value: unknown, prefix = ''): string[] {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return prefix ? [prefix] : []
  }
  return Object.entries(value as Json).flatMap(([key, child]) =>
    leafPaths(child, prefix ? `${prefix}.${key}` : key)
  )
}

function get(obj: Json, path: string): unknown {
  return path
    .split('.')
    .reduce<unknown>(
      (acc, key) => (acc !== null && typeof acc === 'object' ? (acc as Json)[key] : undefined),
      obj
    )
}

const OTHER_LOCALES = Object.entries(LOCALES).filter(([code]) => code !== 'en')

describe('create locale messages', () => {
  const hubPaths = leafPaths(get(LOCALES.en, 'create.hub'), 'create.hub')

  it('has a non-trivial set of hub keys to check', () => {
    expect(hubPaths.length).toBeGreaterThan(30)
  })

  it.each(OTHER_LOCALES)('%s translates every create.hub key', (_code, messages) => {
    const missing = hubPaths.filter((path) => typeof get(messages, path) !== 'string')
    expect(missing).toEqual([])
  })

  it.each(OTHER_LOCALES)('%s leaves no create.hub key empty', (_code, messages) => {
    const blank = hubPaths.filter((path) => (get(messages, path) as string)?.trim() === '')
    expect(blank).toEqual([])
  })

  it.each(Object.entries(LOCALES))('%s has dropped the dead abacus blocks', (_code, messages) => {
    expect(get(messages, 'create.hub.abacus')).toBeUndefined()
    expect(get(messages, 'create.abacus')).toBeUndefined()
  })

  it.each(Object.entries(LOCALES))(
    '%s resolves the copy every registry tool renders',
    (_code, messages) => {
      const missing: string[] = []
      for (const tool of CREATE_TOOLS) {
        const keys = [
          'title',
          'description',
          'button',
          ...Array.from({ length: tool.featureCount }, (_, i) => `feature${i + 1}`),
        ]
        for (const key of keys) {
          const path = `create.hub.${tool.i18nKey}.${key}`
          if (typeof get(messages, path) !== 'string') missing.push(path)
        }
      }
      expect(missing).toEqual([])
    }
  )

  it.each(OTHER_LOCALES)(
    '%s only falls back to English where we have said it may',
    (_code, messages) => {
      const enPaths = leafPaths(get(LOCALES.en, 'create'), 'create')
      const missing = enPaths
        .filter((path) => get(messages, path) === undefined)
        .filter((path) => !EN_ONLY_ALLOWLIST.some((prefix) => path.startsWith(`${prefix}.`)))
      expect(missing).toEqual([])
    }
  )
})
