import { describe, expect, it } from 'vitest'
import { termsToClipIds } from '../termsToClipIds'

describe('termsToClipIds', () => {
  it('returns empty array for empty terms', () => {
    expect(termsToClipIds([])).toEqual([])
  })

  it('handles single term', () => {
    expect(termsToClipIds([5])).toEqual(['number-5'])
  })

  it('handles addition', () => {
    expect(termsToClipIds([5, 3])).toEqual(['number-5', 'operator-plus', 'number-3'])
  })

  it('handles subtraction', () => {
    expect(termsToClipIds([10, -3])).toEqual(['number-10', 'operator-minus', 'number-3'])
  })

  it('handles mixed operations', () => {
    expect(termsToClipIds([5, 3, -2])).toEqual([
      'number-5',
      'operator-plus',
      'number-3',
      'operator-minus',
      'number-2',
    ])
  })

  it('handles multi-digit numbers in terms', () => {
    expect(termsToClipIds([42, -15])).toEqual([
      'number-40',
      'number-2',
      'operator-minus',
      'number-15',
    ])
  })
})
