/**
 * Phase 5b: the kid's page broadcasts the plan's parts and tries and the item
 * on screen (`arithmeticObserverPosition`), and the part kinds' `{ kind,
 * label, emoji }` for a transition. The observer places its current dot by
 * `currentItem` (§10 P6b1-13: the legacy position fields are gone): these
 * send what the page sends and feed it to the observer hook.
 */
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { partTransitionViewOf } from '@/components/practice/PartTransitionScreen'
import type { ProblemSlot, SessionPart } from '@/db/schema/session-plans'
import type { PartTransitionEvent, PracticeStateEvent } from '@/lib/classroom/socket-events'
import {
  type ArithmeticViewPlan,
  arithmeticObserverPosition,
} from '@/lib/curriculum/parts/arithmetic/session-view'
import { type BroadcastPracticeState, useSessionBroadcast } from '../useSessionBroadcast'
import { useSessionObserver } from '../useSessionObserver'

type Handler = (data?: unknown) => void
interface MockSocket {
  handlers: Map<string, Handler>
  on: ReturnType<typeof vi.fn>
  off: ReturnType<typeof vi.fn>
  emit: ReturnType<typeof vi.fn>
  disconnect: ReturnType<typeof vi.fn>
  connected: boolean
}
const sockets: MockSocket[] = []

function makeSocket(): MockSocket {
  const socket: MockSocket = {
    handlers: new Map(),
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    disconnect: vi.fn(),
    connected: true,
  }
  socket.on.mockImplementation((event: string, handler: Handler) => {
    socket.handlers.set(event, handler)
    return socket
  })
  return socket
}

vi.mock('@/hooks/useUserId', () => ({ useUserId: () => ({ data: 'viewer-1' }) }))
vi.mock('socket.io-client', () => ({
  io: vi.fn(() => {
    const socket = makeSocket()
    sockets.push(socket)
    return socket
  }),
}))

function slot(p: number, i: number): ProblemSlot {
  return {
    slotId: `p${p}s${i}`,
    index: i,
    purpose: 'review',
    constraints: {},
    problem: { terms: [p * 10 + i, 1], answer: p * 10 + i + 1, skillsRequired: [] },
  }
}
function part(p: number, type: SessionPart['type'], n: number): SessionPart {
  return {
    partNumber: (p + 1) as 1 | 2 | 3,
    type,
    format: type === 'linear' ? 'linear' : 'vertical',
    useAbacus: type === 'abacus',
    slots: Array.from({ length: n }, (_, i) => slot(p, i)),
    estimatedMinutes: 2,
  }
}
const parts = [part(0, 'abacus', 3), part(1, 'linear', 2)]
const plan = {
  parts,
  currentPartIndex: 0,
  partStates: { 0: { slotIndex: 2 } },
  results: [],
} as unknown as ArithmeticViewPlan

const SESSION_ID = 'session-1'

function kidState(item: BroadcastPracticeState['item']): BroadcastPracticeState {
  const s = parts[item.partIndex].slots.find((x) => x.slotId === item.itemId)!
  return {
    currentProblem: { terms: s.problem!.terms, answer: s.problem!.answer },
    slotId: s.slotId,
    phase: 'problem',
    studentAnswer: '',
    isCorrect: null,
    startedAt: 1000,
    purpose: 'review',
    item,
    position: arithmeticObserverPosition(plan, item),
  }
}

function renderKid(state: BroadcastPracticeState | null) {
  const hook = renderHook(
    ({ s }: { s: BroadcastPracticeState | null }) =>
      useSessionBroadcast(SESSION_ID, 'player-1', s, 'practicing', null),
    { initialProps: { s: state } }
  )
  const kid = sockets[sockets.length - 1]
  act(() => kid.handlers.get('connect')?.())
  return { hook, kid }
}

function emitted<T>(socket: MockSocket, event: string): T[] {
  return socket.emit.mock.calls.filter((c: unknown[]) => c[0] === event).map((c) => c[1] as T)
}

function renderObserver() {
  const hook = renderHook(() => useSessionObserver(SESSION_ID, 'observer-1', 'player-1', true))
  const observer = sockets[sockets.length - 1]
  return { hook, observer }
}

describe('useSessionBroadcast — position from the plan (Phase 5b)', () => {
  beforeEach(() => {
    sockets.length = 0
    vi.clearAllMocks()
  })

  it('sends the parts, the tries and currentItem, and an observer places its dot by it', () => {
    const { kid } = renderKid(kidState({ partIndex: 0, itemId: 'p0s2', doOver: false, round: 0 }))
    const events = emitted<PracticeStateEvent>(kid, 'practice-state')
    const last = events[events.length - 1]
    expect(last).toMatchObject({
      sessionId: SESSION_ID,
      sessionParts: parts,
      slotResults: [],
      currentItem: { partIndex: 0, itemId: 'p0s2' },
      purpose: 'review',
    })
    // The screen's own fields, and the legacy position fields, are not on the wire
    for (const field of [
      'item',
      'position',
      'currentProblemNumber',
      'totalProblems',
      'currentPartIndex',
      'currentSlotIndex',
    ]) {
      expect(last).not.toHaveProperty(field)
    }

    const { hook, observer } = renderObserver()
    act(() => observer.handlers.get('practice-state')?.(last))
    expect(hook.result.current.state).toMatchObject({
      currentItem: { partIndex: 0, itemId: 'p0s2' },
      currentPartIndex: 0,
      currentSlotIndex: 2,
      currentProblem: { terms: [2, 1], answer: 3 },
    })
  })

  it('re-sends when a do-over of an item with the same problem replaces the screen', () => {
    const live = kidState({ partIndex: 0, itemId: 'p0s2', doOver: false, round: 0 })
    const { hook, kid } = renderKid(live)
    kid.emit.mockClear()
    // Same answer and phase, another item: a do-over of p0s2 itself
    const redo = { ...live, item: { ...live.item, doOver: true } }
    redo.position = arithmeticObserverPosition(plan, redo.item)
    hook.rerender({ s: redo })
    expect(emitted<PracticeStateEvent>(kid, 'practice-state')).toHaveLength(1)
  })

  it('sends a do-over as its own item; the observer shows its dot', () => {
    const { kid } = renderKid(kidState({ partIndex: 0, itemId: 'p0s0', doOver: true, round: 0 }))
    const events = emitted<PracticeStateEvent>(kid, 'practice-state')
    const last = events[events.length - 1]
    expect(last).toMatchObject({ currentItem: { partIndex: 0, itemId: 'p0s0' } })

    const { hook, observer } = renderObserver()
    act(() => observer.handlers.get('practice-state')?.(last))
    expect(hook.result.current.state).toMatchObject({ currentPartIndex: 0, currentSlotIndex: 0 })
  })

  it('a broadcast without currentItem (a kid screen older than Phase 5b) shows no current dot', () => {
    const { hook, observer } = renderObserver()
    const { currentItem: _none, ...old } = arithmeticObserverPosition(plan, {
      partIndex: 0,
      itemId: 'p0s2',
      doOver: false,
    })
    act(() =>
      observer.handlers.get('practice-state')?.({
        sessionId: SESSION_ID,
        currentProblem: { terms: [2, 1], answer: 3 },
        phase: 'problem',
        studentAnswer: '',
        isCorrect: null,
        timing: { startedAt: 1, elapsed: 0 },
        purpose: 'review',
        ...old,
      })
    )
    expect(hook.result.current.state?.sessionParts).toEqual(parts)
    expect(hook.result.current.state).not.toHaveProperty('currentSlotIndex')
  })

  it("sends the kinds' { kind, label, emoji } for a transition, and an observer follows", () => {
    const { hook, kid } = renderKid(null)
    const previous = partTransitionViewOf(parts[0])
    const next = partTransitionViewOf(parts[1])
    act(() => hook.result.current.sendPartTransition(previous, next, 5000, 7000))

    const [event] = emitted<PartTransitionEvent>(kid, 'part-transition')
    expect(event).toEqual({
      sessionId: SESSION_ID,
      previous: { kind: 'arithmetic', label: 'Abacus', emoji: '🧮' },
      next: { kind: 'arithmetic', label: 'Equations', emoji: '✏️' },
      countdownStartTime: 5000,
      countdownDurationMs: 7000,
    })

    const { hook: obs, observer } = renderObserver()
    act(() => observer.handlers.get('part-transition')?.(event))
    expect(obs.result.current.transitionState).toMatchObject({
      previous: { kind: 'arithmetic', label: 'Abacus', emoji: '🧮' },
      next: { kind: 'arithmetic', label: 'Equations', emoji: '✏️' },
      countdownStartTime: 5000,
      countdownDurationMs: 7000,
    })
  })

  it('names the session start as no previous part', () => {
    const { hook, kid } = renderKid(null)
    act(() => hook.result.current.sendPartTransition(null, partTransitionViewOf(parts[0]), 1, 7000))
    const [event] = emitted<PartTransitionEvent>(kid, 'part-transition')
    expect(event.previous).toBeNull()
    expect(event.next).toEqual({ kind: 'arithmetic', label: 'Abacus', emoji: '🧮' })
  })
})
