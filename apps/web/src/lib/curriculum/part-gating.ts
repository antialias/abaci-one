/**
 * Part gating for session plans — the pure decision of which requested part
 * types survive the readiness gates, and WHY the others were dropped.
 *
 * Kept free of DB imports so it is unit-testable and so the modal can show the
 * same reasons the planner acted on (`skippedParts` on the plan summary and in
 * the `plan_structure_ready` progress event).
 */

import type { SessionPartType, SkippedPart } from '@/db/schema/session-plans'

export interface ResolveEnabledPartTypesInput {
  /** Parts the caller asked for */
  partsToInclude: Record<SessionPartType, boolean>
  /** At least one skill is at the visual practice level */
  hasVisualSkills: boolean
  /** The L3 derived-readiness flag */
  linearReadinessEnabled: boolean
  /** Linear-ready skills after teacher vetoes (flag on only) */
  linearReadyCount: number
  /** Linear-ready skills ignoring vetoes (flag on only) — separates "vetoed" from "not ready" */
  linearReadyBeforeVetoCount: number
}

export interface ResolvedPartTypes {
  enabledPartTypes: SessionPartType[]
  skippedParts: SkippedPart[]
}

export function resolveEnabledPartTypes(input: ResolveEnabledPartTypesInput): ResolvedPartTypes {
  const {
    partsToInclude,
    hasVisualSkills,
    linearReadinessEnabled,
    linearReadyCount,
    linearReadyBeforeVetoCount,
  } = input

  const enabledPartTypes: SessionPartType[] = []
  const skippedParts: SkippedPart[] = []

  for (const type of ['abacus', 'visualization', 'linear'] as const) {
    if (!partsToInclude[type]) continue
    if (type === 'abacus') {
      enabledPartTypes.push(type)
      continue
    }
    if (type === 'visualization') {
      if (hasVisualSkills) enabledPartTypes.push(type)
      else skippedParts.push({ type, reason: 'no-visual-skills' })
      continue
    }
    // linear
    if (!linearReadinessEnabled) {
      // Flag off: linear rides on the visual coupling (legacy behaviour)
      if (hasVisualSkills) enabledPartTypes.push(type)
      else skippedParts.push({ type, reason: 'no-visual-skills' })
      continue
    }
    if (linearReadyCount > 0) {
      enabledPartTypes.push(type)
    } else if (linearReadyBeforeVetoCount > 0) {
      skippedParts.push({ type, reason: 'vetoed' })
    } else {
      skippedParts.push({ type, reason: 'not-ready' })
    }
  }

  return { enabledPartTypes, skippedParts }
}
