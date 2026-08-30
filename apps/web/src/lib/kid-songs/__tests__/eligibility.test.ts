// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  audioUrlFor,
  isValidAudioVersion,
  isValidId,
  isValidTitle,
  toIso,
  toNullableIso,
} from '../eligibility'

describe('kid-song eligibility primitives', () => {
  it.each([null, 1, {}, '', '   ', 'bad\nname', 'badname', 'badname'])(
    'rejects invalid title %p',
    (title) => expect(isValidTitle(title)).toBe(false)
  )

  it('trims titles and enforces Unicode-code-unit length', () => {
    expect(isValidTitle(`  ${'a'.repeat(120)}  `)).toBe(true)
    expect(isValidTitle('a'.repeat(121))).toBe(false)
  })

  it('guards IDs and versions', () => {
    expect(isValidId('abc_DEF-123')).toBe(true)
    expect(isValidId('../bad')).toBe(false)
    expect(isValidId('a'.repeat(65))).toBe(false)
    expect(isValidAudioVersion('a'.repeat(64))).toBe(true)
    expect(isValidAudioVersion('A'.repeat(64))).toBe(false)
    expect(isValidAudioVersion('a'.repeat(63))).toBe(false)
  })

  it('converts dates to canonical ISO UTC strings', () => {
    expect(toIso(new Date('2026-08-30T13:55:00Z'))).toBe('2026-08-30T13:55:00.000Z')
    expect(toNullableIso(null)).toBeNull()
  })

  it('constructs the exact relative versioned audio URL', () => {
    const version = 'b'.repeat(64)
    expect(audioUrlFor('player_1', 'song-2', version)).toBe(
      `/api/integrations/kid-songs/player_1/audio?songId=song-2&v=${version}`
    )
  })
})
