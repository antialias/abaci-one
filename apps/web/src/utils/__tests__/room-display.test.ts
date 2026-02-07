import { describe, it, expect } from 'vitest'
import { getRoomDisplay, getRoomDisplayName, getRoomDisplayWithEmoji } from '../room-display'

describe('getRoomDisplay', () => {
  it('returns custom name display when name is provided', () => {
    const display = getRoomDisplay({ name: "Alice's Room", code: 'ABC123' })
    expect(display.plaintext).toBe("Alice's Room")
    expect(display.primary).toBe("Alice's Room")
    expect(display.secondary).toBe('ABC123')
    expect(display.emoji).toBeUndefined()
    expect(display.isGenerated).toBe(false)
  })

  it('returns auto-generated display when name is null', () => {
    const display = getRoomDisplay({ name: null, code: 'XYZ789' })
    expect(display.plaintext).toBe('Room XYZ789')
    expect(display.primary).toBe('XYZ789')
    expect(display.secondary).toBeUndefined()
    expect(display.isGenerated).toBe(true)
  })

  it('selects matching emoji', () => {
    const display = getRoomDisplay({ name: null, code: 'A', gameName: 'matching' })
    expect(display.emoji).toBe('🃏')
  })

  it('selects memory-quiz emoji', () => {
    const display = getRoomDisplay({ name: null, code: 'A', gameName: 'memory-quiz' })
    expect(display.emoji).toBe('🧠')
  })

  it('selects complement-race emoji', () => {
    const display = getRoomDisplay({ name: null, code: 'A', gameName: 'complement-race' })
    expect(display.emoji).toBe('⚡')
  })

  it('uses default emoji for unknown game', () => {
    const display = getRoomDisplay({ name: null, code: 'A', gameName: 'unknown-game' })
    expect(display.emoji).toBe('🎮')
  })

  it('uses default emoji when no gameName', () => {
    const display = getRoomDisplay({ name: null, code: 'A' })
    expect(display.emoji).toBe('🎮')
  })
})

describe('getRoomDisplayName', () => {
  it('returns custom name when provided', () => {
    expect(getRoomDisplayName({ name: 'My Room', code: 'X' })).toBe('My Room')
  })

  it('returns "Room CODE" when no name', () => {
    expect(getRoomDisplayName({ name: null, code: 'ABC' })).toBe('Room ABC')
  })
})

describe('getRoomDisplayWithEmoji', () => {
  it('returns plain name for custom rooms', () => {
    expect(getRoomDisplayWithEmoji({ name: 'My Room', code: 'X' })).toBe('My Room')
  })

  it('returns emoji + code for generated rooms', () => {
    const result = getRoomDisplayWithEmoji({ name: null, code: 'ABC', gameName: 'matching' })
    expect(result).toBe('🃏 ABC')
  })
})
