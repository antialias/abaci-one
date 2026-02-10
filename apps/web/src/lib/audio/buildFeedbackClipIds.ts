import { CELEBRATION_CLIPS, STREAK_CLIPS } from './clips/feedback'
import { numberToClipIds } from './numberToClipIds'

export interface FeedbackContext {
  streak?: number
}

/**
 * Generate feedback clip IDs for a practice answer.
 *
 * Parallel to `buildFeedbackText` but returns clip ID arrays.
 *
 * Correct answers get a random congratulatory clip, or a streak milestone
 * clip when the streak hits an exact milestone (3, 5, 7, 10).
 * Incorrect answers get "the answer is" followed by the number clips.
 */
export function buildFeedbackClipIds(
  isCorrect: boolean,
  correctAnswer: number,
  context?: FeedbackContext
): string[] {
  if (isCorrect) {
    // At exact streak milestones, play the milestone clip instead
    const streak = context?.streak
    if (streak !== undefined && STREAK_CLIPS[streak]) {
      return [STREAK_CLIPS[streak]]
    }
    const idx = Math.floor(Math.random() * CELEBRATION_CLIPS.length)
    return [CELEBRATION_CLIPS[idx]]
  }
  return ['feedback-the-answer-is', ...numberToClipIds(Math.abs(correctAnswer))]
}
