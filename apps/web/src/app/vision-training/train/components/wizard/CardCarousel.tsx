'use client'

import { css } from '../../../../../../styled-system/css'
import { CollapsedCard } from './CollapsedCard'
import { ExpandedCard } from './ExpandedCard'
import {
  CARDS,
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
} from './types'

interface CardCarouselProps {
  cards: CardId[]
  currentCardIndex: number
  onCardClick: (cardIndex: number) => void
  // Model type (from URL)
  modelType: ModelType
  // Data
  samples: SamplesData | null
  samplesLoading: boolean
  hardwareInfo: HardwareInfo | null
  hardwareLoading: boolean
  fetchHardware: () => void
  preflightInfo: PreflightInfo | null
  preflightLoading: boolean
  fetchPreflight: () => void
  config: TrainingConfig
  setConfig: (config: TrainingConfig | ((prev: TrainingConfig) => TrainingConfig)) => void
  isGpu: boolean
  // Training
  serverPhase: ServerPhase
  statusMessage: string
  currentEpoch: EpochData | null
  epochHistory: EpochData[]
  bestAccuracy: number
  bestPixelError: number | null
  datasetInfo: DatasetInfo | null
  loadingProgress: LoadingProgress | null
  result: TrainingResult | null
  error: string | null
  // Summaries
  getCardSummary: (cardId: string) => { label: string; value: string } | null
  // Actions
  onProgress: () => void
  onStartTraining: () => void
  onCancel: () => void
  onStopAndSave?: () => void
  onTrainAgain: () => void
  onRerunTraining?: () => void
  onSyncComplete?: () => void
  onDataWarningAcknowledged?: () => void
  canStartTraining: boolean
}

export function CardCarousel({
  cards,
  currentCardIndex,
  onCardClick,
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
  getCardSummary,
  onProgress,
  onStartTraining,
  onCancel,
  onStopAndSave,
  onTrainAgain,
  onRerunTraining,
  onSyncComplete,
  onDataWarningAcknowledged,
  canStartTraining,
}: CardCarouselProps) {
  // Generate preview for upcoming cards based on known data
  // Can return a simple string or a rich object with multiple lines
  const getCardPreview = (
    cardId: CardId
  ): { primary: string; secondary?: string; tertiary?: string } | string => {
    switch (cardId) {
      case 'data':
        if (samples?.hasData) {
          const count =
            samples.type === 'column-classifier' ? samples.totalImages : samples.totalFrames
          const label = samples.type === 'column-classifier' ? 'images' : 'frames'
          return {
            primary: `${count} ${label}`,
            secondary:
              samples.dataQuality === 'excellent'
                ? 'Excellent'
                : samples.dataQuality === 'good'
                  ? 'Good quality'
                  : samples.dataQuality === 'minimal'
                    ? 'Minimal'
                    : 'Ready',
          }
        }
        return 'Check data'

      case 'hardware':
        if (hardwareInfo && !hardwareInfo.error) {
          const shortName =
            hardwareInfo.deviceName.length > 12
              ? hardwareInfo.deviceName.split(' ').slice(0, 2).join(' ')
              : hardwareInfo.deviceName
          return {
            primary: shortName,
            secondary: hardwareInfo.deviceType === 'gpu' ? 'GPU Accel' : 'CPU Mode',
          }
        }
        return 'Detect HW'

      case 'dependencies':
        if (preflightInfo?.ready) {
          return {
            primary: 'Ready',
            secondary: `${preflightInfo.dependencies.installed.length} packages`,
          }
        }
        if (preflightInfo?.dependencies.missing.length) {
          return {
            primary: 'Missing',
            secondary: `${preflightInfo.dependencies.missing.length} packages`,
          }
        }
        return 'Check deps'

      case 'config':
        return {
          primary: `${config.epochs} epochs`,
          secondary: `Batch ${config.batchSize}`,
        }

      case 'setup':
        return 'Initialize'

      case 'loading': {
        if (!samples) return 'Load data'
        const loadCount =
          samples.type === 'column-classifier' ? samples.totalImages : samples.totalFrames
        return `Load ${loadCount}`
      }

      case 'training':
        return {
          primary: `${config.epochs} epochs`,
        }

      case 'export':
        return 'TF.js export'

      case 'results':
        return 'View results'

      default:
        return ''
    }
  }

  return (
    <div
      data-element="card-carousel"
      className={css({
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 3,
        mb: 4,
      })}
    >
      {/* Done cards (left side) - clickable to go back */}
      <div className={css({ display: 'flex', gap: 2 })}>
        {cards.slice(0, currentCardIndex).map((cardId, index) => {
          const cardDef = CARDS[cardId]
          const summary = getCardSummary(cardId)
          return (
            <CollapsedCard
              key={cardId}
              icon={cardDef.icon}
              title={cardDef.title}
              summary={summary?.value}
              status="done"
              onClick={() => onCardClick(index)}
            />
          )
        })}
      </div>

      {/* Current card (center, expanded) */}
      {currentCardIndex >= 0 && currentCardIndex < cards.length && (
        <ExpandedCard
          cardId={cards[currentCardIndex]}
          // Model type (from URL)
          modelType={modelType}
          // Data
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
          // Training
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
          // Actions
          onProgress={onProgress}
          onStartTraining={onStartTraining}
          onCancel={onCancel}
          onStopAndSave={onStopAndSave}
          onTrainAgain={onTrainAgain}
          onRerunTraining={onRerunTraining}
          onSyncComplete={onSyncComplete}
          onDataWarningAcknowledged={onDataWarningAcknowledged}
          canStartTraining={canStartTraining}
        />
      )}

      {/* Upcoming cards (right side) */}
      <div className={css({ display: 'flex', gap: 2 })}>
        {cards.slice(currentCardIndex + 1).map((cardId) => {
          const cardDef = CARDS[cardId]
          return (
            <CollapsedCard
              key={cardId}
              icon={cardDef.icon}
              title={cardDef.title}
              preview={getCardPreview(cardId)}
              status="upcoming"
            />
          )
        })}
      </div>
    </div>
  )
}
