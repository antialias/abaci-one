import type { SemanticFrame, SubjectEntry } from './types'
import { capitalize } from './inflect'

/** A character that can star in a word problem */
export interface Character {
  name: string
  pronoun: 'she' | 'he' | 'they'
  possessive: 'her' | 'his' | 'their'
}

export const CHARACTERS: Character[] = [
  { name: 'Sonia', pronoun: 'she', possessive: 'her' },
  { name: 'Marcus', pronoun: 'he', possessive: 'his' },
  { name: 'Priya', pronoun: 'she', possessive: 'her' },
  { name: 'Kai', pronoun: 'he', possessive: 'his' },
  { name: 'Amara', pronoun: 'she', possessive: 'her' },
  { name: 'Leo', pronoun: 'he', possessive: 'his' },
  { name: 'Mei', pronoun: 'she', possessive: 'her' },
  { name: 'Diego', pronoun: 'he', possessive: 'his' },
  { name: 'Zara', pronoun: 'she', possessive: 'her' },
  { name: 'Noah', pronoun: 'he', possessive: 'his' },
  { name: 'Aisha', pronoun: 'she', possessive: 'her' },
  { name: 'Ravi', pronoun: 'he', possessive: 'his' },
  { name: 'Luna', pronoun: 'she', possessive: 'her' },
  { name: 'Ethan', pronoun: 'he', possessive: 'his' },
  { name: 'Yuki', pronoun: 'they', possessive: 'their' },
]

/**
 * Replace {name}, {pronoun}, {Pronoun}, {possessive}, {Possessive} in a string.
 */
export function resolveTemplate(text: string, character: Character): string {
  return text
    .replace(/\{name\}/g, character.name)
    .replace(/\{pronoun\}/g, character.pronoun)
    .replace(/\{Pronoun\}/g, capitalize(character.pronoun))
    .replace(/\{possessive\}/g, character.possessive)
    .replace(/\{Possessive\}/g, capitalize(character.possessive))
}

/**
 * Resolve a subject entry's placeholders.
 *
 * - `{Pronoun}` subjects get conjugation auto-set: 'they' → 'base', else 'thirdPerson'.
 * - All other subjects get simple template replacement with conjugation preserved.
 */
export function resolveSubject(subject: SubjectEntry, character: Character): SubjectEntry {
  if (subject.phrase === '{Pronoun}') {
    return {
      phrase: capitalize(character.pronoun),
      conjugation: character.pronoun === 'they' ? 'base' : 'thirdPerson',
    }
  }
  const resolved = resolveTemplate(subject.phrase, character)
  if (resolved === subject.phrase) return subject // no placeholders — return original
  return { phrase: resolved, conjugation: subject.conjugation }
}

/**
 * Resolve all character placeholders in a SemanticFrame.
 * Returns a new frame — the original is not mutated.
 */
export function resolveCharacter(frame: SemanticFrame, character: Character): SemanticFrame {
  return {
    ...frame,
    setupPhrases: frame.setupPhrases.map(p => resolveTemplate(p, character)),
    subjects: frame.subjects.map(s => resolveSubject(s, character)),
    solveForXQuestions: frame.solveForXQuestions?.map(q => resolveTemplate(q, character)),
  }
}
