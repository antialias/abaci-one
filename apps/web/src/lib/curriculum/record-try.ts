/**
 * One recorder for every live try (practice-kinds plan of record §1.3, K2).
 *
 * `recordTry` = `withRowCas(planId, plan => idempotency → locate (expected
 * item, kind) → judge → evidence → machine)`. A first try, a retry and a
 * do-over all come through here, from any of the three bodies the wire
 * carries (§3.3):
 *
 * - `record` / `record_redo` with the legacy body (every open bundle from
 *   before K2) or the K2 superset body. Those actions are one kind's by wire;
 *   its adapter normalizes the body and locates the try by content, through
 *   the seam in `parts/legacy-wire.ts` (amendment A12), so the same try gives
 *   the same row whichever body carries it;
 * - `record_try` with the envelope (`TrySubmission`), located by `itemId`
 *   (and, when sent, the round) through the kind's `expectedItem` /
 *   `acceptsDoOver`. The client sends every try this way from K4b.
 *
 * This file names no kind: what a kind stores is the kind's (`snapshotOf`,
 * `evidenceOf`, `payloadOf`), and the legacy wire is its adapter's.
 *
 * The server is the only judge (amendment A1): the stored `isCorrect` is
 * `kind.judge(...)` on an answered try, false otherwise; a body's `isCorrect`
 * is never stored or compared. The verdict stored is returned beside the plan
 * (amendment A11), for a duplicate the verdict of the row already stored.
 */

import {
  doOverStamp,
  isClientTryId,
  mintTryId,
  normalizeTries,
  partStateOf,
} from '@/db/schema/session-plan-normalize'
import {
  calculateSessionHealth,
  type SessionPlan,
  type SlotResult,
  type StoredTry,
  type TryEvidence,
  type TryKind,
  type TryOutcome,
  type TryPayload,
} from '@/db/schema/session-plans'
import { revokeSharesForSession } from '@/lib/session-share'
import type { AnyPartKind } from './parts/kind'
import { type LegacySubmission, legacyWire } from './parts/legacy-wire'
import { kindIdOf } from './parts/registry'
import { recordSkillAttemptsWithHelp } from './progress-manager'
import {
  isLiveButNotPracticing,
  knownKindOf,
  MalformedTrySubmissionError,
  NotPracticingError,
  SlotResultMismatchError,
} from './record-try-errors'
import { noWrite, type SessionPlanPatch, withRowCas } from './row-cas'
import { applyFlowEvent, type RecordedTry } from './session-flow'
import { sanitizeResultTiming } from './timing/response-time-guard'
import { weightOfTry } from './try-weight'

export type { LegacySubmission, RedoContext, RedoSubmission } from './parts/legacy-wire'
export {
  MalformedDoOverError,
  MalformedTrySubmissionError,
  type MismatchReason,
  NotPracticingError,
  SlotResultMismatchError,
  UnknownKindError,
} from './record-try-errors'

type StoredPart = SessionPlan['parts'][number]

// ============================================================================
// Bodies
// ============================================================================

/** A try in the envelope (`record_try`, §1.3). */
export interface TrySubmission {
  tryId: string
  partIndex: number
  itemId: string
  mode: 'first_or_retry' | 'do_over'
  /**
   * A first or retry try's round as the client showed it (K4, amendment A16).
   * When sent it must be the expected item's round: a resend that arrives
   * once the item's next round is current is not the current try. Absent:
   * the item's id alone locates it.
   */
  round?: number
  outcome: TryOutcome
  /** null unless answered */
  answer: unknown | null
  payload: TryPayload
  timing: Pick<
    StoredTry,
    | 'responseTimeMs'
    | 'responseTimeMsRaw'
    | 'wasIdleCapped'
    | 'capReason'
    | 'capThresholdMs'
    | 'capSource'
    | 'hiddenTimeExcludedMs'
  >
  help: Pick<StoredTry, 'hadHelp' | 'incorrectAttempts' | 'helpTrigger'>
}

/** The verdict stored for a try, returned with the plan (amendment A11). */
export interface TryVerdict {
  tryId: string
  isCorrect: boolean
  outcome: TryOutcome
}

export interface RecordTryResult {
  plan: SessionPlan
  /** The try just recorded, or the one already stored for a duplicate; null when none is found */
  try: TryVerdict | null
}

const OUTCOMES: readonly TryOutcome[] = ['answered', 'skipped', 'timeout']

/**
 * The timing fields a `record_try` body may set, with the type each must
 * have. Only these reach the row: anything else in `timing` (`voided`,
 * `attachmentId`, a top-level field of any name) is dropped, so a body can
 * set no stamp the server owns.
 */
const TIMING_FIELD_TYPES = {
  responseTimeMs: 'number',
  responseTimeMsRaw: 'number',
  wasIdleCapped: 'boolean',
  capReason: 'string',
  capThresholdMs: 'number',
  capSource: 'string',
  hiddenTimeExcludedMs: 'number',
} as const satisfies Record<keyof TrySubmission['timing'], 'number' | 'boolean' | 'string'>

/** The whitelisted timing fields of a body, each of its declared type. */
function timingOf(raw: unknown): Partial<TrySubmission['timing']> {
  const out: Record<string, unknown> = {}
  if (!raw || typeof raw !== 'object') return out
  const r = raw as Record<string, unknown>
  for (const [key, type] of Object.entries(TIMING_FIELD_TYPES)) {
    if (typeof r[key] === type) out[key] = r[key]
  }
  return out as Partial<TrySubmission['timing']>
}
const isOutcome = (v: unknown): v is TryOutcome => OUTCOMES.includes(v as TryOutcome)

/**
 * A `record_try` body checked for shape (the route's 400). Timing and help
 * are whitelisted field by field (`TIMING_FIELD_TYPES`); timing then passes
 * the same guard as a legacy body's (`sanitizeResultTiming`).
 */
export function parseTrySubmission(body: unknown): TrySubmission {
  if (!body || typeof body !== 'object') throw new MalformedTrySubmissionError('not an object')
  const b = body as Record<string, unknown>
  if (!isClientTryId(b.tryId)) throw new MalformedTrySubmissionError('tryId')
  if (typeof b.partIndex !== 'number' || !Number.isInteger(b.partIndex)) {
    throw new MalformedTrySubmissionError('partIndex')
  }
  if (typeof b.itemId !== 'string' || b.itemId.length === 0) {
    throw new MalformedTrySubmissionError('itemId')
  }
  if (b.mode !== 'first_or_retry' && b.mode !== 'do_over') {
    throw new MalformedTrySubmissionError('mode')
  }
  if (
    b.round !== undefined &&
    (typeof b.round !== 'number' || !Number.isInteger(b.round) || b.round < 0)
  ) {
    throw new MalformedTrySubmissionError('round')
  }
  if (!isOutcome(b.outcome)) throw new MalformedTrySubmissionError('outcome')
  const payload = b.payload as TryPayload | undefined
  if (!payload || typeof payload !== 'object' || typeof payload.kind !== 'string') {
    throw new MalformedTrySubmissionError('payload')
  }
  const timing = timingOf(b.timing)
  if (typeof timing.responseTimeMs !== 'number') {
    throw new MalformedTrySubmissionError('timing.responseTimeMs')
  }
  const help = (b.help ?? {}) as Partial<TrySubmission['help']>
  return {
    tryId: b.tryId,
    partIndex: b.partIndex,
    itemId: b.itemId,
    mode: b.mode,
    ...(b.mode === 'first_or_retry' && typeof b.round === 'number' ? { round: b.round } : {}),
    outcome: b.outcome,
    answer: b.outcome === 'answered' ? (b.answer ?? null) : null,
    payload,
    timing: timing as TrySubmission['timing'],
    help: {
      hadHelp: help.hadHelp === true,
      incorrectAttempts: typeof help.incorrectAttempts === 'number' ? help.incorrectAttempts : 0,
      ...(typeof help.helpTrigger === 'string' ? { helpTrigger: help.helpTrigger } : {}),
    },
  }
}

// ============================================================================
// The recorder
// ============================================================================

/** The submission after the body shape is gone: what the CAS decision reads. */
type Normalized =
  | { shape: 'legacy'; mode: TrySubmission['mode']; tryId: string | undefined; t: LegacyTry }
  | { shape: 'envelope'; mode: TrySubmission['mode']; tryId: string; s: TrySubmission }

type LegacyTry = ReturnType<typeof legacyWire.normalize>

/** Either body → what the decision reads (§3.3). */
function normalizeSubmission(s: TrySubmission | LegacySubmission): Normalized {
  if (!('action' in s)) {
    const sub = parseTrySubmission(s)
    return { shape: 'envelope', mode: sub.mode, tryId: sub.tryId, s: sub }
  }
  const t = legacyWire.normalize(s)
  return { shape: 'legacy', mode: t.mode, tryId: t.tryId, t }
}

/** Whether a try with this id is already recorded (idempotent record by `tryId`). */
function isRecordedTry(plan: SessionPlan, tryId: string | undefined): boolean {
  return tryId !== undefined && plan.results.some((r) => r.tryId === tryId)
}

/** The stored verdict of a row of `plan` (its normalized try: old rows derive `outcome`). */
function verdictOfRow(plan: SessionPlan, row: SlotResult | undefined): TryVerdict | null {
  if (!row) return null
  const t = normalizeTries(plan.id, plan.parts, plan.results).find((x) => x.result === row)
  return t ? { tryId: t.tryId, isCorrect: t.isCorrect, outcome: t.outcome } : null
}

/** Elapsed practice time for session health: since the start, 0 before it. */
function elapsedSinceStart(plan: SessionPlan): number {
  return plan.startedAt ? Date.now() - plan.startedAt.getTime() : 0
}

/** The row write for a recorded try: the machine's patch plus session health. */
function tryWrite(plan: SessionPlan, row: SlotResult, t: RecordedTry): SessionPlanPatch {
  const { patch } = applyFlowEvent(plan, { type: 'TRY_RECORDED', row, try: t })
  return {
    ...patch,
    sessionHealth: calculateSessionHealth(
      { ...plan, results: patch.results ?? plan.results },
      elapsedSinceStart(plan)
    ),
  }
}

/** Revoke any active share links once a session completes (non-critical). */
async function revokeSharesIfComplete(planId: string, isComplete: boolean) {
  if (!isComplete) return
  try {
    await revokeSharesForSession(planId)
  } catch (shareError) {
    // Non-critical: log and continue (session already completed successfully)
    console.error('[recordTry] revokeSharesForSession FAILED:', shareError)
  }
}

/** Where a try goes, once located and checked. */
interface Target {
  partIndex: number
  part: StoredPart
  kind: AnyPartKind
  itemId: string
  tryKind: TryKind
  round: number
  practiceOnly: boolean
  /** The kind's top-level fields for the row (`snapshotOf`, or the legacy adapter's) */
  snapshot: Partial<SlotResult>
  /** The stored payload */
  payload: TryPayload
  outcome: TryOutcome
  answer: unknown
}

/** What a committed try reports to the code after its write. */
interface Committed {
  verdict: TryVerdict
  mode: Normalized['mode']
  practiceOnly: boolean
  evidence: TryEvidence | null
  hadHelp: boolean | undefined
  responseTimeMs: number
  previousPartIndex: number
  itemId: string
  inRetryEpoch: boolean
}

type Decision = { committed: Committed } | { duplicate: TryVerdict | null }

/** Locate a try sent in a legacy body, through the legacy wire's adapter. */
function locateLegacy(plan: SessionPlan, t: LegacyTry): Target | { duplicate: TryVerdict | null } {
  const located = legacyWire.locate(plan, t)
  if ('duplicate' in located) return { duplicate: verdictOfRow(plan, located.duplicate) }
  const part = plan.parts[located.partIndex]
  return {
    ...located,
    part,
    kind: knownKindOf(part),
    payload: { kind: kindIdOf(part) },
    outcome: t.outcome,
    answer: t.answer,
  }
}

/** The id and round of an expected item (the kind's, else the item's own `itemId`, round 0). */
function itemPositionOf(
  kind: AnyPartKind,
  item: unknown
): { itemId: string; round: number } | null {
  if (kind.itemPositionOf) return kind.itemPositionOf(item)
  const itemId = (item as { itemId?: unknown } | null)?.itemId
  return typeof itemId === 'string' ? { itemId, round: 0 } : null
}

/**
 * Locate a try sent in the envelope (`record_try`): by `itemId`, through the
 * kind. Order as the legacy wire's: `not_practicing` before the kind, so a try
 * the session cannot take is never told `unknown_kind`.
 */
function locateEnvelope(plan: SessionPlan, s: TrySubmission): Target {
  if (s.mode === 'first_or_retry' && isLiveButNotPracticing(plan)) {
    throw new NotPracticingError(plan)
  }
  const part = plan.parts[s.partIndex]
  if (!part) throw new SlotResultMismatchError(s.itemId, null, 'unknown_item')
  const kind = knownKindOf(part)
  const content = kind.contentOf(part)
  const state = partStateOf(plan, s.partIndex)
  let tryKind: TryKind
  let round: number
  let practiceOnly: boolean
  if (s.mode === 'first_or_retry') {
    const expected =
      s.partIndex === plan.currentPartIndex ? kind.expectedItem(content, state) : null
    const position = expected === null ? null : itemPositionOf(kind, expected)
    if (
      !position ||
      position.itemId !== s.itemId ||
      (s.round !== undefined && s.round !== position.round)
    ) {
      throw new SlotResultMismatchError(s.itemId, position?.itemId ?? null, 'not_current')
    }
    tryKind = position.round > 0 ? 'retry' : 'first'
    round = position.round
    practiceOnly = false
  } else {
    const tries = normalizeTries(plan.id, plan.parts, plan.results || [])
    if (!kind.acceptsDoOver(content, state, tries, s.itemId)) {
      const reason = kind.whyNotDoOver?.(content, state, tries, s.itemId) ?? 'not_accepted'
      throw new SlotResultMismatchError(s.itemId, null, reason)
    }
    const stamp = doOverStamp(tries.filter((t) => t.itemId === s.itemId))
    // The kit's rule (amendment A17): a do-over of an item whose answer the
    // kind showed is practice-only when a kind accepts it at all. It is
    // recorded and counts toward nothing, so no kind can give credit for an
    // answer it showed. A kind may refuse it instead (`whyNotDoOver`
    // 'divulged', the shared cursor). Shown: its latest counted try is wrong
    // and no round is left for it, and it is not the item on screen (an item
    // shown at its last round has 0 rounds left but its answer is not out yet)
    const onScreen = kind.expectedItem(content, state)
    const divulged =
      !stamp.practiceOnly &&
      stamp.round > 0 &&
      kind.roundsRemaining(content, state, s.itemId) === 0 &&
      (onScreen === null || itemPositionOf(kind, onScreen)?.itemId !== s.itemId)
    round = stamp.round
    practiceOnly = stamp.practiceOnly || divulged
    tryKind = 'do_over'
  }
  const snapshot = kind.snapshotOf
    ? kind.snapshotOf(content, s.itemId, s)
    : { fields: {}, payload: s.payload }
  if (!snapshot) throw new SlotResultMismatchError(s.itemId, null, 'unknown_item')
  return {
    partIndex: s.partIndex,
    part,
    kind,
    itemId: s.itemId,
    tryKind,
    round,
    practiceOnly,
    snapshot: snapshot.fields,
    payload: { ...snapshot.payload, kind: kindIdOf(part) },
    outcome: s.outcome,
    answer: s.outcome === 'answered' ? s.answer : null,
  }
}

/** The row's own fields before the server's stamps: the body's, or the envelope's timing and help. */
function bodyFieldsOf(n: Normalized): Partial<SlotResult> {
  if (n.shape === 'legacy') return n.t.fields
  const timing = { ...n.s.timing, ...sanitizeResultTiming(n.s.timing) }
  return { ...timing, ...n.s.help }
}

/** The item a plan shows next in its current part, for the trace after a commit (kind-blind). */
function nextItemIdOf(plan: SessionPlan): string | null {
  const part = plan.parts[plan.currentPartIndex]
  const kind = part ? knownKindOrNull(part) : null
  if (!part || !kind) return null
  const item = kind.expectedItem(kind.contentOf(part), partStateOf(plan, plan.currentPartIndex))
  return item === null ? null : (itemPositionOf(kind, item)?.itemId ?? null)
}

function knownKindOrNull(part: StoredPart): AnyPartKind | null {
  try {
    return knownKindOf(part)
  } catch {
    return null
  }
}

/**
 * Record a try: a first try, a retry or a do-over, from any body (§1.3, §3.3).
 *
 * Idempotent by `tryId`: a try whose id is already recorded returns the plan
 * unchanged with the verdict already stored, whatever its part's kind. Every
 * CAS attempt re-reads the row, so a request that lost a race against the
 * same `tryId` sees it recorded and returns without a second write or a
 * second skill-attempt bump (§10 P1-10).
 *
 * The server stamps `kind`, `round`, `practiceOnly`, `partIndex`,
 * `masteryWeight` (weightOfTry), the envelope and the verdict; client-sent
 * values for them are ignored. The flow machine (`TRY_RECORDED`) moves the
 * part's cursor through its kind and decides the rhythm. A do-over of an
 * item whose latest counted try was correct is practice-only (weight 0, no
 * skill-attempt bump).
 */
export async function recordTry(
  planId: string,
  submission: TrySubmission | LegacySubmission
): Promise<RecordTryResult> {
  const n = normalizeSubmission(submission)
  const traceStart = Date.now()

  const { plan: updated, value: decision } = await withRowCas<Decision>(planId, (plan) => {
    if (!plan.parts || !Array.isArray(plan.parts)) {
      throw new Error(
        `Plan ${planId} has invalid parts: ${typeof plan.parts} (status: ${plan.status}, partIndex: ${plan.currentPartIndex})`
      )
    }
    if (plan.parts.length === 0) throw new Error(`Plan ${planId} has empty parts array`)
    if (!plan.results || !Array.isArray(plan.results)) {
      throw new Error(`Plan ${planId} has invalid results: ${typeof plan.results} (expected array)`)
    }

    // A try already recorded (a resend after a lost reply, a double submit,
    // or the request this one raced): answered before anything else
    if (isRecordedTry(plan, n.tryId)) {
      console.log('[recordTry] duplicate tryId ignored', { planId, tryId: n.tryId })
      return noWrite({
        duplicate: verdictOfRow(
          plan,
          plan.results.find((r) => r.tryId === n.tryId)
        ),
      })
    }

    const located = n.shape === 'envelope' ? locateEnvelope(plan, n.s) : locateLegacy(plan, n.t)
    if ('duplicate' in located) return noWrite(located)
    const t = located
    const content = t.kind.contentOf(t.part)

    if (n.mode === 'first_or_retry') {
      console.log('[GBTRACE][server]', 'record-slot-result-start', {
        ts: new Date().toISOString(),
        planId,
        playerId: plan.playerId,
        currentPartIndex: plan.currentPartIndex,
        currentPartNumber: t.part.partNumber,
        partKind: kindIdOf(t.part),
        itemId: t.itemId,
        round: t.round,
      })
    }

    const fields = bodyFieldsOf(n)
    const { outcome, answer } = t
    // The server is the only judge (amendment A1)
    const isCorrect = outcome === 'answered' && t.kind.judge(content, t.itemId, answer)

    // The row carries the try record only: no legacy try fields since 6b-1
    // (§10 P6b1-4); the kind's top-level fields as always (K14)
    const stamped = {
      ...fields,
      ...(n.shape === 'envelope' ? t.snapshot : {}),
      isCorrect,
      tryId: n.tryId ?? mintTryId(),
      kind: t.tryKind,
      round: t.round,
      practiceOnly: t.practiceOnly,
      partIndex: t.partIndex,
      ...(n.shape === 'legacy' ? t.snapshot : {}),
      partNumber: t.part.partNumber,
      timestamp: new Date(),
      masteryWeight: weightOfTry({
        kind: t.tryKind,
        round: t.round,
        isCorrect,
        practiceOnly: t.practiceOnly,
      }),
    } as SlotResult
    const evidence = t.kind.evidenceOf(t.part, {
      result: stamped,
      outcome,
      payload: t.kind.payloadOf({ ...stamped, payload: t.payload }),
    })
    const row: SlotResult = {
      ...stamped,
      itemId: t.itemId,
      outcome,
      answer,
      evidence,
      payload: t.payload,
    }

    return {
      write: tryWrite(plan, row, {
        partIndex: t.partIndex,
        itemId: t.itemId,
        kind: t.tryKind,
        round: t.round,
        practiceOnly: t.practiceOnly,
        isCorrect,
      }),
      value: {
        committed: {
          verdict: { tryId: row.tryId as string, isCorrect, outcome },
          mode: n.mode,
          practiceOnly: t.practiceOnly,
          evidence,
          hadHelp: row.hadHelp,
          responseTimeMs: row.responseTimeMs,
          previousPartIndex: plan.currentPartIndex,
          itemId: t.itemId,
          inRetryEpoch: t.tryKind === 'retry',
        },
      },
    }
  })

  if ('duplicate' in decision) return { plan: updated, try: decision.duplicate }
  const c = decision.committed

  // Update global skill mastery timestamps with help tracking. Once per
  // recorded try: only the request whose write committed gets here; never for
  // a practice-only do-over (no pedagogical effect). masteryWeight is applied
  // by BKT when it reads the rows, not here.
  if (!c.practiceOnly && c.evidence && c.evidence.skills.length > 0) {
    const skillResults = c.evidence.skills.map((skillId) => ({
      skillId,
      isCorrect: c.verdict.isCorrect,
    }))
    try {
      await recordSkillAttemptsWithHelp(
        updated.playerId,
        skillResults,
        // as each recorder passed it before K2: a do-over defaulted it
        (c.mode === 'do_over' ? (c.hadHelp ?? false) : c.hadHelp) as boolean,
        c.responseTimeMs
      )
    } catch (skillError) {
      console.error('[recordTry] recordSkillAttemptsWithHelp FAILED:', skillError)
      // A first or retry try fails loudly (as it always has); a do-over's write
      // is already recorded and the bump is not worth failing it for
      if (c.mode === 'first_or_retry') throw skillError
    }
  }

  const isComplete = updated.status === 'completed'
  await revokeSharesIfComplete(planId, isComplete)

  if (c.mode === 'first_or_retry') {
    // From the committed row, after the CAS (nothing extra inside it)
    console.log('[GBTRACE][server]', 'record-slot-result-finish', {
      ts: new Date().toISOString(),
      planId,
      playerId: updated.playerId,
      durationMs: Date.now() - traceStart,
      previousPartIndex: c.previousPartIndex,
      previousItemId: c.itemId,
      nextPartIndex: updated.currentPartIndex,
      nextItemId: nextItemIdOf(updated),
      partTransitioned: updated.currentPartIndex > c.previousPartIndex,
      flowState: updated.flowState,
      inRetryEpoch: c.inRetryEpoch,
      isComplete,
      status: updated.status,
    })
  }

  return { plan: updated, try: c.verdict }
}
