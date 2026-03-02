import { describe, it, expect } from 'vitest'
import { MACRO_REGISTRY, wouldViolateDistinctness } from '../engine/macros'
import { PROP_REGISTRY } from '../propositions/registry'

describe('wouldViolateDistinctness', () => {
  describe('I.1 — equilateral triangle: inputs [A, B] must be distinct', () => {
    const pairs = MACRO_REGISTRY[1].distinctInputPairs

    it('rejects same point for both endpoints', () => {
      expect(wouldViolateDistinctness(pairs, ['pt-A'], 'pt-A')).toBe(true)
    })

    it('accepts distinct points', () => {
      expect(wouldViolateDistinctness(pairs, ['pt-A'], 'pt-B')).toBe(false)
    })

    it('accepts first point freely (no constraints yet)', () => {
      expect(wouldViolateDistinctness(pairs, [], 'pt-A')).toBe(false)
    })
  })

  describe('I.2 — transfer distance: all 3 inputs must be distinct', () => {
    const pairs = MACRO_REGISTRY[2].distinctInputPairs

    it('accepts first point freely', () => {
      expect(wouldViolateDistinctness(pairs, [], 'pt-A')).toBe(false)
    })

    it('rejects second point same as first', () => {
      expect(wouldViolateDistinctness(pairs, ['pt-A'], 'pt-A')).toBe(true)
    })

    it('accepts distinct second point', () => {
      expect(wouldViolateDistinctness(pairs, ['pt-A'], 'pt-B')).toBe(false)
    })

    it('rejects third point same as first', () => {
      expect(wouldViolateDistinctness(pairs, ['pt-A', 'pt-B'], 'pt-A')).toBe(true)
    })

    it('rejects third point same as second', () => {
      expect(wouldViolateDistinctness(pairs, ['pt-A', 'pt-B'], 'pt-B')).toBe(true)
    })

    it('accepts distinct third point', () => {
      expect(wouldViolateDistinctness(pairs, ['pt-A', 'pt-B'], 'pt-C')).toBe(false)
    })
  })

  describe('I.3 — cut off equal: each segment distinct, but segments can share endpoints', () => {
    const pairs = MACRO_REGISTRY[3].distinctInputPairs

    it('rejects end-of-greater same as start-of-greater (index 1 = index 0)', () => {
      expect(wouldViolateDistinctness(pairs, ['pt-A'], 'pt-A')).toBe(true)
    })

    it('accepts distinct end-of-greater', () => {
      expect(wouldViolateDistinctness(pairs, ['pt-A'], 'pt-E')).toBe(false)
    })

    it('allows start-of-less to repeat start-of-greater (Prop I.5: [A, E, A, F])', () => {
      expect(wouldViolateDistinctness(pairs, ['pt-A', 'pt-E'], 'pt-A')).toBe(false)
    })

    it('allows start-of-less to repeat end-of-greater', () => {
      expect(wouldViolateDistinctness(pairs, ['pt-A', 'pt-E'], 'pt-E')).toBe(false)
    })

    it('rejects end-of-less same as start-of-less (index 3 = index 2)', () => {
      expect(wouldViolateDistinctness(pairs, ['pt-A', 'pt-E', 'pt-A'], 'pt-A')).toBe(true)
    })

    it('accepts distinct end-of-less', () => {
      expect(wouldViolateDistinctness(pairs, ['pt-A', 'pt-E', 'pt-A'], 'pt-F')).toBe(false)
    })

    it('Prop I.5 full sequence: [A, E, A, F] — all steps accepted', () => {
      expect(wouldViolateDistinctness(pairs, [], 'pt-A')).toBe(false)
      expect(wouldViolateDistinctness(pairs, ['pt-A'], 'pt-E')).toBe(false)
      expect(wouldViolateDistinctness(pairs, ['pt-A', 'pt-E'], 'pt-A')).toBe(false)
      expect(wouldViolateDistinctness(pairs, ['pt-A', 'pt-E', 'pt-A'], 'pt-F')).toBe(false)
    })

    it('Prop I.6 full sequence: [B, A, A, C] — all steps accepted', () => {
      expect(wouldViolateDistinctness(pairs, [], 'pt-B')).toBe(false)
      expect(wouldViolateDistinctness(pairs, ['pt-B'], 'pt-A')).toBe(false)
      expect(wouldViolateDistinctness(pairs, ['pt-B', 'pt-A'], 'pt-A')).toBe(false)
      expect(wouldViolateDistinctness(pairs, ['pt-B', 'pt-A', 'pt-A'], 'pt-C')).toBe(false)
    })
  })

  describe('proposition macro steps pass distinctness checks', () => {
    // Collect every macro step from every proposition
    const macroSteps: {
      propId: number
      stepIndex: number
      macroPropId: number
      inputPointIds: string[]
    }[] = []
    for (const [propIdStr, propDef] of Object.entries(PROP_REGISTRY)) {
      for (let i = 0; i < propDef.steps.length; i++) {
        const step = propDef.steps[i]
        if (step.expected.type === 'macro') {
          macroSteps.push({
            propId: Number(propIdStr),
            stepIndex: i,
            macroPropId: step.expected.propId,
            inputPointIds: step.expected.inputPointIds,
          })
        }
      }
    }

    it.each(
      macroSteps
    )('Prop I.$propId step $stepIndex — I.$macroPropId macro with $inputPointIds', ({
      macroPropId,
      inputPointIds,
    }) => {
      const macroDef = MACRO_REGISTRY[macroPropId]
      expect(macroDef, `Macro I.${macroPropId} not in registry`).toBeDefined()

      // Simulate selecting each point in sequence — none should be rejected
      for (let i = 0; i < inputPointIds.length; i++) {
        const selectedSoFar = inputPointIds.slice(0, i)
        const candidate = inputPointIds[i]
        const violates = wouldViolateDistinctness(
          macroDef.distinctInputPairs,
          selectedSoFar,
          candidate
        )
        expect(
          violates,
          `Selection ${i} (${candidate}) after [${selectedSoFar}] was rejected by I.${macroPropId} distinctInputPairs`
        ).toBe(false)
      }
    })
  })

  describe('registry completeness', () => {
    it('every macro in the registry has distinctInputPairs defined', () => {
      for (const [propId, macro] of Object.entries(MACRO_REGISTRY)) {
        expect(
          macro.distinctInputPairs,
          `Macro I.${propId} missing distinctInputPairs`
        ).toBeDefined()
        expect(Array.isArray(macro.distinctInputPairs)).toBe(true)
      }
    })

    it('all pair indices are within inputCount bounds', () => {
      for (const [propId, macro] of Object.entries(MACRO_REGISTRY)) {
        for (const [i, j] of macro.distinctInputPairs) {
          expect(i, `Macro I.${propId} pair index ${i} out of bounds`).toBeLessThan(
            macro.inputCount
          )
          expect(j, `Macro I.${propId} pair index ${j} out of bounds`).toBeLessThan(
            macro.inputCount
          )
          expect(i, `Macro I.${propId} pair [${i},${j}] should have i < j`).toBeLessThan(j)
        }
      }
    })
  })
})
