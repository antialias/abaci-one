import { numberToClipIds } from './numberToClipIds'

/**
 * Convert a problem's terms into an array of clip IDs.
 *
 * Parallel to `termsToSentence` but returns clip ID strings
 * instead of an English sentence.
 *
 * Examples:
 *   termsToClipIds([5, 3])     → ['number-5', 'operator-plus', 'number-3']
 *   termsToClipIds([10, -3])   → ['number-10', 'operator-minus', 'number-3']
 *   termsToClipIds([5, 3, -2]) → ['number-5', 'operator-plus', 'number-3', 'operator-minus', 'number-2']
 */
export function termsToClipIds(terms: number[]): string[] {
  if (terms.length === 0) return []

  const clips: string[] = [...numberToClipIds(Math.abs(terms[0]))]

  for (let t = 1; t < terms.length; t++) {
    clips.push(terms[t] < 0 ? 'operator-minus' : 'operator-plus')
    clips.push(...numberToClipIds(Math.abs(terms[t])))
  }

  return clips
}
