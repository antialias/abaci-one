// Phase and Card identifiers
export type PhaseId = 'preparation' | 'training' | 'results'
export type CardId =
  | 'data'
  | 'hardware'
  | 'config'
  | 'setup'
  | 'loading'
  | 'training'
  | 'export'
  | 'results'

// Card state relative to current position
export type CardPosition = 'done' | 'current' | 'upcoming'

// Phase status
export type PhaseStatus = 'done' | 'current' | 'upcoming'

// Phase definition
export interface PhaseDefinition {
  id: PhaseId
  title: string
  cards: CardId[]
}

// All phases in order
export const PHASES: PhaseDefinition[] = [
  {
    id: 'preparation',
    title: 'Preparation',
    cards: ['data', 'hardware', 'config'],
  },
  {
    id: 'training',
    title: 'Training',
    cards: ['setup', 'loading', 'training', 'export'],
  },
  {
    id: 'results',
    title: 'Results',
    cards: ['results'],
  },
]

// Card metadata
export interface CardDefinition {
  id: CardId
  title: string
  icon: string
  autoProgress: boolean
  autoProgressDelay?: number // ms
}

export const CARDS: Record<CardId, CardDefinition> = {
  data: {
    id: 'data',
    title: 'Training Data',
    icon: '📊',
    autoProgress: true,
    autoProgressDelay: 2000,
  },
  hardware: {
    id: 'hardware',
    title: 'Hardware',
    icon: '🔧',
    autoProgress: true,
    autoProgressDelay: 2000,
  },
  config: {
    id: 'config',
    title: 'Configuration',
    icon: '⚙️',
    autoProgress: false,
  },
  setup: {
    id: 'setup',
    title: 'Setup',
    icon: '🔄',
    autoProgress: true, // Event-driven
  },
  loading: {
    id: 'loading',
    title: 'Loading',
    icon: '📥',
    autoProgress: true, // Event-driven
  },
  training: {
    id: 'training',
    title: 'Training',
    icon: '🏋️',
    autoProgress: true, // Event-driven (when epochs complete)
  },
  export: {
    id: 'export',
    title: 'Export',
    icon: '📦',
    autoProgress: true, // Event-driven
  },
  results: {
    id: 'results',
    title: 'Results',
    icon: '🎉',
    autoProgress: false,
  },
}

// Card summaries for done state
export interface CardSummary {
  label: string
  value: string
}

// Wizard state
export interface WizardState {
  currentPhaseIndex: number
  currentCardIndex: number
}

// Data types (re-exported from existing)
export interface DigitSample {
  count: number
  samplePath: string | null
  tilePaths: string[]
}

export interface SamplesData {
  digits: Record<number, DigitSample>
  totalImages: number
  hasData: boolean
  dataQuality: 'none' | 'insufficient' | 'minimal' | 'good' | 'excellent'
}

export interface HardwareInfo {
  available: boolean
  device: string
  deviceName: string
  deviceType: string
  details: Record<string, unknown>
  error: string | null
  hint?: string
}

export interface EpochData {
  epoch: number
  total_epochs: number
  loss: number
  accuracy: number
  val_loss: number
  val_accuracy: number
}

export interface DatasetInfo {
  total_images: number
  digit_counts: Record<number, number>
}

export interface TrainingResult {
  final_accuracy: number
  final_loss: number
  epochs_trained: number
  output_dir: string
  tfjs_exported: boolean
}

export interface TrainingConfig {
  epochs: number
  batchSize: number
  validationSplit: number
  augmentation: boolean
}

// Server-side training phase (from SSE events)
export type ServerPhase = 'idle' | 'setup' | 'loading' | 'training' | 'exporting' | 'complete' | 'error'

// Helper to get phase index
export function getPhaseIndex(phaseId: PhaseId): number {
  return PHASES.findIndex((p) => p.id === phaseId)
}

// Helper to get card index within a phase
export function getCardIndexInPhase(phaseId: PhaseId, cardId: CardId): number {
  const phase = PHASES.find((p) => p.id === phaseId)
  return phase?.cards.indexOf(cardId) ?? -1
}

// Helper to find which phase a card belongs to
export function getPhaseForCard(cardId: CardId): PhaseId | null {
  for (const phase of PHASES) {
    if (phase.cards.includes(cardId)) {
      return phase.id
    }
  }
  return null
}

// Map server phase to wizard position
export function serverPhaseToWizardPosition(
  serverPhase: ServerPhase
): { phaseIndex: number; cardIndex: number } {
  switch (serverPhase) {
    case 'idle':
      return { phaseIndex: 0, cardIndex: 0 } // Start at data card
    case 'setup':
      return { phaseIndex: 1, cardIndex: 0 } // Training phase, setup card
    case 'loading':
      return { phaseIndex: 1, cardIndex: 1 } // Training phase, loading card
    case 'training':
      return { phaseIndex: 1, cardIndex: 2 } // Training phase, training card
    case 'exporting':
      return { phaseIndex: 1, cardIndex: 3 } // Training phase, export card
    case 'complete':
      return { phaseIndex: 2, cardIndex: 0 } // Results phase
    case 'error':
      return { phaseIndex: 2, cardIndex: 0 } // Show error in results phase
    default:
      return { phaseIndex: 0, cardIndex: 0 }
  }
}
