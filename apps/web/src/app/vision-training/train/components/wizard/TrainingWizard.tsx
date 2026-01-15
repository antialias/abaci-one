"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { css } from "../../../../../../styled-system/css";
import { PhaseSection } from "./PhaseSection";
import {
  PHASES,
  serverPhaseToWizardPosition,
  isColumnClassifierDatasetInfo,
  isBoundaryDetectorDatasetInfo,
  isBoundaryDetectorResult,
  type ModelType,
  type SamplesData,
  type HardwareInfo,
  type PreflightInfo,
  type TrainingConfig,
  type ServerPhase,
  type EpochData,
  type DatasetInfo,
  type LoadingProgress,
  type TrainingResult,
  type PhaseStatus,
} from "./types";

// localStorage keys for persistence
const STORAGE_KEY_POSITION = "vision-training-wizard-position";

// Position state saved to localStorage
// Note: modelType is no longer saved - it's determined by the URL path
interface WizardPositionState {
  currentPhaseIndex: number;
  currentCardIndex: number;
  dataWarningAcknowledged: boolean;
}

interface TrainingWizardProps {
  // Model type (determined by URL path, not user selection)
  modelType: ModelType;
  // Data state
  samples: SamplesData | null;
  samplesLoading: boolean;
  // Hardware state
  hardwareInfo: HardwareInfo | null;
  hardwareLoading: boolean;
  fetchHardware: () => void;
  // Preflight state
  preflightInfo: PreflightInfo | null;
  preflightLoading: boolean;
  fetchPreflight: () => void;
  // Config state
  config: TrainingConfig;
  setConfig: (
    config: TrainingConfig | ((prev: TrainingConfig) => TrainingConfig),
  ) => void;
  // Training state (from server)
  serverPhase: ServerPhase;
  statusMessage: string;
  currentEpoch: EpochData | null;
  epochHistory: EpochData[];
  datasetInfo: DatasetInfo | null;
  loadingProgress: LoadingProgress | null;
  result: TrainingResult | null;
  error: string | null;
  // Actions
  onStart: () => void;
  onCancel: () => void;
  onStopAndSave?: () => void;
  onReset: () => void;
  onSyncComplete?: () => void;
  // Called to re-run training with same config (from results)
  onRerunTraining?: () => void;
}

export function TrainingWizard({
  modelType,
  samples,
  samplesLoading,
  hardwareInfo,
  hardwareLoading,
  fetchHardware,
  preflightInfo,
  preflightLoading,
  fetchPreflight,
  config,
  setConfig,
  serverPhase,
  statusMessage,
  currentEpoch,
  epochHistory,
  datasetInfo,
  loadingProgress,
  result,
  error,
  onStart,
  onCancel,
  onStopAndSave,
  onReset,
  onSyncComplete,
  onRerunTraining,
}: TrainingWizardProps) {
  // Wizard position state
  const [currentPhaseIndex, setCurrentPhaseIndex] = useState(0);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  // Track if user explicitly bypassed insufficient data warning
  const [dataWarningAcknowledged, setDataWarningAcknowledged] = useState(false);
  // Track if we've initialized from localStorage
  const initializedRef = useRef(false);

  // Load position state from localStorage on mount
  // Note: modelType is no longer restored from localStorage - it comes from the URL
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    try {
      const saved = localStorage.getItem(STORAGE_KEY_POSITION);
      if (saved) {
        const state = JSON.parse(saved) as WizardPositionState;
        // Only restore if we're not actively training
        if (serverPhase === "idle") {
          setCurrentPhaseIndex(state.currentPhaseIndex);
          setCurrentCardIndex(state.currentCardIndex);
          setDataWarningAcknowledged(state.dataWarningAcknowledged);
        }
      }
    } catch {
      // Ignore localStorage errors
    }
  }, [serverPhase]);

  // Save position state to localStorage when it changes
  // Note: modelType is not saved - it comes from the URL
  useEffect(() => {
    // Don't save until we've initialized
    if (!initializedRef.current) return;
    // Don't save during active training (let server phase drive position)
    if (
      serverPhase !== "idle" &&
      serverPhase !== "complete" &&
      serverPhase !== "error"
    )
      return;

    const state: WizardPositionState = {
      currentPhaseIndex,
      currentCardIndex,
      dataWarningAcknowledged,
    };
    try {
      localStorage.setItem(STORAGE_KEY_POSITION, JSON.stringify(state));
    } catch {
      // Ignore localStorage errors
    }
  }, [
    currentPhaseIndex,
    currentCardIndex,
    dataWarningAcknowledged,
    serverPhase,
  ]);

  // Derive state
  const isGpu = hardwareInfo?.deviceType === "gpu";
  const bestAccuracy =
    epochHistory.length > 0
      ? Math.max(...epochHistory.map((e) => e.val_accuracy))
      : 0;
  // Best pixel error (lower is better) - for boundary detector
  const pixelErrors = epochHistory
    .map((e) => e.val_pixel_error)
    .filter((e) => e !== undefined);
  const bestPixelError =
    pixelErrors.length > 0 ? Math.min(...pixelErrors) : null;
  const hasEnoughData =
    samples?.hasData &&
    samples.dataQuality !== "none" &&
    samples.dataQuality !== "insufficient";
  // Allow training if data is sufficient OR user acknowledged the warning
  const canProceedWithData =
    hasEnoughData || (dataWarningAcknowledged && samples?.hasData);

  // Sync wizard position with server phase during training
  useEffect(() => {
    if (serverPhase !== "idle") {
      const { phaseIndex, cardIndex } =
        serverPhaseToWizardPosition(serverPhase);
      setCurrentPhaseIndex(phaseIndex);
      setCurrentCardIndex(cardIndex);
    }
  }, [serverPhase]);

  // Progress to next card
  const progressToNextCard = useCallback(() => {
    const currentPhase = PHASES[currentPhaseIndex];

    if (currentCardIndex < currentPhase.cards.length - 1) {
      // More cards in this phase
      setCurrentCardIndex((prev) => prev + 1);
    } else if (currentPhaseIndex < PHASES.length - 1) {
      // Move to next phase
      setCurrentPhaseIndex((prev) => prev + 1);
      setCurrentCardIndex(0);
    }
  }, [currentPhaseIndex, currentCardIndex]);

  // Handle starting training (transition from config to training phase)
  const handleStartTraining = useCallback(() => {
    // Move to training phase
    setCurrentPhaseIndex(1);
    setCurrentCardIndex(0);
    // Trigger actual training
    onStart();
  }, [onStart]);

  // Handle train again (reset to preparation)
  const handleTrainAgain = useCallback(() => {
    setCurrentPhaseIndex(0);
    setCurrentCardIndex(0);
    setDataWarningAcknowledged(false);
    // Clear localStorage when fully resetting
    try {
      localStorage.removeItem(STORAGE_KEY_POSITION);
    } catch {
      // Ignore
    }
    onReset();
  }, [onReset]);

  // Handle data warning acknowledgment (user clicked "Continue Anyway")
  const handleDataWarningAcknowledged = useCallback(() => {
    setDataWarningAcknowledged(true);
  }, []);

  // Navigate to a specific card (for rewinding to prior cards)
  const goToCard = useCallback(
    (phaseIndex: number, cardIndex: number) => {
      // Only allow going backwards or to current position
      if (
        phaseIndex < currentPhaseIndex ||
        (phaseIndex === currentPhaseIndex && cardIndex <= currentCardIndex)
      ) {
        setCurrentPhaseIndex(phaseIndex);
        setCurrentCardIndex(cardIndex);
      }
    },
    [currentPhaseIndex, currentCardIndex],
  );

  // Get phase status based on current position
  const getPhaseStatus = (phaseIndex: number): PhaseStatus => {
    if (phaseIndex < currentPhaseIndex) return "done";
    if (phaseIndex === currentPhaseIndex) return "current";
    return "upcoming";
  };

  // Card summaries for done states
  const getCardSummary = (
    cardId: string,
  ): { label: string; value: string } | null => {
    switch (cardId) {
      case "data": {
        if (!samples?.hasData) return null;
        const count =
          samples.type === "column-classifier"
            ? samples.totalImages
            : samples.totalFrames;
        return { label: "Samples", value: `${count}` };
      }
      case "hardware":
        if (!hardwareInfo) return null;
        return {
          label: hardwareInfo.deviceType === "gpu" ? "GPU" : "CPU",
          value: hardwareInfo.deviceName.split(" ").slice(0, 2).join(" "),
        };
      case "dependencies":
        if (!preflightInfo?.ready) return null;
        return {
          label: "Packages",
          value: `${preflightInfo.dependencies.installed.length}`,
        };
      case "config":
        return { label: "Epochs", value: `${config.epochs}` };
      case "setup":
        return { label: "Ready", value: "✓" };
      case "loading":
        if (!datasetInfo) return { label: "Loaded", value: "✓" };
        if (isColumnClassifierDatasetInfo(datasetInfo)) {
          return { label: "Loaded", value: `${datasetInfo.total_images}` };
        }
        if (isBoundaryDetectorDatasetInfo(datasetInfo)) {
          return { label: "Loaded", value: `${datasetInfo.total_frames}` };
        }
        return { label: "Loaded", value: "✓" };
      case "training":
        // Show pixel error for boundary detector, accuracy for column classifier
        if (modelType === "boundary-detector" && bestPixelError !== null) {
          return {
            label: "Error",
            value: `${bestPixelError.toFixed(0)}px`,
          };
        }
        return {
          label: "Accuracy",
          value: `${(bestAccuracy * 100).toFixed(0)}%`,
        };
      case "export":
        return { label: "Exported", value: "✓" };
      case "results":
        if (!result) return null;
        // Show pixel error for boundary detector, accuracy for column classifier
        if (
          isBoundaryDetectorResult(result) &&
          result.final_pixel_error !== undefined
        ) {
          return {
            label: "Final",
            value: `${result.final_pixel_error.toFixed(0)}px`,
          };
        }
        return {
          label: "Final",
          value: `${(result.final_accuracy * 100).toFixed(1)}%`,
        };
      default:
        return null;
    }
  };

  return (
    <div
      data-component="training-wizard"
      className={css({
        display: "flex",
        flexDirection: "column",
        gap: 4,
      })}
    >
      {PHASES.map((phase, phaseIndex) => (
        <PhaseSection
          key={phase.id}
          phase={phase}
          phaseIndex={phaseIndex}
          status={getPhaseStatus(phaseIndex)}
          currentCardIndex={
            phaseIndex === currentPhaseIndex ? currentCardIndex : -1
          }
          onGoToCard={goToCard}
          // Model type (from URL)
          modelType={modelType}
          // Data for cards
          samples={samples}
          samplesLoading={samplesLoading}
          hardwareInfo={hardwareInfo}
          hardwareLoading={hardwareLoading}
          fetchHardware={fetchHardware}
          preflightInfo={preflightInfo}
          preflightLoading={preflightLoading}
          fetchPreflight={fetchPreflight}
          config={config}
          setConfig={setConfig}
          isGpu={isGpu}
          // Training data
          serverPhase={serverPhase}
          statusMessage={statusMessage}
          currentEpoch={currentEpoch}
          epochHistory={epochHistory}
          bestAccuracy={bestAccuracy}
          bestPixelError={bestPixelError}
          datasetInfo={datasetInfo}
          loadingProgress={loadingProgress}
          result={result}
          error={error}
          // Summaries
          getCardSummary={getCardSummary}
          // Actions
          onProgress={progressToNextCard}
          onStartTraining={handleStartTraining}
          onCancel={onCancel}
          onStopAndSave={onStopAndSave}
          onTrainAgain={handleTrainAgain}
          onRerunTraining={onRerunTraining}
          onSyncComplete={onSyncComplete}
          onDataWarningAcknowledged={handleDataWarningAcknowledged}
          // Validation - require data, hardware, and dependencies all ready
          // Note: modelType is always defined (comes from URL)
          canStartTraining={
            !!canProceedWithData &&
            !hardwareLoading &&
            !hardwareInfo?.error &&
            !!preflightInfo?.ready
          }
        />
      ))}
    </div>
  );
}
