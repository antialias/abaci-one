/**
 * The abacus notice after a game break, before the real `ActiveSession`
 * (plan §8 A19): the notice comes first, the part's first item after it, and
 * the item's response time counts from when the item is shown, never the
 * time the kid spent on the notice.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BreakRecord, SessionPlan } from '@/db/schema/session-plans'
import { liveMidPartOneSession } from '@/test/fixtures/session-report'
import { AbacusNoticeGate } from '../AbacusNoticeGate'
import { ActiveSession } from '../ActiveSession'

vi.mock('@/contexts/MyAbacusContext', () => ({
  useMyAbacus: () => ({
    isDockedByUser: false,
    requestDock: vi.fn(),
    undock: vi.fn(),
    dock: vi.fn(),
    setDockedValue: vi.fn(),
    visionConfig: { enabled: false, remoteCameraSessionId: null },
    captureTrainingColumns: vi.fn(),
    setVisionRemoteSession: vi.fn(),
  }),
}))
vi.mock('@/contexts/ThemeContext', () => ({ useTheme: () => ({ resolvedTheme: 'light' }) }))
vi.mock('@soroban/abacus-react', async (importActual) => ({
  ...(await importActual<typeof import('@soroban/abacus-react')>()),
  useAbacusDisplay: () => ({ config: {} }),
}))
vi.mock('@/hooks/useSessionPlan', () => ({
  useSetRemoteCameraSession: () => ({ mutate: vi.fn() }),
}))
vi.mock('../../AbacusDock', () => ({ AbacusDock: () => null }))
vi.mock('../../decomposition', () => ({
  DecompositionProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  DecompositionSection: () => null,
}))
vi.mock('../AssistanceDebugPanel', () => ({ AssistanceDebugPanel: () => null }))
vi.mock('../NumericKeypad', () => ({ NumericKeypad: () => null }))
vi.mock('../PracticeHelpOverlay', () => ({ PracticeHelpOverlay: () => null }))
vi.mock('../hooks/usePartTransitionAudio', () => ({ usePartTransitionAudio: () => {} }))
vi.mock('../hooks/useDeviceDetection', async (importActual) => ({
  ...(await importActual<typeof import('../hooks/useDeviceDetection')>()),
  useHasPhysicalKeyboard: () => false,
}))

const student = { id: 'kid-1', name: 'Kid', emoji: '🦊', color: 'blue' }

/** Practice resumes at part 2 (visualization) after a skipped break that followed part 1 (abacus). */
function afterBreakPlan(): SessionPlan {
  const skipped: BreakRecord = {
    breakIndex: 0,
    afterPartIndex: 0,
    startedAt: new Date(0).toISOString(),
    endedAt: new Date(1000).toISOString(),
    reason: 'skipped',
    game: null,
  }
  return {
    ...liveMidPartOneSession().plan,
    flowState: 'practicing',
    currentPartIndex: 1,
    partStates: {},
    results: [],
    breaks: [skipped],
  }
}

describe('AbacusNoticeGate — the notice after a break, before the first item', () => {
  let now = 1_000_000
  beforeEach(() => {
    now = 1_000_000
    vi.spyOn(Date, 'now').mockImplementation(() => now)
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows the notice first, then the item, whose response time excludes the notice', async () => {
    const plan = afterBreakPlan()
    const onAnswer = vi.fn((_result: { responseTimeMs: number; slotId: string }) =>
      Promise.resolve()
    )
    const onShown = vi.fn()
    const onEnded = vi.fn()
    const client = new QueryClient()
    const page = render(
      <QueryClientProvider client={client}>
        <AbacusNoticeGate plan={plan} student={student} onShown={onShown} onEnded={onEnded}>
          <ActiveSession
            plan={plan}
            student={student}
            onAnswer={onAnswer as never}
            onEndEarly={vi.fn()}
            debug
          />
        </AbacusNoticeGate>
      </QueryClientProvider>
    )
    const q = (selector: string) => page.container.querySelector(selector)

    // The notice, and no session under it
    expect(q('[data-component="abacus-notice-screen"]')).toBeInTheDocument()
    expect(q('[data-element="abacus-action"]')).toHaveTextContent('Put your abacus aside')
    expect(q('[data-component="active-session"]')).toBeNull()
    expect(onShown).toHaveBeenCalledTimes(1)

    // The kid reads it for 5 s, then taps Continue
    now += 5000
    const proceed = q('[data-action="continue-abacus-notice"]')
    if (!proceed) throw new Error('no Continue on the notice')
    act(() => {
      fireEvent.click(proceed)
    })
    expect(q('[data-component="abacus-notice-screen"]')).toBeNull()
    expect(onEnded).toHaveBeenCalledTimes(1)

    // The part's first item is on screen
    await waitFor(() => expect(q('[data-action="debug-submit-correct"]')).toBeInTheDocument())

    // 2 s on the item, then the answer
    now += 2000
    await act(async () => {
      fireEvent.click(q('[data-action="debug-submit-correct"]') as Element)
    })
    await waitFor(() => expect(onAnswer).toHaveBeenCalledTimes(1))
    const answered = onAnswer.mock.calls[0][0]
    expect(answered.slotId).toBe(plan.parts[1].slots[0].slotId)
    expect(answered.responseTimeMs).toBe(2000)
    page.unmount()
  })

  it('a part that already has a try shows the item straight away', () => {
    const fresh = afterBreakPlan()
    const answered = liveMidPartOneSession().plan.results[0]
    const plan: SessionPlan = {
      ...fresh,
      results: [{ ...answered, slotId: 'fx-p1s0', partNumber: 2, partIndex: 1, slotIndex: 0 }],
    }
    const page = render(
      <AbacusNoticeGate plan={plan} student={student}>
        <div data-component="active-session" />
      </AbacusNoticeGate>
    )
    expect(page.container.querySelector('[data-component="abacus-notice-screen"]')).toBeNull()
    expect(page.container.querySelector('[data-component="active-session"]')).toBeInTheDocument()
  })
})
