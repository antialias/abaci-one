/**
 * @vitest-environment node
 *
 * Session Mode Tests
 *
 * Tests for the pure helper functions: isRemediationMode, isProgressionMode,
 * isMaintenanceMode, and getWeakSkillIds.
 *
 * Note: getSessionMode() is async and requires DB access, so it's tested
 * separately in integration tests. These tests focus on the pure type guards
 * and helper functions.
 */

import { describe, expect, it } from 'vitest'
import {
  isRemediationMode,
  isProgressionMode,
  isMaintenanceMode,
  getWeakSkillIds,
  type RemediationMode,
  type ProgressionMode,
  type MaintenanceMode,
  type SessionMode,
} from '@/lib/curriculum/session-mode'

// =============================================================================
// Fixtures
// =============================================================================

const remediationMode: RemediationMode = {
  type: 'remediation',
  weakSkills: [
    { skillId: 'fiveComplements.4=5-1', displayName: 'Add 4 (5-1)', pKnown: 0.2 },
    { skillId: 'fiveComplements.3=5-2', displayName: 'Add 3 (5-2)', pKnown: 0.3 },
  ],
  focusDescription: 'Strengthening: Add 4 (5-1) and Add 3 (5-2)',
}

const progressionMode: ProgressionMode = {
  type: 'progression',
  nextSkill: { skillId: 'tenComplements.9=10-1', displayName: 'Add 9 (10-1)', pKnown: 0 },
  phase: {
    id: 'L2.add.+9.direct',
    levelId: 2,
    operation: 'addition',
    targetNumber: 9,
    usesFiveComplement: false,
    usesTenComplement: true,
    name: 'Add 9',
    description: 'Direct +9',
    primarySkillId: 'tenComplements.9=10-1',
    order: 10,
  },
  tutorialRequired: true,
  skipCount: 0,
  focusDescription: 'Learning: Add 9 (10-1)',
  canSkipTutorial: true,
}

const maintenanceMode: MaintenanceMode = {
  type: 'maintenance',
  focusDescription: 'Mixed practice',
  skillCount: 5,
}

const maintenanceModeWithDeferred: MaintenanceMode = {
  type: 'maintenance',
  focusDescription: 'Mixed practice',
  skillCount: 3,
  deferredProgression: {
    nextSkill: { skillId: 'tenComplements.9=10-1', displayName: 'Add 9 (10-1)', pKnown: 0 },
    readiness: {},
    phase: {
      id: 'L2.add.+9.direct',
      levelId: 2,
      operation: 'addition',
      targetNumber: 9,
      usesFiveComplement: false,
      usesTenComplement: true,
      name: 'Add 9',
      description: 'Direct +9',
      primarySkillId: 'tenComplements.9=10-1',
      order: 10,
    },
  },
}

// =============================================================================
// isRemediationMode
// =============================================================================

describe('isRemediationMode', () => {
  it('returns true for remediation mode', () => {
    expect(isRemediationMode(remediationMode)).toBe(true)
  })

  it('returns false for progression mode', () => {
    expect(isRemediationMode(progressionMode)).toBe(false)
  })

  it('returns false for maintenance mode', () => {
    expect(isRemediationMode(maintenanceMode)).toBe(false)
  })

  it('narrows the type correctly', () => {
    const mode: SessionMode = remediationMode
    if (isRemediationMode(mode)) {
      // TypeScript should allow access to weakSkills here
      expect(mode.weakSkills).toHaveLength(2)
    }
  })
})

// =============================================================================
// isProgressionMode
// =============================================================================

describe('isProgressionMode', () => {
  it('returns true for progression mode', () => {
    expect(isProgressionMode(progressionMode)).toBe(true)
  })

  it('returns false for remediation mode', () => {
    expect(isProgressionMode(remediationMode)).toBe(false)
  })

  it('returns false for maintenance mode', () => {
    expect(isProgressionMode(maintenanceMode)).toBe(false)
  })

  it('narrows the type correctly', () => {
    const mode: SessionMode = progressionMode
    if (isProgressionMode(mode)) {
      expect(mode.nextSkill.skillId).toBe('tenComplements.9=10-1')
      expect(mode.tutorialRequired).toBe(true)
    }
  })
})

// =============================================================================
// isMaintenanceMode
// =============================================================================

describe('isMaintenanceMode', () => {
  it('returns true for maintenance mode', () => {
    expect(isMaintenanceMode(maintenanceMode)).toBe(true)
  })

  it('returns true for maintenance mode with deferred progression', () => {
    expect(isMaintenanceMode(maintenanceModeWithDeferred)).toBe(true)
  })

  it('returns false for remediation mode', () => {
    expect(isMaintenanceMode(remediationMode)).toBe(false)
  })

  it('returns false for progression mode', () => {
    expect(isMaintenanceMode(progressionMode)).toBe(false)
  })

  it('narrows the type correctly', () => {
    const mode: SessionMode = maintenanceMode
    if (isMaintenanceMode(mode)) {
      expect(mode.skillCount).toBe(5)
    }
  })
})

// =============================================================================
// getWeakSkillIds
// =============================================================================

describe('getWeakSkillIds', () => {
  it('returns weak skill IDs for remediation mode', () => {
    const ids = getWeakSkillIds(remediationMode)
    expect(ids).toEqual(['fiveComplements.4=5-1', 'fiveComplements.3=5-2'])
  })

  it('returns empty array for progression mode', () => {
    expect(getWeakSkillIds(progressionMode)).toEqual([])
  })

  it('returns empty array for maintenance mode', () => {
    expect(getWeakSkillIds(maintenanceMode)).toEqual([])
  })

  it('returns empty array for maintenance mode with deferred progression', () => {
    expect(getWeakSkillIds(maintenanceModeWithDeferred)).toEqual([])
  })

  it('returns skills in the same order as weakSkills array', () => {
    const modeWith3: RemediationMode = {
      type: 'remediation',
      weakSkills: [
        { skillId: 'a.b', displayName: 'A', pKnown: 0.1 },
        { skillId: 'c.d', displayName: 'C', pKnown: 0.2 },
        { skillId: 'e.f', displayName: 'E', pKnown: 0.3 },
      ],
      focusDescription: 'test',
    }
    expect(getWeakSkillIds(modeWith3)).toEqual(['a.b', 'c.d', 'e.f'])
  })

  it('returns empty array for remediation mode with no weak skills', () => {
    const emptyRemediation: RemediationMode = {
      type: 'remediation',
      weakSkills: [],
      focusDescription: 'test',
    }
    expect(getWeakSkillIds(emptyRemediation)).toEqual([])
  })
})

// =============================================================================
// Type discriminant exhaustiveness
// =============================================================================

describe('mode type discriminant', () => {
  it('every mode matches exactly one type guard', () => {
    const modes: SessionMode[] = [remediationMode, progressionMode, maintenanceMode]

    for (const mode of modes) {
      const matches = [isRemediationMode(mode), isProgressionMode(mode), isMaintenanceMode(mode)]
      expect(matches.filter(Boolean)).toHaveLength(1)
    }
  })
})
