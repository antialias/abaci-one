import { numberToEnglish } from './numberToEnglish'

/**
 * Convert a problem's terms into a readable English sentence.
 *
 * Terms follow the convention: first term is the starting number,
 * subsequent positive terms mean addition, negative terms mean subtraction.
 *
 * Examples:
 *   termsToSentence([5, 3])     → "five plus three"
 *   termsToSentence([10, -3])   → "ten minus three"
 *   termsToSentence([5, 3, -2]) → "five plus three minus two"
 */
export function termsToSentence(terms: number[]): string {
  if (terms.length === 0) return ''

  const parts: string[] = [numberToEnglish(Math.abs(terms[0]))]

  for (let t = 1; t < terms.length; t++) {
    const term = terms[t]
    parts.push(term < 0 ? 'minus' : 'plus')
    parts.push(numberToEnglish(Math.abs(term)))
  }

  return parts.join(' ')
}
