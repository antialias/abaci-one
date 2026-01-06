'use client'

import { css } from '../../../../../../styled-system/css'
import { CollapsedCard } from './CollapsedCard'
import { ExpandedCard } from './ExpandedCard'
import {
  CARDS,
  type CardId,
  type SamplesData,
  type HardwareInfo,
  type TrainingConfig,
  type ServerPhase,
  type EpochData,
  type DatasetInfo,
  type TrainingResult,
} from './types'

interface CardCarouselProps {
  cards: CardId[]
  currentCardIndex: number
  // Data
  samples: SamplesData | null
  samplesLoading: boolean
  hardwareInfo: HardwareInfo | null
  hardwareLoading: boolean
  fetchHardware: () => void
  config: TrainingConfig
  setConfig: (config: TrainingConfig | ((prev: TrainingConfig) => TrainingConfig)) => void
  isGpu: boolean
  // Training
  serverPhase: ServerPhase
  statusMessage: string
  currentEpoch: EpochData | null
  bestAccuracy: number
  datasetInfo: DatasetInfo | null
  result: TrainingResult | null
  error: string | null
  // Summaries
  getCardSummary: (cardId: string) => { label: string; value: string } | null
  // Actions
  onProgress: () => void
  onStartTraining: () => void
  onCancel: () => void
  onTrainAgain: () => void
  onSyncComplete?: () => void
  canStartTraining: boolean
}

export function CardCarousel({
  cards,
  currentCardIndex,
  samples,
  samplesLoading,
  hardwareInfo,
  hardwareLoading,
  fetchHardware,
  config,
  setConfig,
  isGpu,
  serverPhase,
  statusMessage,
  currentEpoch,
  bestAccuracy,
  datasetInfo,
  result,
  error,
  getCardSummary,
  onProgress,
  onStartTraining,
  onCancel,
  onTrainAgain,
  onSyncComplete,
  canStartTraining,
}: CardCarouselProps) {
  // Generate preview for upcoming cards based on known data
  // Can return a simple string or a rich object with multiple lines
  const getCardPreview = (cardId: CardId): { primary: string; secondary?: string; tertiary?: string } | string => {
    switch (cardId) {
      case 'data':
        if (samples?.hasData) {
          return {
            primary: `${samples.totalImages} images`,
            secondary: samples.dataQuality === 'excellent' ? 'Excellent' :
                       samples.dataQuality === 'good' ? 'Good quality' :
                       samples.dataQuality === 'minimal' ? 'Minimal' : 'Ready',
          }
        }
        return 'Check data'

      case 'hardware':
        if (hardwareInfo && !hardwareInfo.error) {
          const shortName = hardwareInfo.deviceName.length > 12
            ? hardwareInfo.deviceName.split(' ').slice(0, 2).join(' ')
            : hardwareInfo.deviceName
          return {
            primary: shortName,
            secondary: hardwareInfo.deviceType === 'gpu' ? 'GPU Accel' : 'CPU Mode',
          }
        }
        return 'Detect HW'

      case 'config':
        return {
          primary: `${config.epochs} epochs`,
          secondary: `Batch ${config.batchSize}`,
          tertiary: config.augmentation ? 'Augment: On' : 'Augment: Off',
        }

      case 'setup':
        return 'Initialize'

      case 'loading':
        return samples?.totalImages ? `Load ${samples.totalImages}` : 'Load data'

      case 'training':
        return {
          primary: `${config.epochs} epochs`,
          secondary: config.augmentation ? 'w/ augment' : undefined,
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
      {/* Done cards (left side) */}
      <div className={css({ display: 'flex', gap: 2 })}>
        {cards.slice(0, currentCardIndex).map((cardId) => {
          const cardDef = CARDS[cardId]
          const summary = getCardSummary(cardId)
          return (
            <CollapsedCard
              key={cardId}
              icon={cardDef.icon}
              title={cardDef.title}
              summary={summary?.value}
              status="done"
            />
          )
        })}
      </div>

      {/* Current card (center, expanded) */}
      {currentCardIndex >= 0 && currentCardIndex < cards.length && (
        <ExpandedCard
          cardId={cards[currentCardIndex]}
          // Data
          samples={samples}
          samplesLoading={samplesLoading}
          hardwareInfo={hardwareInfo}
          hardwareLoading={hardwareLoading}
          fetchHardware={fetchHardware}
          config={config}
          setConfig={setConfig}
          isGpu={isGpu}
          // Training
          serverPhase={serverPhase}
          statusMessage={statusMessage}
          currentEpoch={currentEpoch}
          bestAccuracy={bestAccuracy}
          datasetInfo={datasetInfo}
          result={result}
          error={error}
          // Actions
          onProgress={onProgress}
          onStartTraining={onStartTraining}
          onCancel={onCancel}
          onTrainAgain={onTrainAgain}
          onSyncComplete={onSyncComplete}
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
