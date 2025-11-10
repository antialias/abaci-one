import type { StepBeadHighlight } from '@soroban/abacus-react'
import type React from 'react'
import { vi } from 'vitest'

// Import the helper functions from the module (we'll need to extract these)
// For now, let's define them locally for testing

// Helper function to compute problem string from start and target values
function computeProblemString(startValue: number, targetValue: number): string {
  if (targetValue > startValue) {
    const difference = targetValue - startValue
    return `${startValue} + ${difference} = ${targetValue}`
  } else if (targetValue < startValue) {
    const difference = startValue - targetValue
    return `${startValue} - ${difference} = ${targetValue}`
  } else {
    return `${startValue} (no change)`
  }
}

// Helper function to calculate bead position from refs
function calculateBeadPosition(
  bead: StepBeadHighlight,
  beadRefs: React.MutableRefObject<Map<string, SVGElement>>,
  abacusContainer: HTMLElement | null
): { x: number; y: number } | null {
  if (!abacusContainer) return null

  const key = `${bead.placeValue}-${bead.beadType}-${bead.position || 0}`
  const beadElement = beadRefs.current.get(key)

  if (!beadElement) return null

  const beadRect = beadElement.getBoundingClientRect()
  const containerRect = abacusContainer.getBoundingClientRect()

  return {
    x: beadRect.left + beadRect.width / 2 - containerRect.left,
    y: beadRect.top + beadRect.height / 2 - containerRect.top,
  }
}

// Helper function to find the topmost bead with arrows
function findTopmostBeadWithArrows(
  stepBeadHighlights: StepBeadHighlight[] | undefined
): StepBeadHighlight | null {
  if (!stepBeadHighlights || stepBeadHighlights.length === 0) return null

  // Sort by place value (highest first, since place value 4 = leftmost = highest value)
  // Then by bead type (heaven beads are higher than earth beads)
  // Then by position for earth beads (lower position = higher on abacus)
  const sortedBeads = [...stepBeadHighlights].sort((a, b) => {
    // First sort by place value (higher place value = more significant = topmost priority)
    if (a.placeValue !== b.placeValue) {
      return b.placeValue - a.placeValue
    }

    // If same place value, heaven beads come before earth beads
    if (a.beadType !== b.beadType) {
      return a.beadType === 'heaven' ? -1 : 1
    }

    // If both earth beads in same column, lower position number = higher on abacus
    if (a.beadType === 'earth' && b.beadType === 'earth') {
      return (a.position || 0) - (b.position || 0)
    }

    return 0
  })

  return sortedBeads[0] || null
}

describe('TutorialPlayer Helper Functions', () => {
  describe('computeProblemString', () => {
    it('should handle addition problems correctly', () => {
      expect(computeProblemString(0, 5)).toBe('0 + 5 = 5')
      expect(computeProblemString(3, 7)).toBe('3 + 4 = 7')
      expect(computeProblemString(10, 15)).toBe('10 + 5 = 15')
    })

    it('should handle subtraction problems correctly', () => {
      expect(computeProblemString(5, 0)).toBe('5 - 5 = 0')
      expect(computeProblemString(7, 3)).toBe('7 - 4 = 3')
      expect(computeProblemString(15, 10)).toBe('15 - 5 = 10')
    })

    it('should handle no change problems correctly', () => {
      expect(computeProblemString(0, 0)).toBe('0 (no change)')
      expect(computeProblemString(5, 5)).toBe('5 (no change)')
      expect(computeProblemString(42, 42)).toBe('42 (no change)')
    })

    it('should handle edge cases', () => {
      expect(computeProblemString(-5, 0)).toBe('-5 + 5 = 0')
      expect(computeProblemString(0, -3)).toBe('0 - 3 = -3')
      expect(computeProblemString(-2, -5)).toBe('-2 - 3 = -5')
    })
  })

  describe('findTopmostBeadWithArrows', () => {
    it('should return null for empty or undefined input', () => {
      expect(findTopmostBeadWithArrows(undefined)).toBeNull()
      expect(findTopmostBeadWithArrows([])).toBeNull()
    })

    it('should return the only bead when there is one', () => {
      const singleBead: StepBeadHighlight = {
        placeValue: 0,
        beadType: 'earth',
        position: 0,
        direction: 'up',
        stepIndex: 0,
      }

      expect(findTopmostBeadWithArrows([singleBead])).toEqual(singleBead)
    })

    it('should prioritize higher place values', () => {
      const beads: StepBeadHighlight[] = [
        {
          placeValue: 0,
          beadType: 'earth',
          position: 0,
          direction: 'up',
          stepIndex: 0,
        },
        {
          placeValue: 2,
          beadType: 'earth',
          position: 0,
          direction: 'up',
          stepIndex: 0,
        },
        {
          placeValue: 1,
          beadType: 'earth',
          position: 0,
          direction: 'up',
          stepIndex: 0,
        },
      ]

      const result = findTopmostBeadWithArrows(beads)
      expect(result?.placeValue).toBe(2)
    })

    it('should prioritize heaven beads over earth beads in same column', () => {
      const beads: StepBeadHighlight[] = [
        {
          placeValue: 1,
          beadType: 'earth',
          position: 0,
          direction: 'up',
          stepIndex: 0,
        },
        { placeValue: 1, beadType: 'heaven', direction: 'down', stepIndex: 0 },
      ]

      const result = findTopmostBeadWithArrows(beads)
      expect(result?.beadType).toBe('heaven')
    })

    it('should prioritize lower position earth beads (higher on abacus)', () => {
      const beads: StepBeadHighlight[] = [
        {
          placeValue: 0,
          beadType: 'earth',
          position: 2,
          direction: 'up',
          stepIndex: 0,
        },
        {
          placeValue: 0,
          beadType: 'earth',
          position: 0,
          direction: 'up',
          stepIndex: 0,
        },
        {
          placeValue: 0,
          beadType: 'earth',
          position: 1,
          direction: 'up',
          stepIndex: 0,
        },
      ]

      const result = findTopmostBeadWithArrows(beads)
      expect(result?.position).toBe(0)
    })

    it('should handle complex mixed scenarios correctly', () => {
      const beads: StepBeadHighlight[] = [
        {
          placeValue: 0,
          beadType: 'earth',
          position: 1,
          direction: 'up',
          stepIndex: 0,
        },
        {
          placeValue: 1,
          beadType: 'earth',
          position: 3,
          direction: 'down',
          stepIndex: 0,
        },
        { placeValue: 2, beadType: 'heaven', direction: 'down', stepIndex: 0 },
        { placeValue: 1, beadType: 'heaven', direction: 'up', stepIndex: 0 },
      ]

      const result = findTopmostBeadWithArrows(beads)
      // Should pick place value 2 (highest), heaven bead
      expect(result?.placeValue).toBe(2)
      expect(result?.beadType).toBe('heaven')
    })

    it('should handle undefined positions correctly', () => {
      const beads: StepBeadHighlight[] = [
        { placeValue: 0, beadType: 'earth', direction: 'up', stepIndex: 0 }, // No position
        {
          placeValue: 0,
          beadType: 'earth',
          position: 1,
          direction: 'up',
          stepIndex: 0,
        },
      ]

      const result = findTopmostBeadWithArrows(beads)
      // Should pick position 0 (undefined defaults to 0, which is higher)
      expect(result?.position).toBeUndefined()
    })
  })

  describe('calculateBeadPosition', () => {
    let mockBeadRefs: React.MutableRefObject<Map<string, SVGElement>>
    let mockAbacusContainer: HTMLElement

    beforeEach(() => {
      // Mock getBoundingClientRect for SVG elements and container
      const mockGetBoundingClientRect = vi.fn()

      // Mock bead element
      const mockBeadElement = {
        getBoundingClientRect: mockGetBoundingClientRect.mockReturnValue({
          left: 100,
          top: 50,
          width: 20,
          height: 20,
        }),
      } as unknown as SVGElement

      // Mock container element
      mockAbacusContainer = {
        getBoundingClientRect: vi.fn().mockReturnValue({
          left: 50,
          top: 20,
          width: 400,
          height: 300,
        }),
      } as unknown as HTMLElement

      // Create mock beadRefs
      const beadMap = new Map<string, SVGElement>()
      beadMap.set('0-earth-0', mockBeadElement)
      beadMap.set('1-heaven-0', mockBeadElement)

      mockBeadRefs = { current: beadMap }
    })

    it('should return null when abacusContainer is null', () => {
      const bead: StepBeadHighlight = {
        placeValue: 0,
        beadType: 'earth',
        position: 0,
        direction: 'up',
        stepIndex: 0,
      }

      const result = calculateBeadPosition(bead, mockBeadRefs, null)
      expect(result).toBeNull()
    })

    it('should return null when bead element is not found in refs', () => {
      const bead: StepBeadHighlight = {
        placeValue: 5, // Not in our mock refs
        beadType: 'earth',
        position: 0,
        direction: 'up',
        stepIndex: 0,
      }

      const result = calculateBeadPosition(bead, mockBeadRefs, mockAbacusContainer)
      expect(result).toBeNull()
    })

    it('should calculate correct relative position for earth bead', () => {
      const bead: StepBeadHighlight = {
        placeValue: 0,
        beadType: 'earth',
        position: 0,
        direction: 'up',
        stepIndex: 0,
      }

      const result = calculateBeadPosition(bead, mockBeadRefs, mockAbacusContainer)

      expect(result).toEqual({
        x: 60, // (100 + 20/2) - 50 = 110 - 50 = 60
        y: 40, // (50 + 20/2) - 20 = 60 - 20 = 40
      })
    })

    it('should calculate correct relative position for heaven bead', () => {
      const bead: StepBeadHighlight = {
        placeValue: 1,
        beadType: 'heaven',
        direction: 'down',
        stepIndex: 0,
      }

      const result = calculateBeadPosition(bead, mockBeadRefs, mockAbacusContainer)

      expect(result).toEqual({
        x: 60, // Same calculation as above
        y: 40,
      })
    })

    it('should use position 0 as default when position is undefined', () => {
      const bead: StepBeadHighlight = {
        placeValue: 0,
        beadType: 'earth',
        // position is undefined
        direction: 'up',
        stepIndex: 0,
      }

      // This should look for key '0-earth-0' which exists in our mock
      const result = calculateBeadPosition(bead, mockBeadRefs, mockAbacusContainer)

      expect(result).toEqual({
        x: 60,
        y: 40,
      })
    })

    it('should generate correct key format for bead lookup', () => {
      const bead: StepBeadHighlight = {
        placeValue: 2,
        beadType: 'earth',
        position: 3,
        direction: 'up',
        stepIndex: 0,
      }

      // Add this specific bead to our refs
      const mockElement = {
        getBoundingClientRect: vi.fn().mockReturnValue({
          left: 200,
          top: 100,
          width: 25,
          height: 25,
        }),
      } as unknown as SVGElement

      mockBeadRefs.current.set('2-earth-3', mockElement)

      const result = calculateBeadPosition(bead, mockBeadRefs, mockAbacusContainer)

      expect(result).toEqual({
        x: 162.5, // (200 + 25/2) - 50 = 212.5 - 50 = 162.5
        y: 92.5, // (100 + 25/2) - 20 = 112.5 - 20 = 92.5
      })
    })
  })
})
