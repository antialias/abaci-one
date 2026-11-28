/**
 * What the session shell needs of a kind's browser half (practice-kinds plan
 * §1.3, §4 K5a-3b): its try items, its views and its wire. A kind registers
 * one in `parts/browser-registry.ts`; the shell reads it by the part on
 * screen and never names a kind. Types only.
 *
 * The plan's sketch (§1.3) is the target; this is what the shell needs today,
 * behaviour-identical to `ActiveSession` (A22): the record and broadcast
 * bodies are still each kind's own wire (K5b moves observers to
 * `KindBroadcast`), and the kind's item view still lays out the screen.
 */

import type { ComponentType, MutableRefObject, ReactNode } from 'react'
import type { SessionPlan, SlotResult, SlotResultSubmission } from '@/db/schema/session-plans'
import type { ReceivedAbacusControl } from '@/hooks/useSessionBroadcast'
import type { BrowserKind, DisplayVerdict } from '@/lib/curriculum/parts/browser-kind'
import type { ResponseTimeGuardResult } from '@/lib/curriculum/timing/response-time-guard'
import type {
  ActiveRedo,
  BroadcastItem,
  BroadcastState,
  PauseInfo,
  RecordRedoParams,
  StudentInfo,
} from './types'
import type {
  EntryPhase,
  LifecyclePhase,
  TryClock,
  TryItemKind,
  TryPhaseState,
  UseTryLifecycleReturn,
} from './useTryLifecycle'

/** Where an item stands: its part, its id and its round (0 = first). */
export interface ItemPosition {
  partIndex: number
  itemId: string
  round: number
}

/** An item a plan shows (the kind's `expectedItem`, through the registry), at its position. */
export interface ShownItem extends ItemPosition {
  /** The kind's item; only the kind reads it */
  item: unknown
}

/** The try as the kind records it, sent through `onAnswer`. */
export type TryRecord = SlotResultSubmission & { partIndex: number; tryId: string }

/** A submitted try's record, as the do-over write also carries it. */
export type SubmittedTryRecord = Omit<SlotResult, 'timestamp' | 'partNumber'> & {
  tryId: string
  partIndex: number
}

/** The kind-blind parts of a try's record, which the shell computes. */
export interface TryRecordParts {
  /** The response time through the capture-time guard (#156) */
  timing: ResponseTimeGuardResult
  /** Hidden-tab time folded out of the response time, if any (audit) */
  hiddenTimeExcludedMs: number | undefined
}

/** A submit from the kind's view: the answer, the timing cap, and how to write the record. */
export interface SubmitRequest<Answer> {
  answer: Answer
  /** The response-time cap (the kind's auto-pause threshold) */
  capMs: number
  /** Told the verdict on screen as soon as it is decided, before the write */
  onVerdict(isCorrect: boolean): void
  resultOf(parts: TryRecordParts & { isCorrect: boolean }): SubmittedTryRecord
}

/** A skip from the kind's view: it shows the answer; the record says skipped. */
export interface SkipRequest {
  capMs: number
  /** Show the answer on the item (before the submit phase starts) */
  reveal(): void
  resultOf(parts: TryRecordParts): TryRecord
}

/** How a kind's view answers through the shell (the plan's `AnswerChannel`). */
export interface AnswerChannel<A, Answer> {
  submit(attempt: A, request: SubmitRequest<Answer>): Promise<void>
  skip(attempt: A, request: SkipRequest): Promise<void>
  /** The kind's own pause (arithmetic's auto-pause after a long idle) */
  pause(info: PauseInfo): void
}

/**
 * A try's feedback as the shell decided it at submit: the verdict shown and
 * whether the answer is shown with it. The one place a try's feedback is
 * decided (`SessionShell`); the kind's view draws it.
 */
export interface TryFeedback {
  verdict: DisplayVerdict
  showAnswer: boolean
}

/** What the shell calls on the kind's view, synchronously with its own step. */
export interface ItemViewHandle {
  /** The session resumed (the kid or the teacher): before the lifecycle resumes */
  onResumed(): void
}

export interface ItemViewProps<I, A extends TryClock, O, X extends EntryPhase<A>, Answer> {
  plan: SessionPlan
  student: StudentInfo
  /** Results from prior sessions (the kind's help thresholds) */
  historicalResults?: SlotResult[]
  /** The phase state the lifecycle and the kind's entry hook share */
  state: TryPhaseState<LifecyclePhase<A, O, X>>
  lifecycle: UseTryLifecycleReturn<I, A, O, X>
  channel: AnswerChannel<A, Answer>
  /** The last try's feedback (null before the first submit) */
  feedback: TryFeedback | null
  /** The do-over on screen, if any */
  redo: ActiveRedo | null
  /** Key of the item the lifecycle follows (changes when the plan or a do-over names another) */
  itemKey: string | undefined
  /** Set by the shell just before a slide to the next item */
  slidePending: MutableRefObject<boolean>
  handle: MutableRefObject<ItemViewHandle | null>
  /** Loading or browsing: the view stays mounted (its hooks run) and draws nothing */
  hidden: boolean
  /** The shell's do-over banner, drawn at the top of the item */
  banner: ReactNode
  /** The shell's overlays (the pause modal, the round interlude), drawn last */
  overlays: ReactNode
  teacherControl?: ReceivedAbacusControl | null
  onTeacherControlHandled?: () => void
  debug: boolean
}

export interface InterludeProps {
  isVisible: boolean
  /** The round starting (1 = the first retry round) */
  round: number
  /** Items in the round */
  itemCount: number
  student: { name: string; emoji: string }
  onComplete: () => void
}

/** A kind's browser half for the session shell. */
export interface SessionKind<I, A extends TryClock, O, X extends EntryPhase<A>, Answer, Checked>
  extends BrowserKind<Checked, Answer> {
  /** The optimistic check (A11); the shell needs one to pace feedback today (K5a-3c reconciles) */
  check(item: Checked, answer: Answer): boolean
  /** Rounds a wrong try can be retried in; the last round's wrong try shows the answer */
  maxRounds: number
  tryItems: TryItemKind<I, A, O>
  /** The try item of an item a plan shows; null when it cannot be shown */
  tryItemOf(shown: ShownItem, opts: { doOver: boolean }): I | null
  /** The item an attempt answers: its own part, item and round, never the plan's current ones */
  positionOf(parts: SessionPlan['parts'], attempt: A): ItemPosition
  /** The observer phase of an entry phase of the kind's own (arithmetic's help mode: 'tutorial') */
  broadcastPhaseOf(phase: string): BroadcastState['phase'] | null
  /** The do-over write for the redone item; null when the part has no such item */
  doOverWriteOf(args: {
    playerId: string
    planId: string
    plan: SessionPlan
    redo: Pick<ActiveRedo, 'partIndex' | 'itemId'>
    result: SubmittedTryRecord
    originalWasCorrect: boolean
  }): RecordRedoParams | null
  /** Items in the round now running in part `partIndex` (the interlude's count) */
  roundSizeOf(plan: SessionPlan, partIndex: number): number
  /** The observer wire for the attempt on screen, around the shell's phase, verdict and item */
  broadcastOf(
    parts: SessionPlan['parts'],
    attempt: A,
    skeleton: Pick<BroadcastState, 'phase' | 'isCorrect' | 'startedAt' | 'item'>
  ): BroadcastState
  /** The observer wire for an attempt sliding off, given what was last broadcast as on screen */
  outgoingBroadcastOf(
    parts: SessionPlan['parts'],
    outgoing: O,
    last: { item: BroadcastItem; attempt: A } | null,
    skeleton: { doOver: boolean; startedAt: number }
  ): BroadcastState
  ItemView: ComponentType<ItemViewProps<I, A, O, X, Answer>>
  ObserverView: ComponentType<{ state: BroadcastState; presentation: string; isDark: boolean }>
  TryCard: ComponentType<{ result: SlotResult; presentation: string; isDark: boolean }>
  Interlude: ComponentType<InterludeProps>
}

/** Any kind's session half, as the registry holds it (the shell never reads its types). */
export type AnySessionKind = SessionKind<any, any, any, any, any, any>
