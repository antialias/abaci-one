/**
 * Classroom Socket Event Types
 *
 * These types define the Socket.IO events used for real-time classroom communication.
 *
 * Channel Patterns:
 * - user:${userId}           - User-specific notifications (enrollment requests)
 * - classroom:${classroomId} - Classroom presence events (student entered/left)
 * - session:${sessionId}     - Practice session observation
 */

import type { SessionReport } from '@/lib/curriculum/session-report'

// ============================================================================
// Enrollment Events (sent to user:${userId} channel)
// ============================================================================

export interface EnrollmentRequestCreatedEvent {
  request: {
    id: string
    classroomId: string
    classroomName: string
    playerId: string
    playerName: string
    requestedByRole: 'parent' | 'teacher'
  }
}

/**
 * Sent when one side (teacher or parent) approves an enrollment request.
 * This is different from EnrollmentApprovedEvent which is sent when BOTH sides approve.
 *
 * Use cases:
 * - Teacher approves parent-initiated request → notify parent
 * - Parent approves teacher-initiated request → notify teacher (via classroom channel)
 */
export interface EnrollmentRequestApprovedEvent {
  requestId: string
  classroomId: string
  classroomName: string
  playerId: string
  playerName: string
  approvedBy: 'teacher' | 'parent'
}

/**
 * Sent when a request is denied by either side.
 *
 * Use cases:
 * - Teacher denies parent's request → notify parent
 * - Parent denies teacher's request → notify teacher (via classroom channel)
 */
export interface EnrollmentRequestDeniedEvent {
  requestId: string
  classroomId: string
  classroomName: string
  playerId: string
  playerName: string
  deniedBy: 'teacher' | 'parent'
}

/**
 * Sent when enrollment is fully complete (both sides have approved).
 * The student is now enrolled in the classroom.
 */
export interface EnrollmentApprovedEvent {
  classroomId: string
  classroomName: string
  playerId: string
  playerName: string
}

/**
 * Sent when a student is removed from a classroom (unenrolled).
 * This also removes their presence if they were in the classroom.
 *
 * Sent to:
 * - classroom:${classroomId} - Teacher sees student removed
 * - player:${playerId} - Student sees they're no longer enrolled
 * - user:${parentIds} - Parents see child is no longer enrolled
 */
export interface StudentUnenrolledEvent {
  classroomId: string
  classroomName: string
  playerId: string
  playerName: string
  unenrolledBy: 'teacher' | 'parent'
}

/**
 * @deprecated Use EnrollmentRequestDeniedEvent instead
 */
export interface EnrollmentDeniedEvent {
  classroomId: string
  playerId: string
  deniedBy: 'teacher' | 'parent'
}

// ============================================================================
// Entry Prompt Events (sent to user:${userId} channel)
// ============================================================================

/**
 * Sent when a teacher creates an entry prompt for a student.
 * Broadcast to all parents of the student.
 */
export interface EntryPromptCreatedEvent {
  promptId: string
  classroomId: string
  classroomName: string
  playerId: string
  playerName: string
  playerEmoji: string
  teacherName: string
  /** When the prompt expires (ISO timestamp) */
  expiresAt: string
}

/**
 * Sent when a parent accepts an entry prompt (child enters classroom).
 * Broadcast to teacher and classroom channel.
 */
export interface EntryPromptAcceptedEvent {
  promptId: string
  classroomId: string
  playerId: string
  playerName: string
  /** Parent who accepted */
  acceptedBy: string
}

/**
 * Sent when a parent declines an entry prompt.
 * Broadcast only to teacher.
 */
export interface EntryPromptDeclinedEvent {
  promptId: string
  classroomId: string
  playerId: string
  playerName: string
  /** Parent who declined */
  declinedBy: string
}

// ============================================================================
// Presence Events (sent to classroom:${classroomId} channel)
// ============================================================================

export interface StudentEnteredEvent {
  playerId: string
  playerName: string
  enteredBy: string
}

export interface StudentLeftEvent {
  playerId: string
  playerName: string
}

// ============================================================================
// Player Presence Events (sent to player:${playerId} channel)
// ============================================================================

export interface PresenceRemovedEvent {
  classroomId: string
  removedBy: 'teacher' | 'self'
}

// ============================================================================
// Session Observation Events (sent to session:${sessionId} channel)
// ============================================================================

/**
 * Complexity data for broadcast (simplified for transmission)
 */
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
 * The stats feed's slice of a `practice-state` broadcast (Phase 4c): what the
 * history list's live time estimate needs, relayed to `session-stats:<id>`
 * (joined at `view`), without the live problem, answer or feedback that
 * `session:<id>` (joined at `observe`) carries.
 */
export interface SessionStatsEvent {
  sessionId: string
  sessionParts?: PracticeStateEvent['sessionParts']
  slotResults?: PracticeStateEvent['slotResults']
}

export interface PracticeStateEvent {
  sessionId: string
  currentProblem: unknown // GeneratedProblem type from curriculum
  phase: 'problem' | 'feedback' | 'tutorial'
  /** Student's current typed answer (digit by digit) */
  studentAnswer: string
  isCorrect: boolean | null
  timing: {
    startedAt: number
    elapsed: number
  }
  /** Purpose of this problem slot (why it was selected) */
  purpose: 'focus' | 'reinforce' | 'review' | 'challenge'
  /** Complexity data for tooltip display */
  complexity?: BroadcastComplexity
  /**
   * The fields below come from the server's plan and the item on the kid's
   * screen (Phase 5b), computed by the arithmetic kind's view
   * (`parts/arithmetic/session-view.ts`, `arithmeticObserverPosition`), not
   * from copies the kid's screen keeps. Counts come from the session report
   * (Phase 4). The legacy position fields (`currentProblemNumber`,
   * `totalProblems`, `currentPartIndex`, `currentSlotIndex`) are gone (§10
   * P6b1-13): observers place the current dot by `currentItem`.
   */
  /** The plan's parts (the dots, and the problems the observer lists tries against) */
  sessionParts?: unknown[] // SessionPart[]
  /** The plan's tries, for the observer's dots and the stats feed */
  slotResults?: unknown[] // SlotResult[]
  /** The item on the kid's screen: a do-over's own item, else the one the plan expects */
  currentItem?: PracticeItemRef
}

/** An item of a part, as structure names it (§1.2: `itemId` is today's `slotId`). */
export interface PracticeItemRef {
  partIndex: number
  itemId: string
}

/** The position fields of a `practice-state` broadcast (Phase 5b). */
export type ObserverPosition = Pick<
  PracticeStateEvent,
  'sessionParts' | 'slotResults' | 'currentItem'
>

export interface TutorialStateEvent {
  sessionId: string
  currentStep: number
  totalSteps: number
  content: unknown // TutorialStep type
}

export interface TutorialControlEvent {
  sessionId: string
  action: 'skip' | 'next' | 'previous'
}

export interface AbacusControlEvent {
  sessionId: string
  target: 'help' | 'hero'
  action: 'show' | 'hide' | 'set-value'
  value?: number
}

export interface ObserverJoinedEvent {
  observerId: string
}

export interface SessionPausedEvent {
  sessionId: string
  reason: string
  /** Optional message from teacher to show on pause screen */
  message?: string
}

export interface SessionResumedEvent {
  sessionId: string
}

/**
 * Sent when student transitions between session parts.
 * Used to show observers the transition screen with synchronized countdown.
 */
export interface PartTransitionEvent {
  sessionId: string
  /** The part we're transitioning FROM, as its kind names it (null at session start; Phase 5b) */
  previous: PartTransitionSide | null
  /** The part we're transitioning TO, as its kind names it (Phase 5b) */
  next: PartTransitionSide
  /** Timestamp when countdown started (for sync) */
  countdownStartTime: number
  /** Countdown duration in ms */
  countdownDurationMs: number
}

/** A part as the transition names it: its kind, and the label and emoji its kind gives it (§1.3). */
export interface PartTransitionSide {
  kind: string
  label: string
  emoji: string
}

/**
 * Sent when part transition completes (countdown finished or skipped)
 */
export interface PartTransitionCompleteEvent {
  sessionId: string
}

/**
 * Vision frame from student's abacus camera.
 * Sent when student has vision mode enabled during practice.
 */
export interface VisionFrameEvent {
  sessionId: string
  /** Base64-encoded JPEG image data */
  imageData: string
  /** Detected abacus value (null if not yet detected) */
  detectedValue: number | null
  /** Detection confidence (0-1) */
  confidence: number
  /** Timestamp when frame was captured */
  timestamp: number
}

/**
 * Sent when a student starts a practice session while present in a classroom.
 * Allows teacher to see session status update in real-time.
 */
export interface SessionStartedEvent {
  sessionId: string
  playerId: string
  playerName: string
}

/**
 * Sent when a student's practice session ends (completed or abandoned)
 * while present in a classroom.
 */
export interface SessionEndedEvent {
  sessionId: string
  playerId: string
  playerName: string
  reason: 'completed' | 'ended_early' | 'abandoned'
  /**
   * The row version of the write that ended the session (Phase 4a; absent
   * from older servers). Sent to the `player:`, `classroom:` and gated
   * `session-report:` rooms on every end, natural completion included, after
   * the commit; since Phase 4c also to `session:<id>`, where observers keep
   * the final report on screen (§10 P4a-4, P4c-1).
   */
  rowVersion?: number
  /** How the session ended (Phase 4a; absent from older servers) */
  outcome?: 'completed' | 'abandoned'
}

/**
 * A teacher card's numbers after a committed write (Phase 4d, §10 P4d-8):
 * cut from the session report, sent only to the teacher-only room
 * `classroom:<id>` of every classroom the student is enrolled in.
 */
export interface ClassroomSessionSummaryEvent {
  sessionId: string
  playerId: string
  outcome: SessionReport['outcome']
  /** The report's `position.progress.done` (items attempted once it is not in progress) */
  completedProblems: number
  /** The report's `position.progress.total` (planned items once it is not in progress) */
  totalProblems: number
  totals: SessionReport['totals']
  rowVersion: number
}

/**
 * Join a session's gated report room (Phase 4a): the socket's viewer with
 * `observe` on the player, or a share token. The viewer is the one the
 * server verified at the handshake, never an id in the payload.
 */
export interface SubscribeSessionReportRequest {
  sessionId: string
  /**
   * Ignored by the server (it checks the socket's verified viewer). Older
   * clients still send it; new ones don't.
   */
  viewerId?: string
  playerId?: string
  /** Share-link holder (checked with `validateSessionShare(token, { allowEnded: true })`) */
  shareToken?: string
}

/**
 * The session's report after a committed row write (session architecture §4,
 * Phase 4a), to `session:${sessionId}`. Reports of one session carry strictly
 * increasing `rowVersion`s from one server; a client applies one only when its
 * `rowVersion` is newer than what it holds.
 */
export interface SessionReportEvent {
  report: SessionReport
}

// ============================================================================
// Skill Tutorial Events (sent to classroom:${classroomId} channel)
// ============================================================================

/**
 * Tutorial state for a specific step within a skill tutorial
 */
export interface TutorialStepState {
  /** Current step index (0-based) */
  currentStepIndex: number
  /** Total steps in the tutorial */
  totalSteps: number
  /** Current multi-step index within the step (for decomposition) */
  currentMultiStep: number
  /** Total multi-steps in current step */
  totalMultiSteps: number
  /** Current abacus value */
  currentValue: number
  /** Target value to reach */
  targetValue: number
  /** Starting value for this step */
  startValue: number
  /** Whether the current step is completed */
  isStepCompleted: boolean
  /** Problem string (e.g., "0 +1 = 1") */
  problem: string
  /** Step description */
  description: string
  /** Current instruction text */
  currentInstruction: string
}

/**
 * Broadcast event for skill tutorial state.
 * Sent when a student is viewing a skill tutorial before starting practice.
 */
export interface SkillTutorialStateEvent {
  /** Player viewing the tutorial */
  playerId: string
  /** Player name for display */
  playerName: string
  /** Current launcher state */
  launcherState: 'intro' | 'tutorial' | 'complete'
  /** Skill being learned */
  skillId: string
  /** Skill display title */
  skillTitle: string
  /** Tutorial state details (only present when launcherState is 'tutorial') */
  tutorialState?: TutorialStepState
}

/**
 * Why a `join-classroom` / `join-player` failed: `'refused'`, the viewer may
 * not join and asking again changes nothing; `'transient'`, the server could
 * not check (a database error), and the client may ask again.
 */
export type ChannelErrorCode = 'refused' | 'transient'

/**
 * Control actions a teacher can send to a student's tutorial
 */
export type SkillTutorialControlAction =
  | { type: 'start-tutorial' }
  | { type: 'skip-tutorial' }
  | { type: 'next-step' }
  | { type: 'previous-step' }
  | { type: 'go-to-step'; stepIndex: number }
  | { type: 'set-abacus-value'; value: number }
  | { type: 'advance-multi-step' }
  | { type: 'previous-multi-step' }

/**
 * Control event sent from teacher to student during skill tutorial
 */
export interface SkillTutorialControlEvent {
  /** Target player ID */
  playerId: string
  /** Control action to apply */
  action: SkillTutorialControlAction
}

// ============================================================================
// Notification Events (sent to user:${userId} channel)
// ============================================================================

/**
 * Generic notification event emitted by the unified notification system.
 * The `type` field determines the notification kind; `data` contains
 * type-specific payload.
 */
export interface GenericNotificationEvent {
  type: string
  title: string
  body: string
  icon: string
  url: string
  data: unknown
}

// ============================================================================
// Session Flow State Event (authoritative state broadcast)
// ============================================================================

/**
 * Broadcast whenever the session's flow state changes (or on observer join).
 * This is the authoritative source of truth — observers should render based on
 * this rather than reconstructing state from individual game-break events.
 */
export interface SessionFlowStateEvent {
  sessionId: string
  /** Current flow state from the server-side state machine */
  flowState:
    | 'practicing'
    | 'part_transition'
    | 'break_pending'
    | 'break_active'
    | 'break_results'
    | 'completed'
    | 'abandoned'
  /** Context for game break states — present when flowState involves a break */
  breakContext?: {
    roomId: string
    gameName: string
    gameId: string
    phase: 'selecting' | 'playing' | 'completed'
  }
}

// ============================================================================
// Observer co-play events
// ============================================================================

/** Observer signals they're ready to join game breaks as a participant */
export interface ObserverCoPlayReadyEvent {
  sessionId: string
  observerId: string
  player: {
    name: string
    emoji: string
    color: string
  }
}

/** Observer signals they're no longer available for co-play */
export interface ObserverCoPlayLeaveEvent {
  sessionId: string
  observerId: string
}

// ============================================================================
// Client-Side Event Map (for typed socket.io client)
// ============================================================================

/**
 * Events the client can listen to
 */
export interface ClassroomServerToClientEvents {
  // Enrollment events
  'enrollment-request-created': (data: EnrollmentRequestCreatedEvent) => void
  'enrollment-request-approved': (data: EnrollmentRequestApprovedEvent) => void
  'enrollment-request-denied': (data: EnrollmentRequestDeniedEvent) => void
  'enrollment-approved': (data: EnrollmentApprovedEvent) => void
  'student-unenrolled': (data: StudentUnenrolledEvent) => void
  'enrollment-denied': (data: EnrollmentDeniedEvent) => void // deprecated

  // Entry prompt events (user channel for parents, classroom channel for teacher)
  'entry-prompt-created': (data: EntryPromptCreatedEvent) => void
  'entry-prompt-accepted': (data: EntryPromptAcceptedEvent) => void
  'entry-prompt-declined': (data: EntryPromptDeclinedEvent) => void

  // Presence events (classroom channel)
  'student-entered': (data: StudentEnteredEvent) => void
  'student-left': (data: StudentLeftEvent) => void

  // Player presence events (player channel)
  'presence-removed': (data: PresenceRemovedEvent) => void

  // Session observation events
  'practice-state': (data: PracticeStateEvent) => void
  'tutorial-state': (data: TutorialStateEvent) => void
  'tutorial-control': (data: TutorialControlEvent) => void
  'abacus-control': (data: AbacusControlEvent) => void
  'observer-joined': (data: ObserverJoinedEvent) => void
  'session-paused': (data: SessionPausedEvent) => void
  'session-resumed': (data: SessionResumedEvent) => void
  'part-transition': (data: PartTransitionEvent) => void
  'part-transition-complete': (data: PartTransitionCompleteEvent) => void
  'vision-frame': (data: VisionFrameEvent) => void

  // Session status events (classroom channel - for teacher's active sessions view)
  'session-started': (data: SessionStartedEvent) => void
  'session-ended': (data: SessionEndedEvent) => void
  'session-report': (data: SessionReportEvent) => void
  'session-report-subscribed': (data: { sessionId: string }) => void
  'session-report-error': (data: { sessionId: string; error: string }) => void
  /** A refused join of a session's live room or stats feed (Phase 4c) */
  'session-room-error': (data: { sessionId: string; error: string }) => void
  /** The kid's screen was admitted to `session:<id>` (Phase 4c): rebroadcast */
  'session-room-joined': (data: { sessionId: string }) => void
  /** The history list's stats feed (`session-stats:<id>`, `view` level): the kid's parts and tries, no live answer */
  'session-stats': (data: SessionStatsEvent) => void
  /** A teacher card's numbers after a committed write (teacher-only `classroom:<id>`, Phase 4d) */
  'classroom-session-summary': (data: ClassroomSessionSummaryEvent) => void

  /** An accepted `join-classroom` / `join-player` */
  'channel-joined': (data: { channel: 'classroom' | 'player'; id: string }) => void
  /** A failed `join-classroom` / `join-player`: nothing was joined */
  'channel-error': (data: {
    channel: 'classroom' | 'player'
    id: string
    error: string
    code: ChannelErrorCode
  }) => void

  // Skill tutorial: the kid's state goes to the teacher-only `classroom:<id>`
  // of each classroom the kid is enrolled in; the teacher's controls go to the
  // kid's `player:<id>`
  'skill-tutorial-state': (data: SkillTutorialStateEvent) => void
  'skill-tutorial-control': (data: SkillTutorialControlEvent) => void

  // Session flow state (authoritative state broadcast)
  'session-flow-state': (data: SessionFlowStateEvent) => void

  // Observer co-play readiness (session channel)
  'observer-coplay-ready': (data: ObserverCoPlayReadyEvent) => void
  'observer-coplay-leave': (data: ObserverCoPlayLeaveEvent) => void

  // Notification events (user channel - unified notification system)
  notification: (data: GenericNotificationEvent) => void
}

/**
 * Events the client can emit
 */
export interface ClassroomClientToServerEvents {
  // Channel subscriptions
  'join-classroom': (data: { classroomId: string }) => void
  'leave-classroom': (data: { classroomId: string }) => void
  'join-player': (data: { playerId: string }) => void
  'leave-player': (data: { playerId: string }) => void
  /** The kid's own screen; checked as `subscribe-session-report` (Phase 4c, session-room-access.ts) */
  'join-session': (data: SubscribeSessionReportRequest) => void
  /** The history list's live estimate; same check (`playerId` may be omitted) */
  'subscribe-session-stats': (data: SubscribeSessionReportRequest) => void
  'unsubscribe-session-stats': (data: { sessionId: string }) => void
  'subscribe-session-report': (data: SubscribeSessionReportRequest) => void
  'unsubscribe-session-report': (data: { sessionId: string }) => void
  'observe-session': (data: {
    sessionId: string
    /** Ignored by the server (the observer is the socket's verified viewer); older clients send it */
    observerId?: string
    playerId?: string
    shareToken?: string
  }) => void
  'stop-observing': (data: { sessionId: string }) => void

  // Session state broadcasts (from student client)
  'practice-state': (data: PracticeStateEvent) => void
  'tutorial-state': (data: TutorialStateEvent) => void
  'vision-frame': (data: VisionFrameEvent) => void

  // Observer controls
  'tutorial-control': (data: TutorialControlEvent) => void
  'abacus-control': (data: AbacusControlEvent) => void
  'session-pause': (data: SessionPausedEvent) => void
  'session-resume': (data: SessionResumedEvent) => void
  'part-transition': (data: PartTransitionEvent) => void
  'part-transition-complete': (data: PartTransitionCompleteEvent) => void

  // Session flow state broadcast (from student client)
  'session-flow-state': (data: SessionFlowStateEvent) => void

  // Observer co-play readiness (from observer to session channel)
  'observer-coplay-ready': (data: ObserverCoPlayReadyEvent) => void
  'observer-coplay-leave': (data: ObserverCoPlayLeaveEvent) => void

  // Skill tutorial: the kid's device sends its state, the teacher sends controls
  'skill-tutorial-state': (data: SkillTutorialStateEvent) => void
  'skill-tutorial-control': (data: SkillTutorialControlEvent) => void
}
