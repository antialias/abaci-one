import { numberToClipIds } from './numberToClips'

export interface SequenceItem {
  clipId: string
  pauseAfterMs: number
}

const DEFAULT_PAUSE = 150
const OPERATOR_PAUSE = 250
const FEEDBACK_PAUSE = 300

/**
 * Convert a problem's terms into a sequence of clip IDs with pauses.
 *
 * Terms follow the convention: first term is the starting number,
 * subsequent positive terms mean addition, negative terms mean subtraction.
 *
 * Example: [5, 3] → "five" (pause) "plus" (pause) "three"
 * Example: [10, -3] → "ten" (pause) "minus" (pause) "three"
 * Example: [5, 3, -2] → "five" (pause) "plus" (pause) "three" (pause) "minus" (pause) "two"
 */
export function problemToSequence(terms: number[]): SequenceItem[] {
  if (terms.length === 0) return []

  const items: SequenceItem[] = []

  // First term (always read as-is, could be negative for the starting number)
  const firstTerm = Math.abs(terms[0])
  const firstClips = numberToClipIds(firstTerm)
  for (let i = 0; i < firstClips.length; i++) {
    items.push({
      clipId: firstClips[i],
      pauseAfterMs: i < firstClips.length - 1 ? DEFAULT_PAUSE : OPERATOR_PAUSE,
    })
  }

  // Subsequent terms
  for (let t = 1; t < terms.length; t++) {
    const term = terms[t]
    const isSubtraction = term < 0
    const absValue = Math.abs(term)

    // Operator
    items.push({
      clipId: isSubtraction ? 'operator-minus' : 'operator-plus',
      pauseAfterMs: OPERATOR_PAUSE,
    })

    // Number
    const numClips = numberToClipIds(absValue)
    for (let i = 0; i < numClips.length; i++) {
      items.push({
        clipId: numClips[i],
        pauseAfterMs:
          i < numClips.length - 1 ? DEFAULT_PAUSE : t < terms.length - 1 ? OPERATOR_PAUSE : 0,
      })
    }
  }

  return items
}

/**
 * Generate a feedback sequence.
 *
 * Correct: randomly picks "Correct!" or "Great job!" or "Nice work!"
 * Incorrect: "The answer is" + number clips
 */
export function feedbackToSequence(isCorrect: boolean, correctAnswer: number): SequenceItem[] {
  if (isCorrect) {
    const options = ['feedback-correct', 'feedback-great-job', 'feedback-nice-work']
    const pick = options[Math.floor(Math.random() * options.length)]
    return [{ clipId: pick, pauseAfterMs: 0 }]
  }

  // "The answer is" + number
  const items: SequenceItem[] = [{ clipId: 'feedback-the-answer-is', pauseAfterMs: FEEDBACK_PAUSE }]

  const numClips = numberToClipIds(Math.abs(correctAnswer))
  for (let i = 0; i < numClips.length; i++) {
    items.push({
      clipId: numClips[i],
      pauseAfterMs: i < numClips.length - 1 ? DEFAULT_PAUSE : 0,
    })
  }

  return items
}
