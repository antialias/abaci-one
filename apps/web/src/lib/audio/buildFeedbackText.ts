import { numberToEnglish } from './numberToEnglish'

const CORRECT_OPTIONS = ['Correct!', 'Great job!', 'Nice work!']

/**
 * Generate feedback text for a practice answer.
 *
 * Correct answers get a random congratulatory phrase.
 * Incorrect answers get "The answer is <number>".
 */
export function buildFeedbackText(isCorrect: boolean, correctAnswer: number): string {
  if (isCorrect) {
    return CORRECT_OPTIONS[Math.floor(Math.random() * CORRECT_OPTIONS.length)]
  }
  return `The answer is ${numberToEnglish(Math.abs(correctAnswer))}`
}
