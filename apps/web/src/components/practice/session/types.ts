/**
 * The session screen's types (practice-kinds plan §4 K5a-3b): what the page
 * hands the shell and what the shell hands back. Moved unchanged from
 * `ActiveSession.tsx`; the wire they describe is unchanged.
 *
 * `BroadcastState` is today's observer wire: its problem fields are
 * arithmetic's, filled by the kind's `broadcastOf`; K5b moves observers onto
 * `KindBroadcast`.
 */

import type { SlotResult } from '@/db/schema/session-plans'
import type { PracticeItemRef } from '@/lib/classroom/socket-events'
import type { AutoPauseStats, PauseInfo } from '../autoPauseCalculator'

export type { AutoPauseStats, PauseInfo }

/** Student info needed for the pause modal */
export interface StudentInfo {
  id: string
  name: string
  emoji: string
  color: string
}

/** Timing data for the current problem attempt */
export interface AttemptTimingData {
  /** When the current attempt started */
  startTime: number
  /** Accumulated pause time in ms */
  accumulatedPauseMs: number
}

/** Complexity data for broadcast (simplified for transmission) */
export interface BroadcastComplexity {
  /** Complexity bounds from slot constraints */
  bounds?: { min?: number; max?: number }
  /** Total complexity cost from generation trace */
  totalCost?: number
  /** Number of steps (for per-term average) */
  stepCount?: number
  /** Pre-formatted target skill name */
  targetSkillName?: string
}

/**
 * Broadcast state for session observation
 * This is sent to teachers observing the session in real-time
 */
export interface BroadcastState {
  /** Current problem being worked on */
  currentProblem: {
    terms: number[]
    answer: number
  }
  /** Unique slot ID for this problem (same ID used in answer validation) */
  slotId: string
  /** Current phase of the interaction */
  phase: 'problem' | 'feedback' | 'tutorial'
  /** Student's current answer (empty string if not yet started typing) */
  studentAnswer: string
  /** Whether the answer is correct (null if not yet submitted) */
  isCorrect: boolean | null
  /** When the current attempt started (timestamp) */
  startedAt: number
  /** Purpose of this problem slot (why this problem was selected) */
  purpose: 'focus' | 'reinforce' | 'review' | 'challenge'
  /** Complexity data for tooltip display */
  complexity?: BroadcastComplexity
  /**
   * The item on screen: the problem's own part and item, whether it is a
   * do-over, and its retry round. Position and counts are not here (Phase
   * 5b): the page takes them from the server's plan and the report.
   */
  item: BroadcastItem
}

/** The item on screen, as `BroadcastState` names it. */
export interface BroadcastItem extends PracticeItemRef {
  /** A do-over of an earlier item (tapped on its dot), not the item the plan expects */
  doOver: boolean
  /** Retry round of the problem on screen (0 = original; a do-over is 0) */
  round: number
}

/**
 * A do-over the kid chose by tapping a dot: the item, by its id (Phase 5b).
 * Where the session goes after it is the server's plan, never a remembered
 * position.
 */
export interface ActiveRedo {
  isActive: boolean
  /** Part of the item being redone */
  partIndex: number
  /** The item being redone (today its slot id) */
  itemId: string
  /** The dots' index of the item (its number on screen is `linearIndex + 1`) */
  linearIndex: number
  /** The latest result of the item when it was tapped */
  originalResult: SlotResult
}

/** A do-over write: the screen's try and the item redone, sent as a `record_try` do-over. */
export interface RecordRedoParams {
  playerId: string
  planId: string
  result: Omit<SlotResult, 'timestamp' | 'partNumber'> & { tryId: string }
  redoContext: {
    /** The item redone (Phase 5b); the server also reads `result.slotId` */
    itemId: string
    /** Legacy position of the item, which servers up to Phase 5 match by */
    originalPartIndex: number
    originalSlotIndex: number
    /** Read only by servers from before Phase 1 */
    originalWasCorrect: boolean
  }
}
