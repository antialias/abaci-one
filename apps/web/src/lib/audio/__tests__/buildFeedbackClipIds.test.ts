import { describe, expect, it, vi } from 'vitest'
import { buildFeedbackClipIds } from '../buildFeedbackClipIds'

describe('buildFeedbackClipIds', () => {
  it('returns a celebration clip for correct answers', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    expect(buildFeedbackClipIds(true, 5)).toEqual(['feedback-correct'])

    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    expect(buildFeedbackClipIds(true, 5)).toEqual(['feedback-great-job'])

    vi.spyOn(Math, 'random').mockReturnValue(0.9)
    expect(buildFeedbackClipIds(true, 5)).toEqual(['feedback-nice-work'])

    vi.restoreAllMocks()
  })

  it('returns "the answer is" + number clips for incorrect answers', () => {
    expect(buildFeedbackClipIds(false, 5)).toEqual([
      'feedback-the-answer-is', 'number-5',
    ])
  })

  it('handles multi-digit correct answers', () => {
    expect(buildFeedbackClipIds(false, 42)).toEqual([
      'feedback-the-answer-is', 'number-40', 'number-2',
    ])
  })

  it('handles negative correct answers (uses absolute value)', () => {
    expect(buildFeedbackClipIds(false, -7)).toEqual([
      'feedback-the-answer-is', 'number-7',
    ])
  })
})
