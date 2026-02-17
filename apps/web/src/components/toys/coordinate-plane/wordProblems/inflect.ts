import type { NounEntry, VerbEntry, SubjectEntry } from './types'

/** Pick singular or plural based on count */
export function pluralize(noun: NounEntry, count: number): string {
  return count === 1 ? noun.singular : noun.plural
}

/** Get third-person singular form */
export function conjugate3p(verb: VerbEntry): string {
  return verb.thirdPerson
}

/** Get base/infinitive form */
export function conjugateBase(verb: VerbEntry): string {
  return verb.base
}

/** Conjugate a verb to agree with a subject entry */
export function conjugateFor(verb: VerbEntry, subject: SubjectEntry): string {
  return subject.conjugation === 'thirdPerson' ? verb.thirdPerson : verb.base
}

/**
 * Format a number with its unit, respecting prefix/suffix position.
 * Examples: formatWithUnit(3, "$", "prefix") → "$3"
 *           formatWithUnit(5, "inches", "suffix") → "5 inches"
 */
export function formatWithUnit(
  value: number,
  unit: string,
  position: 'prefix' | 'suffix'
): string {
  if (position === 'prefix') {
    return `${unit}${value}`
  }
  return `${value} ${unit}`
}

/**
 * Capitalize the first letter of a string.
 */
export function capitalize(s: string): string {
  if (s.length === 0) return s
  return s[0].toUpperCase() + s.slice(1)
}

/** Words that should be lowercased when a subject appears mid-sentence */
const MID_SENTENCE_LOWERCASE = new Set([
  'the', 'a', 'an', 'each', 'every', 'some', 'this', 'that',
  'she', 'he', 'it', 'they', 'we',
])

/**
 * Lowercase a subject phrase for mid-sentence use.
 * Lowercases the first letter only if it's an article/pronoun/determiner.
 * Preserves proper nouns like "Sonia".
 */
export function midSentence(phrase: string): string {
  const firstWord = phrase.split(' ')[0]
  if (MID_SENTENCE_LOWERCASE.has(firstWord.toLowerCase())) {
    return phrase[0].toLowerCase() + phrase.slice(1)
  }
  return phrase
}
