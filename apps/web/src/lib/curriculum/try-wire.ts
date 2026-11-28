/**
 * The try bodies a client sends (practice-kinds §3.3). Pure and client-safe:
 * the hooks send them, the tests build them the same way.
 */
import type { SlotResult, TryOutcome, TryPayload } from '@/db/schema/session-plans'

/** The envelope fields the K2 superset body adds to a legacy try body (§3.3). */
export interface SupersetEnvelope {
  itemId: string
  outcome: TryOutcome
  answer: unknown
  payload: TryPayload
}

/**
 * The K2 superset body for `record` / `record_redo` (practice-kinds §3.3): the
 * legacy fields, which every server reads, plus the envelope a K2 server
 * reads (`itemId`, `outcome`, `answer`, `payload`). A skip names its outcome
 * (`handleSkip`); any other try is answered.
 *
 * `isCorrect` stays in the body only so that a server rolled back to K1, which
 * stores the body's verdict, still stores one; a K2 server judges the try
 * itself and ignores it. A later phase drops it (practice-kinds K5, amendment
 * A1).
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
