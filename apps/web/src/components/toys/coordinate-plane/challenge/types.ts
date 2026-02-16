import type { WordProblem } from '../wordProblems/types'

export type ChallengePhase =
  | 'idle'
  | 'auto-adjusting'
  | 'presenting'
  | 'solving'
  | 'checking'
  | 'celebrating'
  | 'revealing'
  | 'revealed'

export interface ChallengeState {
  phase: ChallengePhase
  problem: WordProblem | null
  attempts: number
  /** Timestamp when current phase started */
  phaseStartTime: number
  /** Index of current reveal step (during 'revealing' phase) */
  revealStep: number
}

export interface ViewportTarget {
  cx: number
  cy: number
  ppuX: number
  ppuY: number
}

export interface ViewportAnimation {
  active: boolean
  from: ViewportTarget
  to: ViewportTarget
  startTime: number
  duration: number
}

/** Placement result for the word problem card */
export interface CardPlacement {
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  style: {
    top?: number | string
    bottom?: number | string
    left?: number | string
    right?: number | string
  }
}
