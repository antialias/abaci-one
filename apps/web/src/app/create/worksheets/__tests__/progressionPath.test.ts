// Tests for progression path utilities

import { describe, expect, it } from 'vitest'
import {
  SINGLE_CARRY_PATH,
  configMatchesStep,
  findNearestStep,
  getSliderValueFromStep,
  getStepById,
  getStepFromSliderValue,
  type ProgressionStep,
} from '../progressionPath'

describe('progressionPath', () => {
  describe('SINGLE_CARRY_PATH', () => {
    it('should have 8 steps', () => {
      expect(SINGLE_CARRY_PATH).toHaveLength(8)
    })

    it('should have consecutive step numbers', () => {
      SINGLE_CARRY_PATH.forEach((step, index) => {
        expect(step.stepNumber).toBe(index)
      })
    })

    it('should have correct next/previous links', () => {
      // First step (basic-addition-1d)
      expect(SINGLE_CARRY_PATH[0].previousStepId).toBe(null)
      expect(SINGLE_CARRY_PATH[0].nextStepId).toBe('mixed-addition-1d')

      // Middle steps (mixed-addition-1d → single-carry-1d-full)
      expect(SINGLE_CARRY_PATH[1].previousStepId).toBe('basic-addition-1d')
      expect(SINGLE_CARRY_PATH[1].nextStepId).toBe('single-carry-1d-full')

      // Last step (single-carry-3d-minimal)
      expect(SINGLE_CARRY_PATH[7].previousStepId).toBe('single-carry-3d-full')
      expect(SINGLE_CARRY_PATH[7].nextStepId).toBe(null)
    })

    it('should demonstrate scaffolding cycling', () => {
      // Foundation steps: no ten-frames
      expect(SINGLE_CARRY_PATH[0].config.displayRules?.tenFrames).toBe('never')
      expect(SINGLE_CARRY_PATH[1].config.displayRules?.tenFrames).toBe('never')

      // 1-digit carry: full → minimal
      expect(SINGLE_CARRY_PATH[2].config.displayRules?.tenFrames).toBe('whenRegrouping')
      expect(SINGLE_CARRY_PATH[3].config.displayRules?.tenFrames).toBe('never')

      // 2-digit carry: full → minimal (ten-frames RETURN)
      expect(SINGLE_CARRY_PATH[4].config.displayRules?.tenFrames).toBe('whenRegrouping')
      expect(SINGLE_CARRY_PATH[5].config.displayRules?.tenFrames).toBe('never')

      // 3-digit carry: full → minimal (ten-frames RETURN AGAIN)
      expect(SINGLE_CARRY_PATH[6].config.displayRules?.tenFrames).toBe('whenRegrouping')
      expect(SINGLE_CARRY_PATH[7].config.displayRules?.tenFrames).toBe('never')
    })

    it('should have increasing digit complexity', () => {
      // Foundation 1-digit (steps 0-1)
      expect(SINGLE_CARRY_PATH[0].config.digitRange?.min).toBe(1)
      expect(SINGLE_CARRY_PATH[0].config.digitRange?.max).toBe(1)
      expect(SINGLE_CARRY_PATH[1].config.digitRange?.min).toBe(1)

      // 1-digit carry (steps 2-3)
      expect(SINGLE_CARRY_PATH[2].config.digitRange?.min).toBe(1)
      expect(SINGLE_CARRY_PATH[2].config.digitRange?.max).toBe(1)
      expect(SINGLE_CARRY_PATH[3].config.digitRange?.min).toBe(1)

      // 2-digit carry (steps 4-5)
      expect(SINGLE_CARRY_PATH[4].config.digitRange?.min).toBe(2)
      expect(SINGLE_CARRY_PATH[4].config.digitRange?.max).toBe(2)
      expect(SINGLE_CARRY_PATH[5].config.digitRange?.min).toBe(2)

      // 3-digit carry (steps 6-7)
      expect(SINGLE_CARRY_PATH[6].config.digitRange?.min).toBe(3)
      expect(SINGLE_CARRY_PATH[6].config.digitRange?.max).toBe(3)
      expect(SINGLE_CARRY_PATH[7].config.digitRange?.min).toBe(3)
    })

    it('should have consistent regrouping config', () => {
      // Foundation steps have different regrouping
      expect(SINGLE_CARRY_PATH[0].config.pAnyStart).toBe(0) // No regrouping
      expect(SINGLE_CARRY_PATH[0].config.pAllStart).toBe(0)
      expect(SINGLE_CARRY_PATH[1].config.pAnyStart).toBe(0.5) // 50% regrouping
      expect(SINGLE_CARRY_PATH[1].config.pAllStart).toBe(0)

      // Carry steps have 100% regrouping, ones place only
      for (let i = 2; i < SINGLE_CARRY_PATH.length; i++) {
        expect(SINGLE_CARRY_PATH[i].config.pAnyStart).toBe(1.0)
        expect(SINGLE_CARRY_PATH[i].config.pAllStart).toBe(0)
      }
    })

    it('should all be addition operator', () => {
      SINGLE_CARRY_PATH.forEach((step) => {
        expect(step.config.operator).toBe('addition')
      })
    })

    it('should all be addition techniques', () => {
      // Foundation steps use basic-addition technique
      expect(SINGLE_CARRY_PATH[0].technique).toBe('basic-addition')
      expect(SINGLE_CARRY_PATH[1].technique).toBe('basic-addition')

      // Carry steps use single-carry technique
      for (let i = 2; i < SINGLE_CARRY_PATH.length; i++) {
        expect(SINGLE_CARRY_PATH[i].technique).toBe('single-carry')
      }
    })

    it('should have interpolate disabled', () => {
      // Mastery mode = no progressive difficulty
      SINGLE_CARRY_PATH.forEach((step) => {
        expect(step.config.interpolate).toBe(false)
      })
    })
  })

  describe('getStepFromSliderValue', () => {
    it('should return first step for value 0', () => {
      const step = getStepFromSliderValue(0, SINGLE_CARRY_PATH)
      expect(step.stepNumber).toBe(0)
      expect(step.id).toBe('basic-addition-1d')
    })

    it('should return last step for value 100', () => {
      const step = getStepFromSliderValue(100, SINGLE_CARRY_PATH)
      expect(step.stepNumber).toBe(7)
      expect(step.id).toBe('single-carry-3d-minimal')
    })

    it('should return middle steps for middle values', () => {
      // 8 steps → positions at 0, 14.3, 28.6, 42.9, 57.1, 71.4, 85.7, 100
      // Value 14: (14/100) * 7 = 0.98 → rounds to 1
      const step1 = getStepFromSliderValue(14, SINGLE_CARRY_PATH)
      expect(step1.stepNumber).toBe(1)

      // Value 29: (29/100) * 7 = 2.03 → rounds to 2
      const step2 = getStepFromSliderValue(29, SINGLE_CARRY_PATH)
      expect(step2.stepNumber).toBe(2)

      // Value 43: (43/100) * 7 = 3.01 → rounds to 3
      const step3 = getStepFromSliderValue(43, SINGLE_CARRY_PATH)
      expect(step3.stepNumber).toBe(3)
    })

    it('should round to nearest step', () => {
      // 8 steps → positions at 0, 14.3, 28.6, 42.9, 57.1, 71.4, 85.7, 100
      // Value 21: (21/100) * 7 = 1.47 → rounds to 1
      const step = getStepFromSliderValue(21, SINGLE_CARRY_PATH)
      expect(step.stepNumber).toBe(1)

      // Value 7: (7/100) * 7 = 0.49 → rounds to 0
      const step2 = getStepFromSliderValue(7, SINGLE_CARRY_PATH)
      expect(step2.stepNumber).toBe(0)

      // Value 50: (50/100) * 7 = 3.5 → rounds to 4
      const step3 = getStepFromSliderValue(50, SINGLE_CARRY_PATH)
      expect(step3.stepNumber).toBe(4)
    })

    it('should clamp values below 0 to first step', () => {
      const step = getStepFromSliderValue(-10, SINGLE_CARRY_PATH)
      expect(step.stepNumber).toBe(0)
    })

    it('should clamp values above 100 to last step', () => {
      const step = getStepFromSliderValue(150, SINGLE_CARRY_PATH)
      expect(step.stepNumber).toBe(7)
    })
  })

  describe('getSliderValueFromStep', () => {
    it('should return 0 for first step', () => {
      const value = getSliderValueFromStep(0, SINGLE_CARRY_PATH.length)
      expect(value).toBe(0)
    })

    it('should return 100 for last step', () => {
      const value = getSliderValueFromStep(7, SINGLE_CARRY_PATH.length)
      expect(value).toBe(100)
    })

    it('should return evenly spaced values for middle steps', () => {
      // 8 steps → 0, 100/7, 200/7, 300/7, 400/7, 500/7, 600/7, 100
      expect(getSliderValueFromStep(0, 8)).toBe(0)
      expect(getSliderValueFromStep(7, 8)).toBe(100)
      // Middle steps should be evenly spaced
      for (let i = 0; i < 8; i++) {
        expect(getSliderValueFromStep(i, 8)).toBeCloseTo((i / 7) * 100, 10)
      }
    })

    it('should handle single-step path', () => {
      const value = getSliderValueFromStep(0, 1)
      expect(value).toBe(0)
    })

    it('should be inverse of getStepFromSliderValue', () => {
      // Round-trip should preserve step number
      for (let stepNum = 0; stepNum < SINGLE_CARRY_PATH.length; stepNum++) {
        const sliderValue = getSliderValueFromStep(stepNum, SINGLE_CARRY_PATH.length)
        const step = getStepFromSliderValue(sliderValue, SINGLE_CARRY_PATH)
        expect(step.stepNumber).toBe(stepNum)
      }
    })
  })

  describe('findNearestStep', () => {
    it('should find exact match for step config', () => {
      const step4Config = SINGLE_CARRY_PATH[4].config
      const nearest = findNearestStep(step4Config, SINGLE_CARRY_PATH)
      expect(nearest.stepNumber).toBe(4)
      expect(nearest.id).toBe('single-carry-2d-full')
    })

    it('should prioritize digit range matching', () => {
      // Config with 3-digit but wrong scaffolding
      // Use a complete displayRules object from an existing step
      const baseDisplayRules = SINGLE_CARRY_PATH[0].config.displayRules!
      const config = {
        digitRange: { min: 3, max: 3 },
        operator: 'addition' as const,
        pAnyStart: 1.0,
        pAllStart: 0,
        displayRules: {
          ...baseDisplayRules,
          tenFrames: 'always' as const, // Wrong, but digit range matches
        },
      }

      const nearest = findNearestStep(config, SINGLE_CARRY_PATH)
      // Should match step 4 or 5 (both 3-digit)
      expect(nearest.config.digitRange?.min).toBe(3)
    })

    it('should fall back to best scoring step if no good match', () => {
      const config = {
        digitRange: { min: 5, max: 5 }, // No 5-digit steps
        operator: 'subtraction' as const, // Wrong operator
        pAnyStart: 0.5, // Matches mixed-addition-1d (step 1)
        pAllStart: 0.5,
      }

      const nearest = findNearestStep(config, SINGLE_CARRY_PATH)
      expect(nearest).toBeDefined() // Should still return something
      // Step 1 (mixed-addition-1d) wins because pAnyStart=0.5 matches
      expect(nearest.stepNumber).toBe(1)
    })

    it('should match regrouping config when digit range matches', () => {
      // Two steps with same digit range, different scaffolding
      const baseDisplayRules = SINGLE_CARRY_PATH[4].config.displayRules!

      const config1 = {
        digitRange: { min: 2, max: 2 },
        operator: 'addition' as const,
        pAnyStart: 1.0,
        pAllStart: 0,
        displayRules: {
          ...baseDisplayRules,
          tenFrames: 'whenRegrouping' as const,
        },
      }

      const nearest1 = findNearestStep(config1, SINGLE_CARRY_PATH)
      expect(nearest1.id).toBe('single-carry-2d-full') // Step 4

      const config2 = {
        digitRange: { min: 2, max: 2 },
        operator: 'addition' as const,
        pAnyStart: 1.0,
        pAllStart: 0,
        displayRules: {
          ...baseDisplayRules,
          tenFrames: 'never' as const,
        },
      }

      const nearest2 = findNearestStep(config2, SINGLE_CARRY_PATH)
      expect(nearest2.id).toBe('single-carry-2d-minimal') // Step 5
    })
  })

  describe('configMatchesStep', () => {
    it('should return true for exact match', () => {
      const step = SINGLE_CARRY_PATH[2]
      const matches = configMatchesStep(step.config, step)
      expect(matches).toBe(true)
    })

    it('should return false if digit range differs', () => {
      const step = SINGLE_CARRY_PATH[2]
      const config = {
        ...step.config,
        digitRange: { min: 3, max: 3 }, // Different
      }
      const matches = configMatchesStep(config, step)
      expect(matches).toBe(false)
    })

    it('should return false if regrouping config differs', () => {
      const step = SINGLE_CARRY_PATH[2]
      const config = {
        ...step.config,
        pAnyStart: 0.5, // Different
      }
      const matches = configMatchesStep(config, step)
      expect(matches).toBe(false)
    })

    it('should return false if scaffolding differs', () => {
      const step = SINGLE_CARRY_PATH[2]
      const config = {
        ...step.config,
        displayRules: step.config.displayRules
          ? {
              ...step.config.displayRules,
              tenFrames: 'never' as const, // Different
            }
          : undefined,
      }
      const matches = configMatchesStep(config, step)
      expect(matches).toBe(false)
    })

    it('should return false if operator differs', () => {
      const step = SINGLE_CARRY_PATH[2]
      const config = {
        ...step.config,
        operator: 'subtraction' as const, // Different
      }
      const matches = configMatchesStep(config, step)
      expect(matches).toBe(false)
    })
  })

  describe('getStepById', () => {
    it('should find step by ID', () => {
      const step = getStepById('single-carry-2d-full', SINGLE_CARRY_PATH)
      expect(step).toBeDefined()
      expect(step?.stepNumber).toBe(4)
      expect(step?.config.digitRange?.min).toBe(2)
    })

    it('should return undefined for non-existent ID', () => {
      const step = getStepById('does-not-exist', SINGLE_CARRY_PATH)
      expect(step).toBeUndefined()
    })

    it('should find first step', () => {
      const step = getStepById('basic-addition-1d', SINGLE_CARRY_PATH)
      expect(step).toBeDefined()
      expect(step?.stepNumber).toBe(0)
    })

    it('should find last step', () => {
      const step = getStepById('single-carry-3d-minimal', SINGLE_CARRY_PATH)
      expect(step).toBeDefined()
      expect(step?.stepNumber).toBe(7)
    })
  })
})
