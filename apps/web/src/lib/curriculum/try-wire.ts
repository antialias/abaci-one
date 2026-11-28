/**
 * The try bodies a client sends (practice-kinds §3.3). Pure and client-safe:
 * the hooks send them, the tests build them the same way.
 *
 * The K2 bundle's superset body (`supersetBodyOf`) is what the client sends
 * through K4a. From K4b, one release later, it sends every try as
 * `record_try` with the envelope (`envelopeOfScreenTry`), which the K4a
 * server already records with its round honoured (amendment A16); the
 * superset body stays for open older tabs and the tests that replay it.
 */
import type { SlotResult, TryOutcome, TryPayload } from '@/db/schema/session-plans'
import type { TrySubmission } from './record-try'

/** The envelope fields the K2 superset body adds to a legacy try body (§3.3). */
export interface SupersetEnvelope {
  itemId: string
  outcome: TryOutcome
  answer: unknown
  payload: TryPayload
}

/**
 * The K2 bundle's superset body for `record` / `record_redo` (practice-kinds
 * §3.3): the legacy fields, which every server reads, plus the envelope a K2
 * server reads (`itemId`, `outcome`, `answer`, `payload`). A skip names its
 * outcome (`handleSkip`); any other try is answered. The K2 bundle sent
 * `isCorrect` in it for a server rolled back to K1; every server from K2 on
 * ignores it. The K4b client no longer sends this body (`envelopeOfScreenTry`).
 */
export function supersetBodyOf<T extends Pick<SlotResult, 'slotId' | 'studentAnswer'>>(
  result: T & { outcome?: SupersetEnvelope['outcome'] }
): T & SupersetEnvelope {
  const outcome = result.outcome ?? 'answered'
  return {
    ...result,
    itemId: result.slotId,
    outcome,
    answer: outcome === 'answered' ? result.studentAnswer : null,
    payload: { kind: 'arithmetic' },
  }
}

/** The timing fields a try carries, as the screen's capture-time guard (#156) sets them. */
const TIMING_FIELDS = [
  'responseTimeMs',
  'responseTimeMsRaw',
  'wasIdleCapped',
  'capReason',
  'capThresholdMs',
  'capSource',
  'hiddenTimeExcludedMs',
] as const satisfies readonly (keyof TrySubmission['timing'])[]

/**
 * A try as today's screen builds it (`ActiveSession`'s `handleSubmit` and
 * `handleSkip`): arithmetic's fields, with a skip naming its outcome. Its
 * `isCorrect` is the screen's own check, for display; it is never sent.
 */
export type ScreenTry = Pick<
  SlotResult,
  | 'slotId'
  | 'studentAnswer'
  | 'responseTimeMs'
  | 'usedOnScreenAbacus'
  | 'hadHelp'
  | 'incorrectAttempts'
> &
  Partial<
    Pick<
      SlotResult,
      | 'epochNumber'
      | 'helpTrigger'
      | 'responseTimeMsRaw'
      | 'wasIdleCapped'
      | 'capReason'
      | 'capThresholdMs'
      | 'capSource'
      | 'hiddenTimeExcludedMs'
    >
  > & { tryId: string; outcome?: TryOutcome }

/**
 * The `record_try` envelope for a try the screen built (practice-kinds §1.3,
 * §3.3 K4 row). The server is the only judge (amendment A1): the envelope has
 * no verdict, so the screen's `isCorrect` stays on the screen. A first or
 * retry try names the round it was shown in, so a resend that arrives once
 * the item's next round is current is refused, as the legacy body's
 * `epochNumber` is (amendment A16). The server fills arithmetic's top-level
 * fields from the plan's slot (`snapshotOf`, K14).
 */
export function envelopeOfScreenTry(
  result: ScreenTry,
  at: { mode: TrySubmission['mode']; partIndex: number; itemId?: string }
): TrySubmission {
  const outcome = result.outcome ?? 'answered'
  const timing: Record<string, unknown> = {}
  for (const key of TIMING_FIELDS) {
    if (result[key] !== undefined) timing[key] = result[key]
  }
  return {
    tryId: result.tryId,
    partIndex: at.partIndex,
    itemId: at.itemId ?? result.slotId,
    mode: at.mode,
    ...(at.mode === 'first_or_retry' ? { round: result.epochNumber ?? 0 } : {}),
    outcome,
    answer: outcome === 'answered' ? result.studentAnswer : null,
    payload: { kind: 'arithmetic', usedOnScreenAbacus: result.usedOnScreenAbacus === true },
    timing: timing as TrySubmission['timing'],
    help: {
      hadHelp: result.hadHelp,
      incorrectAttempts: result.incorrectAttempts,
      ...(result.helpTrigger !== undefined ? { helpTrigger: result.helpTrigger } : {}),
    },
  }
}
