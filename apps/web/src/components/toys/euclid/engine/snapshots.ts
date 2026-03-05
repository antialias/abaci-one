import type { ConstructionState, IntersectionCandidate, GhostLayer } from '../types'
import type { ProofFact } from './facts'
import { distancePair } from './facts'
import type { FactStore } from './factStore'
import { queryEquality } from './factStore'
import { getPoint, getAllSegments } from './constructionState'
import type { CompletionResult, CompletionSegment } from '../proof/types'

export interface ProofSnapshot {
  construction: ConstructionState
  candidates: IntersectionCandidate[]
  proofFacts: ProofFact[]
  ghostLayers: GhostLayer[]
}

export function captureSnapshot(
  construction: ConstructionState,
  candidates: IntersectionCandidate[],
  proofFacts: ProofFact[],
  ghostLayers: GhostLayer[]
): ProofSnapshot {
  // ConstructionState is replaced on each mutation (spread), so storing the reference is safe.
  // Same for candidates array (replaced via [...old, ...new]).
  // proofFacts is also replaced via proofFactsRef.current = [...].
  // ghostLayers is also replaced via ghostLayersRef.current = [...].
  return { construction, candidates, proofFacts, ghostLayers }
}

/**
 * Derive the completion result from the fact store's proven equalities
 * on the proposition's result segments. Returns the proven equality
 * (e.g. "AF = BC") or flags it as unproven if the engine couldn't establish it.
 */
export function deriveCompletionResult(
  factStore: FactStore,
  resultSegments: Array<{ fromId: string; toId: string }> | undefined,
  state: ConstructionState
): CompletionResult {
  if (!resultSegments || resultSegments.length === 0) {
    return { status: 'proven', statement: null, segments: [] }
  }

  const label = (id: string) => getPoint(state, id)?.label ?? id.replace(/^pt-/, '')
  const segLabel = (fromId: string, toId: string) => `${label(fromId)}${label(toId)}`

  // Collect all result segment distance pairs
  const resultDps = resultSegments.map((rs) => distancePair(rs.fromId, rs.toId))

  // Build an ordered list of equal segments, starting with result segments
  // then adding any construction segment that's in the same equality class
  const equalSegs: CompletionSegment[] = []
  const seen = new Set<string>()

  for (const rs of resultSegments) {
    const lbl = segLabel(rs.fromId, rs.toId)
    if (!seen.has(lbl)) {
      seen.add(lbl)
      equalSegs.push({ label: lbl, dp: distancePair(rs.fromId, rs.toId) })
    }
  }

  // Check all construction segments for matches
  for (const seg of getAllSegments(state)) {
    const segDp = distancePair(seg.fromId, seg.toId)
    const lbl = segLabel(seg.fromId, seg.toId)
    if (seen.has(lbl)) continue

    for (const rDp of resultDps) {
      if (queryEquality(factStore, rDp, segDp)) {
        seen.add(lbl)
        equalSegs.push({ label: lbl, dp: segDp })
        break
      }
    }
  }

  if (equalSegs.length >= 2) {
    return {
      status: 'proven',
      statement: equalSegs.map((s) => s.label).join(' = '),
      segments: equalSegs,
    }
  }

  // If we have result segments but couldn't find proven equalities,
  // the proof chain is incomplete
  return {
    status: 'unproven',
    statement: resultSegments.map((rs) => segLabel(rs.fromId, rs.toId)).join(', '),
    segments: resultSegments.map((rs) => ({
      label: segLabel(rs.fromId, rs.toId),
      dp: distancePair(rs.fromId, rs.toId),
    })),
  }
}
