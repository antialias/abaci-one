import type { PropositionDef } from '../types'
import { PROP_5_PAPPUS } from './prop5-pappus'

/** Alternate proof variants keyed by proposition ID. */
export const ALTERNATE_PROOFS: Record<number, PropositionDef[]> = {
  5: [PROP_5_PAPPUS],
}
