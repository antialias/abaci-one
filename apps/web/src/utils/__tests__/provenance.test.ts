import { generateUnifiedInstructionSequence } from '../unifiedStepGenerator'

describe('Provenance System', () => {
  describe('3475 + 25 = 3500 example', () => {
    let result: ReturnType<typeof generateUnifiedInstructionSequence>

    beforeAll(() => {
      result = generateUnifiedInstructionSequence(3475, 3500)
    })

    it('should generate steps with provenance data', () => {
      expect(result.steps.length).toBeGreaterThan(0)

      // Log for debugging
      console.log('Generated steps:')
      result.steps.forEach((step, index) => {
        console.log(`Step ${index}: ${step.mathematicalTerm}`)
        console.log(`  - segmentId: ${step.segmentId}`)
        if (step.provenance) {
          console.log(`  - rhs: ${step.provenance.rhs}`)
          console.log(`  - rhsDigit: ${step.provenance.rhsDigit}`)
          console.log(`  - rhsPlace: ${step.provenance.rhsPlace}`)
          console.log(`  - rhsPlaceName: ${step.provenance.rhsPlaceName}`)
          console.log(`  - rhsValue: ${step.provenance.rhsValue}`)
          if (step.provenance.groupId) {
            console.log(`  - groupId: ${step.provenance.groupId}`)
          }
        } else {
          console.log('  - No provenance data')
        }
      })

      // Log segments to see the rules
      console.log('\nGenerated segments:')
      result.segments.forEach((segment, index) => {
        console.log(`Segment ${index}: place=${segment.place}, digit=${segment.digit}`)
        console.log(`  - rule: ${segment.plan[0]?.rule}`)
        console.log(`  - stepIndices: [${segment.stepIndices.join(', ')}]`)
      })
    })

    it('should have provenance for the "20" term (tens digit)', () => {
      const twentyStep = result.steps.find((step) => step.mathematicalTerm === '20')
      expect(twentyStep).toBeDefined()
      expect(twentyStep?.provenance).toBeDefined()

      if (twentyStep?.provenance) {
        expect(twentyStep.provenance.rhs).toBe(25)
        expect(twentyStep.provenance.rhsDigit).toBe(2)
        expect(twentyStep.provenance.rhsPlace).toBe(1)
        expect(twentyStep.provenance.rhsPlaceName).toBe('tens')
        expect(twentyStep.provenance.rhsValue).toBe(20)
        expect(twentyStep.provenance.rhsDigitIndex).toBe(0) // '2' is first digit in '25'
      }
    })

    it('should have provenance for the ones digit (via TenComplement)', () => {
      // Adding 5 to ones digit 5 requires TenComplement: +100 -90 -5
      // The "-5" step represents the ones digit contribution
      const minusFiveStep = result.steps.find((step) => step.mathematicalTerm === '-5')
      expect(minusFiveStep).toBeDefined()
      expect(minusFiveStep?.provenance).toBeDefined()

      if (minusFiveStep?.provenance) {
        expect(minusFiveStep.provenance.rhs).toBe(25)
        expect(minusFiveStep.provenance.rhsDigit).toBe(5)
        expect(minusFiveStep.provenance.rhsPlace).toBe(0)
        expect(minusFiveStep.provenance.rhsPlaceName).toBe('ones')
        expect(minusFiveStep.provenance.rhsValue).toBe(5)
        // All steps in the TenComplement group share the same groupId
        expect(minusFiveStep.provenance.groupId).toBe('10comp-0-5')
      }
    })

    it('should generate equation anchors', () => {
      expect(result.equationAnchors).toBeDefined()
      expect(result.equationAnchors?.differenceText).toBe('25')
      expect(result.equationAnchors?.rhsDigitPositions).toHaveLength(2)

      // First digit (2)
      expect(result.equationAnchors?.rhsDigitPositions[0]).toEqual({
        digitIndex: 0,
        startIndex: expect.any(Number),
        endIndex: expect.any(Number),
      })

      // Second digit (5)
      expect(result.equationAnchors?.rhsDigitPositions[1]).toEqual({
        digitIndex: 1,
        startIndex: expect.any(Number),
        endIndex: expect.any(Number),
      })
    })

    it('should have segments with proper step mapping', () => {
      expect(result.segments.length).toBeGreaterThan(0)

      // Find segment for tens place (digit 2)
      const tensSegment = result.segments.find((seg) => seg.place === 1 && seg.digit === 2)
      expect(tensSegment).toBeDefined()
      expect(tensSegment?.stepIndices.length).toBeGreaterThan(0)

      // Find segment for ones place (digit 5)
      const onesSegment = result.segments.find((seg) => seg.place === 0 && seg.digit === 5)
      expect(onesSegment).toBeDefined()
      expect(onesSegment?.stepIndices.length).toBeGreaterThan(0)
    })

    it('should maintain consistency between steps and segments', () => {
      result.segments.forEach((segment) => {
        segment.stepIndices.forEach((stepIndex) => {
          const step = result.steps[stepIndex]
          expect(step).toBeDefined()
          expect(step.segmentId).toBe(segment.id)

          // Check provenance consistency
          if (step.provenance) {
            expect(step.provenance.rhsPlace).toBe(segment.place)
            expect(step.provenance.rhsDigit).toBe(segment.digit)
          }
        })
      })
    })
  })

  describe('Edge cases', () => {
    it('should handle single digit addition', () => {
      const result = generateUnifiedInstructionSequence(10, 13)
      const steps = result.steps.filter((step) => step.provenance)
      expect(steps.length).toBeGreaterThan(0)

      steps.forEach((step) => {
        expect(step.provenance?.rhs).toBe(3)
        expect(step.provenance?.rhsDigit).toBe(3)
        expect(step.provenance?.rhsPlace).toBe(0)
        expect(step.provenance?.rhsPlaceName).toBe('ones')
      })
    })

    it('should handle complement operations with group IDs', () => {
      // This might trigger a complement operation
      const result = generateUnifiedInstructionSequence(0, 7)
      const complementSteps = result.steps.filter((step) =>
        step.provenance?.groupId?.includes('comp')
      )

      if (complementSteps.length > 0) {
        const firstGroupId = complementSteps[0].provenance?.groupId
        complementSteps.forEach((step) => {
          expect(step.provenance?.groupId).toBe(firstGroupId)
        })
      }
    })
  })
})
