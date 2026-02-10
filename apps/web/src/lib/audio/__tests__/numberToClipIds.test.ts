import { describe, expect, it } from 'vitest'
import { numberToClipIds } from '../numberToClipIds'

describe('numberToClipIds', () => {
  it('handles 0', () => {
    expect(numberToClipIds(0)).toEqual(['number-0'])
  })

  it('handles single digits (1-9)', () => {
    expect(numberToClipIds(1)).toEqual(['number-1'])
    expect(numberToClipIds(5)).toEqual(['number-5'])
    expect(numberToClipIds(9)).toEqual(['number-9'])
  })

  it('handles teens (10-20)', () => {
    expect(numberToClipIds(10)).toEqual(['number-10'])
    expect(numberToClipIds(11)).toEqual(['number-11'])
    expect(numberToClipIds(15)).toEqual(['number-15'])
    expect(numberToClipIds(19)).toEqual(['number-19'])
    expect(numberToClipIds(20)).toEqual(['number-20'])
  })

  it('handles two-digit numbers (21-99)', () => {
    expect(numberToClipIds(21)).toEqual(['number-20', 'number-1'])
    expect(numberToClipIds(30)).toEqual(['number-30'])
    expect(numberToClipIds(42)).toEqual(['number-40', 'number-2'])
    expect(numberToClipIds(55)).toEqual(['number-50', 'number-5'])
    expect(numberToClipIds(99)).toEqual(['number-90', 'number-9'])
  })

  it('handles hundreds', () => {
    expect(numberToClipIds(100)).toEqual(['number-1', 'number-hundred'])
    expect(numberToClipIds(157)).toEqual(['number-1', 'number-hundred', 'number-50', 'number-7'])
    expect(numberToClipIds(200)).toEqual(['number-2', 'number-hundred'])
    expect(numberToClipIds(305)).toEqual(['number-3', 'number-hundred', 'number-5'])
    expect(numberToClipIds(410)).toEqual(['number-4', 'number-hundred', 'number-10'])
    expect(numberToClipIds(512)).toEqual(['number-5', 'number-hundred', 'number-12'])
    expect(numberToClipIds(999)).toEqual(['number-9', 'number-hundred', 'number-90', 'number-9'])
  })

  it('handles thousands', () => {
    expect(numberToClipIds(1000)).toEqual(['number-1', 'number-thousand'])
    expect(numberToClipIds(2000)).toEqual(['number-2', 'number-thousand'])
    expect(numberToClipIds(2345)).toEqual([
      'number-2',
      'number-thousand',
      'number-3',
      'number-hundred',
      'number-40',
      'number-5',
    ])
    expect(numberToClipIds(1001)).toEqual(['number-1', 'number-thousand', 'number-1'])
    expect(numberToClipIds(9999)).toEqual([
      'number-9',
      'number-thousand',
      'number-9',
      'number-hundred',
      'number-90',
      'number-9',
    ])
  })

  it('handles round thousands with hundreds', () => {
    expect(numberToClipIds(1100)).toEqual([
      'number-1',
      'number-thousand',
      'number-1',
      'number-hundred',
    ])
    expect(numberToClipIds(5020)).toEqual(['number-5', 'number-thousand', 'number-20'])
  })

  it('throws for negative numbers', () => {
    expect(() => numberToClipIds(-1)).toThrow()
  })

  it('throws for numbers > 9999', () => {
    expect(() => numberToClipIds(10000)).toThrow()
  })

  it('throws for non-integers', () => {
    expect(() => numberToClipIds(1.5)).toThrow()
  })
})
