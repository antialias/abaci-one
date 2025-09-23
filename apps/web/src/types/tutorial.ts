// Tutorial system type definitions
export interface TutorialStep {
  id: string
  title: string
  problem: string
  description: string
  startValue: number
  targetValue: number
  highlightBeads?: Array<{
    placeValue: number
    beadType: 'heaven' | 'earth'
    position?: number // for earth beads, 0-3
  }>
  // Progressive step-based highlighting with directions
  stepBeadHighlights?: Array<{
    placeValue: number
    beadType: 'heaven' | 'earth'
    position?: number // for earth beads, 0-3
    stepIndex: number  // Which instruction step this bead belongs to
    direction: 'up' | 'down' | 'activate' | 'deactivate'  // Movement direction
    order?: number     // Order within the step (for multiple beads per step)
  }>
  totalSteps?: number // Total number of instruction steps
  expectedAction: 'add' | 'remove' | 'multi-step'
  actionDescription: string
  tooltip: {
    content: string
    explanation: string
  }
  // errorMessages removed - bead diff tooltip provides better guidance
  multiStepInstructions?: string[]
  position?: number // Position in unified tutorial flow
}

// Skill-based system for practice problem generation
export interface SkillSet {
  // Five complements (single-column operations)
  fiveComplements: {
    "4=5-1": boolean
    "3=5-2": boolean
    "2=5-3": boolean
    "1=5-4": boolean
  }

  // Ten complements (carrying operations)
  tenComplements: {
    "9=10-1": boolean
    "8=10-2": boolean
    "7=10-3": boolean
    "6=10-4": boolean
    "5=10-5": boolean
    "4=10-6": boolean
    "3=10-7": boolean
    "2=10-8": boolean
    "1=10-9": boolean
  }

  // Basic operations
  basic: {
    directAddition: boolean    // Can add 1-4 directly
    heavenBead: boolean        // Can use heaven bead (5)
    simpleCombinations: boolean // Can do 6-9 without complements
  }
}

export interface PracticeStep {
  id: string
  title: string
  description: string

  // Problem generation settings
  problemCount: number
  maxTerms: number // max numbers to add in a single problem

  // Skill-based constraints
  requiredSkills: SkillSet   // Skills user must know
  targetSkills?: Partial<SkillSet>  // Skills to specifically practice (optional)
  forbiddenSkills?: Partial<SkillSet> // Skills user hasn't learned yet (optional)

  // Advanced constraints (optional)
  numberRange?: { min: number, max: number }
  sumConstraints?: { maxSum: number, minSum?: number }

  // Legacy support for existing system
  skillLevel?: 'basic' | 'heaven' | 'five-complements' | 'mixed'

  // Tutorial integration
  position?: number // Where in tutorial flow this appears
}

export interface Problem {
  id: string
  terms: number[]
  userAnswer?: number
  isCorrect?: boolean
}

// Utility functions for skill management
export function createEmptySkillSet(): SkillSet {
  return {
    basic: {
      directAddition: false,
      heavenBead: false,
      simpleCombinations: false
    },
    fiveComplements: {
      "4=5-1": false,
      "3=5-2": false,
      "2=5-3": false,
      "1=5-4": false
    },
    tenComplements: {
      "9=10-1": false,
      "8=10-2": false,
      "7=10-3": false,
      "6=10-4": false,
      "5=10-5": false,
      "4=10-6": false,
      "3=10-7": false,
      "2=10-8": false,
      "1=10-9": false
    }
  }
}

export function createBasicSkillSet(): SkillSet {
  return {
    basic: {
      directAddition: true,
      heavenBead: false,
      simpleCombinations: false
    },
    fiveComplements: {
      "4=5-1": false,
      "3=5-2": false,
      "2=5-3": false,
      "1=5-4": false
    },
    tenComplements: {
      "9=10-1": false,
      "8=10-2": false,
      "7=10-3": false,
      "6=10-4": false,
      "5=10-5": false,
      "4=10-6": false,
      "3=10-7": false,
      "2=10-8": false,
      "1=10-9": false
    }
  }
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