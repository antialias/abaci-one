import type { DistancePair } from '../engine/facts'

export interface CompletionSegment {
  label: string
  dp: DistancePair
}

export interface CompletionResult {
  /** 'proven' when the fact store confirms the result, 'unproven' if it doesn't */
  status: 'proven' | 'unproven'
  /** The equality statement, e.g. "AF = BC" */
  statement: string | null
  /** Individual segments in the equality chain, for hover provenance */
  segments: CompletionSegment[]
}

export interface ProofHighlightState {
  dpKeys: Set<string> | null
  angleKeys: Set<string> | null
  citGroup: string | null
}
