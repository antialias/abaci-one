import { describe, it, expect } from 'vitest'

/**
 * Unit tests for celebration tooltip logic
 * These test the core business logic without rendering components
 */

describe('Celebration Tooltip Logic', () => {
  // Helper function that mimics the tooltip visibility logic from TutorialPlayer
  function shouldShowCelebrationTooltip(
    isStepCompleted: boolean,
    currentValue: number,
    targetValue: number,
    hasStepInstructions: boolean
  ) {
    const showCelebration = isStepCompleted && currentValue === targetValue
    const showInstructions = !showCelebration && hasStepInstructions
    return {
      showCelebration,
      showInstructions,
      visible: showCelebration || showInstructions
    }
  }

  describe('Celebration visibility logic', () => {
    it('should show celebration when step is completed and at target value', () => {
      const result = shouldShowCelebrationTooltip(
        true,  // isStepCompleted
        5,     // currentValue
        5,     // targetValue
        false  // hasStepInstructions
      )

      expect(result.showCelebration).toBe(true)
      expect(result.showInstructions).toBe(false)
      expect(result.visible).toBe(true)
    })

    it('should not show celebration when step completed but not at target', () => {
      const result = shouldShowCelebrationTooltip(
        true,  // isStepCompleted
        6,     // currentValue (moved away from target)
        5,     // targetValue
        true   // hasStepInstructions
      )

      expect(result.showCelebration).toBe(false)
      expect(result.showInstructions).toBe(true)
      expect(result.visible).toBe(true)
    })

    it('should not show celebration when not completed even if at target', () => {
      const result = shouldShowCelebrationTooltip(
        false, // isStepCompleted
        5,     // currentValue
        5,     // targetValue
        true   // hasStepInstructions
      )

      expect(result.showCelebration).toBe(false)
      expect(result.showInstructions).toBe(true)
      expect(result.visible).toBe(true)
    })

    it('should show instructions when not completed and has instructions', () => {
      const result = shouldShowCelebrationTooltip(
        false, // isStepCompleted
        3,     // currentValue
        5,     // targetValue
        true   // hasStepInstructions
      )

      expect(result.showCelebration).toBe(false)
      expect(result.showInstructions).toBe(true)
      expect(result.visible).toBe(true)
    })

    it('should not show anything when not completed and no instructions', () => {
      const result = shouldShowCelebrationTooltip(
        false, // isStepCompleted
        3,     // currentValue
        5,     // targetValue
        false  // hasStepInstructions
      )

      expect(result.showCelebration).toBe(false)
      expect(result.showInstructions).toBe(false)
      expect(result.visible).toBe(false)
    })
  })

  describe('State transition scenarios', () => {
    it('should transition from instruction to celebration when reaching target', () => {
      // Initially showing instructions
      const initial = shouldShowCelebrationTooltip(false, 3, 5, true)
      expect(initial.showInstructions).toBe(true)
      expect(initial.showCelebration).toBe(false)

      // After completing and reaching target
      const completed = shouldShowCelebrationTooltip(true, 5, 5, true)
      expect(completed.showCelebration).toBe(true)
      expect(completed.showInstructions).toBe(false)
    })

    it('should transition from celebration to instructions when moving away', () => {
      // Initially celebrating
      const celebrating = shouldShowCelebrationTooltip(true, 5, 5, true)
      expect(celebrating.showCelebration).toBe(true)
      expect(celebrating.showInstructions).toBe(false)

      // After moving away from target
      const movedAway = shouldShowCelebrationTooltip(true, 6, 5, true)
      expect(movedAway.showCelebration).toBe(false)
      expect(movedAway.showInstructions).toBe(true)
    })

    it('should return to celebration when returning to target value', () => {
      // Start celebrating
      const initial = shouldShowCelebrationTooltip(true, 5, 5, true)
      expect(initial.showCelebration).toBe(true)

      // Move away
      const away = shouldShowCelebrationTooltip(true, 6, 5, true)
      expect(away.showCelebration).toBe(false)
      expect(away.showInstructions).toBe(true)

      // Return to target
      const returned = shouldShowCelebrationTooltip(true, 5, 5, true)
      expect(returned.showCelebration).toBe(true)
      expect(returned.showInstructions).toBe(false)
    })
  })

  describe('Edge cases', () => {
    it('should handle negative values correctly', () => {
      const result = shouldShowCelebrationTooltip(true, -3, -3, false)
      expect(result.showCelebration).toBe(true)
    })

    it('should handle zero values correctly', () => {
      const result = shouldShowCelebrationTooltip(true, 0, 0, false)
      expect(result.showCelebration).toBe(true)
    })

    it('should handle large values correctly', () => {
      const result = shouldShowCelebrationTooltip(true, 99999, 99999, false)
      expect(result.showCelebration).toBe(true)
    })

    it('should prioritize celebration over instructions', () => {
      // When both conditions could be true, celebration takes priority
      const result = shouldShowCelebrationTooltip(true, 5, 5, true)
      expect(result.showCelebration).toBe(true)
      expect(result.showInstructions).toBe(false)
    })
  })
})

/**
 * Tests for last moved bead tracking logic
 */
describe('Last Moved Bead Tracking', () => {
  interface StepBeadHighlight {
    placeValue: number
    beadType: 'earth' | 'heaven'
    position: number
    direction: string
  }

  // Helper function that mimics the bead selection logic
  function selectTooltipBead(
    showCelebration: boolean,
    showInstructions: boolean,
    currentStepBeads: StepBeadHighlight[] | null,
    lastMovedBead: StepBeadHighlight | null
  ): StepBeadHighlight | null {
    if (showCelebration) {
      // For celebration, use last moved bead or fallback
      if (lastMovedBead) {
        return lastMovedBead
      } else {
        // Fallback to ones place heaven bead
        return {
          placeValue: 0,
          beadType: 'heaven',
          position: 0,
          direction: 'none'
        }
      }
    } else if (showInstructions && currentStepBeads?.length) {
      // For instructions, use first bead with arrows
      return currentStepBeads.find(bead => bead.direction !== 'none') || null
    }

    return null
  }

  describe('Bead selection for celebration', () => {
    it('should use last moved bead when available', () => {
      const lastMoved: StepBeadHighlight = {
        placeValue: 2,
        beadType: 'earth',
        position: 1,
        direction: 'down'
      }

      const result = selectTooltipBead(true, false, null, lastMoved)
      expect(result).toEqual(lastMoved)
    })

    it('should use fallback when no last moved bead', () => {
      const result = selectTooltipBead(true, false, null, null)

      expect(result).toEqual({
        placeValue: 0,
        beadType: 'heaven',
        position: 0,
        direction: 'none'
      })
    })

    it('should use instruction bead when showing instructions', () => {
      const instructionBeads: StepBeadHighlight[] = [
        {
          placeValue: 1,
          beadType: 'earth',
          position: 0,
          direction: 'up'
        }
      ]

      const result = selectTooltipBead(false, true, instructionBeads, null)
      expect(result).toEqual(instructionBeads[0])
    })

    it('should return null when no conditions met', () => {
      const result = selectTooltipBead(false, false, null, null)
      expect(result).toBeNull()
    })
  })

  describe('Bead priority logic', () => {
    it('should prefer last moved bead over instruction bead for celebration', () => {
      const lastMoved: StepBeadHighlight = {
        placeValue: 3,
        beadType: 'heaven',
        position: 0,
        direction: 'up'
      }

      const instructionBeads: StepBeadHighlight[] = [
        {
          placeValue: 1,
          beadType: 'earth',
          position: 0,
          direction: 'down'
        }
      ]

      const result = selectTooltipBead(true, false, instructionBeads, lastMoved)
      expect(result).toEqual(lastMoved)
    })

    it('should use fallback only when no last moved bead available', () => {
      const instructionBeads: StepBeadHighlight[] = [
        {
          placeValue: 1,
          beadType: 'earth',
          position: 0,
          direction: 'down'
        }
      ]

      const result = selectTooltipBead(true, false, instructionBeads, null)

      // Should use fallback, not instruction bead
      expect(result?.placeValue).toBe(0)
      expect(result?.beadType).toBe('heaven')
    })
  })
})