import type { PropositionStep } from '../types'
import type { ProofFact } from '../engine/facts'
import { citationDefFromFact } from '../engine/citations'

/**
 * Compute progressive disclosure ordinals for citations.
 *
 * Each citation key tracks how many times it has appeared so far:
 * - 1st: full label + axiom text
 * - 2nd: full label only
 * - 3rd+: abbreviated key
 *
 * Returns a Map from `"step-{i}"` or `"fact-{id}"` to the ordinal.
 */
export function computeCitationOrdinals(
  steps: PropositionStep[],
  factsByStep: Map<number, ProofFact[]>
): Map<string, number> {
  const counts = new Map<string, number>()
  const ordinals = new Map<string, number>()

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]
    if (step.citation) {
      const n = (counts.get(step.citation) ?? 0) + 1
      counts.set(step.citation, n)
      ordinals.set(`step-${i}`, n)
    }
    for (const fact of factsByStep.get(i) ?? []) {
      const cd = citationDefFromFact(fact.citation)
      if (cd) {
        const n = (counts.get(cd.key) ?? 0) + 1
        counts.set(cd.key, n)
        ordinals.set(`fact-${fact.id}`, n)
      }
    }
  }
  // Conclusion facts (atStep === steps.length)
  for (const fact of factsByStep.get(steps.length) ?? []) {
    const cd = citationDefFromFact(fact.citation)
    if (cd) {
      const n = (counts.get(cd.key) ?? 0) + 1
      counts.set(cd.key, n)
      ordinals.set(`fact-${fact.id}`, n)
    }
  }
  return ordinals
}
