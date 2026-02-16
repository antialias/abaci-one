import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import type { SessionMode } from '@/lib/curriculum/session-mode'
import type { CurriculumPhase } from '@/lib/curriculum/definitions'
import {
  StartPracticeModalProvider,
  useStartPracticeModal,
  PART_TYPES,
  PURPOSE_TYPES,
} from '../StartPracticeModalContext'
import { DEFAULT_SESSION_PREFERENCES } from '@/db/schema/player-session-preferences'

// Mock hooks and dependencies
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}))

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    setQueryData: vi.fn(),
    invalidateQueries: vi.fn(),
  }),
}))

vi.mock('@/hooks/useSessionPlan', () => ({
  useGenerateSessionPlan: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
    error: null,
    reset: vi.fn(),
    taskId: null,
    taskState: null,
    progress: 0,
    progressMessage: null,
    plan: null,
    isGenerating: false,
    isComplete: false,
    taskError: null,
  }),
  useApproveSessionPlan: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
    error: null,
    reset: vi.fn(),
  }),
  useStartSessionPlan: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
    error: null,
    reset: vi.fn(),
  }),
  ActiveSessionExistsClientError: class extends Error {
    existingPlan = null
  },
  NoSkillsEnabledClientError: class extends Error {},
  sessionPlanKeys: {
    active: (id: string) => ['session-plan', 'active', id],
  },
}))

vi.mock('@/lib/arcade/practice-approved-games', () => ({
  getPracticeApprovedGames: () => [
    { manifest: { name: 'game1', displayName: 'Game One', icon: '🎮' } },
    { manifest: { name: 'game2', displayName: 'Game Two', icon: '🎯' } },
  ],
}))

vi.mock('@/lib/curriculum/skill-tutorial-config', () => ({
  getSkillTutorialConfig: (skillId: string) =>
    skillId === 'skill-with-tutorial' ? { title: 'Test Tutorial', skillId } : null,
}))

// Mock curriculum phase for tests
const mockPhase: CurriculumPhase = {
  id: 'L1.add.+1.direct',
  levelId: 1,
  operation: 'addition',
  targetNumber: 1,
  usesFiveComplement: false,
  usesTenComplement: false,
  name: 'Direct +1',
  description: 'Learn direct addition of +1',
  primarySkillId: 'add-direct-1',
  order: 1,
}

// Default session mode for tests
const defaultSessionMode: SessionMode = {
  type: 'progression',
  nextSkill: { skillId: 'test-skill', displayName: 'Test Skill', pKnown: 0.8 },
  tutorialRequired: false,
  phase: mockPhase,
  skipCount: 0,
  focusDescription: 'Test focus',
  canSkipTutorial: true,
}

const remediationSessionMode: SessionMode = {
  type: 'remediation',
  weakSkills: [
    { skillId: 'weak1', displayName: 'Weak Skill 1', pKnown: 0.3 },
    { skillId: 'weak2', displayName: 'Weak Skill 2', pKnown: 0.4 },
  ],
  focusDescription: 'Strengthening weak skills',
}

interface WrapperProps {
  children: ReactNode
  sessionMode?: SessionMode
  secondsPerTerm?: number
}

function createWrapper(overrides: Partial<WrapperProps> = {}) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <StartPracticeModalProvider
        studentId="test-student"
        studentName="Test Student"
        focusDescription="Test focus"
        sessionMode={overrides.sessionMode ?? defaultSessionMode}
        secondsPerTerm={overrides.secondsPerTerm}
        savedPreferences={{ ...DEFAULT_SESSION_PREFERENCES, gameBreakEnabledGames: ['game1', 'game2'] }}
      >
        {children}
      </StartPracticeModalProvider>
    )
  }
}

describe('StartPracticeModalContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Initial State', () => {
    it('should provide default duration of 10 minutes', () => {
      const { result } = renderHook(() => useStartPracticeModal(), {
        wrapper: createWrapper(),
      })

      expect(result.current.durationMinutes).toBe(10)
    })

    it('should initialize with default part weights (abacus=2, visualization=1, linear=0)', () => {
      const { result } = renderHook(() => useStartPracticeModal(), {
        wrapper: createWrapper(),
      })

      expect(result.current.partWeights).toEqual({
        abacus: 2,
        visualization: 1,
        linear: 0,
      })
      // enabledParts derived from weights
      expect(result.current.enabledParts).toEqual({
        abacus: true,
        visualization: true,
        linear: false,
      })
    })

    it('should initialize with game breaks enabled by default', () => {
      const { result } = renderHook(() => useStartPracticeModal(), {
        wrapper: createWrapper(),
      })

      expect(result.current.gameBreakEnabled).toBe(true)
    })

    it('should initialize with expanded state as false', () => {
      const { result } = renderHook(() => useStartPracticeModal(), {
        wrapper: createWrapper(),
      })

      expect(result.current.isExpanded).toBe(false)
    })

    it('should provide student info from props', () => {
      const { result } = renderHook(() => useStartPracticeModal(), {
        wrapper: createWrapper(),
      })

      expect(result.current.studentId).toBe('test-student')
      expect(result.current.studentName).toBe('Test Student')
    })
  })

  describe('Duration Management', () => {
    it('should update duration minutes', () => {
      const { result } = renderHook(() => useStartPracticeModal(), {
        wrapper: createWrapper(),
      })

      act(() => {
        result.current.setDurationMinutes(15)
      })

      expect(result.current.durationMinutes).toBe(15)
    })

    it('should recalculate estimated problems when duration changes', () => {
      const { result } = renderHook(() => useStartPracticeModal(), {
        wrapper: createWrapper(),
      })

      const initialProblems = result.current.estimatedProblems

      act(() => {
        result.current.setDurationMinutes(20)
      })

      expect(result.current.estimatedProblems).toBeGreaterThan(initialProblems)
    })
  })

  describe('Part Weight Cycling', () => {
    it('should cycle a part weight: 1 → 2', () => {
      const { result } = renderHook(() => useStartPracticeModal(), {
        wrapper: createWrapper(),
      })

      // visualization starts at 1
      expect(result.current.partWeights.visualization).toBe(1)

      act(() => {
        result.current.cyclePartWeight('visualization')
      })

      expect(result.current.partWeights.visualization).toBe(2)
    })

    it('should cycle weight 2 → 1 (never disables via cycle)', () => {
      const { result } = renderHook(() => useStartPracticeModal(), {
        wrapper: createWrapper(),
      })

      // Cycle visualization: 1 → 2 → 1
      act(() => {
        result.current.cyclePartWeight('visualization') // 1→2
      })
      act(() => {
        result.current.cyclePartWeight('visualization') // 2→1
      })

      expect(result.current.partWeights.visualization).toBe(1)
      expect(result.current.enabledParts.visualization).toBe(true)
    })

    it('should cycle weight 0 → 1 (enable)', () => {
      const { result } = renderHook(() => useStartPracticeModal(), {
        wrapper: createWrapper(),
      })

      // linear starts at 0
      expect(result.current.partWeights.linear).toBe(0)

      act(() => {
        result.current.cyclePartWeight('linear')
      })

      expect(result.current.partWeights.linear).toBe(1)
      expect(result.current.enabledParts.linear).toBe(true)
    })

    it('should update enabledPartCount when weights change', () => {
      const { result } = renderHook(() => useStartPracticeModal(), {
        wrapper: createWrapper(),
      })

      expect(result.current.enabledPartCount).toBe(2) // abacus + visualization

      // Enable linear (0 → 1)
      act(() => {
        result.current.cyclePartWeight('linear')
      })

      expect(result.current.enabledPartCount).toBe(3)
    })
  })

  describe('Disable Part', () => {
    it('should disable a part via disablePart', () => {
      const { result } = renderHook(() => useStartPracticeModal(), {
        wrapper: createWrapper(),
      })

      expect(result.current.partWeights.visualization).toBe(1)

      act(() => {
        result.current.disablePart('visualization')
      })

      expect(result.current.partWeights.visualization).toBe(0)
      expect(result.current.enabledParts.visualization).toBe(false)
    })

    it('should not allow disabling the last active part', () => {
      const { result } = renderHook(() => useStartPracticeModal(), {
        wrapper: createWrapper(),
      })

      // Disable visualization first
      act(() => {
        result.current.disablePart('visualization')
      })

      expect(result.current.partWeights.visualization).toBe(0)

      // Try to disable abacus — should be blocked since it's the only active one
      act(() => {
        result.current.disablePart('abacus')
      })

      expect(result.current.partWeights.abacus).toBe(2)
    })
  })

  describe('Game Break Settings', () => {
    it('should toggle game break enabled', () => {
      const { result } = renderHook(() => useStartPracticeModal(), {
        wrapper: createWrapper(),
      })

      expect(result.current.gameBreakEnabled).toBe(true)

      act(() => {
        result.current.setGameBreakEnabled(false)
      })

      expect(result.current.gameBreakEnabled).toBe(false)
    })

    it('should update game break minutes', () => {
      const { result } = renderHook(() => useStartPracticeModal(), {
        wrapper: createWrapper(),
      })

      act(() => {
        result.current.setGameBreakMinutes(5)
      })

      expect(result.current.gameBreakMinutes).toBe(5)
    })

    it('should update game break selection mode', () => {
      const { result } = renderHook(() => useStartPracticeModal(), {
        wrapper: createWrapper(),
      })

      act(() => {
        result.current.setGameBreakSelectionMode('kid-chooses')
      })

      expect(result.current.gameBreakSelectionMode).toBe('kid-chooses')
    })

    it('should update selected game', () => {
      const { result } = renderHook(() => useStartPracticeModal(), {
        wrapper: createWrapper(),
      })

      act(() => {
        result.current.setGameBreakSelectedGame('game1')
      })

      expect(result.current.gameBreakSelectedGame).toBe('game1')
    })

    it('should show game break settings only when 2+ parts enabled', () => {
      const { result } = renderHook(() => useStartPracticeModal(), {
        wrapper: createWrapper(),
      })

      expect(result.current.showGameBreakSettings).toBe(true) // 2 parts enabled

      // Disable visualization explicitly
      act(() => {
        result.current.disablePart('visualization')
      })

      expect(result.current.showGameBreakSettings).toBe(false) // only 1 part
    })
  })

  describe('Problem Length Preference', () => {
    it('should default to recommended', () => {
      const { result } = renderHook(() => useStartPracticeModal(), {
        wrapper: createWrapper(),
      })

      expect(result.current.problemLengthPreference).toBe('recommended')
    })

    it('should update problem length preference', () => {
      const { result } = renderHook(() => useStartPracticeModal(), {
        wrapper: createWrapper(),
      })

      act(() => {
        result.current.setProblemLengthPreference('shorter')
      })

      expect(result.current.problemLengthPreference).toBe('shorter')
    })

    it('should affect avgTermsPerProblem when preference changes to longer', () => {
      const { result } = renderHook(() => useStartPracticeModal(), {
        wrapper: createWrapper(),
      })

      const initialAvg = result.current.avgTermsPerProblem

      act(() => {
        result.current.setProblemLengthPreference('longer')
      })

      expect(result.current.avgTermsPerProblem).toBeGreaterThan(initialAvg)
    })

    it('should decrease avgTermsPerProblem when preference changes to shorter', () => {
      const { result } = renderHook(() => useStartPracticeModal(), {
        wrapper: createWrapper(),
      })

      const initialAvg = result.current.avgTermsPerProblem

      act(() => {
        result.current.setProblemLengthPreference('shorter')
      })

      expect(result.current.avgTermsPerProblem).toBeLessThanOrEqual(initialAvg)
    })

    it('should expose comfortLevel from provider props', () => {
      const { result } = renderHook(() => useStartPracticeModal(), {
        wrapper: createWrapper(),
      })

      // Default comfort level is 0.3
      expect(result.current.comfortLevel).toBe(0.3)
    })
  })

  describe('Derived Values', () => {
    it('should calculate problemsPerType for each enabled mode', () => {
      const { result } = renderHook(() => useStartPracticeModal(), {
        wrapper: createWrapper(),
      })

      const { problemsPerType } = result.current

      expect(problemsPerType.abacus).toBeGreaterThan(0)
      expect(problemsPerType.visualization).toBeGreaterThan(0)
      expect(problemsPerType.linear).toBe(0) // disabled
    })

    it('should calculate total estimatedProblems', () => {
      const { result } = renderHook(() => useStartPracticeModal(), {
        wrapper: createWrapper(),
      })

      const { problemsPerType, estimatedProblems } = result.current

      expect(estimatedProblems).toBe(
        problemsPerType.abacus + problemsPerType.visualization + problemsPerType.linear
      )
    })

    it('should provide modesSummary based on enabled parts', () => {
      const { result } = renderHook(() => useStartPracticeModal(), {
        wrapper: createWrapper(),
      })

      // With 2 modes enabled (abacus + visualization), linear is weight 0
      expect(result.current.modesSummary.text).toBe('2 modes')
      expect(result.current.modesSummary.emojis).toContain('🧮')
      expect(result.current.modesSummary.emojis).toContain('🧠')
    })

    it('should provide practice approved games list', () => {
      const { result } = renderHook(() => useStartPracticeModal(), {
        wrapper: createWrapper(),
      })

      expect(result.current.practiceApprovedGames).toHaveLength(2)
      expect(result.current.practiceApprovedGames[0].manifest.name).toBe('game1')
    })
  })

  describe('Tutorial Gate', () => {
    it('should not show tutorial gate for progression without tutorial', () => {
      const { result } = renderHook(() => useStartPracticeModal(), {
        wrapper: createWrapper({ sessionMode: defaultSessionMode }),
      })

      expect(result.current.showTutorialGate).toBe(false)
    })

    it('should show tutorial gate when tutorialRequired is true', () => {
      const sessionModeWithTutorial: SessionMode = {
        type: 'progression',
        nextSkill: {
          skillId: 'skill-with-tutorial',
          displayName: 'Skill With Tutorial',
          pKnown: 0.8,
        },
        tutorialRequired: true,
        phase: mockPhase,
        skipCount: 0,
        focusDescription: 'Learning new skill',
        canSkipTutorial: true,
      }

      const { result } = renderHook(() => useStartPracticeModal(), {
        wrapper: createWrapper({ sessionMode: sessionModeWithTutorial }),
      })

      expect(result.current.showTutorialGate).toBe(true)
      expect(result.current.tutorialConfig).not.toBeNull()
    })

    it('should provide nextSkill for progression mode', () => {
      const { result } = renderHook(() => useStartPracticeModal(), {
        wrapper: createWrapper({ sessionMode: defaultSessionMode }),
      })

      expect(result.current.nextSkill).toEqual({
        skillId: 'test-skill',
        displayName: 'Test Skill',
        pKnown: 0.8,
      })
    })
  })

  describe('Remediation Mode', () => {
    it('should show remediation CTA for remediation mode with weak skills', () => {
      const { result } = renderHook(() => useStartPracticeModal(), {
        wrapper: createWrapper({ sessionMode: remediationSessionMode }),
      })

      expect(result.current.showRemediationCta).toBe(true)
    })

    it('should not show tutorial gate for remediation mode', () => {
      const { result } = renderHook(() => useStartPracticeModal(), {
        wrapper: createWrapper({ sessionMode: remediationSessionMode }),
      })

      expect(result.current.showTutorialGate).toBe(false)
    })

    it('should not have nextSkill for remediation mode', () => {
      const { result } = renderHook(() => useStartPracticeModal(), {
        wrapper: createWrapper({ sessionMode: remediationSessionMode }),
      })

      expect(result.current.nextSkill).toBeNull()
    })
  })

  describe('UI State', () => {
    it('should toggle expanded state', () => {
      const { result } = renderHook(() => useStartPracticeModal(), {
        wrapper: createWrapper(),
      })

      expect(result.current.isExpanded).toBe(false)

      act(() => {
        result.current.setIsExpanded(true)
      })

      expect(result.current.isExpanded).toBe(true)
    })
  })

  describe('Error Handling', () => {
    it('should throw error when used outside provider', () => {
      // Suppress console.error for this test
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      expect(() => {
        renderHook(() => useStartPracticeModal())
      }).toThrow('useStartPracticeModal must be used within StartPracticeModalProvider')

      consoleSpy.mockRestore()
    })
  })

  describe('PART_TYPES Constant', () => {
    it('should export PART_TYPES with correct structure', () => {
      expect(PART_TYPES).toHaveLength(3)
      expect(PART_TYPES[0]).toEqual({
        type: 'abacus',
        emoji: '🧮',
        label: 'Abacus',
        defaultWeight: 2,
      })
      expect(PART_TYPES[1]).toEqual({
        type: 'visualization',
        emoji: '🧠',
        label: 'Visualize',
        defaultWeight: 1,
      })
      expect(PART_TYPES[2]).toEqual({
        type: 'linear',
        emoji: '💭',
        label: 'Linear',
        defaultWeight: 0,
      })
    })
  })

  describe('Purpose Weights', () => {
    it('should initialize with default purpose weights (focus=3, reinforce=1, review=1, challenge=1)', () => {
      const { result } = renderHook(() => useStartPracticeModal(), {
        wrapper: createWrapper(),
      })

      expect(result.current.purposeWeights).toEqual({
        focus: 3,
        reinforce: 1,
        review: 1,
        challenge: 1,
      })
    })

    it('should cycle purpose weight: 1 → 2', () => {
      const { result } = renderHook(() => useStartPracticeModal(), {
        wrapper: createWrapper(),
      })

      expect(result.current.purposeWeights.reinforce).toBe(1)

      act(() => {
        result.current.cyclePurposeWeight('reinforce')
      })

      expect(result.current.purposeWeights.reinforce).toBe(2)
    })

    it('should cycle purpose weight: 2 → 1', () => {
      const { result } = renderHook(() => useStartPracticeModal(), {
        wrapper: createWrapper(),
      })

      act(() => {
        result.current.cyclePurposeWeight('reinforce') // 1→2
      })
      act(() => {
        result.current.cyclePurposeWeight('reinforce') // 2→1
      })

      expect(result.current.purposeWeights.reinforce).toBe(1)
    })

    it('should cycle purpose weight: 0 → 1 (enable)', () => {
      const { result } = renderHook(() => useStartPracticeModal(), {
        wrapper: createWrapper(),
      })

      // Disable reinforce first
      act(() => {
        result.current.disablePurpose('reinforce')
      })
      expect(result.current.purposeWeights.reinforce).toBe(0)

      // Cycle: 0 → 1
      act(() => {
        result.current.cyclePurposeWeight('reinforce')
      })
      expect(result.current.purposeWeights.reinforce).toBe(1)
    })

    it('should no-op cycle when sole active purpose', () => {
      const { result } = renderHook(() => useStartPracticeModal(), {
        wrapper: createWrapper(),
      })

      // Disable all except focus
      act(() => {
        result.current.disablePurpose('reinforce')
      })
      act(() => {
        result.current.disablePurpose('review')
      })
      act(() => {
        result.current.disablePurpose('challenge')
      })

      expect(result.current.purposeWeights.focus).toBe(3)

      // Cycle should be a no-op (sole active)
      act(() => {
        result.current.cyclePurposeWeight('focus')
      })

      expect(result.current.purposeWeights.focus).toBe(3)
    })

    it('should disable a purpose via disablePurpose', () => {
      const { result } = renderHook(() => useStartPracticeModal(), {
        wrapper: createWrapper(),
      })

      act(() => {
        result.current.disablePurpose('challenge')
      })

      expect(result.current.purposeWeights.challenge).toBe(0)
    })

    it('should not allow disabling the last active purpose', () => {
      const { result } = renderHook(() => useStartPracticeModal(), {
        wrapper: createWrapper(),
      })

      // Disable all except focus
      act(() => {
        result.current.disablePurpose('reinforce')
      })
      act(() => {
        result.current.disablePurpose('review')
      })
      act(() => {
        result.current.disablePurpose('challenge')
      })

      // Try to disable focus — should be blocked
      act(() => {
        result.current.disablePurpose('focus')
      })

      expect(result.current.purposeWeights.focus).toBe(3)
    })

    it('should derive normalized purposeTimeWeights', () => {
      const { result } = renderHook(() => useStartPracticeModal(), {
        wrapper: createWrapper(),
      })

      // Default: {focus: 3, reinforce: 1, review: 1, challenge: 1} → total = 6
      const { purposeTimeWeights } = result.current
      expect(purposeTimeWeights.focus).toBeCloseTo(3 / 6)
      expect(purposeTimeWeights.reinforce).toBeCloseTo(1 / 6)
      expect(purposeTimeWeights.review).toBeCloseTo(1 / 6)
      expect(purposeTimeWeights.challenge).toBeCloseTo(1 / 6)
    })

    it('should update purposeTimeWeights when weights change', () => {
      const { result } = renderHook(() => useStartPracticeModal(), {
        wrapper: createWrapper(),
      })

      act(() => {
        result.current.disablePurpose('challenge')
      })

      // Now {focus: 3, reinforce: 1, review: 1, challenge: 0} → total = 5
      const { purposeTimeWeights } = result.current
      expect(purposeTimeWeights.focus).toBeCloseTo(3 / 5)
      expect(purposeTimeWeights.reinforce).toBeCloseTo(1 / 5)
      expect(purposeTimeWeights.review).toBeCloseTo(1 / 5)
      expect(purposeTimeWeights.challenge).toBeCloseTo(0)
    })
  })

  describe('PURPOSE_TYPES Constant', () => {
    it('should export PURPOSE_TYPES with correct structure', () => {
      expect(PURPOSE_TYPES).toHaveLength(4)
      expect(PURPOSE_TYPES[0]).toEqual({
        type: 'focus',
        emoji: '🎯',
        label: 'Focus',
        defaultWeight: 3,
      })
      expect(PURPOSE_TYPES[1]).toEqual({
        type: 'reinforce',
        emoji: '💪',
        label: 'Reinforce',
        defaultWeight: 1,
      })
      expect(PURPOSE_TYPES[2]).toEqual({
        type: 'review',
        emoji: '🔄',
        label: 'Review',
        defaultWeight: 1,
      })
      expect(PURPOSE_TYPES[3]).toEqual({
        type: 'challenge',
        emoji: '⭐',
        label: 'Challenge',
        defaultWeight: 1,
      })
    })
  })

  describe('Multi-Game Mode (default)', () => {
    it('should set hasSingleGame to false when multiple games available', () => {
      const { result } = renderHook(() => useStartPracticeModal(), {
        wrapper: createWrapper(),
      })

      expect(result.current.hasSingleGame).toBe(false)
    })

    it('should set singleGame to null when multiple games available', () => {
      const { result } = renderHook(() => useStartPracticeModal(), {
        wrapper: createWrapper(),
      })

      expect(result.current.singleGame).toBeNull()
    })
  })
})
