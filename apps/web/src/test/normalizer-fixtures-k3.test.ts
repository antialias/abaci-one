/**
 * Practice-kinds §3.2 normalizer fixtures (5) and (7), K3: a part that is not
 * arithmetic, read by structure through the registry alone.
 *
 * (5) A part of a kind this image does not know, with tries whose
 *     `payload.kind` names it: the normalizer keeps them (not evidence), the
 *     report counts them as tries with their verdict and time, and MCP's
 *     summary (`summarizeSessionReport`, what `get_practice_sessions` answers)
 *     the same. `TryCard` is K5's (it does not exist yet); the report row it
 *     will read is checked here.
 * (7) A `read_abacus` part (the stub kind, registered for the test) and its
 *     rows: the kind's evidence and payload, its items as the planned count,
 *     its presentation on the part row, its current item through the
 *     registry (`currentItemOf`, the report's position).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  currentItemOf,
  normalizeTries,
  resolvedEvidenceOfRow,
} from '@/db/schema/session-plan-normalize'
import type { SessionPart, SlotResult } from '@/db/schema/session-plans'
import {
  type ReadAbacusItem,
  readAbacusKind,
} from '@/lib/curriculum/parts/__tests__/fixtures/read-abacus-kind'
import type { AnyPartKind } from '@/lib/curriculum/parts/kind'
import { masteryModeOf } from '@/lib/curriculum/parts/presentations'
import { partKinds } from '@/lib/curriculum/parts/registry'
import { summarizeSessionReport } from '@/lib/curriculum/session-report'
import {
  reportOf,
  type SessionReportFixture,
  T0,
  tenProblemSession,
} from './fixtures/session-report'

vi.mock('@/db', () => ({ db: {}, schema: {} }))

const registry = partKinds as Map<string, AnyPartKind>

const items: ReadAbacusItem[] = [0, 1, 2].map((i) => ({
  itemId: `r${i}`,
  beadState: [i, 0],
  expectedValue: 10 + i,
  skillsRequired: [`read.${i}`],
}))

/** A try of a part that is not arithmetic, as `record_try` stores one (no arithmetic fields of its own). */
function kindRow(
  partNumber: number,
  partIndex: number,
  itemId: string,
  payload: SlotResult['payload'],
  over: Partial<SlotResult> = {}
): SlotResult {
  return {
    tryId: `t-${partIndex}-${itemId}-${over.kind ?? 'first'}`,
    slotId: itemId,
    partNumber,
    partIndex,
    slotIndex: 0,
    itemId,
    kind: 'first',
    round: 0,
    practiceOnly: false,
    outcome: 'answered',
    answer: 11,
    isCorrect: true,
    responseTimeMs: 4000,
    timestamp: new Date(T0 + 700_000),
    payload,
    ...over,
  } as SlotResult
}

/** The ten-problem session with its third part replaced by `part` and that part's rows by `rows`. */
function withThirdPart(part: unknown, rows: SlotResult[]): SessionReportFixture {
  const fixture = tenProblemSession()
  const parts = [...fixture.plan.parts.slice(0, 2), part as SessionPart]
  const results = [...fixture.plan.results.filter((r) => r.partNumber !== 3), ...rows]
  return { ...fixture, plan: { ...fixture.plan, parts, results } }
}

describe('fixture (5): a part of a kind this image does not know, with its tries', () => {
  const unknown = { kind: 'zzz', partNumber: 3, presentation: 'zzz_view', content: { n: 2 } }
  const rows = [
    kindRow(3, 2, 'z0', { kind: 'zzz', shown: 'A' }, { isCorrect: false }),
    kindRow(3, 2, 'z0', { kind: 'zzz', shown: 'A' }, { kind: 'retry', round: 1 }),
    kindRow(3, 2, 'z1', { kind: 'zzz', shown: 'B' }, { responseTimeMs: 6000 }),
  ]
  const fixture = withThirdPart(unknown, rows)

  it('the normalizer keeps the tries as stored: not evidence, the payload whole', () => {
    const tries = normalizeTries('plan', fixture.plan.parts, fixture.plan.results).slice(-3)
    expect(tries.map((t) => [t.itemId, t.kind, t.round, t.isCorrect, t.evidence])).toEqual([
      ['z0', 'first', 0, false, null],
      ['z0', 'retry', 1, true, null],
      ['z1', 'first', 0, true, null],
    ])
    expect(tries.map((t) => t.payload)).toEqual(rows.map((r) => r.payload))
  })

  it('the report counts them, with their verdict and time; MCP answers the same numbers', () => {
    const report = reportOf(fixture)
    const row = report.parts[2]
    expect(row).toMatchObject({
      type: null,
      presentation: 'zzz_view',
      problems: 2,
      tries: 3,
      firstTryCorrect: 1,
      fixedInRetries: 1,
    })
    const part3 = report.tries.filter((t) => t.partIndex === 2)
    expect(part3.map((t) => [t.itemId, t.isCorrect, t.effectiveMs])).toEqual([
      ['z0', false, 4000],
      ['z0', true, 4000],
      ['z1', true, 6000],
    ])
    // Nothing is planned for a kind this image cannot list
    expect(report.totals.plannedProblems).toBe(7)
    expect(summarizeSessionReport(report).totals).toEqual(report.totals)
  })
})

describe('fixture (7): a read_abacus part and its rows', () => {
  beforeEach(() => {
    registry.set(readAbacusKind.id, readAbacusKind as unknown as AnyPartKind)
  })
  afterEach(() => {
    registry.delete(readAbacusKind.id)
  })

  const reading = { kind: 'read_abacus', partNumber: 3, presentation: 'static', content: { items } }
  const payload = (i: number) => ({ kind: 'read_abacus', item: items[i] })
  const rows = [
    kindRow(3, 2, 'r0', payload(0), { answer: 10 }),
    kindRow(3, 2, 'r1', payload(1), { answer: 3, isCorrect: false }),
    kindRow(3, 2, 'r2', payload(2), { answer: 12 }),
  ]

  it("the normalizer reads the kind's evidence and payload", () => {
    const fixture = withThirdPart(reading, rows)
    const tries = normalizeTries('plan', fixture.plan.parts, fixture.plan.results).slice(-3)
    expect(tries.map((t) => [t.itemId, t.evidence])).toEqual([
      ['r0', { skills: ['read.0'], presentation: 'static' }],
      ['r1', { skills: ['read.1'], presentation: 'static' }],
      ['r2', { skills: ['read.2'], presentation: 'static' }],
    ])
    expect(tries.map((t) => t.payload)).toEqual([payload(0), payload(1), payload(2)])
    // Its presentation counts toward the kind's own mode, resolved through the
    // registry as it stands now (the stub is registered after load)
    expect(
      fixture.plan.results.slice(-3).map((r) => resolvedEvidenceOfRow(r, fixture.plan.parts)?.mode)
    ).toEqual(['read_abacus', 'read_abacus', 'read_abacus'])
    expect(masteryModeOf('static')).toBe('read_abacus')
  })

  it('the report plans its items, counts its tries and names its presentation', () => {
    const report = reportOf(withThirdPart(reading, rows))
    expect(report.parts[2]).toMatchObject({
      type: null,
      presentation: 'static',
      plannedProblems: 3,
      problems: 3,
      tries: 3,
      firstTryCorrect: 2,
    })
    expect(report.totals.plannedProblems).toBe(4 + 3 + 3)
  })

  it('the current item, mid-part, is the kind’s, through the registry', () => {
    const fixture = withThirdPart(reading, rows.slice(0, 1))
    const plan = {
      ...fixture.plan,
      status: 'in_progress' as const,
      flowState: 'practicing' as const,
      completedAt: null,
      currentPartIndex: 2,
      partStates: { '2': { index: 1 } },
    }
    expect(currentItemOf<ReadAbacusItem>(plan)).toEqual({ partIndex: 2, ...items[1] })
    const report = reportOf({ ...fixture, plan })
    expect(report.position?.currentItem).toEqual({ partIndex: 2, itemId: 'r1' })
    // With no entry, the kind's initial state
    expect(currentItemOf({ ...plan, partStates: {} })).toEqual({ partIndex: 2, ...items[0] })
  })
})
