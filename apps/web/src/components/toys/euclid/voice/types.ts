/**
 * Types for the Euclid voice call system.
 */

import type { ConstructionState, PropositionStep } from '../types'
import type { ProofFact } from '../engine/facts'

/** Context available to Euclid voice modes. */
export interface EuclidModeContext {
  /** The proposition number (1-based) */
  propositionId: number
  /** Proposition title (e.g. "Construct an equilateral triangle on a given line") */
  propositionTitle: string
  /** Proposition kind: 'construction' or 'theorem' */
  propositionKind: 'construction' | 'theorem'
  /** Current tutorial step (0-indexed) */
  currentStep: number
  /** Total number of steps */
  totalSteps: number
  /** Whether the construction/proof is complete */
  isComplete: boolean
  /** Current construction state (points, segments, circles) */
  construction: ConstructionState
  /** Proven facts so far */
  proofFacts: ProofFact[]
  /** Base64 screenshot of the current canvas (null if not captured yet) */
  screenshotDataUrl: string | null
  /** Whether the user is in playground/exploration mode (post-completion) */
  playgroundMode: boolean
  /** The full list of tutorial steps for this proposition */
  steps: PropositionStep[]
}

/** Euclid voice mode IDs */
export type EuclidModeId = 'greeting' | 'conversing' | 'thinking'
