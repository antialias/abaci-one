// Model type - which model to train
export type ModelType = "column-classifier" | "boundary-detector";

// Phase and Card identifiers
export type PhaseId = "preparation" | "training" | "results";
export type CardId =
  | "model"
  | "data"
  | "hardware"
  | "dependencies"
  | "config"
  | "setup"
  | "loading"
  | "training"
  | "export"
  | "results";

// Card state relative to current position
export type CardPosition = "done" | "current" | "upcoming";

// Phase status
export type PhaseStatus = "done" | "current" | "upcoming";

// Phase definition
export interface PhaseDefinition {
  id: PhaseId;
  title: string;
  cards: CardId[];
}

// All phases in order
// Note: Model selection is now handled by the URL path (/vision-training/[model]/train)
// and the nav bar model selector. The 'model' card has been removed from the wizard.
export const PHASES: PhaseDefinition[] = [
  {
    id: "preparation",
    title: "Preparation",
    cards: ["data", "hardware", "dependencies", "config"],
  },
  {
    id: "training",
    title: "Training",
    cards: ["setup", "loading", "training", "export"],
  },
  {
    id: "results",
    title: "Results",
    cards: ["results"],
  },
];

// Card metadata
export interface CardDefinition {
  id: CardId;
  title: string;
  icon: string;
  autoProgress: boolean;
  autoProgressDelay?: number; // ms
}

export const CARDS: Record<CardId, CardDefinition> = {
  model: {
    id: "model",
    title: "Model",
    icon: "🎯",
    autoProgress: false, // User must select
  },
  data: {
    id: "data",
    title: "Training Data",
    icon: "📊",
    autoProgress: true,
    autoProgressDelay: 2000,
  },
  hardware: {
    id: "hardware",
    title: "Hardware",
    icon: "🔧",
    autoProgress: true,
    autoProgressDelay: 2000,
  },
  dependencies: {
    id: "dependencies",
    title: "Dependencies",
    icon: "📦",
    autoProgress: true,
    autoProgressDelay: 2000,
  },
  config: {
    id: "config",
    title: "Configuration",
    icon: "⚙️",
    autoProgress: false,
  },
  setup: {
    id: "setup",
    title: "Setup",
    icon: "🔄",
    autoProgress: true, // Event-driven
  },
  loading: {
    id: "loading",
    title: "Loading",
    icon: "📥",
    autoProgress: true, // Event-driven
  },
  training: {
    id: "training",
    title: "Training",
    icon: "🏋️",
    autoProgress: true, // Event-driven (when epochs complete)
  },
  export: {
    id: "export",
    title: "Export",
    icon: "📦",
    autoProgress: true, // Event-driven
  },
  results: {
    id: "results",
    title: "Results",
    icon: "🎉",
    autoProgress: false,
  },
};

// Card summaries for done state
export interface CardSummary {
  label: string;
  value: string;
}

// Wizard state
export interface WizardState {
  currentPhaseIndex: number;
  currentCardIndex: number;
}

// Data quality levels
export type DataQuality =
  | "none"
  | "insufficient"
  | "minimal"
  | "good"
  | "excellent";

// Data types - discriminated union by model type
export interface DigitSample {
  count: number;
  samplePath: string | null;
  tilePaths: string[];
}

// Column classifier samples (digits 0-9)
export interface ColumnClassifierSamples {
  type: "column-classifier";
  digits: Record<number, DigitSample>;
  totalImages: number;
  hasData: boolean;
  dataQuality: DataQuality;
}

// Boundary detector samples (full frames with corners)
export interface BoundaryDetectorSamples {
  type: "boundary-detector";
  totalFrames: number;
  hasData: boolean;
  dataQuality: DataQuality;
  deviceCount: number; // Unique devices captured from
  samplePaths: string[]; // Preview paths
}

// Union type for samples data
export type SamplesData = ColumnClassifierSamples | BoundaryDetectorSamples;

// Legacy type alias for backwards compatibility during refactor
export type ColumnClassifierSamplesLegacy = Omit<
  ColumnClassifierSamples,
  "type"
>;

// Summary for model selection card (both models at once)
export interface ModelsSummary {
  columnClassifier: {
    totalImages: number;
    hasData: boolean;
    dataQuality: DataQuality;
  };
  boundaryDetector: {
    totalFrames: number;
    hasData: boolean;
    dataQuality: DataQuality;
  };
}

// Type guards for discriminated unions
export function isColumnClassifierSamples(
  samples: SamplesData,
): samples is ColumnClassifierSamples {
  return samples.type === "column-classifier";
}

export function isBoundaryDetectorSamples(
  samples: SamplesData,
): samples is BoundaryDetectorSamples {
  return samples.type === "boundary-detector";
}

export function isColumnClassifierResult(
  result: TrainingResult,
): result is ColumnClassifierResult {
  return result.type === "column-classifier";
}

export function isBoundaryDetectorResult(
  result: TrainingResult,
): result is BoundaryDetectorResult {
  return result.type === "boundary-detector";
}

export interface HardwareInfo {
  available: boolean;
  device: string;
  deviceName: string;
  deviceType: string;
  details: Record<string, unknown>;
  error: string | null;
  hint?: string;
}

export interface PreflightInfo {
  ready: boolean;
  platform: {
    supported: boolean;
    reason?: string;
  };
  venv: {
    exists: boolean;
    python: string;
    isAppleSilicon: boolean;
    hasGpu: boolean;
    error?: string;
  };
  dependencies: {
    allInstalled: boolean;
    installed: { name: string; pipName: string }[];
    missing: { name: string; pipName: string }[];
    error?: string;
  };
}

// Inference sample for visualization during training (boundary detector)
export interface InferenceSample {
  imageBase64: string; // Base64 encoded JPEG image
  predicted: [number, number, number, number, number, number, number, number]; // TL, TR, BR, BL (x,y pairs, normalized 0-1)
  groundTruth: [number, number, number, number, number, number, number, number]; // TL, TR, BR, BL (x,y pairs, normalized 0-1)
  pixelError: number; // Mean corner error in pixels for this sample
}

export interface EpochData {
  epoch: number;
  total_epochs: number;
  loss: number;
  accuracy: number;
  val_loss: number;
  val_accuracy: number;
  // Pixel error for boundary detector (more intuitive than abstract accuracy)
  val_pixel_error?: number; // Mean corner error in pixels
  // Per-head metrics from two-head bead position model
  heaven_accuracy?: number;
  val_heaven_accuracy?: number;
  earth_accuracy?: number;
  val_earth_accuracy?: number;
  // Inference samples for visualization (boundary detector only)
  inference_samples?: InferenceSample[];
}

// Column classifier dataset info
export interface ColumnClassifierDatasetInfo {
  type: "column-classifier";
  total_images: number;
  digit_counts: Record<number, number>;
}

// Boundary detector dataset info
export interface BoundaryDetectorDatasetInfo {
  type: "boundary-detector";
  total_frames: number;
  device_count: number;
  color_augmentation_enabled?: boolean;
  raw_frames?: number; // Original frames before augmentation
}

// Union type for dataset info
export type DatasetInfo =
  | ColumnClassifierDatasetInfo
  | BoundaryDetectorDatasetInfo;

// Loading progress for dataset loading phase
export interface LoadingProgress {
  step: "scanning" | "loading_raw" | "augmenting" | "finalizing";
  current: number;
  total: number;
  message: string;
}

// Type guards for dataset info
export function isColumnClassifierDatasetInfo(
  info: DatasetInfo,
): info is ColumnClassifierDatasetInfo {
  return info.type === "column-classifier";
}

export function isBoundaryDetectorDatasetInfo(
  info: DatasetInfo,
): info is BoundaryDetectorDatasetInfo {
  return info.type === "boundary-detector";
}

// Base training result shared by all models
export interface BaseTrainingResult {
  final_accuracy: number;
  final_loss: number;
  epochs_trained: number;
  output_dir: string;
  tfjs_exported: boolean;
  session_id?: string; // Session ID for database tracking
  // Timing metadata
  started_at?: string; // ISO timestamp
  completed_at?: string; // ISO timestamp
  training_duration_seconds?: number;
  // Hardware and environment metadata
  hardware?: TrainingHardwareInfo;
  environment?: TrainingEnvironmentInfo;
  // Full epoch history for graphs
  epoch_history?: EpochData[];
}

// Column classifier training result
export interface ColumnClassifierResult extends BaseTrainingResult {
  type: "column-classifier";
  // Per-head metrics from two-head bead position model
  heaven_accuracy?: number;
  earth_accuracy?: number;
}

// Boundary detector training result
export interface BoundaryDetectorResult extends BaseTrainingResult {
  type: "boundary-detector";
  final_mae?: number; // Mean Absolute Error (0-1 normalized) from training
  final_pixel_error?: number; // Average corner error in pixels (= final_mae * 224)
  mean_corner_error?: number; // Mean error in pixels (optional, from inference testing)
  iou_score?: number; // Intersection over Union (optional, from inference testing)
}

// Union type for training results
export type TrainingResult = ColumnClassifierResult | BoundaryDetectorResult;

export interface TrainingConfig {
  epochs: number;
  batchSize: number;
  validationSplit: number;
  colorAugmentation: boolean;
  // Additional config fields from Python script
  heatmap_size?: number;
  heatmap_sigma?: number;
  marker_masking?: boolean;
  [key: string]: unknown; // Allow additional config fields
}

// Hardware info captured during training
export interface TrainingHardwareInfo {
  device: string; // 'metal' | 'cuda' | 'cpu'
  deviceName: string; // e.g., 'Apple M2 Pro GPU (Metal)'
  deviceType: string; // 'gpu' | 'cpu'
  tensorflowVersion?: string;
  platform?: string;
  machine?: string;
  processor?: string;
  chipType?: string; // Apple Silicon chip type
  systemMemory?: string;
  gpuCount?: number;
}

// Environment info captured during training
export interface TrainingEnvironmentInfo {
  hostname: string;
  username: string;
  pythonVersion: string;
  workingDirectory: string;
  platform: string;
  platformVersion: string;
  architecture: string;
}

// Training timing info
export interface TrainingTimingInfo {
  started_at: string; // ISO timestamp
  completed_at: string; // ISO timestamp
  training_duration_seconds: number;
}

// Server-side training phase (from SSE events)
export type ServerPhase =
  | "idle"
  | "setup"
  | "loading"
  | "training"
  | "exporting"
  | "complete"
  | "error";

// Helper to get phase index
export function getPhaseIndex(phaseId: PhaseId): number {
  return PHASES.findIndex((p) => p.id === phaseId);
}

// Helper to get card index within a phase
export function getCardIndexInPhase(phaseId: PhaseId, cardId: CardId): number {
  const phase = PHASES.find((p) => p.id === phaseId);
  return phase?.cards.indexOf(cardId) ?? -1;
}

// Helper to find which phase a card belongs to
export function getPhaseForCard(cardId: CardId): PhaseId | null {
  for (const phase of PHASES) {
    if (phase.cards.includes(cardId)) {
      return phase.id;
    }
  }
  return null;
}

// Map server phase to wizard position
export function serverPhaseToWizardPosition(serverPhase: ServerPhase): {
  phaseIndex: number;
  cardIndex: number;
} {
  switch (serverPhase) {
    case "idle":
      return { phaseIndex: 0, cardIndex: 0 }; // Start at data card
    case "setup":
      return { phaseIndex: 1, cardIndex: 0 }; // Training phase, setup card
    case "loading":
      return { phaseIndex: 1, cardIndex: 1 }; // Training phase, loading card
    case "training":
      return { phaseIndex: 1, cardIndex: 2 }; // Training phase, training card
    case "exporting":
      return { phaseIndex: 1, cardIndex: 3 }; // Training phase, export card
    case "complete":
      return { phaseIndex: 2, cardIndex: 0 }; // Results phase
    case "error":
      return { phaseIndex: 2, cardIndex: 0 }; // Show error in results phase
    default:
      return { phaseIndex: 0, cardIndex: 0 };
  }
}
