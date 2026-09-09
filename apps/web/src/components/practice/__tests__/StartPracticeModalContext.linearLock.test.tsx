/**
 * When derived readiness locks number sentences, the context is the single place
 * that keeps linear out of the plan request — even if the saved preference had it on.
 */
import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_SESSION_PREFERENCES } from '@/db/schema/player-session-preferences'
import type { SessionMode } from '@/lib/curriculum/session-mode'
import { StartPracticeModalProvider, useStartPracticeModal } from '../StartPracticeModalContext'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ setQueryData: vi.fn(), invalidateQueries: vi.fn() }),
}))

const { mutation } = vi.hoisted(() => ({
  mutation: () => ({ mutateAsync: vi.fn(), isPending: false, error: null, reset: vi.fn() }),
}))

vi.mock('@/hooks/useSessionPlan', () => ({
  useGenerateSessionPlan: () => ({
    ...mutation(),
    taskId: null,
    taskState: null,
    progress: 0,
    progressMessage: null,
    plan: null,
    isGenerating: false,
    isComplete: false,
    taskError: null,
  }),
  useApproveSessionPlan: mutation,
  useStartSessionPlan: mutation,
  useAbandonSession: mutation,
  ActiveSessionExistsClientError: class extends Error {
    existingPlan = null
  },
  NoSkillsEnabledClientError: class extends Error {},
  SessionLimitReachedError: class extends Error {},
  sessionPlanKeys: { active: (id: string) => ['session-plan', 'active', id] },
}))

vi.mock('@/lib/arcade/practice-approved-games', () => ({
  getPracticeApprovedGames: () => [],
}))

const sessionMode: SessionMode = {
  type: 'remediation',
  weakSkills: [
    { skillId: 'weak1', displayName: 'Weak Skill 1', pKnown: 0.3, hasMathSentence: true },
  ],
  focusDescription: 'Strengthening weak skills',
}

function wrapper(linearLocked: boolean, partWeights = { abacus: 2, visualization: 1, linear: 1 }) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <StartPracticeModalProvider
        studentId="test-student"
        studentName="Test Student"
        focusDescription="Test focus"
        sessionMode={sessionMode}
        linearLocked={linearLocked}
        savedPreferences={{
          ...DEFAULT_SESSION_PREFERENCES,
          partWeights,
        }}
      >
        {children}
      </StartPracticeModalProvider>
    )
  }
}

describe('StartPracticeModalContext — linear lock', () => {
  it('forces linear out of the effective weights and enabled parts', () => {
    const { result } = renderHook(() => useStartPracticeModal(), { wrapper: wrapper(true) })
    expect(result.current.linearLocked).toBe(true)
    expect(result.current.enabledParts.linear).toBe(false)
    expect(result.current.partWeights.linear).toBe(0)
    expect(result.current.enabledPartCount).toBe(2)
  })

  it('cycling the locked part is a no-op', () => {
    const { result } = renderHook(() => useStartPracticeModal(), { wrapper: wrapper(true) })
    act(() => result.current.cyclePartWeight('linear'))
    expect(result.current.partWeights.linear).toBe(0)
    expect(result.current.enabledParts.linear).toBe(false)
  })

  it('cannot disable the last effectively-active part behind a locked one', () => {
    const { result } = renderHook(() => useStartPracticeModal(), { wrapper: wrapper(true) })
    act(() => result.current.disablePart('visualization'))
    expect(result.current.partWeights.visualization).toBe(0)
    // abacus is now the only live part; linear (locked) must not count as a fallback
    act(() => result.current.disablePart('abacus'))
    expect(result.current.partWeights.abacus).toBe(2)
    expect(result.current.enabledPartCount).toBe(1)
  })

  it('falls back to the default split when the lock would zero every part', () => {
    // Saved while linear was available: number sentences only. Locked now.
    const { result } = renderHook(() => useStartPracticeModal(), {
      wrapper: wrapper(true, { abacus: 0, visualization: 0, linear: 1 }),
    })
    expect(result.current.partWeights).toEqual({ abacus: 2, visualization: 1, linear: 0 })
    expect(result.current.enabledPartCount).toBe(2)
  })

  it('leaves the saved preference in force when not locked', () => {
    const { result } = renderHook(() => useStartPracticeModal(), { wrapper: wrapper(false) })
    expect(result.current.linearLocked).toBe(false)
    expect(result.current.enabledParts.linear).toBe(true)
    expect(result.current.partWeights.linear).toBe(1)
  })
})
