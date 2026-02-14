/**
 * Tests for StartPracticeModalContext when only one practice-approved game exists.
 * This is a separate file because the mock must be set at module level.
 */
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import type { SessionMode } from '@/lib/curriculum/session-mode'
import type { CurriculumPhase } from '@/lib/curriculum/definitions'
import { StartPracticeModalProvider, useStartPracticeModal } from '../StartPracticeModalContext'
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

// Mock with SINGLE game to test single-game mode
vi.mock('@/lib/arcade/practice-approved-games', () => ({
  getPracticeApprovedGames: () => [
    {
      manifest: {
        name: 'matching',
        displayName: 'Matching Pairs Battle',
        shortName: 'Matching Pairs',
        icon: '⚔️',
      },
    },
  ],
}))

vi.mock('@/lib/curriculum/skill-tutorial-config', () => ({
  getSkillTutorialConfig: () => null,
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

const defaultSessionMode: SessionMode = {
  type: 'progression',
  nextSkill: { skillId: 'test-skill', displayName: 'Test Skill', pKnown: 0.8 },
  tutorialRequired: false,
  phase: mockPhase,
  skipCount: 0,
  focusDescription: 'Test focus',
  canSkipTutorial: true,
}

function createWrapper() {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <StartPracticeModalProvider
        studentId="test-student"
        studentName="Test Student"
        focusDescription="Test focus"
        sessionMode={defaultSessionMode}
        savedPreferences={{ ...DEFAULT_SESSION_PREFERENCES, gameBreakEnabledGames: ['matching'] }}
      >
        {children}
      </StartPracticeModalProvider>
    )
  }
}

describe('StartPracticeModalContext - Single Game Mode', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Derived Values', () => {
    it('should set hasSingleGame to true when only one game available', () => {
      const { result } = renderHook(() => useStartPracticeModal(), {
        wrapper: createWrapper(),
      })

      expect(result.current.hasSingleGame).toBe(true)
    })

    it('should provide singleGame with manifest when only one game available', () => {
      const { result } = renderHook(() => useStartPracticeModal(), {
        wrapper: createWrapper(),
      })

      expect(result.current.singleGame).not.toBeNull()
      expect(result.current.singleGame?.manifest.name).toBe('matching')
      expect(result.current.singleGame?.manifest.displayName).toBe('Matching Pairs Battle')
      expect(result.current.singleGame?.manifest.shortName).toBe('Matching Pairs')
      expect(result.current.singleGame?.manifest.icon).toBe('⚔️')
    })

    it('should have practiceApprovedGames with length 1', () => {
      const { result } = renderHook(() => useStartPracticeModal(), {
        wrapper: createWrapper(),
      })

      expect(result.current.practiceApprovedGames).toHaveLength(1)
    })
  })

  describe('Auto-Selection Effect', () => {
    it('should auto-select the single game', async () => {
      const { result } = renderHook(() => useStartPracticeModal(), {
        wrapper: createWrapper(),
      })

      // The useEffect should have run and set the selected game
      await waitFor(() => {
        expect(result.current.gameBreakSelectedGame).toBe('matching')
      })
    })

    it('should force auto-start selection mode for single game', async () => {
      const { result } = renderHook(() => useStartPracticeModal(), {
        wrapper: createWrapper(),
      })

      // The useEffect should have run and set auto-start mode
      await waitFor(() => {
        expect(result.current.gameBreakSelectionMode).toBe('auto-start')
      })
    })
  })
})
