/**
 * The two legacy try actions as the route sends them to the one recorder
 * (practice-kinds K2): `record` and `record_redo`, each with its body as the
 * client sends it, through `recordTry`. The tests that drove
 * `recordSlotResult` / `recordRedoResult` before K2 drive these; only the
 * function they call changed, never what they assert.
 */
import type { SessionPlan, SlotResultSubmission } from '@/db/schema/session-plans'
import { type RedoContext, type RedoSubmission, recordTry } from '@/lib/curriculum/record-try'

/** `record`: a first try or a retry, in the legacy (or superset) body. */
export async function sendRecord(
  planId: string,
  result: SlotResultSubmission
): Promise<SessionPlan> {
  return (await recordTry(planId, { action: 'record', result })).plan
}

/** `record_redo`: a do-over, in the legacy (or superset) body with its `redoContext`. */
export async function sendRecordRedo(
  planId: string,
  result: RedoSubmission,
  redoContext: RedoContext
): Promise<SessionPlan> {
  return (await recordTry(planId, { action: 'record_redo', result, redoContext })).plan
}
