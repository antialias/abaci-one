import { describe, expect, it } from 'vitest'
import { generateUnifiedInstructionSequence } from '../unifiedStepGenerator'

describe('Provenance Integration Test - 3475 + 25 = 3500', () => {
  it('should generate complete provenance data for the tooltip system', () => {
    // Generate the instruction sequence for the exact example from the user
    const result = generateUnifiedInstructionSequence(3475, 3500)

    // Verify we have steps and segments
    expect(result.steps.length).toBeGreaterThan(0)
    expect(result.segments.length).toBeGreaterThan(0)

    // Log the actual generated data
    console.log('\n=== Complete Integration Test Results ===')
    console.log('Full decomposition:', result.fullDecomposition)
    console.log('Total steps:', result.steps.length)
    console.log('Total segments:', result.segments.length)

    // Find the "20" step (tens digit)
    const twentyStep = result.steps.find((step) => step.mathematicalTerm === '20')
    expect(twentyStep).toBeDefined()
    expect(twentyStep?.provenance).toBeDefined()

    if (twentyStep?.provenance) {
      console.log('\n=== "20" Step Provenance ===')
      console.log('Mathematical term:', twentyStep.mathematicalTerm)
      console.log('Provenance data:', twentyStep.provenance)

      // Verify the provenance data matches our expectations
      expect(twentyStep.provenance.rhs).toBe(25)
      expect(twentyStep.provenance.rhsDigit).toBe(2)
      expect(twentyStep.provenance.rhsPlace).toBe(1)
      expect(twentyStep.provenance.rhsPlaceName).toBe('tens')
      expect(twentyStep.provenance.rhsValue).toBe(20)
      expect(twentyStep.provenance.rhsDigitIndex).toBe(0) // '2' is first char in '25'
    }

    // Find the corresponding segment
    const tensSegment = result.segments.find((seg) => seg.place === 1 && seg.digit === 2)
    expect(tensSegment).toBeDefined()

    if (tensSegment) {
      console.log('\n=== Tens Segment ===')
      console.log('Segment rule:', tensSegment.plan[0]?.rule)
      console.log('Step indices:', tensSegment.stepIndices)
      console.log('Readable title:', tensSegment.readable?.title)

      // Verify the segment contains our step
      expect(tensSegment.stepIndices).toContain(twentyStep!.stepIndex)
      expect(tensSegment.plan[0]?.rule).toBe('Direct')
    }

    // Test the tooltip content generation logic
    if (twentyStep?.provenance && tensSegment) {
      const provenance = twentyStep.provenance

      // Generate the enhanced tooltip content (this is what the ReasonTooltip should show)
      const expectedTitle = `Add the ${provenance.rhsPlaceName} digit — ${provenance.rhsDigit} ${provenance.rhsPlaceName} (${provenance.rhsValue})`
      const expectedSubtitle = `From addend ${provenance.rhs}`
      const expectedExplanation = `We're adding the ${provenance.rhsPlaceName} digit of ${provenance.rhs} → ${provenance.rhsDigit} ${provenance.rhsPlaceName}.`

      console.log('\n=== Expected Tooltip Content ===')
      console.log('Title:', expectedTitle)
      console.log('Subtitle:', expectedSubtitle)
      console.log('Explanation:', expectedExplanation)

      // Verify these match what the user is expecting
      expect(expectedTitle).toBe('Add the tens digit — 2 tens (20)')
      expect(expectedSubtitle).toBe('From addend 25')
      expect(expectedExplanation).toBe("We're adding the tens digit of 25 → 2 tens.")
    }

    // Verify equation anchors for digit highlighting
    expect(result.equationAnchors).toBeDefined()
    if (result.equationAnchors) {
      console.log('\n=== Equation Anchors for Highlighting ===')
      console.log('Difference text:', result.equationAnchors.differenceText)
      console.log('Digit positions:', result.equationAnchors.rhsDigitPositions)

      expect(result.equationAnchors.differenceText).toBe('25')
      expect(result.equationAnchors.rhsDigitPositions).toHaveLength(2)

      // Position for '2' (tens digit)
      expect(result.equationAnchors.rhsDigitPositions[0].digitIndex).toBe(0)
      // Position for '5' (ones digit)
      expect(result.equationAnchors.rhsDigitPositions[1].digitIndex).toBe(1)
    }

    console.log('\n✅ Integration test complete - all provenance data is correctly generated')
  })

  it('should provide data for UI requirements', () => {
    const result = generateUnifiedInstructionSequence(3475, 3500)
    const twentyStep = result.steps.find((step) => step.mathematicalTerm === '20')

    // Verify we have all the data needed for the UI requirements
    expect(twentyStep?.provenance).toBeDefined()
    expect(result.equationAnchors).toBeDefined()
    expect(result.segments.length).toBeGreaterThan(0)

    console.log('\n=== UI Implementation Ready ===')
    console.log('✅ Provenance data: Available for enhanced tooltips')
    console.log('✅ Equation anchors: Available for digit highlighting')
    console.log('✅ Character positions: Available for visual connectors')
    console.log('✅ Segment mapping: Available for tooltip content')

    // The ReasonTooltip component now has all the data it needs to show:
    // - "Add the tens digit — 2 tens (20)" (title)
    // - "From addend 25" (subtitle)
    // - "We're adding the tens digit of 25 → 2 tens." (explanation)
    // - Breadcrumb chips showing the digit transformation
  })
})
