import type { SkippedPart } from '@/db/schema/session-plans'

/**
 * Student-facing copy for a part the planner's readiness gates dropped. Shared by
 * the planner (its "nothing left to practise" error) and the start modal (the
 * skipped-part note while a plan generates), so both paths read the same.
 */
export const PART_NAMES: Record<SkippedPart['type'], string> = {
  abacus: 'Abacus',
  visualization: 'Visualization',
  linear: 'Number sentences',
}

export const SKIP_REASONS: Record<SkippedPart['reason'], string> = {
  'not-ready': 'not ready yet',
  vetoed: "you said 'not yet'",
  'no-visual-skills': 'no visual skills yet',
}

/** e.g. "Number sentences skipped — not ready yet" */
export function describeSkippedPart(part: SkippedPart): string {
  return `${PART_NAMES[part.type]} skipped — ${SKIP_REASONS[part.reason]}`
}
