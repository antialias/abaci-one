import { describe, expect, it } from 'vitest'
import { buildFeedbackText } from '../buildFeedbackText'

describe('buildFeedbackText', () => {
  it('returns a congratulatory phrase for correct answer', () => {
    const text = buildFeedbackText(true, 8)
    expect(['Correct!', 'Great job!', 'Nice work!']).toContain(text)
  })

  it('returns "The answer is <number>" for incorrect answer', () => {
    expect(buildFeedbackText(false, 8)).toBe('The answer is eight')
  })

  it('handles multi-digit incorrect answers', () => {
    expect(buildFeedbackText(false, 42)).toBe('The answer is forty two')
  })

  it('handles large incorrect answers', () => {
    expect(buildFeedbackText(false, 157)).toBe('The answer is one hundred fifty seven')
  })
})
