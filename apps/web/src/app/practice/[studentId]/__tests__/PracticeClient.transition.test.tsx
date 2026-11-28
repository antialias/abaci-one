/**
 * The kid's practice page reads position from the server (Phase 5b):
 * - the part-transition screen comes from the server's `flowState` alone, in
 *   the first frame of `part_transition` (no effect watches the part index or
 *   sets the overlay after a paint); the screen and the broadcast name the
 *   parts as their kinds show them;
 * - the HUD's counts come from the session report alone;
 * - a do-over write names its item;
 * - the abacus notice sits right before its part: on the transition screen
 *   when no break follows, after the break otherwise, before the session
 *   mounts (plan §8 A19).
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { type ReactNode, useLayoutEffect } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SessionHudData } from '@/components/practice'
import type { RecordRedoParams } from '@/components/practice/ActiveSession'
import type { Player } from '@/db/schema/players'
import type {
  BreakRecord,
  GameBreakSettings,
  SessionPart,
  SessionPlan,
  SlotResult,
} from '@/db/schema/session-plans'
import type { SessionReport } from '@/lib/curriculum/session-report'
import {
  liveMidPartOneSession,
  reportOf,
  tenProblemSessionReport,
} from '@/test/fixtures/session-report'
import { hudCountsOf, PracticeClient } from '../PracticeClient'

const h = vi.hoisted(() => ({
  plan: null as unknown,
  report: undefined as unknown,
  reportSources: [] as unknown[],
  viewerId: 'viewer-1' as string | undefined,
  hud: undefined as unknown,
  activeProps: undefined as unknown,
  // One entry per commit of ActiveSession: its plan's flowState and whether
  // the transition overlay was in the DOM at that commit
  commits: [] as Array<{ flowState: string; overlay: boolean }>,
  recordRedo: vi.fn(),
  recordResult: vi.fn((_v: unknown) => new Promise(() => {})),
  sendPartTransition: vi.fn(),
  sendPartTransitionComplete: vi.fn(),
  sendProblemMarker: vi.fn(),
  push: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: h.push }),
  useSearchParams: () => new URLSearchParams(),
}))
vi.mock('@/components/common/ToastContext', () => ({ useToast: () => ({ showError: vi.fn() }) }))
vi.mock('@/components/PageWithNav', () => ({
  PageWithNav: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))
function MockActiveSession(props: { plan: SessionPlan }) {
  h.activeProps = props
  useLayoutEffect(() => {
    h.commits.push({
      flowState: props.plan.flowState ?? 'practicing',
      overlay: document.querySelector('[data-testid="transition-screen"]') !== null,
    })
  })
  return <div data-testid="active-session" />
}
vi.mock('@/components/practice', () => ({
  ActiveSession: (props: { plan: SessionPlan }) => <MockActiveSession {...props} />,
  PracticeErrorBoundary: ({ children }: { children: ReactNode }) => <>{children}</>,
  PracticeSubNav: ({ sessionHud }: { sessionHud?: unknown }) => {
    h.hud = sessionHud
    return null
  },
}))
vi.mock('@/components/practice/GameBreakResultsScreen', () => ({
  GameBreakResultsScreen: () => null,
}))
vi.mock('@/components/practice/GameBreakScreen', () => ({ GameBreakScreen: () => null }))
vi.mock('@/components/practice/PartTransitionScreen', async (importActual) => {
  const actual = await importActual<typeof import('@/components/practice/PartTransitionScreen')>()
  return {
    ...actual,
    PartTransitionScreen: ({
      previous,
      next,
      abacusNotice,
      variant,
      onComplete,
    }: {
      previous: { label: string } | null
      next: { label: string }
      abacusNotice: string | null
      variant?: string
      onComplete: () => void
    }) => (
      <div
        data-testid="transition-screen"
        data-previous={previous?.label ?? 'start'}
        data-next={next.label}
        data-notice={abacusNotice ?? 'none'}
        data-variant={variant ?? 'transition'}
      >
        <button type="button" onClick={onComplete}>
          Continue
        </button>
      </div>
    ),
  }
})
vi.mock('@/components/debug/BroadcastDebugPanel', () => ({ BroadcastDebugPanel: () => null }))
vi.mock('@/contexts/MyAbacusContext', () => ({
  useMyAbacus: () => ({ setVisionFrameCallback: vi.fn() }),
}))
vi.mock('@/hooks/useGameResults', () => ({ useSaveGameResult: () => ({ mutate: vi.fn() }) }))
vi.mock('@/hooks/useSessionBroadcast', () => ({
  useSessionBroadcast: () => ({
    isConnected: false,
    isBroadcasting: false,
    sendPartTransition: h.sendPartTransition,
    sendPartTransitionComplete: h.sendPartTransitionComplete,
    sendVisionFrame: vi.fn(),
    isRecording: false,
    recordingId: null,
    startVisionRecording: vi.fn(),
    stopVisionRecording: vi.fn(),
    sendProblemMarker: h.sendProblemMarker,
    readyObservers: [],
  }),
}))
vi.mock('@/hooks/useSessionMode', () => ({ useSessionMode: () => ({ data: undefined }) }))
vi.mock('@/hooks/useSessionReport', () => ({
  useSessionReport: (source: unknown) => {
    h.reportSources.push(source)
    return { data: h.report }
  },
}))
vi.mock('@/hooks/useSessionSongTrigger', () => ({ useSessionSongTrigger: () => {} }))
vi.mock('@/hooks/useUserId', () => ({ useUserId: () => ({ data: h.viewerId }) }))
vi.mock('@/hooks/useSessionPlan', () => {
  const mutation = () => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn(() => new Promise(() => {})),
    isPending: false,
  })
  return {
    isQuietFlowEventFailure: () => true,
    isQuietTryWriteFailure: () => true,
    sessionPlanKeys: { active: (id: string) => ['active', id] },
    useActiveSessionPlan: () => ({ data: h.plan }),
    useAcknowledgeGameBreakResults: mutation,
    useCompletePartTransition: mutation,
    useEndSessionEarly: mutation,
    useFinishGameBreak: mutation,
    useRecordRedoResult: () => ({ ...mutation(), mutateAsync: h.recordRedo }),
    useRecordSlotResult: () => ({ ...mutation(), mutateAsync: h.recordResult }),
    useStartGameBreak: mutation,
  }
})

function part(partNumber: 1 | 2 | 3, type: SessionPart['type']): SessionPart {
  return {
    partNumber,
    type,
    format: type === 'linear' ? 'linear' : 'vertical',
    useAbacus: type === 'abacus',
    slots: [
      {
        slotId: `p${partNumber}s0`,
        index: 0,
        purpose: 'focus',
        constraints: {},
        problem: { terms: [1, 1], answer: 2, skillsRequired: [] },
      },
    ],
    estimatedMinutes: 1,
  }
}

function plan(over: Partial<SessionPlan>): SessionPlan {
  return {
    id: 'plan-1',
    playerId: 'kid-1',
    status: 'in_progress',
    flowState: 'practicing',
    flowVersion: 1,
    parts: [part(1, 'abacus'), part(2, 'linear')],
    currentPartIndex: 0,
    results: [],
    partStates: null,
    gameBreakSettings: null,
    sessionHealth: null,
    completedAt: null,
    ...over,
  } as unknown as SessionPlan
}

const player = { id: 'kid-1', name: 'Kid', emoji: '🦊', color: 'blue' } as Player

function renderPage(initial: SessionPlan) {
  h.plan = initial
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const ui = () => (
    <QueryClientProvider client={client}>
      <PracticeClient studentId="kid-1" player={player} initialSession={initial} />
    </QueryClientProvider>
  )
  const result = render(ui())
  return {
    ...result,
    showPlan(next: SessionPlan) {
      h.plan = next
      result.rerender(ui())
    },
  }
}

describe('PracticeClient — the transition screen comes from flowState', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    h.report = undefined
    h.reportSources = []
    h.viewerId = 'viewer-1'
    h.commits = []
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response(JSON.stringify({ history: [] }))))
    )
  })

  it('shows the screen for a plan loaded fresh in part_transition, named by the kinds', () => {
    renderPage(plan({ flowState: 'part_transition', currentPartIndex: 1 }))
    const shown = screen.getByTestId('transition-screen')
    expect(shown).toHaveAttribute('data-previous', 'Abacus')
    expect(shown).toHaveAttribute('data-next', 'Equations')
    expect(h.sendPartTransition).toHaveBeenCalledTimes(1)
    expect(h.sendPartTransition).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'arithmetic', label: 'Abacus', presentation: 'abacus' }),
      expect.objectContaining({ kind: 'arithmetic', label: 'Equations', presentation: 'linear' }),
      expect.any(Number),
      7000
    )
  })

  it('has the overlay in the first commit of part_transition (no paint of the next part first)', () => {
    const page = renderPage(plan({ currentPartIndex: 0 }))
    page.showPlan(plan({ flowState: 'part_transition', currentPartIndex: 1, flowVersion: 2 }))
    const inTransition = h.commits.filter((c) => c.flowState === 'part_transition')
    expect(inTransition.length).toBeGreaterThan(0)
    expect(inTransition.every((c) => c.overlay)).toBe(true)
  })

  it('shows nothing when the part index moves while the plan is practicing', () => {
    const page = renderPage(plan({ currentPartIndex: 0 }))
    page.showPlan(plan({ currentPartIndex: 1, flowVersion: 2 }))
    expect(screen.queryByTestId('transition-screen')).toBeNull()
    expect(h.sendPartTransition).not.toHaveBeenCalled()
  })

  it('follows the server in and out, telling observers when the plan leaves', () => {
    const page = renderPage(plan({ currentPartIndex: 0 }))
    page.showPlan(plan({ flowState: 'part_transition', currentPartIndex: 1, flowVersion: 2 }))
    expect(screen.getByTestId('transition-screen')).toBeInTheDocument()
    expect(h.sendPartTransition).toHaveBeenCalledTimes(1)

    // A refetch of the same transition neither re-sends nor re-mounts
    page.showPlan(plan({ flowState: 'part_transition', currentPartIndex: 1, flowVersion: 2 }))
    expect(h.sendPartTransition).toHaveBeenCalledTimes(1)
    expect(h.sendPartTransitionComplete).not.toHaveBeenCalled()

    page.showPlan(plan({ currentPartIndex: 1, flowVersion: 3 }))
    expect(screen.queryByTestId('transition-screen')).toBeNull()
    expect(h.sendPartTransitionComplete).toHaveBeenCalledTimes(1)
  })
})

describe('PracticeClient — the abacus notice sits right before its part', () => {
  const breaksOn: GameBreakSettings = {
    enabled: true,
    maxDurationMinutes: 1,
    selectionMode: 'auto-start',
    selectedGame: 'matching',
  }
  const skippedBreak: BreakRecord = {
    breakIndex: 0,
    afterPartIndex: 0,
    startedAt: new Date(0).toISOString(),
    endedAt: new Date(1000).toISOString(),
    reason: 'skipped',
    game: null,
  }
  const answeredInPart2: SlotResult = {
    slotId: 'p2s0',
    partNumber: 2,
    partIndex: 1,
    slotIndex: 0,
    problem: { terms: [1, 1], answer: 2, skillsRequired: [] },
    studentAnswer: 2,
    isCorrect: true,
    responseTimeMs: 900,
    skillsExercised: [],
    usedOnScreenAbacus: false,
    timestamp: new Date(2000),
    hadHelp: false,
    incorrectAttempts: 0,
  } as unknown as SlotResult

  beforeEach(() => {
    vi.clearAllMocks()
    h.report = undefined
    h.commits = []
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response(JSON.stringify({ history: [] }))))
    )
  })

  it('no break follows: the transition screen carries the notice', () => {
    renderPage(plan({ flowState: 'part_transition', currentPartIndex: 1 }))
    expect(screen.getByTestId('transition-screen')).toHaveAttribute('data-notice', 'put_away')
  })

  it('a break follows: the transition screen carries none', () => {
    renderPage(
      plan({ flowState: 'part_transition', currentPartIndex: 1, gameBreakSettings: breaksOn })
    )
    expect(screen.getByTestId('transition-screen')).toHaveAttribute('data-notice', 'none')
  })

  it('after the break: the notice, then the session mounts; observers see it come and go', () => {
    const page = renderPage(
      plan({ flowState: 'break_active', currentPartIndex: 1, gameBreakSettings: breaksOn })
    )
    expect(screen.queryByTestId('transition-screen')).toBeNull()
    page.showPlan(
      plan({
        currentPartIndex: 1,
        flowVersion: 3,
        gameBreakSettings: breaksOn,
        breaks: [skippedBreak],
      })
    )
    const notice = screen.getByTestId('transition-screen')
    expect(notice).toHaveAttribute('data-variant', 'abacus-notice')
    expect(notice).toHaveAttribute('data-notice', 'put_away')
    expect(notice).toHaveAttribute('data-next', 'Equations')
    // The session is not mounted under the notice: its first item (and clock) waits
    expect(screen.queryByTestId('active-session')).toBeNull()
    expect(h.commits).toEqual([])
    expect(h.sendPartTransition).toHaveBeenCalledTimes(1)
    expect(h.sendPartTransition).toHaveBeenCalledWith(
      expect.objectContaining({ label: 'Abacus' }),
      expect.objectContaining({ label: 'Equations' }),
      expect.any(Number),
      7000
    )

    // A refetch of the same plan keeps the one notice
    page.showPlan(
      plan({
        currentPartIndex: 1,
        flowVersion: 3,
        gameBreakSettings: breaksOn,
        breaks: [skippedBreak],
      })
    )
    expect(h.sendPartTransition).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    expect(screen.queryByTestId('transition-screen')).toBeNull()
    expect(screen.getByTestId('active-session')).toBeInTheDocument()
    expect(h.commits.length).toBeGreaterThan(0)
    expect(h.commits.every((c) => !c.overlay)).toBe(true)
    expect(h.sendPartTransitionComplete).toHaveBeenCalledTimes(1)
  })

  it('a reload once the part has a try: no notice', () => {
    renderPage(
      plan({
        currentPartIndex: 1,
        gameBreakSettings: breaksOn,
        breaks: [skippedBreak],
        results: [answeredInPart2],
      })
    )
    expect(screen.queryByTestId('transition-screen')).toBeNull()
    expect(screen.getByTestId('active-session')).toBeInTheDocument()
  })
})

describe('PracticeClient — HUD counts from the report', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    h.reportSources = []
    h.viewerId = 'viewer-1'
    h.hud = undefined
  })

  it("gives the sub-nav the report's counts", () => {
    const fixture = liveMidPartOneSession()
    h.report = reportOf(fixture)
    renderPage(fixture.plan)
    const hud = h.hud as SessionHudData
    // 3 of 10 done; parts 2 and 3 plan 3 + 3, so 1 until the break
    expect(hud.progress).toEqual({ done: 3, total: 10 })
    expect(hud.laterPartItems).toBe(6)
  })

  it("reads the badge from the report's part when the plan has already moved on", () => {
    // Parts of 10/10/10. The answer's reply put the plan in part 2; the
    // report (pushed before it) still says part 1, 9 done. The badge reads
    // the report alone: 30 − 9 − 20 = 1 until the break, never the mix
    // 30 − 9 − 10 = 11.
    const fixture = liveMidPartOneSession()
    const live = reportOf(fixture)
    if (!live.position) throw new Error('fixture: live report has a position')
    h.report = {
      ...live,
      parts: live.parts.map((row) => ({ ...row, plannedProblems: 10 })),
      position: {
        ...live.position,
        segment: { kind: 'part', partIndex: 0 },
        progress: { done: 9, total: 30 },
      },
    } as SessionReport
    renderPage({ ...fixture.plan, currentPartIndex: 1 })
    const hud = h.hud as SessionHudData
    expect(hud.progress).toEqual({ done: 9, total: 30 })
    expect(hud.laterPartItems).toBe(20)
    const untilBreak =
      (hud.progress?.total ?? 0) - (hud.progress?.done ?? 0) - (hud.laterPartItems ?? 0)
    expect(untilBreak).toBe(1)
  })

  it('shows no counts before the report loads', () => {
    h.report = undefined
    renderPage(liveMidPartOneSession().plan)
    const hud = h.hud as SessionHudData
    expect(hud.progress).toBeUndefined()
    expect(hud.laterPartItems).toBeUndefined()
  })

  it('fetches the report before the viewer id is known', () => {
    h.viewerId = undefined
    h.report = undefined
    renderPage(liveMidPartOneSession().plan)
    expect(h.reportSources[0]).toEqual({ playerId: 'kid-1', planId: 'fx-live-p1', viewerId: null })
  })
})

describe('hudCountsOf', () => {
  const live = reportOf(liveMidPartOneSession())

  it("reads the later parts from the report's own part, whatever the plan says", () => {
    // The report is still in part 1 while a newer plan reply may be in part 2:
    // the badge reads one source (10 − 3 − 6 = 1, never 10 − 3 − 3)
    expect(hudCountsOf(live)).toEqual({ progress: { done: 3, total: 10 }, laterPartItems: 6 })
  })

  it('shows the final count for an ended report, not a blank', () => {
    const ended = tenProblemSessionReport()
    expect(ended.position).toBeNull()
    expect(hudCountsOf(ended)).toEqual({ progress: { done: 10, total: 10 }, laterPartItems: 0 })
  })

  it('has nothing without a report', () => {
    expect(hudCountsOf(undefined)).toEqual({})
    expect(hudCountsOf({ ...live, position: null } as SessionReport)).toEqual({})
  })
})

describe('PracticeClient — a do-over names its item', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    h.report = undefined
    h.recordRedo.mockResolvedValue(null)
  })

  it('sends the write ActiveSession builds, with itemId and slotId = itemId, and marks it', async () => {
    const { doOverWriteOf } = await import('@/components/practice/ActiveSession')
    const fixture = liveMidPartOneSession()
    renderPage(fixture.plan)
    const write = doOverWriteOf({
      playerId: 'kid-1',
      planId: fixture.plan.id,
      redo: { partIndex: 0, itemId: 'fx-p0s1' },
      slotIndex: 1,
      result: { isCorrect: true, slotIndex: 0, slotId: 'stale' } as Omit<
        SlotResult,
        'timestamp' | 'partNumber'
      > & { tryId: string },
      originalWasCorrect: false,
    })
    const { onRecordRedo } = h.activeProps as {
      onRecordRedo: (p: RecordRedoParams) => Promise<SessionPlan | null>
    }
    await act(async () => {
      await onRecordRedo(write)
    })
    expect(h.recordRedo).toHaveBeenCalledTimes(1)
    const sent = h.recordRedo.mock.calls[0][0] as RecordRedoParams
    expect(sent.redoContext).toEqual({
      itemId: 'fx-p0s1',
      originalPartIndex: 0,
      originalSlotIndex: 1,
      originalWasCorrect: false,
    })
    expect(sent.result).toMatchObject({ slotId: 'fx-p0s1', slotIndex: 1, originalSlotIndex: 1 })
    // The answer marker: the item's number in the dots (part 1, slot 1 → #2)
    expect(h.sendProblemMarker).toHaveBeenCalledWith(
      2,
      0,
      'answer-submitted',
      true,
      expect.objectContaining({ isManualRedo: true, epochNumber: 0 })
    )
  })
})

describe('PracticeClient — an answer resolves to the plan the server returned (K5a-3a)', () => {
  type OnAnswer = (r: unknown) => Promise<SessionPlan | null>
  const answerOf = (n: number) => ({
    tryId: `try-${n}`,
    partIndex: 0,
    slotIndex: 3,
    slotId: 'fx-p0s3',
    epochNumber: 0,
    problem: { terms: [13, 6], answer: 19, skillsRequired: [] },
    studentAnswer: 19,
    isCorrect: true,
    responseTimeMs: 1000,
    skillsExercised: [],
    usedOnScreenAbacus: false,
    hadHelp: false,
    incorrectAttempts: 0,
  })

  beforeEach(() => {
    vi.clearAllMocks()
    h.report = undefined
  })

  it('resolves to the plan the write returned', async () => {
    const fixture = liveMidPartOneSession()
    const returned = { ...fixture.plan, rowVersion: 99 }
    h.recordResult.mockImplementationOnce(() => Promise.resolve(returned))
    renderPage(fixture.plan)
    const { onAnswer } = h.activeProps as { onAnswer: OnAnswer }
    let resolved: SessionPlan | null | undefined
    await act(async () => {
      resolved = await onAnswer(answerOf(1))
    })
    expect(resolved).toBe(returned)
  })

  it('resolves null when the write fails, and null for the write dropped behind it', async () => {
    const fixture = liveMidPartOneSession()
    let fail: (e: Error) => void = () => {}
    h.recordResult
      .mockImplementationOnce(
        () =>
          new Promise((_, reject) => {
            fail = reject
          })
      )
      .mockImplementationOnce(() => Promise.resolve(fixture.plan))
    renderPage(fixture.plan)
    const { onAnswer } = h.activeProps as { onAnswer: OnAnswer }
    let first: SessionPlan | null | undefined
    let second: SessionPlan | null | undefined
    await act(async () => {
      const a = onAnswer(answerOf(1))
      const b = onAnswer(answerOf(2)) // queued behind the first
      // The queue starts the first write on its own turn
      await vi.waitFor(() => expect(h.recordResult).toHaveBeenCalledTimes(1))
      fail(new Error('boom'))
      first = await a
      second = await b
    })
    expect(first).toBeNull()
    expect(second).toBeNull()
    // The dropped write never ran
    expect(h.recordResult).toHaveBeenCalledTimes(1)
  })
})
