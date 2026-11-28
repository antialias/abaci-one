/**
 * The kind conformance suite (practice-kinds plan of record §4 K4, decision
 * K11): what every kind must do for structure to carry it with no edit
 * outside its folder. A kind passes it on `EphemeralDatabase`, through the
 * production path: `recordTry` (the one recorder, `record_try` as the client
 * sends it from K4), the flow machine (`applyFlowEvent`, inside
 * `recordTry`'s CAS and `applySessionFlowEvent`), `normalizeTries` and
 * `buildSessionReport`.
 *
 * The suite knows a kind only through the contract (`PartKind`) and the
 * registry, plus what the kind's fixtures declare (`KindFixtures`): how to
 * build a part, answer an item right or wrong, and what its client sends. Its
 * model of a part is "items with up to `retryRounds` retry rounds" (decision
 * K4: most kinds; the shared cursor's). A kind whose cursor moves otherwise
 * brings its own checks beside these.
 *
 * Each check is a plain async function (`conformanceChecks`), so a test can
 * run one against a mutated kind and see it fail (`conformance.test.ts`).
 *
 * The test file that runs the suite mocks `@/db` with the ephemeral database
 * (and `server-only`, the share revoke, the skill-attempt bump and the
 * route's auth), as `src/test/session-flow-unknown-kind.test.ts` does:
 * `vi.mock` only takes effect in a test file.
 */

import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it, type Mock } from 'vitest'
import * as schema from '@/db/schema'
import { normalizeTries, partStateOf } from '@/db/schema/session-plan-normalize'
import type { SessionPart, SessionPlan, SlotResult, TryPayload } from '@/db/schema/session-plans'
import type { AnyPartKind, StoredPart } from '@/lib/curriculum/parts/kind'
import { expectedItemOf, isPartPlayable, partKinds } from '@/lib/curriculum/parts/registry'
import {
  MalformedTrySubmissionError,
  type RecordTryResult,
  recordTry,
  SlotResultMismatchError,
  type TrySubmission,
} from '@/lib/curriculum/record-try'
import {
  applySessionFlowEvent,
  completeSessionPlanEarly,
  getSessionPlan,
} from '@/lib/curriculum/session-planner'
import { buildSessionReport, type SessionReport } from '@/lib/curriculum/session-report'
import { slimPartsSql } from '@/lib/curriculum/session-report-batch'
import {
  createEphemeralDatabase,
  createTestStudent,
  type EphemeralDbResult,
  getCurrentEphemeralDb,
  setCurrentEphemeralDb,
} from '../journey-simulator/EphemeralDatabase'

// ============================================================================
// What a kind declares
// ============================================================================

/** A legacy-shaped stored row of the kind and what the normalizer must make of it. */
export interface LegacyRowFixture {
  row: SlotResult
  expected: {
    itemId: string
    outcome: 'answered' | 'skipped' | 'timeout'
    answer: unknown
    isCorrect: boolean
    /** The evidence the normalizer derives (null = recorded, not counted) */
    evidence: { skills: string[]; presentation: string } | null
  }
}

export interface KindFixtures {
  /** A part of the kind with `items` items; item ids unique to its `partNumber` */
  part(items: number, partNumber: number): StoredPart
  /** An answer to `item` (the kind's `itemOf`), right or wrong by the kind's judge */
  answer(item: unknown, correct: boolean): unknown
  /** The payload the kind's client sends with a try of `item` */
  payload(item: unknown): TryPayload
  /** The skills a try of `item` is evidence of (what the skill-attempt bump receives) */
  skillsOf(item: unknown): string[]
  /** Retry rounds after the first pass (0 = none); the suite checks the kind agrees */
  retryRounds: number
  /**
   * A do-over of an item whose answer the kind showed (`answerShown`, a
   * wrong try in its last round): refused as `divulged` (the shared cursor), or
   * accepted as practice-only, recorded and counting toward nothing (weight
   * 0, no skill evidence, not in `finalCorrect`). The kit's rule (A17): no
   * kind gives credit for an answer it showed, and `recordTry` stamps it so.
   * Declared so the choice is visible; the suite holds the kind to it.
   */
  doOverAfterDivulged: 'refused' | 'practice_only'
  /** A row stored before the envelope (K1), or null: the kind has none */
  legacyRow: ((part: StoredPart) => LegacyRowFixture) | null
}

export interface ConformanceContext {
  playerId: string
  /** The skill-attempt bump, mocked by the test file (`recordSkillAttemptsWithHelp`) */
  skillBump: Mock
}

export interface ConformanceCheck {
  name: string
  run(ctx: ConformanceContext): Promise<void>
}

// ============================================================================
// Driving a session
// ============================================================================

const FIXED = new Date('2026-01-01T00:00:00.000Z')
/** A kind no image registers: a newer image's part read after a rollback (K0) */
export const UNKNOWN_KIND = 'zzz_conformance'
/** The content limit a 20-item part's list projection must stay under (§6.6) */
export const CONTENT_LIMIT_BYTES = 16 * 1024

let tryCounter = 0
const tid = () => `00000000-0000-4000-8000-${String(++tryCounter).padStart(12, '0')}`

type Verdict = 'right' | 'wrong' | 'skip'

async function insertPlan(playerId: string, parts: StoredPart[], results: SlotResult[] = []) {
  const id = `kc-${Math.random().toString(36).slice(2, 10)}`
  await getCurrentEphemeralDb()
    .insert(schema.sessionPlans)
    .values({
      id,
      playerId,
      targetDurationMinutes: 6,
      estimatedProblemCount: 6,
      avgTimePerProblemSeconds: 20,
      gameBreakSettings: {
        enabled: false,
        maxDurationMinutes: 5,
        selectionMode: 'kid-chooses',
        selectedGame: null,
      },
      parts: parts as unknown as SessionPart[],
      summary: {} as SessionPlan['summary'],
      masteredSkillIds: [],
      status: 'in_progress',
      flowState: 'practicing',
      flowUpdatedAt: FIXED,
      flowVersion: 0,
      currentPartIndex: 0,
      results,
      adjustments: [],
      createdAt: FIXED,
      approvedAt: FIXED,
      startedAt: FIXED,
    })
  return id
}

async function row(planId: string): Promise<SessionPlan> {
  const plan = await getSessionPlan(planId)
  if (!plan) throw new Error(`no plan ${planId}`)
  return plan
}

function reportOf(plan: SessionPlan): SessionReport {
  return buildSessionReport({
    plan,
    tries: normalizeTries(plan.id, plan.parts, plan.results),
    now: FIXED.getTime() + 60_000,
  })
}

/** The item the kid is shown now, by the kind (`expectedItemOf`), or null. */
function shown(plan: SessionPlan): { itemId: string; round: number; item: unknown } | null {
  const part = plan.parts[plan.currentPartIndex]
  if (!part || plan.flowState !== 'practicing') return null
  return expectedItemOf(part, partStateOf(plan, plan.currentPartIndex))
}

/** The kind's own view of an item (`itemOf`). */
function itemOf(kind: AnyPartKind, plan: SessionPlan, partIndex: number, itemId: string) {
  const item = kind.itemOf(kind.contentOf(plan.parts[partIndex]), itemId)
  if (item === null) throw new Error(`the kind has no item ${itemId}`)
  return item
}

/** The id of the part's item at `index` (`items()` order). */
function itemIdAt(kind: AnyPartKind, plan: SessionPlan, partIndex: number, index: number) {
  return kind.items(kind.contentOf(plan.parts[partIndex]))[index].itemId
}

function envelope(
  kind: AnyPartKind,
  fx: KindFixtures,
  plan: SessionPlan,
  t: { partIndex: number; itemId: string; mode: TrySubmission['mode']; verdict: Verdict }
): TrySubmission {
  const item = itemOf(kind, plan, t.partIndex, t.itemId)
  const answered = t.verdict !== 'skip'
  return {
    tryId: tid(),
    partIndex: t.partIndex,
    itemId: t.itemId,
    mode: t.mode,
    outcome: answered ? 'answered' : 'skipped',
    answer: answered ? fx.answer(item, t.verdict === 'right') : null,
    payload: fx.payload(item),
    timing: { responseTimeMs: 3000 },
    help: { hadHelp: !answered, incorrectAttempts: 0 },
  }
}

/** Answer what is shown now (a first try or a retry). */
async function answerShown(
  kind: AnyPartKind,
  fx: KindFixtures,
  planId: string,
  verdict: Verdict
): Promise<RecordTryResult & { itemId: string; round: number }> {
  const plan = await row(planId)
  const now = shown(plan)
  if (!now) throw new Error('nothing is shown')
  const sub = envelope(kind, fx, plan, {
    partIndex: plan.currentPartIndex,
    itemId: now.itemId,
    mode: 'first_or_retry',
    verdict,
  })
  return { ...(await recordTry(planId, { ...sub, round: now.round })), ...now }
}

/** A do-over of an item of `partIndex`. */
async function doOver(
  kind: AnyPartKind,
  fx: KindFixtures,
  planId: string,
  partIndex: number,
  itemId: string,
  verdict: Verdict
): Promise<RecordTryResult> {
  const plan = await row(planId)
  return recordTry(
    planId,
    envelope(kind, fx, plan, { partIndex, itemId, mode: 'do_over', verdict })
  )
}

/** The stored row of a try. */
const rowOf = (plan: SessionPlan, tryId: string) => {
  const r = plan.results.find((x) => x.tryId === tryId)
  if (!r) throw new Error(`no row for ${tryId}`)
  return r
}

/** weightOfTry restated (§1.3): practice-only 0; a first try 1; a retry or do-over at round r, 2^-r. */
const weightOf = (kind: string, round: number, practiceOnly: boolean) =>
  practiceOnly ? 0 : kind === 'first' ? 1 : 1 / 2 ** round

/** Answer every item of the current part right until it is done. */
async function finishPart(kind: AnyPartKind, fx: KindFixtures, planId: string) {
  const start = (await row(planId)).currentPartIndex
  for (let guard = 0; guard < 100; guard++) {
    const plan = await row(planId)
    if (plan.currentPartIndex !== start || !shown(plan)) return plan
    await answerShown(kind, fx, planId, 'right')
  }
  throw new Error('the part never finished')
}

// ============================================================================
// The checks
// ============================================================================

export function conformanceChecks(kind: AnyPartKind, fx: KindFixtures): ConformanceCheck[] {
  const one = (part: StoredPart) => [part]
  const counted = (n: number, partNumber = 1) => fx.part(n, partNumber)

  return [
    {
      name: 'declares what it is: presentations, items, its retry rounds',
      async run() {
        const part = counted(3)
        const content = kind.contentOf(part)
        expect(kind.isPlayable(content)).toBe(true)
        expect(kind.presentations.size).toBeGreaterThan(0)
        expect([...kind.presentations.keys()]).toContain(kind.presentationOf(part).id)
        const items = kind.items(content)
        expect(items).toHaveLength(3)
        expect(new Set(items.map((i) => i.itemId)).size).toBe(3)
        const state = kind.initialState(content)
        for (const { itemId } of items) {
          expect(kind.itemOf(content, itemId), itemId).not.toBeNull()
          expect(kind.roundsRemaining(content, state, itemId), itemId).toBe(fx.retryRounds)
        }
        expect(kind.itemOf(content, 'no-such-item')).toBeNull()
      },
    },

    {
      name: 'a duplicate tryId is recorded once, answered with the verdict already stored',
      async run(ctx) {
        const planId = await insertPlan(ctx.playerId, one(counted(2)))
        const plan = await row(planId)
        const now = shown(plan)!
        const sub = envelope(kind, fx, plan, {
          partIndex: 0,
          itemId: now.itemId,
          mode: 'first_or_retry',
          verdict: 'wrong',
        })
        const first = await recordTry(planId, sub)
        const bumps = ctx.skillBump.mock.calls.length
        const versionAfterFirst = (await row(planId)).rowVersion
        // The resend carries a right answer: the stored verdict still answers it
        const item = itemOf(kind, plan, 0, now.itemId)
        const again = await recordTry(planId, { ...sub, answer: fx.answer(item, true) })
        const stored = await row(planId)
        expect(stored.results).toHaveLength(1)
        expect(stored.rowVersion).toBe(versionAfterFirst)
        expect(first.try).toEqual({ tryId: sub.tryId, isCorrect: false, outcome: 'answered' })
        expect(again.try).toEqual(first.try)
        expect(ctx.skillBump.mock.calls.length).toBe(bumps)
      },
    },

    {
      name: "a try sent for a round that is not the item's current one is refused (A16)",
      async run(ctx) {
        const planId = await insertPlan(ctx.playerId, one(counted(2)))
        // Each refused send leaves the row as it was
        const refuses = async (round: unknown, error: 'not_current' | 'malformed') => {
          const plan = await row(planId)
          const now = shown(plan)!
          const sub = envelope(kind, fx, plan, {
            partIndex: plan.currentPartIndex,
            itemId: now.itemId,
            mode: 'first_or_retry',
            verdict: 'right',
          })
          const caught = await recordTry(planId, { ...sub, round } as TrySubmission).catch(
            (e: unknown) => e
          )
          if (error === 'not_current') {
            expect(caught, `round ${String(round)}`).toBeInstanceOf(SlotResultMismatchError)
            expect((caught as SlotResultMismatchError).reason).toBe('not_current')
          } else {
            expect(caught, `round ${String(round)}`).toBeInstanceOf(MalformedTrySubmissionError)
          }
          const after = await row(planId)
          expect(after.results).toEqual(plan.results)
          expect(after.rowVersion).toBe(plan.rowVersion)
        }
        // A round not reached yet
        await refuses(shown(await row(planId))!.round + 1, 'not_current')
        for (const bad of [-1, 0.5, '0', null]) await refuses(bad, 'malformed')
        if (fx.retryRounds > 0) {
          // A stale screen: the first try's round sent once the retry is current
          const wrong = await answerShown(kind, fx, planId, 'wrong')
          for (let guard = 0; guard < 10; guard++) {
            const now = shown(await row(planId))!
            if (now.itemId === wrong.itemId) break
            await answerShown(kind, fx, planId, 'right')
          }
          expect(shown(await row(planId))).toMatchObject({ itemId: wrong.itemId, round: 1 })
          await refuses(0, 'not_current')
        }
      },
    },

    {
      name: 'the server is the only judge: a verdict in the body is never stored',
      async run(ctx) {
        const planId = await insertPlan(ctx.playerId, one(counted(3)))
        const plan = await row(planId)
        const lie = (verdict: Verdict, isCorrect: boolean) => {
          const now = shown(plan)!
          return {
            ...envelope(kind, fx, plan, {
              partIndex: 0,
              itemId: now.itemId,
              mode: 'first_or_retry',
              verdict,
            }),
            isCorrect,
          } as TrySubmission
        }
        const wrong = await recordTry(planId, lie('wrong', true))
        expect(wrong.try?.isCorrect).toBe(false)
        const afterWrong = await row(planId)
        expect(rowOf(afterWrong, wrong.try!.tryId).isCorrect).toBe(false)

        const right = await recordTry(planId, {
          ...envelope(kind, fx, afterWrong, {
            partIndex: 0,
            itemId: shown(afterWrong)!.itemId,
            mode: 'first_or_retry',
            verdict: 'right',
          }),
          isCorrect: false,
        } as TrySubmission)
        expect(right.try?.isCorrect).toBe(true)

        const afterRight = await row(planId)
        const skip = await recordTry(
          planId,
          envelope(kind, fx, afterRight, {
            partIndex: 0,
            itemId: shown(afterRight)!.itemId,
            mode: 'first_or_retry',
            verdict: 'skip',
          })
        )
        expect(skip.try).toMatchObject({ isCorrect: false, outcome: 'skipped' })
        const skipped = rowOf(await row(planId), skip.try!.tryId)
        expect(skipped).toMatchObject({ isCorrect: false, outcome: 'skipped', answer: null })
      },
    },

    {
      name: 'wrong, retry, right: first-try accuracy, fixed in retries, the final verdict',
      async run(ctx) {
        const planId = await insertPlan(ctx.playerId, one(counted(1)))
        const wrong = await answerShown(kind, fx, planId, 'wrong')
        const afterWrong = await row(planId)
        if (fx.retryRounds === 0) {
          // No retry rounds: the wrong try ends the item, and the part
          expect(shown(afterWrong)).toBeNull()
          expect(afterWrong.status).toBe('completed')
          expect(reportOf(afterWrong).totals).toMatchObject({
            problems: 1,
            tries: 1,
            firstTryCorrect: 0,
            fixedInRetries: 0,
            unresolved: 1,
            finalCorrect: 0,
          })
          return
        }
        expect(shown(afterWrong)).toMatchObject({ itemId: wrong.itemId, round: 1 })
        const retry = await answerShown(kind, fx, planId, 'right')
        const done = await row(planId)
        expect(shown(done)).toBeNull()
        expect(done.status).toBe('completed')
        const rows = [rowOf(done, wrong.try!.tryId), rowOf(done, retry.try!.tryId)]
        expect(rows.map((r) => [r.kind, r.round, r.isCorrect, r.masteryWeight])).toEqual([
          ['first', 0, false, 1],
          ['retry', 1, true, 0.5],
        ])
        const report = reportOf(done)
        expect(report.totals).toMatchObject({
          problems: 1,
          tries: 2,
          firstTryCorrect: 0,
          firstTryAccuracy: 0,
          fixedInRetries: 1,
          unresolved: 0,
          finalCorrect: 1,
          finalAccuracy: 1,
        })
      },
    },

    {
      name: 'a do-over of a wrong item in the part counts and redeems it (applyTry)',
      async run(ctx) {
        const planId = await insertPlan(ctx.playerId, one(counted(3)))
        const wrong = await answerShown(kind, fx, planId, 'wrong')
        const before = await row(planId)
        const nextBefore = shown(before)
        expect(nextBefore?.itemId).not.toBe(wrong.itemId)
        const bumps = ctx.skillBump.mock.calls.length
        // With no retry round the wrong try showed the answer: the do-over is
        // the divulged one (refused, or practice-only and redeeming nothing)
        const divulged = fx.retryRounds === 0
        if (divulged && fx.doOverAfterDivulged === 'refused') {
          await expect(doOver(kind, fx, planId, 0, wrong.itemId, 'right')).rejects.toBeInstanceOf(
            SlotResultMismatchError
          )
          return
        }

        const redo = await doOver(kind, fx, planId, 0, wrong.itemId, 'right')
        expect(redo.try?.isCorrect).toBe(true)
        const after = await row(planId)
        const stamped = rowOf(after, redo.try!.tryId)
        expect([stamped.kind, stamped.round, stamped.practiceOnly, stamped.masteryWeight]).toEqual([
          'do_over',
          1,
          divulged,
          divulged ? 0 : 0.5,
        ])
        // A do-over never steps past an item
        expect(shown(after)).toEqual(nextBefore)
        // Counted: the skill-attempt bump runs once for it (when it is evidence of skills)
        const skills = fx.skillsOf(itemOf(kind, after, 0, wrong.itemId))
        expect(ctx.skillBump.mock.calls.length).toBe(
          bumps + (skills.length > 0 && !divulged ? 1 : 0)
        )

        // Redeemed: the rest right finishes the part; the item is not asked again
        const seen: string[] = []
        for (let guard = 0; guard < 10; guard++) {
          const plan = await row(planId)
          const now = shown(plan)
          if (!now) break
          seen.push(`${now.itemId}@${now.round}`)
          await answerShown(kind, fx, planId, 'right')
        }
        expect(seen).toEqual([
          `${itemIdAt(kind, after, 0, 1)}@0`,
          `${itemIdAt(kind, after, 0, 2)}@0`,
        ])
        const done = await row(planId)
        expect(done.status).toBe('completed')
        expect(reportOf(done).totals).toMatchObject({
          problems: 3,
          firstTryCorrect: 2,
          fixedInRetries: divulged ? 0 : 1,
          unresolved: divulged ? 1 : 0,
          finalCorrect: divulged ? 2 : 3,
        })
      },
    },

    {
      name: 'a do-over of a right item in the part is practice-only and moves nothing',
      async run(ctx) {
        const planId = await insertPlan(ctx.playerId, one(counted(2)))
        const right = await answerShown(kind, fx, planId, 'right')
        const before = await row(planId)
        const bumps = ctx.skillBump.mock.calls.length

        for (const verdict of ['right', 'wrong'] as const) {
          const redo = await doOver(kind, fx, planId, 0, right.itemId, verdict)
          const after = await row(planId)
          const stamped = rowOf(after, redo.try!.tryId)
          expect([
            stamped.kind,
            stamped.round,
            stamped.practiceOnly,
            stamped.masteryWeight,
          ]).toEqual(['do_over', 1, true, 0])
          expect(after.partStates).toEqual(before.partStates)
          expect(after.currentPartIndex).toBe(before.currentPartIndex)
          expect(shown(after)).toEqual(shown(before))
        }
        expect(ctx.skillBump.mock.calls.length).toBe(bumps)
        // The item's verdict is its first, right one
        const report = reportOf(await row(planId))
        expect(report.totals).toMatchObject({ problems: 1, firstTryCorrect: 1, finalCorrect: 1 })
      },
    },

    {
      name: 'do-overs after the part (applyTryAside): stamped by the item, the flow unmoved',
      async run(ctx) {
        const planId = await insertPlan(ctx.playerId, [counted(2, 1), counted(2, 2)])
        const right = await answerShown(kind, fx, planId, 'right')
        const wrong = await answerShown(kind, fx, planId, 'wrong')
        await finishPart(kind, fx, planId)
        const inTransition = await row(planId)
        expect(inTransition).toMatchObject({ currentPartIndex: 1, flowState: 'part_transition' })
        const part0 = kind.contentOf(inTransition.parts[0])
        expect(kind.isDone(part0, partStateOf(inTransition, 0))).toBe(true)

        // During the transition: the right item's do-over is practice-only
        const aside = await doOver(kind, fx, planId, 0, right.itemId, 'right')
        const afterAside = await row(planId)
        expect(rowOf(afterAside, aside.try!.tryId)).toMatchObject({
          kind: 'do_over',
          practiceOnly: true,
          masteryWeight: 0,
        })
        expect(afterAside).toMatchObject({ currentPartIndex: 1, flowState: 'part_transition' })
        expect(afterAside.partStates).toEqual(inTransition.partStates)

        await applySessionFlowEvent(planId, { type: 'PART_TRANSITION_COMPLETED' })
        const practicing = await row(planId)
        const nextShown = shown(practicing)
        expect(nextShown).not.toBeNull()

        // In part 2: the wrong item of part 1, stamped by its own latest counted try
        const tries = normalizeTries(practicing.id, practicing.parts, practicing.results).filter(
          (t) => t.itemId === wrong.itemId && !t.practiceOnlyDerived
        )
        const latestRight = tries[tries.length - 1].isCorrect
        // Every retry above was answered right, so an item that ended wrong
        // had no round left: its answer was shown
        const divulged = !latestRight
        if (divulged && fx.doOverAfterDivulged === 'refused') {
          await expect(doOver(kind, fx, planId, 0, wrong.itemId, 'right')).rejects.toBeInstanceOf(
            SlotResultMismatchError
          )
          return
        }
        const bumps = ctx.skillBump.mock.calls.length
        const later = await doOver(kind, fx, planId, 0, wrong.itemId, 'right')
        const afterLater = await row(planId)
        const stamped = rowOf(afterLater, later.try!.tryId)
        // Not divulged: by its latest counted try. Divulged: practice-only (A17)
        const practiceOnly = latestRight || divulged
        expect([stamped.kind, stamped.round, stamped.practiceOnly, stamped.masteryWeight]).toEqual([
          'do_over',
          tries.length,
          practiceOnly,
          weightOf('do_over', tries.length, practiceOnly),
        ])
        if (divulged) expect(ctx.skillBump.mock.calls.length).toBe(bumps)
        expect(afterLater).toMatchObject({ currentPartIndex: 1, flowState: 'practicing' })
        expect(shown(afterLater)).toEqual(nextShown)
        expect(kind.isDone(part0, partStateOf(afterLater, 0))).toBe(true)
        expect(kind.roundsRemaining(part0, partStateOf(afterLater, 0), wrong.itemId)).toBe(0)
        // Fixed by a retry, the item ends right; a divulged item stays wrong
        const part1 = reportOf(afterLater).parts[0]
        expect(part1).toMatchObject({
          problems: 2,
          firstTryCorrect: 1,
          finalCorrect: divulged ? 1 : 2,
          unresolved: divulged ? 1 : 0,
        })
      },
    },

    {
      name: 'roundsRemaining reaches 0 exactly when the kind divulges',
      async run(ctx) {
        // A second part, so the session is still on when the first is done
        const planId = await insertPlan(ctx.playerId, [counted(2, 1), counted(2, 2)])
        const start = await row(planId)
        const content = kind.contentOf(start.parts[0])
        const target = shown(start)!.itemId
        const later = itemIdAt(kind, start, 0, 1)
        // An item not reached yet has every round
        expect(kind.roundsRemaining(content, partStateOf(start, 0), later)).toBe(fx.retryRounds)

        const remaining: number[] = []
        for (let guard = 0; guard < 20; guard++) {
          const plan = await row(planId)
          // `later` is answered right whenever it is shown; `target` wrong every time
          const now = shown(plan)
          if (!now) break
          if (now.itemId === later) {
            await answerShown(kind, fx, planId, 'right')
            continue
          }
          expect(now.itemId).toBe(target)
          const r = kind.roundsRemaining(content, partStateOf(plan, 0), target)
          remaining.push(r)
          expect(r).toBe(fx.retryRounds - now.round)
          await answerShown(kind, fx, planId, 'wrong')
          const after = await row(planId)
          const tries = normalizeTries(after.id, after.parts, after.results)
          const refusal = kind.whyNotDoOver?.(content, partStateOf(after, 0), tries, target) ?? null
          const accepts = kind.acceptsDoOver(content, partStateOf(after, 0), tries, target)
          // Shown exactly when no round is left for the item shown (A17)
          expect(kind.answerShown(tries, target)).toBe(r === 0)
          if (r > 0) {
            // Not divulged: it comes back, and a do-over is open
            expect(accepts).toBe(true)
            expect(refusal).toBeNull()
          } else {
            // Divulged: never asked again in the part, a do-over as declared
            const rest = await finishPart(kind, fx, planId)
            expect(
              normalizeTries(rest.id, rest.parts, rest.results).filter(
                (t) => t.itemId === target && t.kind !== 'do_over'
              )
            ).toHaveLength(fx.retryRounds + 1)
            if (fx.doOverAfterDivulged === 'refused') {
              expect(accepts).toBe(false)
              if (kind.whyNotDoOver) expect(refusal).toBe('divulged')
              const refused = await doOver(kind, fx, planId, 0, target, 'right').catch(
                (e: unknown) => e
              )
              expect(refused).toBeInstanceOf(SlotResultMismatchError)
              if (kind.whyNotDoOver) {
                expect((refused as SlotResultMismatchError).reason).toBe('divulged')
              }
            } else {
              // Accepted, and practice-only: recorded, counting toward nothing
              expect(accepts).toBe(true)
              const bumps = ctx.skillBump.mock.calls.length
              const before = reportOf(rest).totals
              const redo = await doOver(kind, fx, planId, 0, target, 'right')
              const after = await row(planId)
              expect(redo.try?.isCorrect).toBe(true)
              expect(rowOf(after, redo.try!.tryId)).toMatchObject({
                kind: 'do_over',
                practiceOnly: true,
                masteryWeight: 0,
              })
              expect(ctx.skillBump.mock.calls.length).toBe(bumps)
              const totals = reportOf(after).totals
              expect(totals).toMatchObject({
                finalCorrect: before.finalCorrect,
                unresolved: before.unresolved,
                fixedInRetries: before.fixedInRetries,
              })
            }
            break
          }
        }
        // Counted down by one a round, to 0
        expect(remaining).toEqual(
          Array.from({ length: fx.retryRounds + 1 }, (_, i) => fx.retryRounds - i)
        )
      },
    },

    {
      name: 'a do-over of an item queued for its last round counts and redeems it (A17)',
      async run(ctx) {
        // With no retry round no item is ever queued
        if (fx.retryRounds === 0) return
        const planId = await insertPlan(ctx.playerId, one(counted(3)))
        const start = await row(planId)
        const target = itemIdAt(kind, start, 0, 0)
        const other = itemIdAt(kind, start, 0, 1)
        // `target` wrong up to its next-to-last round, so it waits for its
        // last; `other` wrong once, so it is shown while `target` waits
        for (let guard = 0; ; guard++) {
          const now = shown(await row(planId))
          if (!now || guard > 20)
            throw new Error('the part never queued the item for its last round')
          if (now.itemId === target) {
            await answerShown(kind, fx, planId, 'wrong')
            if (now.round === fx.retryRounds - 1) break
          } else {
            const wrong = now.itemId === other && now.round === 0
            await answerShown(kind, fx, planId, wrong ? 'wrong' : 'right')
          }
        }
        const queued = await row(planId)
        const content = kind.contentOf(queued.parts[0])
        const state = partStateOf(queued, 0)
        const tries = normalizeTries(queued.id, queued.parts, queued.results)
        expect(shown(queued)?.itemId).toBe(other)
        // No round left, yet its answer is not out: the cursor cannot tell, the tries can
        expect(kind.roundsRemaining(content, state, target)).toBe(0)
        expect(kind.answerShown(tries, target)).toBe(false)
        expect(kind.acceptsDoOver(content, state, tries, target)).toBe(true)

        const bumps = ctx.skillBump.mock.calls.length
        const redo = await doOver(kind, fx, planId, 0, target, 'right')
        const after = await row(planId)
        expect(rowOf(after, redo.try!.tryId)).toMatchObject({
          kind: 'do_over',
          round: fx.retryRounds,
          practiceOnly: false,
          masteryWeight: weightOf('do_over', fx.retryRounds, false),
        })
        const skills = fx.skillsOf(itemOf(kind, after, 0, target))
        expect(ctx.skillBump.mock.calls.length).toBe(bumps + (skills.length > 0 ? 1 : 0))

        // Redeemed: the rest right finishes the part, and the item is not asked again
        const seen: string[] = []
        for (let guard = 0; guard < 10; guard++) {
          const now = shown(await row(planId))
          if (!now) break
          seen.push(now.itemId)
          await answerShown(kind, fx, planId, 'right')
        }
        expect(seen).not.toContain(target)
        const done = await row(planId)
        expect(done.status).toBe('completed')
        expect(reportOf(done).totals).toMatchObject({ problems: 3, unresolved: 0, finalCorrect: 3 })
      },
    },

    {
      name: "the report's numbers for a fixed try script",
      async run(ctx) {
        // By item, the verdict of each try in round order; past the list, right
        const script: Verdict[][] = [
          ['right'],
          ['wrong', 'right'],
          ['skip', 'wrong', 'wrong'],
          ['wrong', 'wrong', 'right'],
        ]
        const planId = await insertPlan(ctx.playerId, one(counted(script.length)))
        const start = await row(planId)
        const ids = kind.items(kind.contentOf(start.parts[0])).map((i) => i.itemId)
        for (let guard = 0; guard < 50; guard++) {
          const now = shown(await row(planId))
          if (!now) break
          await answerShown(kind, fx, planId, script[ids.indexOf(now.itemId)][now.round] ?? 'right')
        }

        // The model: an item is tried until right or out of rounds
        const attempts = script.map((s) => {
          const out: Verdict[] = []
          for (let round = 0; round <= fx.retryRounds; round++) {
            const v = s[round] ?? 'right'
            out.push(v)
            if (v === 'right') break
          }
          return out
        })
        const first = attempts.filter((a) => a[0] === 'right').length
        const final = attempts.filter((a) => a[a.length - 1] === 'right').length
        const expected = {
          plannedProblems: script.length,
          problems: script.length,
          tries: attempts.reduce((n, a) => n + a.length, 0),
          firstTryCorrect: first,
          firstTryAccuracy: first / script.length,
          fixedInRetries: final - first,
          unresolved: script.length - final,
          finalCorrect: final,
          finalAccuracy: final / script.length,
        }
        const done = await row(planId)
        expect(done.status).toBe('completed')
        const report = reportOf(done)
        expect(report.totals).toEqual(expected)
        expect(report.parts[0]).toMatchObject({
          ...expected,
          kind: kind.id,
          presentation: kind.presentationOf(done.parts[0]).id,
        })
        expect(report.tries.map((t) => [t.itemId, t.kind, t.round, t.isCorrect])).toEqual(
          attempts
            .flatMap((a, i) =>
              a.map((v, round) => [ids[i], round === 0 ? 'first' : 'retry', round, v === 'right'])
            )
            .sort(byRoundThenItem(ids))
        )
        // Every try normalizes with its evidence presentation the part's
        for (const t of normalizeTries(done.id, done.parts, done.results)) {
          if (t.evidence)
            expect(t.evidence.presentation).toBe(kind.presentationOf(done.parts[0]).id)
        }
      },
    },

    {
      name: 'old rows normalize (or the kind declares none)',
      async run(ctx) {
        if (!fx.legacyRow) {
          // Declared: the kind came after the envelope; every row it has is K1-shaped
          expect(fx.legacyRow).toBeNull()
          return
        }
        const part = counted(2)
        const { row: legacy, expected } = fx.legacyRow(part)
        const planId = await insertPlan(ctx.playerId, one(part), [legacy])
        const plan = await row(planId)
        const [t] = normalizeTries(plan.id, plan.parts, plan.results)
        expect(t).toMatchObject({
          itemId: expected.itemId,
          outcome: expected.outcome,
          answer: expected.answer,
          isCorrect: expected.isCorrect,
          kind: 'first',
          partIndex: 0,
        })
        expect(t.evidence).toEqual(expected.evidence)
        expect(t.payload.kind).toBe(kind.id)
        expect(reportOf(plan).totals).toMatchObject({
          problems: 1,
          firstTryCorrect: expected.isCorrect ? 1 : 0,
        })
      },
    },

    {
      name: 'K0: an unknown-kind part after it: finish before, 409 into it, end early, 0/0',
      async run(ctx) {
        const unknown = {
          kind: UNKNOWN_KIND,
          partNumber: 2,
          content: { items: [{ itemId: 'z0' }, { itemId: 'z1' }] },
        } as StoredPart
        const planId = await insertPlan(ctx.playerId, [counted(2, 1), unknown, counted(2, 3)])
        const last = await finishPart(kind, fx, planId)
        expect(last).toMatchObject({ currentPartIndex: 1, flowState: 'part_transition' })
        expect(last.partStates ?? {}).toHaveProperty('0')
        expect(last.partStates ?? {}).not.toHaveProperty('1')

        const inside = await applySessionFlowEvent(planId, { type: 'PART_TRANSITION_COMPLETED' })
        expect(inside).toMatchObject({ currentPartIndex: 1, flowState: 'practicing' })

        // record_try into it, through the route: 409 unknown_kind, the row unchanged
        const { PATCH } = await import(
          '@/app/api/curriculum/[playerId]/sessions/plans/[planId]/route'
        )
        const before = await row(planId)
        const res = await PATCH(
          new Request(`http://test/api/curriculum/${ctx.playerId}/sessions/plans/${planId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'record_try',
              result: {
                tryId: tid(),
                partIndex: 1,
                itemId: 'z0',
                mode: 'first_or_retry',
                outcome: 'answered',
                answer: 1,
                payload: { kind: UNKNOWN_KIND },
                timing: { responseTimeMs: 1000 },
                help: { hadHelp: false, incorrectAttempts: 0 },
              },
            }),
          }) as never,
          { params: Promise.resolve({ playerId: ctx.playerId, planId }) } as never
        )
        expect(res.status).toBe(409)
        expect(((await res.json()) as { code?: string }).code).toBe('unknown_kind')
        const after = await row(planId)
        expect(after.results).toEqual(before.results)
        expect(after.rowVersion).toBe(before.rowVersion)

        const ended = await completeSessionPlanEarly(planId, 'conformance')
        expect(ended).toMatchObject({ status: 'completed', flowState: 'completed' })
        const report = reportOf(await row(planId))
        expect(report.endedEarly).toBe(true)
        expect(report.parts[1]).toMatchObject({
          kind: UNKNOWN_KIND,
          plannedProblems: 0,
          problems: 0,
          tries: 0,
        })
        expect(report.parts[0]).toMatchObject({ problems: 2, firstTryCorrect: 2 })
        expect(isPartPlayable(unknown)).toBe(true)
      },
    },

    {
      name: "a 20-item part's content, as lists read it, is under 16 KB (§6.6)",
      async run(ctx) {
        const planId = await insertPlan(ctx.playerId, one(counted(20)))
        const [projected] = await getCurrentEphemeralDb()
          .select({ parts: slimPartsSql() })
          .from(schema.sessionPlans)
          .where(eq(schema.sessionPlans.id, planId))
        const bytes = Buffer.byteLength(JSON.stringify(projected.parts[0]), 'utf8')
        expect(bytes).toBeGreaterThan(0)
        expect(bytes).toBeLessThan(CONTENT_LIMIT_BYTES)
        // What lists read still names all 20 items
        expect(kind.items(kind.contentOf(projected.parts[0] as StoredPart))).toHaveLength(20)
      },
    },
  ]
}

/** The report lists tries in the order recorded: the first pass, then each round. */
function byRoundThenItem(ids: string[]) {
  return (a: unknown[], b: unknown[]) =>
    (a[2] as number) - (b[2] as number) || ids.indexOf(a[0] as string) - ids.indexOf(b[0] as string)
}

// ============================================================================
// Running
// ============================================================================

/** Run `fn` with `kind` registered under its id, then put the registry back. */
export async function withKindRegistered<T>(kind: AnyPartKind, fn: () => Promise<T>): Promise<T> {
  const registry = partKinds as Map<string, AnyPartKind>
  const prev = registry.get(kind.id)
  registry.set(kind.id, kind)
  try {
    return await fn()
  } finally {
    if (prev) registry.set(kind.id, prev)
    else registry.delete(kind.id)
  }
}

/** One check on a fresh database with `kind` registered; rejects as the check does. */
export async function runCheck(
  kind: AnyPartKind,
  check: ConformanceCheck,
  skillBump: Mock
): Promise<void> {
  const eph: EphemeralDbResult = createEphemeralDatabase()
  setCurrentEphemeralDb(eph.db)
  try {
    const { playerId } = await createTestStudent(eph.db, `kc-${kind.id}`)
    skillBump.mockClear()
    await withKindRegistered(kind, () => check.run({ playerId, skillBump }))
  } finally {
    setCurrentEphemeralDb(null)
    eph.cleanup()
  }
}

/** The names of the checks `kind` fails. */
export async function failingChecks(
  kind: AnyPartKind,
  fx: KindFixtures,
  skillBump: Mock
): Promise<string[]> {
  const failed: string[] = []
  for (const check of conformanceChecks(kind, fx)) {
    try {
      await runCheck(kind, check, skillBump)
    } catch {
      failed.push(check.name)
    }
  }
  return failed
}

/** Register the suite for `kind`: one test a check. */
export function conformanceSuite(kind: AnyPartKind, fx: KindFixtures, skillBump: Mock) {
  describe(`kind conformance: ${kind.id}`, () => {
    beforeEach(() => skillBump.mockClear())
    afterEach(() => skillBump.mockClear())
    for (const check of conformanceChecks(kind, fx)) {
      it(check.name, () => runCheck(kind, check, skillBump))
    }
  })
}
