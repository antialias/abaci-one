import { describe, expect, it, vi } from 'vitest'
import { buildFeedbackClipIds } from '../buildFeedbackClipIds'
import { CELEBRATION_CLIPS, STREAK_CLIPS } from '../clips/feedback'

describe('buildFeedbackClipIds', () => {
  it('returns a celebration clip for correct answers', () => {
    // Use index 0 (always first clip regardless of array size)
    vi.spyOn(Math, 'random').mockReturnValue(0)
    expect(buildFeedbackClipIds(true, 5)).toEqual([CELEBRATION_CLIPS[0]])

    // Use index near middle
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    const midIdx = Math.floor(0.5 * CELEBRATION_CLIPS.length)
    expect(buildFeedbackClipIds(true, 5)).toEqual([CELEBRATION_CLIPS[midIdx]])

    // Use index near end
    vi.spyOn(Math, 'random').mockReturnValue(0.99)
    const lastIdx = Math.floor(0.99 * CELEBRATION_CLIPS.length)
    expect(buildFeedbackClipIds(true, 5)).toEqual([CELEBRATION_CLIPS[lastIdx]])

    vi.restoreAllMocks()
  })

  it('returns "the answer is" + number clips for incorrect answers', () => {
    expect(buildFeedbackClipIds(false, 5)).toEqual(['feedback-the-answer-is', 'number-5'])
  })

  it('handles multi-digit correct answers', () => {
    expect(buildFeedbackClipIds(false, 42)).toEqual([
      'feedback-the-answer-is',
      'number-40',
      'number-2',
    ])
  })

  it('handles negative correct answers (uses absolute value)', () => {
    expect(buildFeedbackClipIds(false, -7)).toEqual(['feedback-the-answer-is', 'number-7'])
  })

  it('returns streak clip at exact milestone (streak 3)', () => {
    expect(buildFeedbackClipIds(true, 42, { streak: 3 })).toEqual([STREAK_CLIPS[3]])
  })

  it('returns streak clip at exact milestone (streak 5)', () => {
    expect(buildFeedbackClipIds(true, 42, { streak: 5 })).toEqual([STREAK_CLIPS[5]])
  })

  it('returns streak clip at exact milestone (streak 7)', () => {
    expect(buildFeedbackClipIds(true, 42, { streak: 7 })).toEqual([STREAK_CLIPS[7]])
  })

  it('returns streak clip at exact milestone (streak 10)', () => {
    expect(buildFeedbackClipIds(true, 42, { streak: 10 })).toEqual([STREAK_CLIPS[10]])
  })

  it('returns random celebration for non-milestone streaks', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    expect(buildFeedbackClipIds(true, 42, { streak: 4 })).toEqual([CELEBRATION_CLIPS[0]])
    vi.restoreAllMocks()
  })

  it('returns random celebration when streak is 0', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    expect(buildFeedbackClipIds(true, 42, { streak: 0 })).toEqual([CELEBRATION_CLIPS[0]])
    vi.restoreAllMocks()
  })
})
