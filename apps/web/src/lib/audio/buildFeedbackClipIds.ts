import { numberToClipIds } from './numberToClipIds'

const CELEBRATION_CLIP_IDS = [
  'feedback-correct',
  'feedback-great-job',
  'feedback-nice-work',
] as const

/**
 * Generate feedback clip IDs for a practice answer.
 *
 * Parallel to `buildFeedbackText` but returns clip ID arrays.
 *
 * Correct answers get a random congratulatory clip.
 * Incorrect answers get "the answer is" followed by the number clips.
 */
export function buildFeedbackClipIds(isCorrect: boolean, correctAnswer: number): string[] {
  if (isCorrect) {
    const idx = Math.floor(Math.random() * CELEBRATION_CLIP_IDS.length)
    return [CELEBRATION_CLIP_IDS[idx]]
  }
  return ['feedback-the-answer-is', ...numberToClipIds(Math.abs(correctAnswer))]
}
