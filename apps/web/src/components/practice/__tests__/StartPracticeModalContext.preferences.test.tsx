/**
 * Tests for saved session preferences integration in StartPracticeModalContext.
 *
 * Covers: initial state from savedPreferences, save effect behavior,
 * priority ordering, and edge cases.
 */
import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import type { PlayerSessionPreferencesConfig } from '@/db/schema/player-session-preferences'
import { DEFAULT_SESSION_PREFERENCES } from '@/db/schema/player-session-preferences'
import type { SessionMode } from '@/lib/curriculum/session-mode'
import type { CurriculumPhase } from '@/lib/curriculum/definitions'
import { StartPracticeModalProvider, useStartPracticeModal } from '../StartPracticeModalContext'

// Mock hooks and dependencies (same as existing test file)
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    setQueryData: vi.fn(),
    invalidateQueries: vi.fn(),
    cancelQueries: vi.fn(),
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

vi.mock('@/lib/arcade/practice-approved-games', () => ({
  getPracticeApprovedGames: () => [
    { manifest: { name: 'game1', displayName: 'Game One', icon: '🎮' } },
    { manifest: { name: 'game2', displayName: 'Game Two', icon: '🎯' } },
  ],
}))

vi.mock('@/lib/curriculum/skill-tutorial-config', () => ({
  getSkillTutorialConfig: () => null,
}))

// Mock session modes
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

// Non-default saved preferences for testing
const customPreferences: PlayerSessionPreferencesConfig = {
  durationMinutes: 20,
  problemLengthPreference: 'shorter',
  partWeights: { abacus: 1, visualization: 2, linear: 1 },
  purposeWeights: { focus: 2, reinforce: 2, review: 0, challenge: 1 },
  shufflePurposes: false,
  gameBreakEnabled: false,
  gameBreakMinutes: 3,
  gameBreakSelectionMode: 'auto-start',
  gameBreakSelectedGame: 'game1',
  gameBreakDifficultyPreset: 'hard',
  gameBreakEnabledGames: ['game1', 'game2'],
}

// ============================================================================
// Wrapper factory
// ============================================================================

interface WrapperOverrides {
  sessionMode?: SessionMode
  savedPreferences?: PlayerSessionPreferencesConfig | null
  onSavePreferences?: (prefs: PlayerSessionPreferencesConfig) => void
  existingPlan?: { targetDurationMinutes: number } | null
}

/** Default savedPreferences that enables game breaks with the mocked games */
const defaultSavedPreferences: PlayerSessionPreferencesConfig = {
  ...DEFAULT_SESSION_PREFERENCES,
  gameBreakEnabledGames: ['game1', 'game2'],
}

function createWrapper(overrides: WrapperOverrides = {}) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <StartPracticeModalProvider
        studentId="test-student"
        studentName="Test Student"
        focusDescription="Test focus"
        sessionMode={overrides.sessionMode ?? defaultSessionMode}
        savedPreferences={'savedPreferences' in overrides ? overrides.savedPreferences : defaultSavedPreferences}
        onSavePreferences={overrides.onSavePreferences}
        existingPlan={overrides.existingPlan as any}
      >
        {children}
      </StartPracticeModalProvider>
    )
  }
}

// ============================================================================
// Tests
// ============================================================================

describe('StartPracticeModalContext — Saved Preferences', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // --------------------------------------------------------------------------
  // Initial state from saved preferences
  // --------------------------------------------------------------------------

  describe('Initial state from savedPreferences', () => {
    it('uses default values when no savedPreferences provided', () => {
      const { result } = renderHook(() => useStartPracticeModal(), {
        wrapper: createWrapper(),
      })

      expect(result.current.durationMinutes).toBe(10)
      expect(result.current.problemLengthPreference).toBe('recommended')
      expect(result.current.partWeights).toEqual({ abacus: 2, visualization: 1, linear: 0 })
      expect(result.current.purposeWeights).toEqual({
        focus: 3,
        reinforce: 1,
        review: 1,
        challenge: 1,
      })
      expect(result.current.shufflePurposes).toBe(true)
      expect(result.current.gameBreakEnabled).toBe(true)
      expect(result.current.gameBreakMinutes).toBe(5)
    })

    it('uses default values when savedPreferences is null', () => {
      const { result } = renderHook(() => useStartPracticeModal(), {
        wrapper: createWrapper({ savedPreferences: null }),
      })

      expect(result.current.durationMinutes).toBe(10)
      expect(result.current.problemLengthPreference).toBe('recommended')
      expect(result.current.partWeights).toEqual({ abacus: 2, visualization: 1, linear: 0 })
    })

    it('initializes duration from savedPreferences', () => {
      const { result } = renderHook(() => useStartPracticeModal(), {
        wrapper: createWrapper({ savedPreferences: customPreferences }),
      })

      expect(result.current.durationMinutes).toBe(20)
    })

    it('initializes problemLengthPreference from savedPreferences', () => {
      const { result } = renderHook(() => useStartPracticeModal(), {
        wrapper: createWrapper({ savedPreferences: customPreferences }),
      })

      expect(result.current.problemLengthPreference).toBe('shorter')
    })

    it('initializes partWeights from savedPreferences', () => {
      const { result } = renderHook(() => useStartPracticeModal(), {
        wrapper: createWrapper({ savedPreferences: customPreferences }),
      })

      expect(result.current.partWeights).toEqual({ abacus: 1, visualization: 2, linear: 1 })
    })

    it('initializes purposeWeights from savedPreferences', () => {
      const { result } = renderHook(() => useStartPracticeModal(), {
        wrapper: createWrapper({ savedPreferences: customPreferences }),
      })

      expect(result.current.purposeWeights).toEqual({
        focus: 2,
        reinforce: 2,
        review: 0,
        challenge: 1,
      })
    })

    it('initializes shufflePurposes from savedPreferences', () => {
      const { result } = renderHook(() => useStartPracticeModal(), {
        wrapper: createWrapper({ savedPreferences: customPreferences }),
      })

      expect(result.current.shufflePurposes).toBe(false)
    })

    it('initializes gameBreakEnabled from savedPreferences', () => {
      const { result } = renderHook(() => useStartPracticeModal(), {
        wrapper: createWrapper({ savedPreferences: customPreferences }),
      })

      expect(result.current.gameBreakEnabled).toBe(false)
    })

    it('initializes gameBreakMinutes from savedPreferences', () => {
      const { result } = renderHook(() => useStartPracticeModal(), {
        wrapper: createWrapper({ savedPreferences: customPreferences }),
      })

      expect(result.current.gameBreakMinutes).toBe(3)
    })

    it('initializes gameBreakDifficultyPreset from savedPreferences', () => {
      const { result } = renderHook(() => useStartPracticeModal(), {
        wrapper: createWrapper({ savedPreferences: customPreferences }),
      })

      expect(result.current.gameBreakDifficultyPreset).toBe('hard')
    })

    it('initializes all 10 persisted settings from savedPreferences at once', () => {
      const { result } = renderHook(() => useStartPracticeModal(), {
        wrapper: createWrapper({ savedPreferences: customPreferences }),
      })

      expect(result.current.durationMinutes).toBe(customPreferences.durationMinutes)
      expect(result.current.problemLengthPreference).toBe(customPreferences.problemLengthPreference)
      expect(result.current.partWeights).toEqual(customPreferences.partWeights)
      expect(result.current.purposeWeights).toEqual(customPreferences.purposeWeights)
      expect(result.current.shufflePurposes).toBe(customPreferences.shufflePurposes)
      expect(result.current.gameBreakEnabled).toBe(customPreferences.gameBreakEnabled)
      expect(result.current.gameBreakMinutes).toBe(customPreferences.gameBreakMinutes)
      expect(result.current.gameBreakDifficultyPreset).toBe(
        customPreferences.gameBreakDifficultyPreset
      )
    })
  })

  // --------------------------------------------------------------------------
  // Priority: savedPreferences vs existingPlan vs defaults
  // --------------------------------------------------------------------------

  describe('Priority ordering', () => {
    it('savedPreferences takes priority over existingPlan for duration', () => {
      const { result } = renderHook(() => useStartPracticeModal(), {
        wrapper: createWrapper({
          savedPreferences: { ...DEFAULT_SESSION_PREFERENCES, durationMinutes: 20 },
          existingPlan: { targetDurationMinutes: 15 },
        }),
      })

      expect(result.current.durationMinutes).toBe(20)
    })

    it('existingPlan is used for duration when no savedPreferences', () => {
      const { result } = renderHook(() => useStartPracticeModal(), {
        wrapper: createWrapper({
          savedPreferences: undefined,
          existingPlan: { targetDurationMinutes: 15 },
        }),
      })

      expect(result.current.durationMinutes).toBe(15)
    })

    it('falls back to default 10 when no savedPreferences and no existingPlan', () => {
      const { result } = renderHook(() => useStartPracticeModal(), {
        wrapper: createWrapper({
          savedPreferences: undefined,
          existingPlan: null,
        }),
      })

      expect(result.current.durationMinutes).toBe(10)
    })
  })

  // --------------------------------------------------------------------------
  // Save effect behavior
  // --------------------------------------------------------------------------

  describe('Save effect', () => {
    it('does NOT fire onSavePreferences on initial mount', () => {
      const onSave = vi.fn()

      renderHook(() => useStartPracticeModal(), {
        wrapper: createWrapper({ onSavePreferences: onSave }),
      })

      expect(onSave).not.toHaveBeenCalled()
    })

    it('does NOT fire onSavePreferences when mounted with savedPreferences', () => {
      const onSave = vi.fn()

      renderHook(() => useStartPracticeModal(), {
        wrapper: createWrapper({
          savedPreferences: customPreferences,
          onSavePreferences: onSave,
        }),
      })

      expect(onSave).not.toHaveBeenCalled()
    })

    it('fires onSavePreferences when duration changes', () => {
      const onSave = vi.fn()

      const { result } = renderHook(() => useStartPracticeModal(), {
        wrapper: createWrapper({ onSavePreferences: onSave }),
      })

      act(() => {
        result.current.setDurationMinutes(15)
      })

      expect(onSave).toHaveBeenCalledTimes(1)
      expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ durationMinutes: 15 }))
    })

    it('fires onSavePreferences when problemLengthPreference changes', () => {
      const onSave = vi.fn()

      const { result } = renderHook(() => useStartPracticeModal(), {
        wrapper: createWrapper({ onSavePreferences: onSave }),
      })

      act(() => {
        result.current.setProblemLengthPreference('shorter')
      })

      expect(onSave).toHaveBeenCalledTimes(1)
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({ problemLengthPreference: 'shorter' })
      )
    })

    it('fires onSavePreferences when partWeights change via cyclePartWeight', () => {
      const onSave = vi.fn()

      const { result } = renderHook(() => useStartPracticeModal(), {
        wrapper: createWrapper({ onSavePreferences: onSave }),
      })

      act(() => {
        // Enable linear (0→1)
        result.current.cyclePartWeight('linear')
      })

      expect(onSave).toHaveBeenCalledTimes(1)
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          partWeights: { abacus: 2, visualization: 1, linear: 1 },
        })
      )
    })

    it('fires onSavePreferences when purposeWeights change', () => {
      const onSave = vi.fn()

      const { result } = renderHook(() => useStartPracticeModal(), {
        wrapper: createWrapper({ onSavePreferences: onSave }),
      })

      act(() => {
        // Disable review (set to 0)
        result.current.disablePurpose('review')
      })

      expect(onSave).toHaveBeenCalledTimes(1)
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          purposeWeights: { focus: 3, reinforce: 1, review: 0, challenge: 1 },
        })
      )
    })

    it('fires onSavePreferences when shufflePurposes changes', () => {
      const onSave = vi.fn()

      const { result } = renderHook(() => useStartPracticeModal(), {
        wrapper: createWrapper({ onSavePreferences: onSave }),
      })

      act(() => {
        result.current.setShufflePurposes(false)
      })

      expect(onSave).toHaveBeenCalledTimes(1)
      expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ shufflePurposes: false }))
    })

    it('fires onSavePreferences when gameBreakEnabled changes', () => {
      const onSave = vi.fn()

      const { result } = renderHook(() => useStartPracticeModal(), {
        wrapper: createWrapper({ onSavePreferences: onSave }),
      })

      act(() => {
        result.current.setGameBreakEnabled(false)
      })

      expect(onSave).toHaveBeenCalledTimes(1)
      expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ gameBreakEnabled: false }))
    })

    it('fires onSavePreferences when gameBreakMinutes changes', () => {
      const onSave = vi.fn()

      const { result } = renderHook(() => useStartPracticeModal(), {
        wrapper: createWrapper({ onSavePreferences: onSave }),
      })

      act(() => {
        result.current.setGameBreakMinutes(3)
      })

      expect(onSave).toHaveBeenCalledTimes(1)
      expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ gameBreakMinutes: 3 }))
    })

    it('fires onSavePreferences when gameBreakDifficultyPreset changes', () => {
      const onSave = vi.fn()

      const { result } = renderHook(() => useStartPracticeModal(), {
        wrapper: createWrapper({ onSavePreferences: onSave }),
      })

      act(() => {
        result.current.setGameBreakDifficultyPreset('easy')
      })

      expect(onSave).toHaveBeenCalledTimes(1)
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({ gameBreakDifficultyPreset: 'easy' })
      )
    })

    it('does NOT fire onSavePreferences when setting same value (no-op)', () => {
      const onSave = vi.fn()

      const { result } = renderHook(() => useStartPracticeModal(), {
        wrapper: createWrapper({ onSavePreferences: onSave }),
      })

      // Set duration to same default value
      act(() => {
        result.current.setDurationMinutes(10)
      })

      // Should not fire because JSON is identical
      expect(onSave).not.toHaveBeenCalled()
    })

    it('includes all 11 persisted settings in the save payload', () => {
      const onSave = vi.fn()

      const { result } = renderHook(() => useStartPracticeModal(), {
        wrapper: createWrapper({ onSavePreferences: onSave }),
      })

      act(() => {
        result.current.setDurationMinutes(20)
      })

      expect(onSave).toHaveBeenCalledTimes(1)
      const payload = onSave.mock.calls[0][0] as PlayerSessionPreferencesConfig
      expect(payload).toHaveProperty('durationMinutes')
      expect(payload).toHaveProperty('problemLengthPreference')
      expect(payload).toHaveProperty('partWeights')
      expect(payload).toHaveProperty('purposeWeights')
      expect(payload).toHaveProperty('shufflePurposes')
      expect(payload).toHaveProperty('gameBreakEnabled')
      expect(payload).toHaveProperty('gameBreakMinutes')
      expect(payload).toHaveProperty('gameBreakSelectionMode')
      expect(payload).toHaveProperty('gameBreakSelectedGame')
      expect(payload).toHaveProperty('gameBreakDifficultyPreset')
      expect(payload).toHaveProperty('gameBreakEnabledGames')
    })

    it('batches rapid changes into the latest config snapshot', () => {
      const onSave = vi.fn()

      const { result } = renderHook(() => useStartPracticeModal(), {
        wrapper: createWrapper({ onSavePreferences: onSave }),
      })

      // Multiple changes in one act
      act(() => {
        result.current.setDurationMinutes(15)
        result.current.setProblemLengthPreference('longer')
      })

      // The effect fires once after the batch with the latest values
      expect(onSave).toHaveBeenCalledTimes(1)
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          durationMinutes: 15,
          problemLengthPreference: 'longer',
        })
      )
    })
  })

  // --------------------------------------------------------------------------
  // gameBreakSelectedGame mapping for 'random'
  // --------------------------------------------------------------------------

  describe('gameBreakSelectedGame persistence', () => {
    it('maps "random" selection to null in save payload', () => {
      const onSave = vi.fn()

      // Start with a specific game selected so switching to 'random' is a real change
      const prefsWithGame: PlayerSessionPreferencesConfig = {
        ...DEFAULT_SESSION_PREFERENCES,
        gameBreakSelectedGame: 'game1',
      }

      const { result } = renderHook(() => useStartPracticeModal(), {
        wrapper: createWrapper({
          savedPreferences: prefsWithGame,
          onSavePreferences: onSave,
        }),
      })

      act(() => {
        result.current.setGameBreakSelectedGame('random')
      })

      expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ gameBreakSelectedGame: null }))
    })

    it('persists specific game name in save payload', () => {
      const onSave = vi.fn()

      const { result } = renderHook(() => useStartPracticeModal(), {
        wrapper: createWrapper({ onSavePreferences: onSave }),
      })

      act(() => {
        result.current.setGameBreakSelectedGame('game1')
      })

      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({ gameBreakSelectedGame: 'game1' })
      )
    })
  })
})
