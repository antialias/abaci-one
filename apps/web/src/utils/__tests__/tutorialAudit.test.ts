import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock tutorialConverter to avoid deep dependency chain (abacusInstructionGenerator → @soroban/abacus-react)
vi.mock('../tutorialConverter', () => ({
  guidedAdditionSteps: [],
}))

// We need to import after mocking
import { auditTutorialSteps, runTutorialAudit } from '../tutorialAudit'

// ============================================================================
// Helper: Override the mocked guidedAdditionSteps at runtime
// ============================================================================

/**
 * The audit function iterates over `guidedAdditionSteps` from tutorialConverter.
 * We mock that module and manipulate the exported array to control test scenarios.
 */
async function setSteps(steps: any[]) {
  const mod = await import('../tutorialConverter')
  // Replace array contents
  const arr = mod.guidedAdditionSteps as any[]
  arr.length = 0
  arr.push(...steps)
}

// ============================================================================
// calculateBeadState helper (tested indirectly through auditTutorialSteps)
// ============================================================================

// The calculateBeadState helper is not exported, but we can test it indirectly
// through the audit logic. We test the audit function's behavior which uses it.

// ============================================================================
// auditTutorialSteps
// ============================================================================

describe('auditTutorialSteps', () => {
  beforeEach(async () => {
    // Reset steps to empty before each test
    await setSteps([])
    vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  // --------------------------------------------------------------------------
  // Empty input
  // --------------------------------------------------------------------------
  describe('with no steps', () => {
    it('returns empty issues array when there are no steps', () => {
      const issues = auditTutorialSteps()
      expect(issues).toEqual([])
    })
  })

  // --------------------------------------------------------------------------
  // basic-1: 0 + 1
  // --------------------------------------------------------------------------
  describe('basic-1 (0 + 1)', () => {
    it('reports no issues when step is correct', async () => {
      await setSteps([
        {
          id: 'basic-1',
          title: 'Basic Addition: 0 + 1',
          problem: '0 + 1',
          startValue: 0,
          targetValue: 1,
          highlightBeads: [{ placeValue: 0, beadType: 'earth', position: 0 }],
        },
      ])
      const issues = auditTutorialSteps()
      expect(issues).toEqual([])
    })

    it('reports issue when highlightBeads is missing', async () => {
      await setSteps([
        {
          id: 'basic-1',
          title: 'Basic Addition: 0 + 1',
          problem: '0 + 1',
          startValue: 0,
          targetValue: 1,
          highlightBeads: undefined,
        },
      ])
      const issues = auditTutorialSteps()
      expect(issues.length).toBeGreaterThan(0)
      expect(issues[0].stepId).toBe('basic-1')
      expect(issues[0].issueType).toBe('highlighting')
      expect(issues[0].severity).toBe('major')
    })

    it('reports issue when too many beads are highlighted', async () => {
      await setSteps([
        {
          id: 'basic-1',
          title: 'Basic Addition: 0 + 1',
          problem: '0 + 1',
          startValue: 0,
          targetValue: 1,
          highlightBeads: [
            { placeValue: 0, beadType: 'earth', position: 0 },
            { placeValue: 0, beadType: 'earth', position: 1 },
          ],
        },
      ])
      const issues = auditTutorialSteps()
      expect(issues.some((i) => i.stepId === 'basic-1' && i.issueType === 'highlighting')).toBe(
        true
      )
    })
  })

  // --------------------------------------------------------------------------
  // basic-2: 1 + 1
  // --------------------------------------------------------------------------
  describe('basic-2 (1 + 1)', () => {
    it('reports no issues when position 1 is highlighted', async () => {
      await setSteps([
        {
          id: 'basic-2',
          title: 'Basic Addition: 1 + 1',
          problem: '1 + 1',
          startValue: 1,
          targetValue: 2,
          highlightBeads: [{ placeValue: 0, beadType: 'earth', position: 1 }],
        },
      ])
      const issues = auditTutorialSteps()
      expect(issues).toEqual([])
    })

    it('reports issue when wrong position is highlighted', async () => {
      await setSteps([
        {
          id: 'basic-2',
          title: 'Basic Addition: 1 + 1',
          problem: '1 + 1',
          startValue: 1,
          targetValue: 2,
          highlightBeads: [{ placeValue: 0, beadType: 'earth', position: 0 }],
        },
      ])
      const issues = auditTutorialSteps()
      expect(issues.some((i) => i.stepId === 'basic-2')).toBe(true)
    })
  })

  // --------------------------------------------------------------------------
  // basic-3: 2 + 1
  // --------------------------------------------------------------------------
  describe('basic-3 (2 + 1)', () => {
    it('reports no issues when position 2 is highlighted', async () => {
      await setSteps([
        {
          id: 'basic-3',
          title: 'Basic Addition: 2 + 1',
          problem: '2 + 1',
          startValue: 2,
          targetValue: 3,
          highlightBeads: [{ placeValue: 0, beadType: 'earth', position: 2 }],
        },
      ])
      const issues = auditTutorialSteps()
      expect(issues).toEqual([])
    })

    it('reports issue when wrong position is highlighted', async () => {
      await setSteps([
        {
          id: 'basic-3',
          title: 'Basic Addition: 2 + 1',
          problem: '2 + 1',
          startValue: 2,
          targetValue: 3,
          highlightBeads: [{ placeValue: 0, beadType: 'earth', position: 0 }],
        },
      ])
      const issues = auditTutorialSteps()
      expect(issues.some((i) => i.stepId === 'basic-3')).toBe(true)
    })
  })

  // --------------------------------------------------------------------------
  // basic-4: 3 + 1
  // --------------------------------------------------------------------------
  describe('basic-4 (3 + 1)', () => {
    it('reports no issues when position 3 is highlighted', async () => {
      await setSteps([
        {
          id: 'basic-4',
          title: 'Basic Addition: 3 + 1',
          problem: '3 + 1',
          startValue: 3,
          targetValue: 4,
          highlightBeads: [{ placeValue: 0, beadType: 'earth', position: 3 }],
        },
      ])
      const issues = auditTutorialSteps()
      expect(issues).toEqual([])
    })

    it('reports issue when position 2 is highlighted instead of 3', async () => {
      await setSteps([
        {
          id: 'basic-4',
          title: 'Basic Addition: 3 + 1',
          problem: '3 + 1',
          startValue: 3,
          targetValue: 4,
          highlightBeads: [{ placeValue: 0, beadType: 'earth', position: 2 }],
        },
      ])
      const issues = auditTutorialSteps()
      expect(issues.some((i) => i.stepId === 'basic-4')).toBe(true)
    })
  })

  // --------------------------------------------------------------------------
  // heaven-intro: 0 + 5
  // --------------------------------------------------------------------------
  describe('heaven-intro (0 + 5)', () => {
    it('reports no issues when heaven bead is highlighted', async () => {
      await setSteps([
        {
          id: 'heaven-intro',
          title: 'Heaven Bead: 0 + 5',
          problem: '0 + 5',
          startValue: 0,
          targetValue: 5,
          highlightBeads: [{ placeValue: 0, beadType: 'heaven' }],
        },
      ])
      const issues = auditTutorialSteps()
      expect(issues).toEqual([])
    })

    it('reports issue when earth bead highlighted instead of heaven', async () => {
      await setSteps([
        {
          id: 'heaven-intro',
          title: 'Heaven Bead: 0 + 5',
          problem: '0 + 5',
          startValue: 0,
          targetValue: 5,
          highlightBeads: [{ placeValue: 0, beadType: 'earth', position: 0 }],
        },
      ])
      const issues = auditTutorialSteps()
      expect(issues.some((i) => i.stepId === 'heaven-intro')).toBe(true)
    })
  })

  // --------------------------------------------------------------------------
  // heaven-plus-earth: 5 + 1
  // --------------------------------------------------------------------------
  describe('heaven-plus-earth (5 + 1)', () => {
    it('reports no issues when earth position 0 is highlighted', async () => {
      await setSteps([
        {
          id: 'heaven-plus-earth',
          title: 'Combining: 5 + 1',
          problem: '5 + 1',
          startValue: 5,
          targetValue: 6,
          highlightBeads: [{ placeValue: 0, beadType: 'earth', position: 0 }],
        },
      ])
      const issues = auditTutorialSteps()
      expect(issues).toEqual([])
    })

    it('reports issue when heaven bead highlighted instead of earth', async () => {
      await setSteps([
        {
          id: 'heaven-plus-earth',
          title: 'Combining: 5 + 1',
          problem: '5 + 1',
          startValue: 5,
          targetValue: 6,
          highlightBeads: [{ placeValue: 0, beadType: 'heaven' }],
        },
      ])
      const issues = auditTutorialSteps()
      expect(issues.some((i) => i.stepId === 'heaven-plus-earth')).toBe(true)
    })

    it('reports issue when wrong earth position highlighted', async () => {
      await setSteps([
        {
          id: 'heaven-plus-earth',
          title: 'Combining: 5 + 1',
          problem: '5 + 1',
          startValue: 5,
          targetValue: 6,
          highlightBeads: [{ placeValue: 0, beadType: 'earth', position: 1 }],
        },
      ])
      const issues = auditTutorialSteps()
      expect(issues.some((i) => i.stepId === 'heaven-plus-earth')).toBe(true)
    })
  })

  // --------------------------------------------------------------------------
  // complement-intro: 3 + 4 (five complement)
  // --------------------------------------------------------------------------
  describe('complement-intro (3 + 4)', () => {
    it('reports no issues when 2 beads highlighted (heaven + earth)', async () => {
      await setSteps([
        {
          id: 'complement-intro',
          title: 'Five Complement: 3 + 4',
          problem: '3 + 4',
          startValue: 3,
          targetValue: 7,
          highlightBeads: [
            { placeValue: 0, beadType: 'heaven' },
            { placeValue: 0, beadType: 'earth', position: 0 },
          ],
        },
      ])
      const issues = auditTutorialSteps()
      expect(issues).toEqual([])
    })

    it('reports issue when only 1 bead highlighted', async () => {
      await setSteps([
        {
          id: 'complement-intro',
          title: 'Five Complement: 3 + 4',
          problem: '3 + 4',
          startValue: 3,
          targetValue: 7,
          highlightBeads: [{ placeValue: 0, beadType: 'heaven' }],
        },
      ])
      const issues = auditTutorialSteps()
      expect(issues.some((i) => i.stepId === 'complement-intro')).toBe(true)
    })
  })

  // --------------------------------------------------------------------------
  // complement-2: 2 + 3 (five complement)
  // --------------------------------------------------------------------------
  describe('complement-2 (2 + 3)', () => {
    it('reports no issues when 3 beads highlighted', async () => {
      await setSteps([
        {
          id: 'complement-2',
          title: 'Five Complement: 2 + 3',
          problem: '2 + 3',
          startValue: 2,
          targetValue: 5,
          highlightBeads: [
            { placeValue: 0, beadType: 'heaven' },
            { placeValue: 0, beadType: 'earth', position: 0 },
            { placeValue: 0, beadType: 'earth', position: 1 },
          ],
        },
      ])
      const issues = auditTutorialSteps()
      expect(issues).toEqual([])
    })

    it('reports issue when 2 beads highlighted instead of 3', async () => {
      await setSteps([
        {
          id: 'complement-2',
          title: 'Five Complement: 2 + 3',
          problem: '2 + 3',
          startValue: 2,
          targetValue: 5,
          highlightBeads: [
            { placeValue: 0, beadType: 'heaven' },
            { placeValue: 0, beadType: 'earth', position: 0 },
          ],
        },
      ])
      const issues = auditTutorialSteps()
      expect(issues.some((i) => i.stepId === 'complement-2')).toBe(true)
    })
  })

  // --------------------------------------------------------------------------
  // complex-1: 6 + 2
  // --------------------------------------------------------------------------
  describe('complex-1 (6 + 2)', () => {
    it('reports no issues when 2 earth beads highlighted', async () => {
      await setSteps([
        {
          id: 'complex-1',
          title: 'Complex: 6 + 2',
          problem: '6 + 2',
          startValue: 6,
          targetValue: 8,
          highlightBeads: [
            { placeValue: 0, beadType: 'earth', position: 1 },
            { placeValue: 0, beadType: 'earth', position: 2 },
          ],
        },
      ])
      const issues = auditTutorialSteps()
      expect(issues).toEqual([])
    })

    it('reports issue when only 1 bead highlighted', async () => {
      await setSteps([
        {
          id: 'complex-1',
          title: 'Complex: 6 + 2',
          problem: '6 + 2',
          startValue: 6,
          targetValue: 8,
          highlightBeads: [{ placeValue: 0, beadType: 'earth', position: 1 }],
        },
      ])
      const issues = auditTutorialSteps()
      expect(issues.some((i) => i.stepId === 'complex-1')).toBe(true)
    })
  })

  // --------------------------------------------------------------------------
  // complex-2: 7 + 4 (ten complement / carry)
  // --------------------------------------------------------------------------
  describe('complex-2 (7 + 4)', () => {
    it('reports no issues when all 4 beads correctly highlighted', async () => {
      await setSteps([
        {
          id: 'complex-2',
          title: 'Complex: 7 + 4',
          problem: '7 + 4',
          startValue: 7,
          targetValue: 11,
          highlightBeads: [
            { placeValue: 1, beadType: 'heaven' },
            { placeValue: 0, beadType: 'heaven' },
            { placeValue: 0, beadType: 'earth', position: 0 },
            { placeValue: 0, beadType: 'earth', position: 1 },
          ],
        },
      ])
      const issues = auditTutorialSteps()
      expect(issues).toEqual([])
    })

    it('reports issue when tens heaven bead missing', async () => {
      await setSteps([
        {
          id: 'complex-2',
          title: 'Complex: 7 + 4',
          problem: '7 + 4',
          startValue: 7,
          targetValue: 11,
          highlightBeads: [
            // Missing: { placeValue: 1, beadType: 'heaven' },
            { placeValue: 0, beadType: 'heaven' },
            { placeValue: 0, beadType: 'earth', position: 0 },
            { placeValue: 0, beadType: 'earth', position: 1 },
          ],
        },
      ])
      const issues = auditTutorialSteps()
      expect(issues.some((i) => i.stepId === 'complex-2' && i.issueType === 'highlighting')).toBe(
        true
      )
      expect(
        issues.some((i) => i.stepId === 'complex-2' && i.issueType === 'missing_beads')
      ).toBe(true)
    })

    it('reports issue when ones heaven bead missing', async () => {
      await setSteps([
        {
          id: 'complex-2',
          title: 'Complex: 7 + 4',
          problem: '7 + 4',
          startValue: 7,
          targetValue: 11,
          highlightBeads: [
            { placeValue: 1, beadType: 'heaven' },
            // Missing: { placeValue: 0, beadType: 'heaven' },
            { placeValue: 0, beadType: 'earth', position: 0 },
            { placeValue: 0, beadType: 'earth', position: 1 },
          ],
        },
      ])
      const issues = auditTutorialSteps()
      expect(
        issues.some(
          (i) =>
            i.stepId === 'complex-2' &&
            i.issueType === 'missing_beads' &&
            i.description.includes('ones place heaven')
        )
      ).toBe(true)
    })

    it('reports issue when wrong number of ones earth beads', async () => {
      await setSteps([
        {
          id: 'complex-2',
          title: 'Complex: 7 + 4',
          problem: '7 + 4',
          startValue: 7,
          targetValue: 11,
          highlightBeads: [
            { placeValue: 1, beadType: 'heaven' },
            { placeValue: 0, beadType: 'heaven' },
            { placeValue: 0, beadType: 'earth', position: 0 },
            // Missing second earth bead
          ],
        },
      ])
      const issues = auditTutorialSteps()
      // Should report both count issue (expects 4) and wrong number of earth beads
      expect(issues.some((i) => i.stepId === 'complex-2')).toBe(true)
    })
  })

  // --------------------------------------------------------------------------
  // Place value validation
  // --------------------------------------------------------------------------
  describe('place value validation', () => {
    it('reports issue for invalid place value (not 0 or 1)', async () => {
      await setSteps([
        {
          id: 'basic-1',
          title: 'Test step',
          problem: '0 + 1',
          startValue: 0,
          targetValue: 1,
          highlightBeads: [{ placeValue: 2, beadType: 'earth', position: 0 }],
        },
      ])
      const issues = auditTutorialSteps()
      expect(
        issues.some(
          (i) =>
            i.issueType === 'highlighting' && i.description.includes('Invalid place value')
        )
      ).toBe(true)
    })

    it('allows place value 0 (ones)', async () => {
      await setSteps([
        {
          id: 'basic-1',
          title: 'Test step',
          problem: '0 + 1',
          startValue: 0,
          targetValue: 1,
          highlightBeads: [{ placeValue: 0, beadType: 'earth', position: 0 }],
        },
      ])
      const issues = auditTutorialSteps()
      const pvIssues = issues.filter((i) => i.description.includes('Invalid place value'))
      expect(pvIssues).toEqual([])
    })

    it('allows place value 1 (tens)', async () => {
      await setSteps([
        {
          id: 'some-other-id',
          title: 'Test step with tens',
          problem: '7 + 4',
          startValue: 7,
          targetValue: 11,
          highlightBeads: [{ placeValue: 1, beadType: 'heaven' }],
        },
      ])
      const issues = auditTutorialSteps()
      const pvIssues = issues.filter((i) => i.description.includes('Invalid place value'))
      expect(pvIssues).toEqual([])
    })
  })

  // --------------------------------------------------------------------------
  // Steps with no highlightBeads
  // --------------------------------------------------------------------------
  describe('steps with no highlightBeads', () => {
    it('does not crash on step with no highlightBeads and unknown id', async () => {
      await setSteps([
        {
          id: 'unknown-step',
          title: 'Unknown step',
          problem: '0 + 0',
          startValue: 0,
          targetValue: 0,
          highlightBeads: undefined,
        },
      ])
      const issues = auditTutorialSteps()
      // Should not throw; unknown id steps skip the switch but may still pass place value check
      expect(Array.isArray(issues)).toBe(true)
    })
  })

  // --------------------------------------------------------------------------
  // Multiple steps together
  // --------------------------------------------------------------------------
  describe('multiple steps', () => {
    it('audits all steps and collects all issues', async () => {
      await setSteps([
        {
          id: 'basic-1',
          title: 'Bad step 1',
          problem: '0 + 1',
          startValue: 0,
          targetValue: 1,
          highlightBeads: [], // empty - should flag
        },
        {
          id: 'basic-2',
          title: 'Bad step 2',
          problem: '1 + 1',
          startValue: 1,
          targetValue: 2,
          highlightBeads: [{ placeValue: 0, beadType: 'earth', position: 0 }], // wrong position
        },
      ])
      const issues = auditTutorialSteps()
      expect(issues.some((i) => i.stepId === 'basic-1')).toBe(true)
      expect(issues.some((i) => i.stepId === 'basic-2')).toBe(true)
    })
  })

  // --------------------------------------------------------------------------
  // Issue structure
  // --------------------------------------------------------------------------
  describe('issue structure', () => {
    it('returns issues with all required fields', async () => {
      await setSteps([
        {
          id: 'basic-1',
          title: 'Basic Addition: 0 + 1',
          problem: '0 + 1',
          startValue: 0,
          targetValue: 1,
          highlightBeads: [], // bad - should produce issue
        },
      ])
      const issues = auditTutorialSteps()
      expect(issues.length).toBeGreaterThan(0)
      const issue = issues[0]
      expect(issue).toHaveProperty('stepId')
      expect(issue).toHaveProperty('stepTitle')
      expect(issue).toHaveProperty('issueType')
      expect(issue).toHaveProperty('severity')
      expect(issue).toHaveProperty('description')
      expect(issue).toHaveProperty('currentState')
      expect(issue).toHaveProperty('expectedState')
    })

    it('uses correct severity values', async () => {
      await setSteps([
        {
          id: 'basic-1',
          title: 'Test',
          problem: '0 + 1',
          startValue: 0,
          targetValue: 1,
          highlightBeads: [],
        },
      ])
      const issues = auditTutorialSteps()
      for (const issue of issues) {
        expect(['critical', 'major', 'minor']).toContain(issue.severity)
      }
    })

    it('uses correct issueType values', async () => {
      await setSteps([
        {
          id: 'basic-1',
          title: 'Test',
          problem: '0 + 1',
          startValue: 0,
          targetValue: 1,
          highlightBeads: [],
        },
      ])
      const issues = auditTutorialSteps()
      for (const issue of issues) {
        expect(['mathematical', 'highlighting', 'instruction', 'missing_beads']).toContain(
          issue.issueType
        )
      }
    })
  })
})

// ============================================================================
// runTutorialAudit
// ============================================================================

describe('runTutorialAudit', () => {
  beforeEach(async () => {
    await setSteps([])
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  it('logs success message when no issues found', async () => {
    await setSteps([
      {
        id: 'basic-1',
        title: 'Basic Addition: 0 + 1',
        problem: '0 + 1',
        startValue: 0,
        targetValue: 1,
        highlightBeads: [{ placeValue: 0, beadType: 'earth', position: 0 }],
      },
    ])
    runTutorialAudit()
    // Should have called console.log with success message
    expect(console.log).toHaveBeenCalled()
  })

  it('logs summary with issue counts when issues found', async () => {
    await setSteps([
      {
        id: 'basic-1',
        title: 'Bad step',
        problem: '0 + 1',
        startValue: 0,
        targetValue: 1,
        highlightBeads: [],
      },
    ])
    runTutorialAudit()
    // Should log summary
    expect(console.log).toHaveBeenCalled()
  })

  it('does not throw even with many issues', async () => {
    await setSteps([
      {
        id: 'basic-1',
        title: 'Bad 1',
        problem: '0 + 1',
        startValue: 0,
        targetValue: 1,
        highlightBeads: [],
      },
      {
        id: 'basic-2',
        title: 'Bad 2',
        problem: '1 + 1',
        startValue: 1,
        targetValue: 2,
        highlightBeads: undefined,
      },
      {
        id: 'heaven-intro',
        title: 'Bad 3',
        problem: '0 + 5',
        startValue: 0,
        targetValue: 5,
        highlightBeads: [{ placeValue: 0, beadType: 'earth', position: 0 }],
      },
    ])
    expect(() => runTutorialAudit()).not.toThrow()
  })
})
