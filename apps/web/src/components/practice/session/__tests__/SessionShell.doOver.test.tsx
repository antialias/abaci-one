/**
 * A do-over through the real `SessionShell` (Phase 5b): the kid redoes an
 * earlier item, and
 * - the write it sends names that item (`redoContext.itemId` = the item's own
 *   id, `result.slotId` = the same, its own slot index beside it);
 * - while the answered do-over slides off, the broadcast keeps naming it as a
 *   do-over, after the page has already cleared the redo state.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SessionPlan } from '@/db/schema/session-plans'
import { liveMidPartOneSession } from '@/test/fixtures/session-report'
import { SessionShell } from '../SessionShell'
import type { ActiveRedo, BroadcastState, RecordRedoParams } from '../types'

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

/** Taps a dot on the page under test (sets its redo state). */
let tapDot: (redo: ActiveRedo) => void = () => {}

/** The page's part: it holds the redo state and clears it when the do-over completes. */
function Page({
  plan,
  onRecordRedo,
  broadcasts,
  events,
}: {
  plan: SessionPlan
  onRecordRedo: (p: RecordRedoParams) => Promise<SessionPlan | null>
  broadcasts: Array<BroadcastState | null>
  events: string[]
}) {
  const [redoState, setRedoState] = useState<ActiveRedo | null>(null)
  tapDot = setRedoState
  return (
    <SessionShell
      plan={plan}
      student={student}
      onAnswer={vi.fn(() => Promise.resolve<SessionPlan | null>(null))}
      onEndEarly={vi.fn()}
      redoState={redoState}
      onRecordRedo={onRecordRedo}
      onRedoComplete={() => {
        events.push('redo-complete')
        setRedoState(null)
      }}
      onBroadcastStateChange={(state) => {
        broadcasts.push(state)
        events.push(`broadcast:${broadcasts.length - 1}`)
      }}
      debug
    />
  )
}

describe('SessionShell — a do-over', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('writes the redone item by its own id, and slides it off still named as a do-over', async () => {
    const fixture = liveMidPartOneSession()
    const plan = fixture.plan
    // The kid taps dot #2: part 1's slot 1, answered wrong (its retry is still to come)
    const tapped = plan.parts[0].slots[1]
    const original = plan.results.find((r) => r.slotId === tapped.slotId)
    if (!original) throw new Error('fixture: slot 1 has a try')
    const redo: ActiveRedo = {
      isActive: true,
      partIndex: 0,
      itemId: tapped.slotId,
      linearIndex: 1,
      originalResult: original,
    }
    // The server answers with the plan, its cursor unmoved (the do-over
    // redeemed nothing), so the do-over slides back to the practice problem
    const onRecordRedo = vi.fn((_p: RecordRedoParams) => Promise.resolve<SessionPlan | null>(plan))
    const broadcasts: Array<BroadcastState | null> = []
    const events: string[] = []
    const client = new QueryClient()
    const page = render(
      <QueryClientProvider client={client}>
        <Page plan={plan} onRecordRedo={onRecordRedo} broadcasts={broadcasts} events={events} />
      </QueryClientProvider>
    )

    // The practice problem is on screen; then the kid taps the dot
    await waitFor(() => expect(broadcasts.at(-1)?.item.itemId).toBe(plan.parts[0].slots[3].slotId))
    act(() => tapDot(redo))

    // The do-over's problem is on screen
    await waitFor(() =>
      expect(broadcasts.at(-1)?.currentProblem.terms).toEqual(tapped.problem?.terms)
    )
    expect(broadcasts.at(-1)?.item).toEqual({
      partIndex: 0,
      itemId: tapped.slotId,
      doOver: true,
      round: 0,
    })

    const submit = page.container.querySelector('[data-action="debug-submit-correct"]')
    if (!submit) throw new Error('debug overlay not rendered')
    await act(async () => {
      fireEvent.click(submit)
    })

    // 1. The write names the redone item
    await waitFor(() => expect(onRecordRedo).toHaveBeenCalledTimes(1))
    const write = onRecordRedo.mock.calls[0][0]
    expect(write.redoContext).toEqual({
      itemId: tapped.slotId,
      originalPartIndex: 0,
      originalSlotIndex: 1,
      originalWasCorrect: false,
    })
    expect(write.result.slotId).toBe(tapped.slotId)
    expect(write.result).toMatchObject({ slotIndex: 1, originalSlotIndex: 1, isCorrect: true })

    // 2. The page clears the redo state as the do-over slides off; the
    // broadcasts after that still show the outgoing do-over as one
    await waitFor(() => expect(events).toContain('redo-complete'), { timeout: 3000 })
    const cleared = events.indexOf('redo-complete')
    const after = events
      .slice(cleared)
      .filter((e) => e.startsWith('broadcast:'))
      .map((e) => broadcasts[Number(e.slice('broadcast:'.length))])
    const slidingOff = after.filter(
      (b) =>
        b?.phase === 'feedback' &&
        JSON.stringify(b.currentProblem.terms) === JSON.stringify(tapped.problem?.terms)
    )
    expect(slidingOff.length).toBeGreaterThan(0)
    for (const b of slidingOff) {
      expect(b?.item).toEqual({ partIndex: 0, itemId: tapped.slotId, doOver: true, round: 0 })
    }
    page.unmount()
  })
})
