/**
 * Canonical snapshot shapes for session moments.
 *
 * Each moment row's `snapshot` JSON conforms to one of these, discriminated
 * by the row's `type` column. The scene component registry maps a moment
 * type to a React component that renders its snapshot.
 *
 * Keep these tight and presentation-agnostic — they describe what happened,
 * not how to draw it. Scene components are free to interpret the data.
 */

import type { SongProblemMomentKind } from '@/lib/session-song/extract-session-stats'
import type { SessionMomentType } from '@/db/schema/session-moments'

// ============================================================================
// Abacus problem snapshot
// ============================================================================

export interface AbacusProblemSnapshot {
  /** 1-based position within the session ("Problem 3"). */
  problemIndex: number
  /** Which session part it lived in (1-based). */
  partIndex: number
  /** 'practice' | 'review' | 'mastery-check' etc. */
  partType: string

  /** Operands signed (negative for subtract). E.g. [8, 7] for 8+7; [12, -5] for 12-5. */
  terms: number[]
  /** The correct answer. */
  answer: number

  /** Sequence of answers the student gave, in order. Last is final. */
  studentAnswers: number[]
  /** Number of attempts (incorrect + 1 if finally correct, else equal to incorrect). */
  attempts: number
  incorrectAttempts: number
  /** Final outcome. */
  outcome: 'correct' | 'eventually_correct' | 'incorrect'

  /** Wall-clock seconds spent on the problem. */
  responseSeconds?: number
  hadHelp: boolean

  /** Skills/concepts the problem exercised. */
  skills: string[]
  /** Bead-strategy step descriptions, when available. */
  strategySteps: string[]

  /** Narrative category from the existing classifier. Optional. */
  storyKind?: SongProblemMomentKind
  /** Why this moment was deemed notable (one short phrase). */
  reason?: string
}

// ============================================================================
// Game break snapshot
// ============================================================================

export interface GameBreakSnapshot {
  /** Internal game id, e.g. 'matching', 'know-your-world'. */
  gameName: string
  /** Display name for UI. */
  gameDisplayName: string
  /** Emoji/icon string from the game-results row, when present. */
  gameIcon?: string
  /** Category, e.g. 'puzzle' | 'memory' | 'speed' | 'strategy' | 'geography'. */
  category: string

  /** Normalized 0-100 score. */
  normalizedScore: number
  /** Accuracy 0-1, when applicable. */
  accuracy?: number
  /** Resolved outcome string, e.g. 'win', 'cooperative-complete', etc. */
  outcome?: string

  /** Short headline from the game-results report. */
  headline?: string
  /** Bulleted highlights — already kid-safe and present-tense. */
  highlights: string[]

  /** Total wall-clock duration in milliseconds. */
  durationMs?: number
}

// ============================================================================
// Discriminated union
// ============================================================================

/**
 * A typed view of one moment row. Discriminated by `type`. Useful when
 * resolving moments inside server code where we know the type matches the
 * snapshot shape because we wrote it.
 */
export type SessionMomentSnapshot =
  | { type: 'abacus-problem'; data: AbacusProblemSnapshot }
  | { type: 'game-break'; data: GameBreakSnapshot }

// ============================================================================
// Render-time projections (catalog + lyric-prompt input)
// ============================================================================

/**
 * The catalog entry the lyric LLM sees. Compact — only what's needed to
 * reference the moment from a lyric line. Full snapshot data lives in the
 * DB row and gets re-attached at render time.
 */
export interface MomentCatalogEntry {
  shortId: string
  type: SessionMomentType
  /** One-line summary, written for the LLM's eyes (not the kid). */
  summary: string
  /** Notability score — passed in so the LLM can prefer high-significance hooks. */
  significance: number
}

/**
 * What the client receives per moment (full payload for scene rendering).
 * Mirrors a session_moments row but with the typed snapshot.
 */
export interface ResolvedMoment {
  id: string
  shortId: string
  type: SessionMomentType
  summary: string
  significance: number
  timestampMs: number
  snapshot: AbacusProblemSnapshot | GameBreakSnapshot
}
