import { describe, it, expect } from 'vitest'
import { getProp1Tutorial } from '../propositions/prop1Tutorial'
import { getProp2Tutorial } from '../propositions/prop2Tutorial'
import { getProp3Tutorial } from '../propositions/prop3Tutorial'
import { PROP_1 } from '../propositions/prop1'
import { PROP_2 } from '../propositions/prop2'
import { PROP_3 } from '../propositions/prop3'
import type { AdvanceOn } from '../types'
import { needsExtendedSegments } from '../types'

function isValidAdvanceOn(value: AdvanceOn | null): boolean {
  if (value === null) return true
  if (typeof value !== 'object') return false
  if (value.kind === 'compass-phase') {
    return value.phase === 'center-set' || value.phase === 'radius-set'
  }
  if (value.kind === 'macro-select') {
    return typeof value.index === 'number' && value.index >= 0
  }
  return false
}

describe('needsExtendedSegments', () => {
  it('returns false for Prop I.1 (no beyondId in any step)', () => {
    expect(needsExtendedSegments(PROP_1)).toBe(false)
  })

  it('returns true for Prop I.2 (steps use beyondId)', () => {
    expect(needsExtendedSegments(PROP_2)).toBe(true)
  })

  it('returns false for Prop I.3 (no beyondId in any step)', () => {
    expect(needsExtendedSegments(PROP_3)).toBe(false)
  })
})

describe('tutorial definitions', () => {
  for (const isTouch of [true, false]) {
    const label = isTouch ? 'touch' : 'mouse'

    describe(`Prop I.1 (${label})`, () => {
      const subSteps = getProp1Tutorial(isTouch)

      it('has one sub-step array per proposition step', () => {
        expect(subSteps).toHaveLength(PROP_1.steps.length)
      })

      it('every sub-step array is non-empty', () => {
        for (let i = 0; i < subSteps.length; i++) {
          expect(subSteps[i].length).toBeGreaterThan(0)
        }
      })

      it('every advanceOn is a valid AdvanceOn or null', () => {
        for (const stepSubs of subSteps) {
          for (const sub of stepSubs) {
            expect(isValidAdvanceOn(sub.advanceOn)).toBe(true)
          }
        }
      })

      it('last sub-step in each group has advanceOn: null (terminal)', () => {
        for (const stepSubs of subSteps) {
          const last = stepSubs[stepSubs.length - 1]
          expect(last.advanceOn).toBeNull()
        }
      })

      it('non-terminal sub-steps have non-null advanceOn', () => {
        for (const stepSubs of subSteps) {
          for (let i = 0; i < stepSubs.length - 1; i++) {
            expect(stepSubs[i].advanceOn).not.toBeNull()
          }
        }
      })
    })

    describe(`Prop I.2 (${label})`, () => {
      const subSteps = getProp2Tutorial(isTouch)

      it('has one sub-step array per proposition step', () => {
        expect(subSteps).toHaveLength(PROP_2.steps.length)
      })

      it('every sub-step array is non-empty', () => {
        for (let i = 0; i < subSteps.length; i++) {
          expect(subSteps[i].length).toBeGreaterThan(0)
        }
      })

      it('every advanceOn is a valid AdvanceOn or null', () => {
        for (const stepSubs of subSteps) {
          for (const sub of stepSubs) {
            expect(isValidAdvanceOn(sub.advanceOn)).toBe(true)
          }
        }
      })

      it('last sub-step in each group has advanceOn: null (terminal)', () => {
        for (const stepSubs of subSteps) {
          const last = stepSubs[stepSubs.length - 1]
          expect(last.advanceOn).toBeNull()
        }
      })

      it('non-terminal sub-steps have non-null advanceOn', () => {
        for (const stepSubs of subSteps) {
          for (let i = 0; i < stepSubs.length - 1; i++) {
            expect(stepSubs[i].advanceOn).not.toBeNull()
          }
        }
      })

      it('macro step has macro-select advanceOn for first sub-step', () => {
        // Step 1 is the I.1 macro — first sub-step should advance on macro-select
        const macroSubs = subSteps[1]
        expect(macroSubs.length).toBeGreaterThanOrEqual(2)
        expect(macroSubs[0].advanceOn).toEqual({ kind: 'macro-select', index: 0 })
      })
    })

    describe(`Prop I.3 (${label})`, () => {
      const subSteps = getProp3Tutorial(isTouch)

      it('has one sub-step array per proposition step', () => {
        expect(subSteps).toHaveLength(PROP_3.steps.length)
      })

      it('every sub-step array is non-empty', () => {
        for (let i = 0; i < subSteps.length; i++) {
          expect(subSteps[i].length).toBeGreaterThan(0)
        }
      })

      it('every advanceOn is a valid AdvanceOn or null', () => {
        for (const stepSubs of subSteps) {
          for (const sub of stepSubs) {
            expect(isValidAdvanceOn(sub.advanceOn)).toBe(true)
          }
        }
      })

      it('last sub-step in each group has advanceOn: null (terminal)', () => {
        for (const stepSubs of subSteps) {
          const last = stepSubs[stepSubs.length - 1]
          expect(last.advanceOn).toBeNull()
        }
      })

      it('non-terminal sub-steps have non-null advanceOn', () => {
        for (const stepSubs of subSteps) {
          for (let i = 0; i < stepSubs.length - 1; i++) {
            expect(stepSubs[i].advanceOn).not.toBeNull()
          }
        }
      })

      it('macro step has macro-select advanceOn for first two sub-steps', () => {
        // Step 0 is the I.2 macro — first two sub-steps should advance on macro-select
        const macroSubs = subSteps[0]
        expect(macroSubs.length).toBeGreaterThanOrEqual(3)
        expect(macroSubs[0].advanceOn).toEqual({ kind: 'macro-select', index: 0 })
        expect(macroSubs[1].advanceOn).toEqual({ kind: 'macro-select', index: 1 })
      })
    })
  }
})
