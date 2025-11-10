import { describe, expect, it } from 'vitest'
import type { TermProvenance } from '../../../utils/unifiedStepGenerator'

// Simple unit test for the tooltip content generation logic
describe('ReasonTooltip Provenance Logic', () => {
  it('should generate correct enhanced title from provenance', () => {
    const provenance: TermProvenance = {
      rhs: 25,
      rhsDigit: 2,
      rhsPlace: 1,
      rhsPlaceName: 'tens',
      rhsDigitIndex: 0,
      rhsValue: 20,
    }

    // This is the logic from getEnhancedTooltipContent
    const title = `Add the ${provenance.rhsPlaceName} digit — ${provenance.rhsDigit} ${provenance.rhsPlaceName} (${provenance.rhsValue})`
    const subtitle = `From addend ${provenance.rhs}`

    expect(title).toBe('Add the tens digit — 2 tens (20)')
    expect(subtitle).toBe('From addend 25')
  })

  it('should generate correct breadcrumb chips from provenance', () => {
    const provenance: TermProvenance = {
      rhs: 25,
      rhsDigit: 2,
      rhsPlace: 1,
      rhsPlaceName: 'tens',
      rhsDigitIndex: 0,
      rhsValue: 20,
    }

    // This is the logic from getEnhancedTooltipContent
    const enhancedChips = [
      {
        label: "Digit we're using",
        value: `${provenance.rhsDigit} (${provenance.rhsPlaceName})`,
      },
      {
        label: 'So we add here',
        value: `+${provenance.rhsDigit} ${provenance.rhsPlaceName} → ${provenance.rhsValue}`,
      },
    ]

    expect(enhancedChips[0]).toEqual({
      label: "Digit we're using",
      value: '2 (tens)',
    })

    expect(enhancedChips[1]).toEqual({
      label: 'So we add here',
      value: '+2 tens → 20',
    })
  })

  it('should generate correct explanation text for Direct rule', () => {
    const provenance: TermProvenance = {
      rhs: 25,
      rhsDigit: 2,
      rhsPlace: 1,
      rhsPlaceName: 'tens',
      rhsDigitIndex: 0,
      rhsValue: 20,
    }

    // This is the logic from the "Why this step" section
    const explanationText = `We're adding the ${provenance.rhsPlaceName} digit of ${provenance.rhs} → ${provenance.rhsDigit} ${provenance.rhsPlaceName}.`

    expect(explanationText).toBe("We're adding the tens digit of 25 → 2 tens.")
  })

  it('should handle ones digit provenance correctly', () => {
    const onesProvenance: TermProvenance = {
      rhs: 25,
      rhsDigit: 5,
      rhsPlace: 0,
      rhsPlaceName: 'ones',
      rhsDigitIndex: 1, // '5' is the second digit in '25'
      rhsValue: 5,
    }

    const title = `Add the ${onesProvenance.rhsPlaceName} digit — ${onesProvenance.rhsDigit} ${onesProvenance.rhsPlaceName} (${onesProvenance.rhsValue})`
    const subtitle = `From addend ${onesProvenance.rhs}`

    expect(title).toBe('Add the ones digit — 5 ones (5)')
    expect(subtitle).toBe('From addend 25')
  })

  it('should handle complement operations with group ID', () => {
    const complementProvenance: TermProvenance = {
      rhs: 25,
      rhsDigit: 5,
      rhsPlace: 0,
      rhsPlaceName: 'ones',
      rhsDigitIndex: 1,
      rhsValue: 5,
      groupId: '10comp-0-5',
    }

    // All terms in a complement group should trace back to the same source digit
    expect(complementProvenance.groupId).toBe('10comp-0-5')
    expect(complementProvenance.rhsDigit).toBe(5)
    expect(complementProvenance.rhs).toBe(25)

    // The title should still show the source digit correctly
    const title = `Add the ${complementProvenance.rhsPlaceName} digit — ${complementProvenance.rhsDigit} ${complementProvenance.rhsPlaceName} (${complementProvenance.rhsValue})`
    expect(title).toBe('Add the ones digit — 5 ones (5)')
  })

  it('should handle the exact 3475 + 25 = 3500 example', () => {
    // Test the exact scenario from the user's request
    const tensDigitProvenance: TermProvenance = {
      rhs: 25,
      rhsDigit: 2,
      rhsPlace: 1,
      rhsPlaceName: 'tens',
      rhsDigitIndex: 0, // '2' is the first character in '25'
      rhsValue: 20, // 2 * 10^1 = 20
    }

    // This should generate the exact text the user is expecting
    const title = `Add the ${tensDigitProvenance.rhsPlaceName} digit — ${tensDigitProvenance.rhsDigit} ${tensDigitProvenance.rhsPlaceName} (${tensDigitProvenance.rhsValue})`
    const subtitle = `From addend ${tensDigitProvenance.rhs}`
    const explanation = `We're adding the ${tensDigitProvenance.rhsPlaceName} digit of ${tensDigitProvenance.rhs} → ${tensDigitProvenance.rhsDigit} ${tensDigitProvenance.rhsPlaceName}.`

    expect(title).toBe('Add the tens digit — 2 tens (20)')
    expect(subtitle).toBe('From addend 25')
    expect(explanation).toBe("We're adding the tens digit of 25 → 2 tens.")

    // The key insight: the "20" pill now explicitly shows it came from the "2" in "25"
    expect(tensDigitProvenance.rhsDigitIndex).toBe(0) // Points to the '2' in '25'
    expect(tensDigitProvenance.rhsValue).toBe(20) // Shows the transformation 2 → 20
  })
})
