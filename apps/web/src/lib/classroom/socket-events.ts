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
  /** Current problem number (1-indexed for display) */
  currentProblemNumber: number
  /** Total problems in the session */
  totalProblems: number
  /** Session structure for progress indicator */
  sessionParts?: unknown[] // SessionPart[] - sent for observer progress display
  /** Current part index for progress indicator */
  currentPartIndex?: number
  /** Current slot index within the part */
  currentSlotIndex?: number
  /** Accumulated results for progress indicator */
  slotResults?: unknown[] // SlotResult[] - for observer progress display
}

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
  /** Part type we're transitioning FROM (null if session start) */
  previousPartType: 'abacus' | 'visualization' | 'linear' | null
  /** Part type we're transitioning TO */
  nextPartType: 'abacus' | 'visualization' | 'linear'
  /** Timestamp when countdown started (for sync) */
  countdownStartTime: number
  /** Countdown duration in ms */
  countdownDurationMs: number
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

  // Skill tutorial events (classroom channel - for teacher's observation)
  'skill-tutorial-state': (data: SkillTutorialStateEvent) => void
  'skill-tutorial-control': (data: SkillTutorialControlEvent) => void
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
  'join-session': (data: { sessionId: string }) => void
  'observe-session': (data: { sessionId: string; observerId: string }) => void
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

  // Skill tutorial broadcasts (from student client to classroom channel)
  'skill-tutorial-state': (data: SkillTutorialStateEvent) => void
  'skill-tutorial-control': (data: SkillTutorialControlEvent) => void
}
