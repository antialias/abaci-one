import { describe, it, expect } from 'vitest'
import { pluralizeWord, pluralizeCount, gamePlurals } from '../pluralization'

describe('pluralizeWord', () => {
  it('returns singular form for count of 1', () => {
    expect(pluralizeWord(1, 'cat')).toBe('cat')
  })

  it('returns plural form (default -s) for count of 0', () => {
    expect(pluralizeWord(0, 'cat')).toBe('cats')
  })

  it('returns plural form (default -s) for count of 2', () => {
    expect(pluralizeWord(2, 'dog')).toBe('dogs')
  })

  it('returns plural form (default -s) for large numbers', () => {
    expect(pluralizeWord(100, 'item')).toBe('items')
  })

  it('uses custom plural form when provided', () => {
    expect(pluralizeWord(2, 'match', 'matches')).toBe('matches')
  })

  it('uses singular when count is 1 even with custom plural', () => {
    expect(pluralizeWord(1, 'match', 'matches')).toBe('match')
  })

  it('handles negative numbers as plural', () => {
    // make-plural treats negative numbers as "other" category
    expect(pluralizeWord(-1, 'cat')).toBe('cats')
  })
})

describe('pluralizeCount', () => {
  it('formats singular correctly', () => {
    expect(pluralizeCount(1, 'pair')).toBe('1 pair')
  })

  it('formats plural correctly with default -s', () => {
    expect(pluralizeCount(3, 'pair')).toBe('3 pairs')
  })

  it('formats zero correctly', () => {
    expect(pluralizeCount(0, 'item')).toBe('0 items')
  })

  it('uses custom plural form', () => {
    expect(pluralizeCount(5, 'match', 'matches')).toBe('5 matches')
  })

  it('singular with custom plural form', () => {
    expect(pluralizeCount(1, 'match', 'matches')).toBe('1 match')
  })
})

describe('gamePlurals', () => {
  it('pair: singular', () => {
    expect(gamePlurals.pair(1)).toBe('1 pair')
  })

  it('pair: plural', () => {
    expect(gamePlurals.pair(3)).toBe('3 pairs')
  })

  it('pairs: is alias for pair', () => {
    expect(gamePlurals.pairs(2)).toBe('2 pairs')
    expect(gamePlurals.pairs(1)).toBe('1 pair')
  })

  it('move: singular and plural', () => {
    expect(gamePlurals.move(1)).toBe('1 move')
    expect(gamePlurals.move(5)).toBe('5 moves')
  })

  it('moves: is alias for move', () => {
    expect(gamePlurals.moves(1)).toBe('1 move')
    expect(gamePlurals.moves(4)).toBe('4 moves')
  })

  it('match: uses custom plural "matches"', () => {
    expect(gamePlurals.match(1)).toBe('1 match')
    expect(gamePlurals.match(3)).toBe('3 matches')
  })

  it('matches: is alias for match', () => {
    expect(gamePlurals.matches(1)).toBe('1 match')
    expect(gamePlurals.matches(2)).toBe('2 matches')
  })

  it('player: singular and plural', () => {
    expect(gamePlurals.player(1)).toBe('1 player')
    expect(gamePlurals.player(4)).toBe('4 players')
  })

  it('players: is alias for player', () => {
    expect(gamePlurals.players(1)).toBe('1 player')
    expect(gamePlurals.players(8)).toBe('8 players')
  })
})
