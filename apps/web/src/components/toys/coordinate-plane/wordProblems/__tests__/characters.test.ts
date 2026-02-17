import { describe, it, expect } from 'vitest'
import {
  CHARACTERS,
  resolveTemplate,
  resolveSubject,
  resolveCharacter,
} from '../characters'
import { FRAMES } from '../frames'
import type { Character } from '../characters'
import type { SemanticFrame, SubjectEntry } from '../types'

const sonia: Character = { name: 'Sonia', pronoun: 'she', possessive: 'her' }
const marcus: Character = { name: 'Marcus', pronoun: 'he', possessive: 'his' }
const yuki: Character = { name: 'Yuki', pronoun: 'they', possessive: 'their' }

describe('characters', () => {
  it('has 15 characters', () => {
    expect(CHARACTERS.length).toBe(15)
  })

  it('all characters have required fields', () => {
    for (const c of CHARACTERS) {
      expect(c.name.length).toBeGreaterThan(0)
      expect(['she', 'he', 'they']).toContain(c.pronoun)
      expect(['her', 'his', 'their']).toContain(c.possessive)
    }
  })

  it('names are unique', () => {
    const names = new Set(CHARACTERS.map(c => c.name))
    expect(names.size).toBe(CHARACTERS.length)
  })

  describe('resolveTemplate', () => {
    it('replaces {name}', () => {
      expect(resolveTemplate('{name} is great.', marcus)).toBe('Marcus is great.')
    })

    it('replaces {pronoun} (lowercase)', () => {
      expect(resolveTemplate('{pronoun} ran fast.', sonia)).toBe('she ran fast.')
    })

    it('replaces {Pronoun} (capitalized)', () => {
      expect(resolveTemplate('{Pronoun} ran fast.', sonia)).toBe('She ran fast.')
      expect(resolveTemplate('{Pronoun} ran fast.', yuki)).toBe('They ran fast.')
    })

    it('replaces {possessive}', () => {
      expect(resolveTemplate('{name} is saving {possessive} allowance.', marcus))
        .toBe('Marcus is saving his allowance.')
    })

    it('replaces {Possessive} (capitalized)', () => {
      expect(resolveTemplate('{Possessive} goal is $100.', yuki))
        .toBe('Their goal is $100.')
    })

    it('replaces multiple placeholders in one string', () => {
      expect(resolveTemplate("{name}'s family is on {possessive} trip.", sonia))
        .toBe("Sonia's family is on her trip.")
    })

    it('returns string unchanged when no placeholders present', () => {
      const text = 'The pizza shop is open.'
      expect(resolveTemplate(text, marcus)).toBe(text)
    })
  })

  describe('resolveSubject', () => {
    it('resolves {name} subject keeping conjugation', () => {
      const subject: SubjectEntry = { phrase: '{name}', conjugation: 'thirdPerson' }
      const result = resolveSubject(subject, marcus)
      expect(result.phrase).toBe('Marcus')
      expect(result.conjugation).toBe('thirdPerson')
    })

    it('resolves {Pronoun} with auto-conjugation for she/he', () => {
      const subject: SubjectEntry = { phrase: '{Pronoun}', conjugation: 'thirdPerson' }
      const result = resolveSubject(subject, sonia)
      expect(result.phrase).toBe('She')
      expect(result.conjugation).toBe('thirdPerson')
    })

    it('resolves {Pronoun} with auto-conjugation for they', () => {
      const subject: SubjectEntry = { phrase: '{Pronoun}', conjugation: 'thirdPerson' }
      const result = resolveSubject(subject, yuki)
      expect(result.phrase).toBe('They')
      expect(result.conjugation).toBe('base')
    })

    it('resolves compound subjects like "{name}\'s hair"', () => {
      const subject: SubjectEntry = { phrase: "{name}'s hair", conjugation: 'thirdPerson' }
      const result = resolveSubject(subject, marcus)
      expect(result.phrase).toBe("Marcus's hair")
      expect(result.conjugation).toBe('thirdPerson')
    })

    it('returns original object for literal subjects (no placeholders)', () => {
      const subject: SubjectEntry = { phrase: 'The plant', conjugation: 'thirdPerson' }
      const result = resolveSubject(subject, marcus)
      expect(result).toBe(subject) // exact same reference
    })
  })

  describe('resolveCharacter', () => {
    it('does not mutate the original frame', () => {
      const frame = FRAMES[0]
      const before = JSON.stringify(frame)
      resolveCharacter(frame, marcus)
      expect(JSON.stringify(frame)).toBe(before)
    })

    it('resolves setupPhrases', () => {
      const frame = FRAMES.find(f => f.id === 'slices-dollars-cost:pizza-shop')!
      const resolved = resolveCharacter(frame, marcus)
      expect(resolved.setupPhrases).toContain('Marcus is ordering pizza.')
    })

    it('resolves subjects', () => {
      const frame = FRAMES.find(f => f.id === 'slices-dollars-cost:pizza-shop')!
      const resolved = resolveCharacter(frame, marcus)
      const nameSubject = resolved.subjects.find(s => s.phrase === 'Marcus')
      expect(nameSubject).toBeDefined()
      expect(nameSubject!.conjugation).toBe('thirdPerson')

      const pronounSubject = resolved.subjects.find(s => s.phrase === 'He')
      expect(pronounSubject).toBeDefined()
      expect(pronounSubject!.conjugation).toBe('thirdPerson')
    })

    it('auto-sets "they" conjugation to base', () => {
      const frame = FRAMES.find(f => f.id === 'slices-dollars-cost:pizza-shop')!
      const resolved = resolveCharacter(frame, yuki)
      const pronounSubject = resolved.subjects.find(s => s.phrase === 'They')
      expect(pronounSubject).toBeDefined()
      expect(pronounSubject!.conjugation).toBe('base')
    })

    it('resolves solveForXQuestions', () => {
      const frame = FRAMES.find(f => f.id === 'weeks-dollars-save:savings')!
      const resolved = resolveCharacter(frame, marcus)
      expect(resolved.solveForXQuestions).toContain('How many weeks until Marcus has enough money?')
    })

    it('preserves literal subjects', () => {
      const frame = FRAMES.find(f => f.id === 'slices-dollars-cost:pizza-shop')!
      const resolved = resolveCharacter(frame, marcus)
      const literal = resolved.subjects.find(s => s.phrase === 'A customer')
      expect(literal).toBeDefined()
    })

    it('no {name}/{pronoun}/{possessive} leaks in any resolved frame', () => {
      for (const frame of FRAMES) {
        for (const char of CHARACTERS) {
          const resolved = resolveCharacter(frame, char)
          for (const phrase of resolved.setupPhrases) {
            expect(phrase).not.toMatch(/\{name\}|\{pronoun\}|\{Pronoun\}|\{possessive\}|\{Possessive\}/)
          }
          for (const s of resolved.subjects) {
            expect(s.phrase).not.toMatch(/\{name\}|\{pronoun\}|\{Pronoun\}|\{possessive\}|\{Possessive\}/)
          }
          if (resolved.solveForXQuestions) {
            for (const q of resolved.solveForXQuestions) {
              expect(q).not.toMatch(/\{name\}|\{pronoun\}|\{Pronoun\}|\{possessive\}|\{Possessive\}/)
            }
          }
        }
      }
    })
  })
})
