// Tutorial system type definitions
export interface TutorialStep {
  id: string
  title: string
  problem: string
  description: string
  startValue: number
  targetValue: number
  highlightBeads?: Array<{
    columnIndex: number
    beadType: 'heaven' | 'earth'
    position?: number // for earth beads, 0-3
  }>
  expectedAction: 'add' | 'remove' | 'multi-step'
  actionDescription: string
  tooltip: {
    content: string
    explanation: string
  }
  errorMessages: {
    wrongBead: string
    wrongAction: string
    hint: string
  }
  multiStepInstructions?: string[]
}

export interface PracticeStep {
  id: string
  title: string
  description: string
  skillLevel: 'basic' | 'heaven' | 'five-complements' | 'mixed'
  problemCount: number
  maxTerms: number // max numbers to add in a single problem
}

export interface Problem {
  id: string
  terms: number[]
  userAnswer?: number
  isCorrect?: boolean
}

export interface Tutorial {
  id: string
  title: string
  description: string
  category: string
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  estimatedDuration: number // in minutes
  steps: TutorialStep[]
  practiceSteps?: PracticeStep[]
  tags: string[]
  author: string
  version: string
  createdAt: Date
  updatedAt: Date
  isPublished: boolean
}

export interface TutorialProgress {
  tutorialId: string
  userId?: string
  currentStepIndex: number
  completedSteps: string[] // step ids
  startedAt: Date
  lastAccessedAt: Date
  completedAt?: Date
  score?: number
  timeSpent: number // in seconds
}

export interface TutorialSession {
  id: string
  tutorial: Tutorial
  progress: TutorialProgress
  currentStep: TutorialStep
  isDebugMode: boolean
  debugHistory: Array<{
    stepId: string
    timestamp: Date
    action: string
    value: number
    success: boolean
  }>
}

// Editor specific types
export interface TutorialTemplate {
  name: string
  description: string
  defaultSteps: Partial<TutorialStep>[]
}

export interface StepValidationError {
  stepId: string
  field: string
  message: string
  severity: 'error' | 'warning'
}

export interface TutorialValidation {
  isValid: boolean
  errors: StepValidationError[]
  warnings: StepValidationError[]
}

// Access control types (future-ready)
export interface UserRole {
  id: string
  name: string
  permissions: Permission[]
}

export interface Permission {
  resource: 'tutorial' | 'step' | 'user' | 'system'
  actions: ('create' | 'read' | 'update' | 'delete' | 'publish')[]
  conditions?: Record<string, any>
}

export interface AccessContext {
  userId?: string
  roles: UserRole[]
  isAuthenticated: boolean
  isAdmin: boolean
  canEdit: boolean
  canPublish: boolean
  canDelete: boolean
}

// Navigation and UI state types
export interface NavigationState {
  currentStepIndex: number
  canGoNext: boolean
  canGoPrevious: boolean
  totalSteps: number
  completionPercentage: number
}

export interface UIState {
  isPlaying: boolean
  isPaused: boolean
  isEditing: boolean
  showDebugPanel: boolean
  showStepList: boolean
  autoAdvance: boolean
  playbackSpeed: number
}

// Event types for tutorial interaction
export type TutorialEvent =
  | { type: 'STEP_STARTED'; stepId: string; timestamp: Date }
  | { type: 'STEP_COMPLETED'; stepId: string; success: boolean; timestamp: Date }
  | { type: 'BEAD_CLICKED'; stepId: string; beadInfo: any; timestamp: Date }
  | { type: 'VALUE_CHANGED'; stepId: string; oldValue: number; newValue: number; timestamp: Date }
  | { type: 'ERROR_OCCURRED'; stepId: string; error: string; timestamp: Date }
  | { type: 'TUTORIAL_COMPLETED'; tutorialId: string; score: number; timestamp: Date }
  | { type: 'TUTORIAL_ABANDONED'; tutorialId: string; lastStepId: string; timestamp: Date }

// API response types
export interface TutorialListResponse {
  tutorials: Tutorial[]
  total: number
  page: number
  limit: number
  hasMore: boolean
}

export interface TutorialDetailResponse {
  tutorial: Tutorial
  userProgress?: TutorialProgress
  canEdit: boolean
  canDelete: boolean
}

export interface SaveTutorialRequest {
  tutorial: Omit<Tutorial, 'id' | 'createdAt' | 'updatedAt'>
}

export interface SaveTutorialResponse {
  tutorial: Tutorial
  validation: TutorialValidation
}