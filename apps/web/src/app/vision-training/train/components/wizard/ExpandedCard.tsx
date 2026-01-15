"use client";

import { css } from "../../../../../../styled-system/css";
import { DataCard } from "./cards/DataCard";
import { HardwareCard } from "./cards/HardwareCard";
import { DependencyCard } from "./cards/DependencyCard";
import { ConfigCard } from "./cards/ConfigCard";
import { SetupCard } from "./cards/SetupCard";
import { LoadingCard } from "./cards/LoadingCard";
import { TrainingCard } from "./cards/TrainingCard";
import { ExportCard } from "./cards/ExportCard";
import { ResultsCard } from "./cards/ResultsCard";
import {
  CARDS,
  isColumnClassifierSamples,
  type CardId,
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
} from "./types";

interface ExpandedCardProps {
  cardId: CardId;
  // Model type (from URL)
  modelType: ModelType;
  // Data
  samples: SamplesData | null;
  samplesLoading: boolean;
  hardwareInfo: HardwareInfo | null;
  hardwareLoading: boolean;
  fetchHardware: () => void;
  preflightInfo: PreflightInfo | null;
  preflightLoading: boolean;
  fetchPreflight: () => void;
  config: TrainingConfig;
  setConfig: (
    config: TrainingConfig | ((prev: TrainingConfig) => TrainingConfig),
  ) => void;
  isGpu: boolean;
  // Training
  serverPhase: ServerPhase;
  statusMessage: string;
  currentEpoch: EpochData | null;
  epochHistory: EpochData[];
  bestAccuracy: number;
  bestPixelError: number | null;
  datasetInfo: DatasetInfo | null;
  loadingProgress: LoadingProgress | null;
  result: TrainingResult | null;
  error: string | null;
  // Actions
  onProgress: () => void;
  onStartTraining: () => void;
  onCancel: () => void;
  onStopAndSave?: () => void;
  onTrainAgain: () => void;
  onRerunTraining?: () => void;
  onSyncComplete?: () => void;
  onDataWarningAcknowledged?: () => void;
  canStartTraining: boolean;
}

export function ExpandedCard({
  cardId,
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
  isGpu,
  serverPhase,
  statusMessage,
  currentEpoch,
  epochHistory,
  bestAccuracy,
  bestPixelError,
  datasetInfo,
  loadingProgress,
  result,
  error,
  onProgress,
  onStartTraining,
  onCancel,
  onStopAndSave,
  onTrainAgain,
  onRerunTraining,
  onSyncComplete,
  onDataWarningAcknowledged,
  canStartTraining,
}: ExpandedCardProps) {
  const cardDef = CARDS[cardId];

  const renderCardContent = () => {
    switch (cardId) {
      case "data":
        return (
          <DataCard
            samples={samples}
            samplesLoading={samplesLoading}
            modelType={modelType}
            onProgress={onProgress}
            onSyncComplete={onSyncComplete}
            onDataWarningAcknowledged={onDataWarningAcknowledged}
          />
        );
      case "hardware":
        return (
          <HardwareCard
            hardwareInfo={hardwareInfo}
            hardwareLoading={hardwareLoading}
            fetchHardware={fetchHardware}
            onProgress={onProgress}
          />
        );
      case "dependencies":
        return (
          <DependencyCard
            preflightInfo={preflightInfo}
            preflightLoading={preflightLoading}
            fetchPreflight={fetchPreflight}
            onProgress={onProgress}
          />
        );
      case "config": {
        const totalSamples = samples
          ? isColumnClassifierSamples(samples)
            ? samples.totalImages
            : samples.totalFrames
          : 0;
        return (
          <ConfigCard
            config={config}
            setConfig={setConfig}
            isGpu={isGpu}
            onStartTraining={onStartTraining}
            canStart={canStartTraining}
            totalImages={totalSamples}
            modelType={modelType}
          />
        );
      }
      case "setup":
        return <SetupCard message={statusMessage} />;
      case "loading":
        return (
          <LoadingCard
            datasetInfo={datasetInfo}
            loadingProgress={loadingProgress}
            message={statusMessage}
          />
        );
      case "training":
        return (
          <TrainingCard
            currentEpoch={currentEpoch}
            epochHistory={epochHistory}
            totalEpochs={config.epochs}
            bestAccuracy={bestAccuracy}
            bestPixelError={bestPixelError}
            statusMessage={statusMessage}
            onCancel={onCancel}
            onStopAndSave={onStopAndSave}
          />
        );
      case "export":
        return <ExportCard message={statusMessage} />;
      case "results":
        return (
          <ResultsCard
            result={result}
            error={error}
            configuredEpochs={config.epochs}
            onTrainAgain={onTrainAgain}
            onRerunTraining={onRerunTraining}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div
      data-element="expanded-card"
      data-card={cardId}
      className={css({
        flex: "1 1 300px",
        maxWidth: "400px",
        minHeight: "200px",
        bg: "gray.800",
        borderRadius: "xl",
        border: "2px solid",
        borderColor: "blue.500",
        boxShadow: "lg",
        overflow: "hidden",
        transition: "all 0.3s ease",
      })}
    >
      {/* Card Header */}
      <div
        className={css({
          display: "flex",
          alignItems: "center",
          gap: 2,
          p: 3,
          borderBottom: "1px solid",
          borderColor: "gray.700",
          bg: "gray.850",
        })}
      >
        <span className={css({ fontSize: "lg" })}>{cardDef.icon}</span>
        <span className={css({ fontWeight: "semibold", color: "gray.100" })}>
          {cardDef.title}
        </span>
      </div>

      {/* Card Content */}
      <div className={css({ p: 4 })}>{renderCardContent()}</div>
    </div>
  );
}
