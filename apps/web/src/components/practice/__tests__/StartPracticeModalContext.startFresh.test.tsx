import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import type { SessionMode } from '@/lib/curriculum/session-mode'
import type { CurriculumPhase } from '@/lib/curriculum/definitions'
import type { SessionPlan } from '@/db/schema/session-plans'
import { StartPracticeModalProvider, useStartPracticeModal } from '../StartPracticeModalContext'
import { DEFAULT_SESSION_PREFERENCES } from '@/db/schema/player-session-preferences'

// Controllable mock functions
const mockGenerateMutateAsync = vi.fn()
const mockApproveMutateAsync = vi.fn()
const mockStartMutateAsync = vi.fn()
const mockAbandonMutateAsync = vi.fn()
const mockRouterPush = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockRouterPush,
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
    mutateAsync: mockGenerateMutateAsync,
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
    mutateAsync: mockApproveMutateAsync,
    isPending: false,
    error: null,
    reset: vi.fn(),
  }),
  useStartSessionPlan: () => ({
    mutateAsync: mockStartMutateAsync,
    isPending: false,
    error: null,
    reset: vi.fn(),
  }),
  useAbandonSession: () => ({
    mutateAsync: mockAbandonMutateAsync,
    isPending: false,
    error: null,
    reset: vi.fn(),
  }),
  ActiveSessionExistsClientError: class extends Error {
    existingPlan = null
  },
  NoSkillsEnabledClientError: class extends Error {},
  SessionLimitReachedError: class extends Error {},
  sessionPlanKeys: {
    active: (id: string) => ['session-plan', 'active', id],
  },
}))

vi.mock('@/lib/arcade/practice-approved-games', () => ({
  getPracticeApprovedGames: () => [
    { manifest: { name: 'game1', displayName: 'Game One', icon: 'G1' } },
    { manifest: { name: 'game2', displayName: 'Game Two', icon: 'G2' } },
  ],
}))

vi.mock('@/lib/curriculum/skill-tutorial-config', () => ({
  getSkillTutorialConfig: () => null,
}))

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
  nextSkill: {
    skillId: 'test-skill',
    displayName: 'Test Skill',
    pKnown: 0.8,
    hasMathSentence: true,
  },
  tutorialRequired: false,
  phase: mockPhase,
  skipCount: 0,
  focusDescription: 'Test focus',
  canSkipTutorial: true,
}

const existingPlan = {
  id: 'existing-plan-id',
  targetDurationMinutes: 10,
} as SessionPlan

function createWrapper(overrides: {
  existingPlan?: SessionPlan | null
  startFresh?: boolean
} = {}) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <StartPracticeModalProvider
        studentId="test-student"
        studentName="Test Student"
        focusDescription="Test focus"
        sessionMode={defaultSessionMode}
        existingPlan={overrides.existingPlan ?? null}
        startFresh={overrides.startFresh ?? false}
        savedPreferences={{
          ...DEFAULT_SESSION_PREFERENCES,
          gameBreakEnabledGames: ['game1', 'game2'],
        }}
      >
        {children}
      </StartPracticeModalProvider>
    )
  }
}

describe('StartPracticeModalContext - Start Fresh', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should reuse existing plan when not starting fresh and duration matches', async () => {
    const { result } = renderHook(() => useStartPracticeModal(), {
      wrapper: createWrapper({ existingPlan }),
    })

    await act(async () => {
      await result.current.handleStart()
    })

    // Should approve and start the existing plan, not generate a new one
    expect(mockApproveMutateAsync).toHaveBeenCalledWith({
      playerId: 'test-student',
      planId: 'existing-plan-id',
    })
    expect(mockStartMutateAsync).toHaveBeenCalledWith({
      playerId: 'test-student',
      planId: 'existing-plan-id',
    })
    expect(mockGenerateMutateAsync).not.toHaveBeenCalled()
    expect(mockAbandonMutateAsync).not.toHaveBeenCalled()
  })

  it('should NOT reuse existing plan when startFresh is true', async () => {
    const { result } = renderHook(() => useStartPracticeModal(), {
      wrapper: createWrapper({ existingPlan, startFresh: true }),
    })

    await act(async () => {
      await result.current.handleStart()
    })

    // Should NOT approve/start the existing plan
    expect(mockApproveMutateAsync).not.toHaveBeenCalled()
    expect(mockStartMutateAsync).not.toHaveBeenCalled()
    // Should abandon the existing session and generate a new plan
    expect(mockAbandonMutateAsync).toHaveBeenCalledWith({
      playerId: 'test-student',
      planId: 'existing-plan-id',
    })
    expect(mockGenerateMutateAsync).toHaveBeenCalled()
  })

  it('should abandon existing session before generating when startFresh', async () => {
    const callOrder: string[] = []
    mockAbandonMutateAsync.mockImplementation(async () => {
      callOrder.push('abandon')
    })
    mockGenerateMutateAsync.mockImplementation(async () => {
      callOrder.push('generate')
      return 'task-id'
    })

    const { result } = renderHook(() => useStartPracticeModal(), {
      wrapper: createWrapper({ existingPlan, startFresh: true }),
    })

    await act(async () => {
      await result.current.handleStart()
    })

    // Abandon must happen before generate
    expect(callOrder).toEqual(['abandon', 'generate'])
  })

  it('should generate new plan without abandoning when no existing plan', async () => {
    const { result } = renderHook(() => useStartPracticeModal(), {
      wrapper: createWrapper({ existingPlan: null, startFresh: true }),
    })

    await act(async () => {
      await result.current.handleStart()
    })

    expect(mockAbandonMutateAsync).not.toHaveBeenCalled()
    expect(mockGenerateMutateAsync).toHaveBeenCalled()
  })

  it('should generate new plan when not starting fresh but duration differs', async () => {
    const differentDurationPlan = {
      ...existingPlan,
      targetDurationMinutes: 20, // different from default 10
    } as SessionPlan

    const { result } = renderHook(() => useStartPracticeModal(), {
      wrapper: createWrapper({ existingPlan: differentDurationPlan }),
    })

    await act(async () => {
      await result.current.handleStart()
    })

    // Duration doesn't match, so it should generate a new plan (not reuse)
    expect(mockApproveMutateAsync).not.toHaveBeenCalled()
    expect(mockGenerateMutateAsync).toHaveBeenCalled()
  })
})
