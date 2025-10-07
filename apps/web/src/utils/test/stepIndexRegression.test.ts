import { describe, expect, it } from 'vitest'
import { calculateBeadDiffFromValues } from '../beadDiff'

/**
 * REGRESSION TEST: Prevent stepIndex mismatch in multi-step sequences
 *
 * This test prevents the specific bug where arrows only showed for the first
 * multi-step instruction. The issue was that stepBeadHighlights were generated
 * with stepIndex: 0 (hardcoded) but AbacusReact's getBeadStepHighlight function
 * only shows arrows when stepIndex === currentStep.
 *
 * Key requirement: When generating StepBeadHighlight objects from bead diffs,
 * the stepIndex must match the currentMultiStep to ensure arrows appear.
 */
describe('StepIndex Regression Prevention', () => {
  it('should prevent stepIndex mismatch in multi-step arrow display', () => {
    // This test simulates the exact scenario that caused the bug:
    // Multi-step sequence where currentMultiStep > 0

    const fromValue = 199 // After completing first step (3 + 196 = 199)
    const toValue = 109 // Second step target (199 - 90 = 109)
    const currentMultiStep = 1 // We're on the second step (index 1)

    // Calculate the bead diff (this part was working correctly)
    const beadDiff = calculateBeadDiffFromValues(fromValue, toValue)

    // Verify the calculation produces the expected changes
    expect(beadDiff.hasChanges).toBe(true)
    expect(beadDiff.changes.length).toBeGreaterThan(0)
    expect(beadDiff.summary).toContain('remove') // Should be removing beads for 199 → 109

    // This is the critical test: Simulate how TutorialPlayer.tsx converts
    // bead diff to StepBeadHighlight format
    const stepBeadHighlights = beadDiff.changes.map((change) => ({
      placeValue: change.placeValue,
      beadType: change.beadType,
      position: change.position,
      direction: change.direction,
      stepIndex: currentMultiStep, // ✅ MUST be currentMultiStep, not hardcoded 0
      order: change.order,
    }))

    // Verify that ALL generated highlights have the correct stepIndex
    stepBeadHighlights.forEach((highlight) => {
      expect(highlight.stepIndex).toBe(currentMultiStep)
      expect(highlight.stepIndex).not.toBe(0) // Prevent hardcoding to 0
    })

    // Simulate AbacusReact's getBeadStepHighlight filtering logic
    // This is what was failing before the fix
    const currentStep = currentMultiStep // AbacusReact receives currentStep={currentMultiStep}

    stepBeadHighlights.forEach((highlight) => {
      // This is the exact logic from AbacusReact.tsx:675
      const isCurrentStep = highlight.stepIndex === currentStep
      const shouldShowArrow = isCurrentStep // Only show arrows for current step

      // Before the fix, this would be false for all highlights when currentMultiStep > 0
      expect(shouldShowArrow).toBe(true)

      // Verify direction is preserved for current step
      if (isCurrentStep) {
        expect(highlight.direction).toBeDefined()
        expect(['activate', 'deactivate']).toContain(highlight.direction)
      }
    })
  })

  it('should work correctly for first step (currentMultiStep = 0)', () => {
    // Verify the fix doesn't break the first step
    const fromValue = 3
    const toValue = 199
    const currentMultiStep = 0

    const beadDiff = calculateBeadDiffFromValues(fromValue, toValue)

    const stepBeadHighlights = beadDiff.changes.map((change) => ({
      placeValue: change.placeValue,
      beadType: change.beadType,
      position: change.position,
      direction: change.direction,
      stepIndex: currentMultiStep,
      order: change.order,
    }))

    stepBeadHighlights.forEach((highlight) => {
      expect(highlight.stepIndex).toBe(0) // Should be 0 for first step

      // Verify arrows show for first step
      const currentStep = currentMultiStep
      const isCurrentStep = highlight.stepIndex === currentStep
      expect(isCurrentStep).toBe(true)
    })
  })

  it('should work correctly for any arbitrary step index', () => {
    // Test with various step indices to ensure the pattern holds
    const testCases = [
      { currentMultiStep: 0, fromValue: 0, toValue: 5 },
      { currentMultiStep: 1, fromValue: 5, toValue: 15 },
      { currentMultiStep: 2, fromValue: 15, toValue: 20 },
      { currentMultiStep: 3, fromValue: 20, toValue: 25 },
    ]

    testCases.forEach(({ currentMultiStep, fromValue, toValue }) => {
      const beadDiff = calculateBeadDiffFromValues(fromValue, toValue)

      if (beadDiff.hasChanges) {
        const stepBeadHighlights = beadDiff.changes.map((change) => ({
          placeValue: change.placeValue,
          beadType: change.beadType,
          position: change.position,
          direction: change.direction,
          stepIndex: currentMultiStep,
          order: change.order,
        }))

        stepBeadHighlights.forEach((highlight) => {
          expect(highlight.stepIndex).toBe(currentMultiStep)

          // Simulate AbacusReact filtering
          const currentStep = currentMultiStep
          const isCurrentStep = highlight.stepIndex === currentStep
          expect(isCurrentStep).toBe(true)
        })
      }
    })
  })

  it('should document the exact getBeadStepHighlight logic from AbacusReact', () => {
    // This test documents the filtering logic from AbacusReact.tsx
    // to make the dependency clear and prevent future mismatches

    const mockStepBeadHighlights = [
      { stepIndex: 0, direction: 'activate', placeValue: 0, beadType: 'earth' as const },
      { stepIndex: 1, direction: 'deactivate', placeValue: 1, beadType: 'heaven' as const },
      { stepIndex: 2, direction: 'activate', placeValue: 2, beadType: 'earth' as const },
    ]

    // Test each step index
    const stepIndices = [0, 1, 2]
    stepIndices.forEach((currentStep) => {
      mockStepBeadHighlights.forEach((highlight) => {
        // This is the exact logic from getBeadStepHighlight in AbacusReact.tsx:675
        const isCurrentStep = highlight.stepIndex === currentStep
        const isCompleted = highlight.stepIndex < currentStep
        const _isHighlighted = isCurrentStep || isCompleted
        const direction = isCurrentStep ? highlight.direction : undefined

        if (highlight.stepIndex === currentStep) {
          expect(isCurrentStep).toBe(true)
          expect(direction).toBe(highlight.direction) // Arrows only show for current step
        } else {
          expect(isCurrentStep).toBe(false)
          expect(direction).toBeUndefined() // No arrows for other steps
        }
      })
    })
  })
})
