/**
 * A session plan as the plan routes send it to the client (`plans/[planId]`
 * and its `flow-events`): dates as ms timestamps, plus the legacy position and
 * break fields derived from the new columns for bundles that still read them
 * (`legacyWireFieldsOf`; D9, §10 P6b1-16).
 */

import { legacyWireFieldsOf } from '@/db/schema/session-plan-normalize'
import type { SessionPlan } from '@/db/schema/session-plans'

const toMs = <T>(value: Date | T): number | T => (value instanceof Date ? value.getTime() : value)

export function serializePlan(plan: SessionPlan) {
  return {
    ...plan,
    createdAt: toMs(plan.createdAt),
    approvedAt: toMs(plan.approvedAt),
    startedAt: toMs(plan.startedAt),
    completedAt: toMs(plan.completedAt),
    flowUpdatedAt: toMs(plan.flowUpdatedAt),
    deletedAt: toMs(plan.deletedAt),
    ...legacyWireFieldsOf(plan),
  }
}
