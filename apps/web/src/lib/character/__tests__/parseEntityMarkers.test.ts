import { describe, it, expect } from 'vitest'
import { parseEntityMarkers } from '../parseEntityMarkers'
import type { EntityMarkerConfig } from '../types'

// Simple test config: matches [TAG] patterns
type TestEntity = { tag: string }
const testConfig: EntityMarkerConfig<TestEntity> = {
  pattern: /\[([A-Z]+)\]/g,
  parseMatch: (groups) => {
    const tag = groups[0]
    if (!tag) return null
    if (tag === 'SKIP') return null // test skip behavior
    return { entity: { tag }, displayText: `<${tag}>` }
  },
}

describe('parseEntityMarkers', () => {
  it('returns plain text when no markers match', () => {
    const result = parseEntityMarkers('no markers here', testConfig)
    expect(result).toEqual([{ kind: 'text', text: 'no markers here' }])
  })

  it('parses a single marker', () => {
    const result = parseEntityMarkers('before [FOO] after', testConfig)
    expect(result).toEqual([
      { kind: 'text', text: 'before ' },
      { kind: 'entity', text: '<FOO>', entity: { tag: 'FOO' } },
      { kind: 'text', text: ' after' },
    ])
  })

  it('parses multiple markers', () => {
    const result = parseEntityMarkers('[A] and [B]', testConfig)
    expect(result).toEqual([
      { kind: 'entity', text: '<A>', entity: { tag: 'A' } },
      { kind: 'text', text: ' and ' },
      { kind: 'entity', text: '<B>', entity: { tag: 'B' } },
    ])
  })

  it('skips markers where parseMatch returns null', () => {
    const result = parseEntityMarkers('[SKIP] and [OK]', testConfig)
    expect(result).toEqual([
      { kind: 'text', text: '[SKIP] and ' },
      { kind: 'entity', text: '<OK>', entity: { tag: 'OK' } },
    ])
  })

  it('handles marker at start of string', () => {
    const result = parseEntityMarkers('[X] rest', testConfig)
    expect(result).toEqual([
      { kind: 'entity', text: '<X>', entity: { tag: 'X' } },
      { kind: 'text', text: ' rest' },
    ])
  })

  it('handles marker at end of string', () => {
    const result = parseEntityMarkers('start [X]', testConfig)
    expect(result).toEqual([
      { kind: 'text', text: 'start ' },
      { kind: 'entity', text: '<X>', entity: { tag: 'X' } },
    ])
  })

  it('handles empty string', () => {
    const result = parseEntityMarkers('', testConfig)
    expect(result).toEqual([{ kind: 'text', text: '' }])
  })

  it('resets regex state between calls', () => {
    parseEntityMarkers('[A]', testConfig)
    const result = parseEntityMarkers('[B]', testConfig)
    expect(result).toEqual([
      { kind: 'entity', text: '<B>', entity: { tag: 'B' } },
    ])
  })
})
