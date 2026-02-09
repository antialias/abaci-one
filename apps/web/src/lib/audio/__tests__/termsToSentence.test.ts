import { describe, expect, it } from 'vitest'
import { termsToSentence } from '../termsToSentence'

describe('termsToSentence', () => {
  it('returns empty string for empty terms', () => {
    expect(termsToSentence([])).toBe('')
  })

  it('handles single-digit addition', () => {
    expect(termsToSentence([5, 3])).toBe('five plus three')
  })

  it('handles subtraction (negative term)', () => {
    expect(termsToSentence([10, -3])).toBe('ten minus three')
  })

  it('handles multi-term problems', () => {
    expect(termsToSentence([5, 3, -2])).toBe('five plus three minus two')
  })

  it('handles two-digit numbers', () => {
    expect(termsToSentence([42, 15])).toBe('forty two plus fifteen')
  })

  it('handles single term (just a number)', () => {
    expect(termsToSentence([7])).toBe('seven')
  })
})
