/**
 * Advance after a try (practice-kinds K5a-3a, §6.14, §7 Q1): when a try waits
 * for its write (a retry round, the last item of a part, a do-over), the next
 * item comes from the plan the write returned, derived synchronously. Nothing
 * waits for the page to re-render with that plan, and nothing polls.
 *
 * Each case runs on fake timers. The write is held until the test resolves
 * it; from then on the clock moves by exactly the feedback delay (500 ms for a
 * correct answer, 1500 ms for a wrong one, UI pacing) and the screen has
 * advanced, with no further tick.
 *
 * In the retry-round cases the page does not re-render with the returned
 * plan inside that window: the screen must not need it. (Before K5a-3a the
 * screen polled a ref of the re-rendered plan every 50 ms for up to 500 ms,
 * then gave up and re-showed the plan it had.)
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render } from '@testing-library/react'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RetryItem, SessionPlan, SlotResult } from '@/db/schema/session-plans'
import { applyFlowEvent } from '@/lib/curriculum/session-flow'
import { liveMidPartOneSession, tenProblemSession } from '@/test/fixtures/session-report'
import { SessionShell } from '../SessionShell'
import type { ActiveRedo, RecordRedoParams } from '../types'

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
vi.mock('../../input/AbacusDock', () => ({ AbacusDock: () => null }))
vi.mock('../../../decomposition', () => ({
  DecompositionProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}))
vi.mock('@/lib/curriculum/parts/arithmetic/browser/DecompositionSection', () => ({
  DecompositionSection: () => null,
}))
vi.mock('@/lib/curriculum/parts/arithmetic/browser/AssistanceDebugPanel', () => ({
  AssistanceDebugPanel: () => null,
}))
vi.mock('@/lib/curriculum/parts/arithmetic/browser/ProblemDebugPanel', () => ({
  ProblemDebugPanel: () => null,
}))
vi.mock('../../input/NumericKeypad', () => ({ NumericKeypad: () => null }))
vi.mock('@/lib/curriculum/parts/arithmetic/browser/PracticeHelpOverlay', () => ({
  PracticeHelpOverlay: () => null,
}))
vi.mock('../../input/useDeviceDetection', async (importActual) => ({
  ...(await importActual<typeof import('../../input/useDeviceDetection')>()),
  useHasPhysicalKeyboard: () => false,
}))

const student = { id: 'kid-1', name: 'Kid', emoji: '🦊', color: 'blue' }

// ---------------------------------------------------------------------------
// Plans: the fixture's part 1 (four slots, fx-p0s0..3), moved by the server's
// own flow machine (`applyFlowEvent`), so a returned plan is the server's
// ---------------------------------------------------------------------------

const template = tenProblemSession().plan.results[0]

/** A recorded try row for part 1's slot `slotIndex`, as the recorder stamps it. */
function rowOf(plan: SessionPlan, slotIndex: number, correct: boolean, round: number, n: number) {
  const slot = plan.parts[0].slots[slotIndex]
  const problem = slot.problem!
  const answer = correct ? problem.answer : problem.answer + 1
  return {
    ...template,
    slotId: slot.slotId,
    itemId: slot.slotId,
    slotIndex,
    problem,
    studentAnswer: answer,
    answer,
    isCorrect: correct,
    isRetry: round > 0,
    epochNumber: round,
    round,
    kind: round > 0 ? 'retry' : 'first',
    tryId: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
  } as SlotResult
}

/** The plan the server returns after a first or retry try in part 1. */
function serverAfter(
  plan: SessionPlan,
  slotIndex: number,
  correct: boolean,
  round: number
): SessionPlan {
  const row = rowOf(plan, slotIndex, correct, round, plan.results.length + 1)
  const { patch } = applyFlowEvent(plan, {
    type: 'TRY_RECORDED',
    row,
    try: {
      itemId: row.slotId,
      kind: round > 0 ? 'retry' : 'first',
      round,
      practiceOnly: false,
      isCorrect: correct,
      partIndex: 0,
    },
  })
  return { ...plan, ...patch, rowVersion: (plan.rowVersion ?? 0) + 1 } as SessionPlan
}

/** Part 1 on its first pass, slots answered as given, the cursor after them. */
function firstPass(answers: boolean[]): SessionPlan {
  let plan: SessionPlan = {
    ...liveMidPartOneSession().plan,
    results: [],
    partStates: { 0: { slotIndex: 0 } },
  }
  answers.forEach((correct, slotIndex) => {
    plan = serverAfter(plan, slotIndex, correct, 0)
  })
  return plan
}

/** Retry round 1 of part 1 running = [slot 1, slot 2] (slots 1 and 2 answered wrong). */
function inRetryRound(): SessionPlan {
  const plan = firstPass([true, false, false, true])
  const retry = (plan.partStates as Record<string, { retry?: { currentEpoch: number } }>)[0].retry
  expect(retry?.currentEpoch).toBe(1)
  const queue = (
    plan.partStates as Record<string, { retry: { currentEpochItems: RetryItem[] } }>
  )[0].retry.currentEpochItems
  expect(queue.map((q) => q.originalSlotIndex)).toEqual([1, 2])
  return plan
}

// ---------------------------------------------------------------------------
// The page under test: it holds the plan and, like PracticeClient, the redo
// state and the resync counter
// ---------------------------------------------------------------------------

let showPlan: (plan: SessionPlan) => void = () => {}
let tapDot: (redo: ActiveRedo) => void = () => {}
let resync: () => void = () => {}

function Page({
  initial,
  onAnswer,
  onRecordRedo,
}: {
  initial: SessionPlan
  onAnswer: (r: unknown) => Promise<SessionPlan | null>
  onRecordRedo?: (p: RecordRedoParams) => Promise<SessionPlan | null>
}) {
  const [plan, setPlan] = useState(initial)
  const [redoState, setRedoState] = useState<ActiveRedo | null>(null)
  const [resyncRequest, setResyncRequest] = useState(0)
  showPlan = setPlan
  tapDot = setRedoState
  resync = () => setResyncRequest((n) => n + 1)
  return (
    <SessionShell
      plan={plan}
      student={student}
      onAnswer={onAnswer}
      onEndEarly={vi.fn()}
      redoState={redoState}
      onRecordRedo={onRecordRedo}
      onRedoComplete={() => setRedoState(null)}
      resyncRequest={resyncRequest}
      debug
    />
  )
}

/** A write the test resolves when it chooses. */
function heldWrite() {
  let resolve: (plan: SessionPlan | null) => void = () => {}
  const promise = new Promise<SessionPlan | null>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

function renderPage(
  initial: SessionPlan,
  write: Promise<SessionPlan | null>,
  onRecordRedo?: (p: RecordRedoParams) => Promise<SessionPlan | null>
) {
  const onAnswer = vi.fn((_r: unknown) => write)
  const client = new QueryClient()
  const page = render(
    <QueryClientProvider client={client}>
      <Page initial={initial} onAnswer={onAnswer} onRecordRedo={onRecordRedo} />
    </QueryClientProvider>
  )
  const session = () => {
    const el = page.container.querySelector('[data-component="active-session"]')
    if (!el) throw new Error('SessionShell not rendered')
    return el
  }
  return {
    page,
    onAnswer,
    phase: () => session().getAttribute('data-phase'),
    /** The problem in the active slot (the incoming one while sliding), by its answer */
    shown: () => {
      const problem = page.container.querySelector(
        '[data-element="problem-container"] [data-component="vertical-problem"]'
      )
      const answer = problem?.getAttribute('data-correct-answer')
      return answer ? Number(answer) : null
    },
  }
}

/** A plan's problem, by its answer (the fixture's answers are all different). */
function answerOf(plan: SessionPlan, slotIndex: number, partIndex = 0): number {
  return plan.parts[partIndex].slots[slotIndex].problem!.answer
}

/** Tap the debug overlay's submit (it sets the answer, then submits on the next frame). */
async function submit(page: ReturnType<typeof render>, correct: boolean) {
  const button = page.container.querySelector(
    `[data-action="${correct ? 'debug-submit-correct' : 'debug-submit-wrong'}"]`
  )
  if (!button) throw new Error('debug overlay not rendered')
  await act(async () => {
    fireEvent.click(button)
  })
  // The overlay submits on the next animation frame
  await act(async () => {
    vi.advanceTimersByTime(16)
  })
}

/** Move the clock by `ms`, flushing React and any promise continuations. */
async function tick(ms: number) {
  await act(async () => {
    vi.advanceTimersByTime(ms)
  })
}

describe('SessionShell — advance after a try comes from the returned plan', () => {
  beforeEach(() => {
    vi.useFakeTimers({
      toFake: [
        'setTimeout',
        'clearTimeout',
        'setInterval',
        'clearInterval',
        'requestAnimationFrame',
        'cancelAnimationFrame',
      ],
    })
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('a retry-round answer slides to the next retry after exactly the feedback delay, with no poll', async () => {
    const before = inRetryRound()
    const write = heldWrite()
    const s = renderPage(before, write.promise)
    await tick(0)
    const retry1 = s.shown()
    expect(retry1).toBe(answerOf(before, 1))
    expect(s.phase()).toBe('inputting')

    await submit(s.page, true)
    expect(s.onAnswer).toHaveBeenCalledTimes(1)
    expect(s.phase()).toBe('submitting')

    // The server answers: round 1 moves on to slot 2. The page has not
    // re-rendered with that plan yet (and does not, inside the window)
    const after = serverAfter(before, 1, true, 1)
    await act(async () => {
      write.resolve(after)
    })
    expect(s.phase()).toBe('showingFeedback')

    await tick(499)
    expect(s.phase()).toBe('showingFeedback')
    expect(s.shown()).toBe(retry1)

    // Exactly the feedback delay: the next retry is on screen, no further tick
    await tick(1)
    expect(s.phase()).toBe('transitioning')
    expect(s.shown()).not.toBe(retry1)
    expect(s.shown()).toBe(answerOf(after, 2))
    s.page.unmount()
  })

  it('slides to the same retry when the page re-renders with the plan at once', async () => {
    const before = inRetryRound()
    const write = heldWrite()
    const s = renderPage(before, write.promise)
    await tick(0)

    await submit(s.page, true)
    const after = serverAfter(before, 1, true, 1)
    await act(async () => {
      write.resolve(after)
      showPlan(after)
    })
    await tick(499)
    expect(s.phase()).toBe('showingFeedback')
    expect(s.shown()).toBe(answerOf(before, 1))

    await tick(1)
    expect(s.phase()).toBe('transitioning')
    expect(s.shown()).toBe(answerOf(after, 2))
    s.page.unmount()
  })

  it('a wrong retry-round answer waits the 1500 ms feedback delay, then slides on with no poll', async () => {
    const before = inRetryRound()
    const write = heldWrite()
    const s = renderPage(before, write.promise)
    await tick(0)
    const retry1 = s.shown()
    expect(retry1).toBe(answerOf(before, 1))

    await submit(s.page, false)
    await act(async () => {
      write.resolve(serverAfter(before, 1, false, 1))
    })
    await tick(1499)
    expect(s.phase()).toBe('showingFeedback')
    expect(s.shown()).toBe(retry1)

    await tick(1)
    expect(s.phase()).toBe('transitioning')
    expect(s.shown()).toBe(answerOf(before, 2))
    s.page.unmount()
  })

  it("a part's last item hands off to the session state after exactly the feedback delay", async () => {
    // Slots 0-2 right; slot 3 is the part's last item, and nothing is queued:
    // the server moves the session to the part transition
    const before = firstPass([true, true, true])
    const write = heldWrite()
    const s = renderPage(before, write.promise)
    await tick(0)
    const last = s.shown()
    expect(last).toBe(answerOf(before, 3))

    await submit(s.page, true)
    expect(s.phase()).toBe('submitting')
    const after = serverAfter(before, 3, true, 0)
    expect(after.flowState).toBe('part_transition')
    expect(after.currentPartIndex).toBe(1)
    // The page shows the server's plan as soon as the write is in (the
    // transition screen is the page's, from flowState)
    await act(async () => {
      write.resolve(after)
      showPlan(after)
    })

    await tick(499)
    expect(s.phase()).toBe('showingFeedback')
    expect(s.shown()).toBe(last)

    // Exactly the feedback delay: handed off (the screen loads what the plan
    // shows, part 2's first problem, beneath the page's transition screen)
    await tick(1)
    expect(s.phase()).toBe('inputting')
    expect(s.shown()).toBe(answerOf(after, 0, 1))
    s.page.unmount()
  })

  it('a do-over returns to the problem the returned plan shows after exactly the feedback delay', async () => {
    const before = liveMidPartOneSession().plan // slot 1 wrong; the cursor on slot 3
    const redoWrite = heldWrite()
    const onRecordRedo = vi.fn((_p: RecordRedoParams) => redoWrite.promise)
    const s = renderPage(before, heldWrite().promise, onRecordRedo)
    await tick(0)
    const practice = s.shown()
    expect(practice).toBe(answerOf(before, 3))

    const tapped = before.parts[0].slots[1]
    const original = before.results.find((r) => r.slotId === tapped.slotId)!
    await act(async () => {
      tapDot({
        isActive: true,
        partIndex: 0,
        itemId: tapped.slotId,
        linearIndex: 1,
        originalResult: original,
      })
    })
    expect(s.shown()).toBe(answerOf(before, 1))

    await submit(s.page, true)
    expect(onRecordRedo).toHaveBeenCalledTimes(1)
    expect(s.onAnswer).not.toHaveBeenCalled()
    // The server answers with its cursor unmoved (slot 1's retry is still
    // queued for after slot 3)
    await act(async () => {
      redoWrite.resolve(before)
    })

    await tick(499)
    expect(s.phase()).toBe('showingFeedback')
    expect(s.shown()).toBe(answerOf(before, 1))

    await tick(1)
    expect(s.phase()).toBe('transitioning')
    expect(s.shown()).toBe(practice)
    s.page.unmount()
  })

  it('a failed write resolves null: the screen resyncs to the server, and derives nothing', async () => {
    const before = inRetryRound()
    const write = heldWrite()
    const s = renderPage(before, write.promise)
    await tick(0)
    const retry1 = s.shown()
    expect(retry1).toBe(answerOf(before, 1))
    const phases: Array<string | null> = []
    const observer = new MutationObserver(() => phases.push(s.phase()))
    observer.observe(s.page.container, { attributes: true, subtree: true })

    await submit(s.page, true)
    // The write failed: the page refetched the server's plan (which never
    // took the try: still on slot 1's retry), bumped the resync, and the
    // answer resolves null
    await act(async () => {
      showPlan({ ...before, rowVersion: (before.rowVersion ?? 0) + 1 })
      resync()
      write.resolve(null)
    })
    await tick(500)
    await tick(0)

    expect(s.phase()).toBe('inputting')
    expect(s.shown()).toBe(retry1)
    // Never slid to slot 2's retry, the next item of the plan at submit
    expect(phases).not.toContain('transitioning')
    expect(s.shown()).not.toBe(answerOf(before, 2))
    observer.disconnect()
    s.page.unmount()
  })

  it('a skip moves on from the plan its write returned, 1500 ms after it, not on a timer from the tap (A21)', async () => {
    const before = firstPass([true])
    const write = heldWrite()
    const s = renderPage(before, write.promise)
    await tick(0)
    const skipped = s.shown()
    expect(skipped).toBe(answerOf(before, 1))

    const skip = s.page.container.querySelector('[data-action="skip"]')
    if (!skip) throw new Error('skip button not rendered')
    await act(async () => {
      fireEvent.click(skip)
    })
    expect(s.onAnswer).toHaveBeenCalledTimes(1)
    expect(s.onAnswer.mock.calls[0][0]).toMatchObject({ outcome: 'skipped' })
    expect(s.phase()).toBe('showingFeedback')

    // The write is slow: the old timer (1500 ms from the tap) reloaded the
    // plan on screen, which still shows the skipped problem
    await tick(3000)
    expect(s.phase()).toBe('showingFeedback')
    expect(s.shown()).toBe(skipped)

    // The server answers: the cursor moves on to slot 2
    const after = serverAfter(before, 1, false, 0)
    await act(async () => {
      write.resolve(after)
    })
    await tick(1499)
    expect(s.phase()).toBe('showingFeedback')
    expect(s.shown()).toBe(skipped)

    // 1500 ms after the plan came back, the next problem is on screen
    await tick(1)
    expect(s.phase()).toBe('inputting')
    expect(s.shown()).toBe(answerOf(after, 2))
    s.page.unmount()
  })

  /** Tap part 1's dot for slot `slotIndex` (it has a recorded try). */
  async function tapSlot(plan: SessionPlan, slotIndex: number) {
    const tapped = plan.parts[0].slots[slotIndex]
    const original = plan.results.find((r) => r.slotId === tapped.slotId)!
    await act(async () => {
      tapDot({
        isActive: true,
        partIndex: 0,
        itemId: tapped.slotId,
        linearIndex: slotIndex,
        originalResult: original,
      })
    })
  }

  /** The skip button of the item on screen. */
  async function skipShown(page: ReturnType<typeof render>) {
    const skip = page.container.querySelector('[data-action="skip"]')
    if (!skip) throw new Error('skip button not rendered')
    await act(async () => {
      fireEvent.click(skip)
    })
  }

  it('a dot tapped while a skip waits for its write wins: the do-over is shown, not the next item', async () => {
    const before = firstPass([true])
    const write = heldWrite()
    const s = renderPage(before, write.promise)
    await tick(0)
    expect(s.shown()).toBe(answerOf(before, 1))

    await skipShown(s.page)
    await tapSlot(before, 0)
    const after = serverAfter(before, 1, false, 0)
    await act(async () => {
      write.resolve(after)
    })
    await tick(1500)

    expect(s.phase()).toBe('inputting')
    expect(s.shown()).toBe(answerOf(before, 0))
    expect(s.shown()).not.toBe(answerOf(after, 2))
    expect(s.page.container.querySelector('[data-element="redo-mode-banner"]')).not.toBeNull()
    s.page.unmount()
  })

  it("a dot tapped during a submit's feedback wins: the do-over is shown, not the next item", async () => {
    const before = firstPass([true])
    const s = renderPage(before, heldWrite().promise)
    await tick(0)
    expect(s.shown()).toBe(answerOf(before, 1))

    // A first-round try mid-part: the next item is known at submit
    await submit(s.page, true)
    expect(s.phase()).toBe('showingFeedback')
    await tapSlot(before, 0)
    await tick(500)
    await tick(0)

    expect(s.phase()).toBe('inputting')
    expect(s.shown()).toBe(answerOf(before, 0))
    expect(s.shown()).not.toBe(answerOf(before, 2))
    expect(s.page.container.querySelector('[data-element="redo-mode-banner"]')).not.toBeNull()
    s.page.unmount()
  })

  it("a skip whose write fails leaves the resync's fresh attempt alone", async () => {
    const before = firstPass([true])
    const write = heldWrite()
    const s = renderPage(before, write.promise)
    await tick(0)
    await skipShown(s.page)

    // The write failed: the page refetched (the server never took the skip),
    // bumped the resync, and the answer resolves null
    await act(async () => {
      showPlan({ ...before, rowVersion: (before.rowVersion ?? 0) + 1 })
      resync()
      write.resolve(null)
    })
    await tick(0)
    expect(s.phase()).toBe('inputting')
    expect(s.shown()).toBe(answerOf(before, 1))

    // Nothing clears the screen again when the skip's feedback delay ends
    // (a clear shows the loading screen for a commit: its node is added)
    const loadingShown: string[] = []
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        for (const node of Array.from(record.addedNodes)) {
          if (node instanceof Element && node.getAttribute('data-status') === 'loading') {
            loadingShown.push('loading')
          }
        }
      }
    })
    observer.observe(s.page.container, { childList: true, subtree: true })
    await tick(1500)
    await tick(0)
    observer.disconnect()
    expect(loadingShown).toEqual([])
    expect(s.phase()).toBe('inputting')
    expect(s.shown()).toBe(answerOf(before, 1))
    s.page.unmount()
  })
})
