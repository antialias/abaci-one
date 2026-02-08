import { describe, expect, it } from 'vitest'
import { feedbackToSequence, problemToSequence } from '../problemReader'

describe('problemToSequence', () => {
  it('returns empty array for empty terms', () => {
    expect(problemToSequence([])).toEqual([])
  })

  it('handles single-digit addition', () => {
    const seq = problemToSequence([5, 3])
    const clipIds = seq.map((s) => s.clipId)
    expect(clipIds).toEqual(['number-5', 'operator-plus', 'number-3'])
  })

  it('handles subtraction (negative term)', () => {
    const seq = problemToSequence([10, -3])
    const clipIds = seq.map((s) => s.clipId)
    expect(clipIds).toEqual(['number-10', 'operator-minus', 'number-3'])
  })

  it('handles multi-term problems', () => {
    const seq = problemToSequence([5, 3, -2])
    const clipIds = seq.map((s) => s.clipId)
    expect(clipIds).toEqual(['number-5', 'operator-plus', 'number-3', 'operator-minus', 'number-2'])
  })

  it('handles two-digit numbers', () => {
    const seq = problemToSequence([42, 15])
    const clipIds = seq.map((s) => s.clipId)
    expect(clipIds).toEqual(['number-40', 'number-2', 'operator-plus', 'number-15'])
  })

  it('includes pauses between clips', () => {
    const seq = problemToSequence([5, 3])
    // "five" should have a pause after it (operator pause)
    expect(seq[0].pauseAfterMs).toBeGreaterThan(0)
    // "plus" should have a pause after it
    expect(seq[1].pauseAfterMs).toBeGreaterThan(0)
    // Last clip should have no pause
    expect(seq[seq.length - 1].pauseAfterMs).toBe(0)
  })

  it('handles single term (just a number)', () => {
    const seq = problemToSequence([7])
    const clipIds = seq.map((s) => s.clipId)
    expect(clipIds).toEqual(['number-7'])
  })
})

describe('feedbackToSequence', () => {
  it('returns a single feedback clip for correct answer', () => {
    const seq = feedbackToSequence(true, 8)
    expect(seq).toHaveLength(1)
    expect(seq[0].clipId).toMatch(/^feedback-(correct|great-job|nice-work)$/)
  })

  it('returns "the answer is" + number for incorrect answer', () => {
    const seq = feedbackToSequence(false, 8)
    const clipIds = seq.map((s) => s.clipId)
    expect(clipIds[0]).toBe('feedback-the-answer-is')
    expect(clipIds[1]).toBe('number-8')
  })

  it('handles multi-digit correct answers', () => {
    const seq = feedbackToSequence(false, 42)
    const clipIds = seq.map((s) => s.clipId)
    expect(clipIds[0]).toBe('feedback-the-answer-is')
    expect(clipIds[1]).toBe('number-40')
    expect(clipIds[2]).toBe('number-2')
  })
})
