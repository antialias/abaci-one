/**
 * Tests for StartPracticeModalContext game break configuration (Phase 3).
 * Tests difficulty presets, custom config, and resolved config logic.
 */
import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import type { SessionMode } from '@/lib/curriculum/session-mode'
import type { CurriculumPhase } from '@/lib/curriculum/definitions'
import { StartPracticeModalProvider, useStartPracticeModal } from '../StartPracticeModalContext'

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

// Mock with games that have practiceBreakConfig
vi.mock('@/lib/arcade/practice-approved-games', () => ({
  getPracticeApprovedGames: () => [
    {
      manifest: {
        name: 'memory-quiz',
        displayName: 'Memory Quiz',
        shortName: 'Memory Quiz',
        icon: '🧠',
        practiceBreakConfig: {
          suggestedConfig: {
            selectedCount: 5,
            displayTime: 2.0,
            selectedDifficulty: 'easy',
          },
          lockedFields: [],
          minDurationMinutes: 2,
          maxDurationMinutes: 8,
          difficultyPresets: {
            easy: { selectedCount: 2, displayTime: 3.0, selectedDifficulty: 'beginner' },
            medium: { selectedCount: 5, displayTime: 2.0, selectedDifficulty: 'easy' },
            hard: { selectedCount: 8, displayTime: 1.5, selectedDifficulty: 'medium' },
          },
        },
      },
    },
    {
      manifest: {
        name: 'matching',
        displayName: 'Matching Pairs',
        shortName: 'Matching',
        icon: '⚔️',
        practiceBreakConfig: {
          suggestedConfig: {
            difficulty: 6,
            gameType: 'abacus-numeral',
          },
          lockedFields: ['gameMode'],
          minDurationMinutes: 2,
          maxDurationMinutes: 10,
          difficultyPresets: {
            easy: { difficulty: 6, gameType: 'abacus-numeral' },
            medium: { difficulty: 8, gameType: 'abacus-numeral' },
            hard: { difficulty: 12, gameType: 'complement-pairs' },
          },
        },
      },
    },
    {
      manifest: {
        name: 'no-config-game',
        displayName: 'No Config Game',
        shortName: 'No Config',
        icon: '🎮',
        // No practiceBreakConfig
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
}

function createWrapper() {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <StartPracticeModalProvider
        studentId="test-student"
        studentName="Test Student"
        focusDescription="Test focus"
        sessionMode={defaultSessionMode}
      >
        {children}
      </StartPracticeModalProvider>
    )
  }
}

describe('StartPracticeModalContext - Game Break Configuration (Phase 3)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Initial State', () => {
    it('should initialize gameBreakDifficultyPreset to medium', () => {
      const { result } = renderHook(() => useStartPracticeModal(), {
        wrapper: createWrapper(),
      })

      expect(result.current.gameBreakDifficultyPreset).toBe('medium')
    })

    it('should initialize gameBreakCustomConfig as empty object', () => {
      const { result } = renderHook(() => useStartPracticeModal(), {
        wrapper: createWrapper(),
      })

      expect(result.current.gameBreakCustomConfig).toEqual({})
    })

    it('should initialize gameBreakShowCustomize as false', () => {
      const { result } = renderHook(() => useStartPracticeModal(), {
        wrapper: createWrapper(),
      })

      expect(result.current.gameBreakShowCustomize).toBe(false)
    })

    it('should initialize selectedGamePracticeConfig as null (no game selected)', () => {
      const { result } = renderHook(() => useStartPracticeModal(), {
        wrapper: createWrapper(),
      })

      expect(result.current.selectedGamePracticeConfig).toBeNull()
    })

    it('should initialize resolvedGameConfig as empty object (no game selected)', () => {
      const { result } = renderHook(() => useStartPracticeModal(), {
        wrapper: createWrapper(),
      })

      expect(result.current.resolvedGameConfig).toEqual({})
    })
  })

  describe('Difficulty Preset Management', () => {
    it('should update gameBreakDifficultyPreset', () => {
      const { result } = renderHook(() => useStartPracticeModal(), {
        wrapper: createWrapper(),
      })

      act(() => {
        result.current.setGameBreakDifficultyPreset('hard')
      })

      expect(result.current.gameBreakDifficultyPreset).toBe('hard')
    })

    it('should allow setting preset to null', () => {
      const { result } = renderHook(() => useStartPracticeModal(), {
        wrapper: createWrapper(),
      })

      act(() => {
        result.current.setGameBreakDifficultyPreset(null)
      })

      expect(result.current.gameBreakDifficultyPreset).toBeNull()
    })
  })

  describe('Custom Config Management', () => {
    it('should update gameBreakCustomConfig', () => {
      const { result } = renderHook(() => useStartPracticeModal(), {
        wrapper: createWrapper(),
      })

      act(() => {
        result.current.setGameBreakCustomConfig({ cardCount: 10, showNumbers: true })
      })

      expect(result.current.gameBreakCustomConfig).toEqual({ cardCount: 10, showNumbers: true })
    })

    it('should update gameBreakShowCustomize', () => {
      const { result } = renderHook(() => useStartPracticeModal(), {
        wrapper: createWrapper(),
      })

      act(() => {
        result.current.setGameBreakShowCustomize(true)
      })

      expect(result.current.gameBreakShowCustomize).toBe(true)
    })
  })

  describe('Selected Game Practice Config', () => {
    it('should return practiceBreakConfig when a game with config is selected', () => {
      const { result } = renderHook(() => useStartPracticeModal(), {
        wrapper: createWrapper(),
      })

      act(() => {
        result.current.setGameBreakSelectedGame('memory-quiz')
      })

      expect(result.current.selectedGamePracticeConfig).not.toBeNull()
      expect(result.current.selectedGamePracticeConfig?.suggestedConfig).toEqual({
        selectedCount: 5,
        displayTime: 2.0,
        selectedDifficulty: 'easy',
      })
    })

    it('should return null when random is selected', () => {
      const { result } = renderHook(() => useStartPracticeModal(), {
        wrapper: createWrapper(),
      })

      act(() => {
        result.current.setGameBreakSelectedGame('random')
      })

      expect(result.current.selectedGamePracticeConfig).toBeNull()
    })

    it('should return null when a game without config is selected', () => {
      const { result } = renderHook(() => useStartPracticeModal(), {
        wrapper: createWrapper(),
      })

      act(() => {
        result.current.setGameBreakSelectedGame('no-config-game')
      })

      expect(result.current.selectedGamePracticeConfig).toBeNull()
    })
  })

  describe('Resolved Game Config', () => {
    it('should return empty object when no game selected', () => {
      const { result } = renderHook(() => useStartPracticeModal(), {
        wrapper: createWrapper(),
      })

      expect(result.current.resolvedGameConfig).toEqual({})
    })

    it('should return medium preset config by default when game with config is selected', () => {
      const { result } = renderHook(() => useStartPracticeModal(), {
        wrapper: createWrapper(),
      })

      act(() => {
        result.current.setGameBreakSelectedGame('memory-quiz')
      })

      // Should merge suggestedConfig with medium preset
      expect(result.current.resolvedGameConfig).toEqual({
        selectedCount: 5, // from medium preset
        displayTime: 2.0, // from medium preset
        selectedDifficulty: 'easy', // from medium preset
      })
    })

    it('should return easy preset config when easy is selected', () => {
      const { result } = renderHook(() => useStartPracticeModal(), {
        wrapper: createWrapper(),
      })

      act(() => {
        result.current.setGameBreakSelectedGame('memory-quiz')
        result.current.setGameBreakDifficultyPreset('easy')
      })

      expect(result.current.resolvedGameConfig).toEqual({
        selectedCount: 2, // from easy preset
        displayTime: 3.0, // from easy preset
        selectedDifficulty: 'beginner', // from easy preset
      })
    })

    it('should return hard preset config when hard is selected', () => {
      const { result } = renderHook(() => useStartPracticeModal(), {
        wrapper: createWrapper(),
      })

      act(() => {
        result.current.setGameBreakSelectedGame('memory-quiz')
        result.current.setGameBreakDifficultyPreset('hard')
      })

      expect(result.current.resolvedGameConfig).toEqual({
        selectedCount: 8, // from hard preset
        displayTime: 1.5, // from hard preset
        selectedDifficulty: 'medium', // from hard preset
      })
    })

    it('should use custom config when customize view is shown', () => {
      const { result } = renderHook(() => useStartPracticeModal(), {
        wrapper: createWrapper(),
      })

      act(() => {
        result.current.setGameBreakSelectedGame('memory-quiz')
        result.current.setGameBreakShowCustomize(true)
        result.current.setGameBreakCustomConfig({ selectedCount: 10, displayTime: 1.0 })
      })

      // Should merge suggestedConfig with custom config
      expect(result.current.resolvedGameConfig).toEqual({
        selectedCount: 10, // from custom config
        displayTime: 1.0, // from custom config
        selectedDifficulty: 'easy', // from suggestedConfig (not overridden)
      })
    })

    it('should fallback to medium when preset is null and customize is not shown', () => {
      const { result } = renderHook(() => useStartPracticeModal(), {
        wrapper: createWrapper(),
      })

      act(() => {
        result.current.setGameBreakSelectedGame('memory-quiz')
        result.current.setGameBreakDifficultyPreset(null)
      })

      // Should use medium preset as fallback
      expect(result.current.resolvedGameConfig).toEqual({
        selectedCount: 5, // from medium preset
        displayTime: 2.0, // from medium preset
        selectedDifficulty: 'easy', // from medium preset
      })
    })
  })

  describe('Game Selection Reset Behavior', () => {
    it('should reset difficulty preset to medium when game changes', () => {
      const { result } = renderHook(() => useStartPracticeModal(), {
        wrapper: createWrapper(),
      })

      act(() => {
        result.current.setGameBreakSelectedGame('memory-quiz')
        result.current.setGameBreakDifficultyPreset('hard')
      })

      expect(result.current.gameBreakDifficultyPreset).toBe('hard')

      act(() => {
        result.current.setGameBreakSelectedGame('matching')
      })

      expect(result.current.gameBreakDifficultyPreset).toBe('medium')
    })

    it('should reset custom config when game changes', () => {
      const { result } = renderHook(() => useStartPracticeModal(), {
        wrapper: createWrapper(),
      })

      act(() => {
        result.current.setGameBreakSelectedGame('memory-quiz')
        result.current.setGameBreakCustomConfig({ selectedCount: 10 })
      })

      expect(result.current.gameBreakCustomConfig).toEqual({ selectedCount: 10 })

      act(() => {
        result.current.setGameBreakSelectedGame('matching')
      })

      expect(result.current.gameBreakCustomConfig).toEqual({})
    })

    it('should reset showCustomize when game changes', () => {
      const { result } = renderHook(() => useStartPracticeModal(), {
        wrapper: createWrapper(),
      })

      act(() => {
        result.current.setGameBreakSelectedGame('memory-quiz')
        result.current.setGameBreakShowCustomize(true)
      })

      expect(result.current.gameBreakShowCustomize).toBe(true)

      act(() => {
        result.current.setGameBreakSelectedGame('matching')
      })

      expect(result.current.gameBreakShowCustomize).toBe(false)
    })

    it('should reset all config state when switching to random', () => {
      const { result } = renderHook(() => useStartPracticeModal(), {
        wrapper: createWrapper(),
      })

      act(() => {
        result.current.setGameBreakSelectedGame('memory-quiz')
        result.current.setGameBreakDifficultyPreset('hard')
        result.current.setGameBreakShowCustomize(true)
        result.current.setGameBreakCustomConfig({ selectedCount: 10 })
      })

      act(() => {
        result.current.setGameBreakSelectedGame('random')
      })

      expect(result.current.gameBreakDifficultyPreset).toBe('medium')
      expect(result.current.gameBreakCustomConfig).toEqual({})
      expect(result.current.gameBreakShowCustomize).toBe(false)
      expect(result.current.selectedGamePracticeConfig).toBeNull()
      expect(result.current.resolvedGameConfig).toEqual({})
    })
  })

  describe('Multiple Games Config Switching', () => {
    it('should correctly resolve config for matching game', () => {
      const { result } = renderHook(() => useStartPracticeModal(), {
        wrapper: createWrapper(),
      })

      act(() => {
        result.current.setGameBreakSelectedGame('matching')
      })

      expect(result.current.resolvedGameConfig).toEqual({
        difficulty: 8, // from medium preset
        gameType: 'abacus-numeral', // from medium preset
      })

      act(() => {
        result.current.setGameBreakDifficultyPreset('hard')
      })

      expect(result.current.resolvedGameConfig).toEqual({
        difficulty: 12, // from hard preset
        gameType: 'complement-pairs', // from hard preset
      })
    })
  })
})
