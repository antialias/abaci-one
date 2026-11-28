/**
 * `PRACTICE_TYPES` is a view over arithmetic's presentations (practice-kinds
 * K3, R7): the ids and order are the presentations', the copy is what these
 * screens showed before K3.
 */

import { describe, expect, it } from 'vitest'
import { arithmeticPresentations } from '@/lib/curriculum/parts/arithmetic/presentations'
import {
  getPracticeType,
  isValidPracticeTypeId,
  PRACTICE_TYPE_IDS,
  PRACTICE_TYPES,
} from '../practiceTypes'

describe('PRACTICE_TYPES', () => {
  it("lists arithmetic's presentations, in their order, every one with copy", () => {
    expect(PRACTICE_TYPE_IDS).toEqual([...arithmeticPresentations.keys()])
  })

  it('keeps the copy the screens showed before K3', () => {
    expect(PRACTICE_TYPES).toEqual([
      { id: 'abacus', label: 'Use Abacus', description: 'Physical abacus practice', icon: '🧮' },
      {
        id: 'visualization',
        label: 'Visualize',
        description: 'Mental math by visualizing beads',
        icon: '🧠',
      },
      {
        id: 'linear',
        label: 'Linear',
        description: 'Mental math with number sentences',
        icon: '📝',
      },
    ])
  })

  it('validates ids, prototype keys and unknown presentations included', () => {
    expect(isValidPracticeTypeId('linear')).toBe(true)
    expect(isValidPracticeTypeId('flash_anzan')).toBe(false)
    expect(isValidPracticeTypeId('toString')).toBe(false)
    expect(getPracticeType('visualization').label).toBe('Visualize')
  })
})
