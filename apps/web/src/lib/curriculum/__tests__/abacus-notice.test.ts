/**
 * The abacus notice (owner's decisions of 2026-11-28, plan §8 A19): which
 * notice comes before a part, from the parts' presentations through the
 * registry; on the transition screen only when no break follows; after a
 * break before the part's first try.
 */
import { describe, expect, it } from 'vitest'
import type {
  BreakRecord,
  SessionFlowState,
  SessionPart,
  SessionPlan,
  SlotResult,
} from '@/db/schema/session-plans'
import {
  abacusNoticeAfterBreak,
  abacusNoticeBefore,
  abacusNoticeOnTransition,
  breakFollowsTransition,
  partNeedsPhysicalAbacus,
} from '../abacus-notice'
import { applyFlowEvent } from '../session-flow'

type Shape = 'abacus' | 'visualization' | 'linear' | 'ramp'

function part(index: number, shape: Shape): SessionPart {
  const type = shape === 'ramp' ? 'linear' : shape
  return {
    partNumber: index + 1,
    type,
    format: type === 'linear' ? 'linear' : 'vertical',
    useAbacus: shape === 'abacus' || shape === 'ramp',
    slots: [
      {
        slotId: `p${index}s0`,
        index: 0,
        purpose: 'focus',
        constraints: {},
        problem: { terms: [1, 1], answer: 2, skillsRequired: [] },
      },
    ],
    estimatedMinutes: 1,
  } as unknown as SessionPart
}

function plan(shapes: Shape[], over: Partial<SessionPlan> = {}): SessionPlan {
  return {
    id: 'plan-1',
    playerId: 'kid-1',
    status: 'in_progress',
    flowState: 'practicing',
    flowVersion: 1,
    parts: shapes.map((s, i) => part(i, s)),
    currentPartIndex: 0,
    results: [],
    breaks: [],
    partStates: {},
    gameBreakSettings: null,
    ...over,
  } as unknown as SessionPlan
}

function tryIn(p: SessionPlan, partIndex: number): SlotResult {
  return {
    slotId: p.parts[partIndex].slots[0].slotId,
    partNumber: partIndex + 1,
    partIndex,
    slotIndex: 0,
    problem: { terms: [1, 1], answer: 2, skillsRequired: [] },
    studentAnswer: 2,
    isCorrect: true,
    responseTimeMs: 1000,
    skillsExercised: [],
    usedOnScreenAbacus: false,
    timestamp: new Date(0),
    hadHelp: false,
    incorrectAttempts: 0,
  } as unknown as SlotResult
}

function breakAfter(
  afterPartIndex: number,
  reason: BreakRecord['reason'] = 'skipped'
): BreakRecord {
  return {
    breakIndex: 0,
    afterPartIndex,
    startedAt: new Date(0).toISOString(),
    endedAt: new Date(1000).toISOString(),
    reason,
    game: null,
  }
}

const breaksOn = {
  enabled: true,
  maxDurationMinutes: 1,
  selectionMode: 'auto-start',
  selectedGame: 'matching',
  skipSetupPhase: true,
  useAdaptiveSelection: false,
} as SessionPlan['gameBreakSettings']

describe('a part needs the physical abacus: its presentation says, through the registry', () => {
  it('abacus yes, visualization no, equations as the part says (the ramp)', () => {
    expect(partNeedsPhysicalAbacus(part(0, 'abacus'))).toBe(true)
    expect(partNeedsPhysicalAbacus(part(0, 'visualization'))).toBe(false)
    expect(partNeedsPhysicalAbacus(part(0, 'linear'))).toBe(false)
    expect(partNeedsPhysicalAbacus(part(0, 'ramp'))).toBe(true)
  })

  it('a kind this image does not know needs none', () => {
    expect(partNeedsPhysicalAbacus({ kind: 'from-a-newer-image' } as never)).toBe(false)
  })
})

describe('abacusNoticeBefore: the need changes between two parts', () => {
  const cases: Array<[Shape, Shape, ReturnType<typeof abacusNoticeBefore>]> = [
    ['abacus', 'visualization', 'put_away'],
    ['abacus', 'linear', 'put_away'],
    ['visualization', 'abacus', 'pick_up'],
    ['abacus', 'abacus', null],
    ['visualization', 'linear', null],
    // A ramp equations part is worked on the physical abacus (A10 resolved)
    ['visualization', 'ramp', 'pick_up'],
    ['abacus', 'ramp', null],
    ['ramp', 'visualization', 'put_away'],
  ]
  for (const [before, after, notice] of cases) {
    it(`${before} → ${after}: ${notice ?? 'none'}`, () => {
      expect(abacusNoticeBefore(plan([before, after]), 1)).toBe(notice)
    })
  }

  it('the first part of a session has none, nor a part the plan does not have', () => {
    expect(abacusNoticeBefore(plan(['abacus', 'visualization']), 0)).toBeNull()
    expect(abacusNoticeBefore(plan(['visualization', 'abacus']), 0)).toBeNull()
    expect(abacusNoticeBefore(plan(['abacus', 'visualization']), 2)).toBeNull()
  })
})

describe('the transition screen carries the notice only when no break follows', () => {
  it('no break: the notice; a break: none', () => {
    const off = plan(['abacus', 'visualization'])
    expect(abacusNoticeOnTransition(off, 1)).toBe('put_away')
    expect(
      abacusNoticeOnTransition({ ...off, gameBreakSettings: { ...breaksOn!, enabled: false } }, 1)
    ).toBe('put_away')
    expect(abacusNoticeOnTransition({ ...off, gameBreakSettings: breaksOn }, 1)).toBeNull()
  })

  it('a break follows exactly when the flow machine runs one after the transition', () => {
    for (const settings of [null, breaksOn, { ...breaksOn!, enabled: false }]) {
      const p = plan(['abacus', 'visualization'], {
        flowState: 'part_transition',
        currentPartIndex: 1,
        gameBreakSettings: settings,
      })
      const applied = applyFlowEvent(p, { type: 'PART_TRANSITION_COMPLETED' })
      expect(applied.patch?.flowState === 'break_pending').toBe(breakFollowsTransition(p))
    }
  })
})

describe('abacusNoticeAfterBreak: before the part’s first item, after its break', () => {
  const afterBreak = (
    over: Partial<SessionPlan> = {},
    shapes: Shape[] = ['abacus', 'visualization']
  ) =>
    plan(shapes, {
      currentPartIndex: 1,
      gameBreakSettings: breaksOn,
      breaks: [breakAfter(0)],
      ...over,
    })

  it('a break ran in the gap and the part has no tries: the notice', () => {
    expect(abacusNoticeAfterBreak(afterBreak())).toBe('put_away')
    expect(abacusNoticeAfterBreak(afterBreak({ breaks: [breakAfter(0, 'gameFinished')] }))).toBe(
      'put_away'
    )
    expect(abacusNoticeAfterBreak(afterBreak({}, ['visualization', 'ramp']))).toBe('pick_up')
  })

  it('no break in the gap (breaks off, or one after another part): none', () => {
    expect(abacusNoticeAfterBreak(afterBreak({ breaks: [] }))).toBeNull()
    expect(
      abacusNoticeAfterBreak(
        afterBreak({ currentPartIndex: 2, breaks: [breakAfter(0)] }, [
          'abacus',
          'visualization',
          'abacus',
        ])
      )
    ).toBeNull()
  })

  it('no change of need: none', () => {
    expect(abacusNoticeAfterBreak(afterBreak({}, ['abacus', 'ramp']))).toBeNull()
    expect(abacusNoticeAfterBreak(afterBreak({}, ['visualization', 'linear']))).toBeNull()
  })

  it('a reload: the part has no tries yet, the notice again; it has one, none', () => {
    const fresh = afterBreak()
    expect(abacusNoticeAfterBreak({ ...fresh })).toBe('put_away')
    const answered = { ...fresh, results: [tryIn(fresh, 0), tryIn(fresh, 1)] }
    expect(abacusNoticeAfterBreak(answered)).toBeNull()
    // Tries in the part before do not count
    expect(abacusNoticeAfterBreak({ ...fresh, results: [tryIn(fresh, 0)] })).toBe('put_away')
  })

  it('only while practicing; never for the first part', () => {
    for (const flowState of [
      'part_transition',
      'break_pending',
      'break_active',
      'break_results',
    ] as SessionFlowState[]) {
      expect(abacusNoticeAfterBreak(afterBreak({ flowState }))).toBeNull()
    }
    expect(abacusNoticeAfterBreak(afterBreak({ currentPartIndex: 0 }))).toBeNull()
  })
})
