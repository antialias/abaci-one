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

export interface EnrollmentApprovedEvent {
  classroomId: string
  playerId: string
  playerName: string
}

export interface EnrollmentDeniedEvent {
  classroomId: string
  playerId: string
  deniedBy: 'teacher' | 'parent'
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
// Session Observation Events (sent to session:${sessionId} channel)
// ============================================================================

export interface PracticeStateEvent {
  sessionId: string
  currentProblem: unknown // GeneratedProblem type from curriculum
  phase: 'problem' | 'feedback' | 'tutorial'
  studentAnswer: number | null
  isCorrect: boolean | null
  timing: {
    startedAt: number
    elapsed: number
  }
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
  'enrollment-approved': (data: EnrollmentApprovedEvent) => void
  'enrollment-denied': (data: EnrollmentDeniedEvent) => void

  // Presence events
  'student-entered': (data: StudentEnteredEvent) => void
  'student-left': (data: StudentLeftEvent) => void

  // Session observation events
  'practice-state': (data: PracticeStateEvent) => void
  'tutorial-state': (data: TutorialStateEvent) => void
  'tutorial-control': (data: TutorialControlEvent) => void
  'abacus-control': (data: AbacusControlEvent) => void
  'observer-joined': (data: ObserverJoinedEvent) => void
  'session-paused': (data: SessionPausedEvent) => void
}

/**
 * Events the client can emit
 */
export interface ClassroomClientToServerEvents {
  // Channel subscriptions
  'join-classroom': (data: { classroomId: string }) => void
  'leave-classroom': (data: { classroomId: string }) => void
  'observe-session': (data: { sessionId: string; observerId: string }) => void
  'stop-observing': (data: { sessionId: string }) => void

  // Session state broadcasts (from student client)
  'practice-state': (data: PracticeStateEvent) => void
  'tutorial-state': (data: TutorialStateEvent) => void

  // Observer controls
  'tutorial-control': (data: TutorialControlEvent) => void
  'abacus-control': (data: AbacusControlEvent) => void
}
