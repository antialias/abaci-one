'use client'

import { css } from '../../../../../../styled-system/css'
import { CardCarousel } from './CardCarousel'
import { StepProgress } from './StepProgress'
import {
  CARDS,
  type PhaseDefinition,
  type PhaseStatus,
  type ModelType,
  type ModelsSummary,
  type SamplesData,
  type HardwareInfo,
  type PreflightInfo,
  type TrainingConfig,
  type ServerPhase,
  type EpochData,
  type DatasetInfo,
  type TrainingResult,
} from './types'

interface PhaseSectionProps {
  phase: PhaseDefinition
  status: PhaseStatus
  currentCardIndex: number
  // Model selection
  modelType: ModelType | null
  modelsSummary: ModelsSummary | null
  modelsSummaryLoading: boolean
  onSelectModel: (model: ModelType) => void
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
  onDataWarningAcknowledged?: () => void
  canStartTraining: boolean
}

const STATUS_STYLES: Record<PhaseStatus, { borderColor: string; bg: string; opacity: number }> = {
  done: { borderColor: 'green.600', bg: 'gray.850', opacity: 1 },
  current: { borderColor: 'blue.500', bg: 'gray.800', opacity: 1 },
  upcoming: { borderColor: 'gray.700', bg: 'gray.850', opacity: 0.6 },
}

export function PhaseSection({
  phase,
  status,
  currentCardIndex,
  modelType,
  modelsSummary,
  modelsSummaryLoading,
  onSelectModel,
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
  onDataWarningAcknowledged,
  canStartTraining,
}: PhaseSectionProps) {
  const styles = STATUS_STYLES[status]

  return (
    <div
      data-element={`phase-${phase.id}`}
      data-status={status}
      className={css({
        borderLeft: '3px solid',
        borderColor: styles.borderColor,
        bg: styles.bg,
        borderRadius: 'lg',
        overflow: 'hidden',
        opacity: styles.opacity,
        transition: 'all 0.3s ease',
      })}
    >
      {/* Phase Header */}
      <div
        className={css({
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          p: 3,
          borderBottom: status === 'current' ? '1px solid' : 'none',
          borderColor: 'gray.700',
        })}
      >
        <div className={css({ display: 'flex', alignItems: 'center', gap: 2 })}>
          {/* Status indicator */}
          <div
            className={css({
              width: '20px',
              height: '20px',
              borderRadius: 'full',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 'xs',
              fontWeight: 'bold',
              bg: status === 'done' ? 'green.600' : status === 'current' ? 'blue.600' : 'gray.600',
              color: 'white',
            })}
          >
            {status === 'done' ? '✓' : status === 'current' ? '●' : '○'}
          </div>
          <span
            className={css({
              fontWeight: 'semibold',
              fontSize: 'sm',
              color: status === 'current' ? 'gray.100' : 'gray.400',
            })}
          >
            {phase.title}
          </span>
        </div>

        {/* Status badge */}
        <span
          className={css({
            fontSize: 'xs',
            px: 2,
            py: 0.5,
            borderRadius: 'full',
            bg: status === 'done' ? 'green.800' : status === 'current' ? 'blue.800' : 'gray.700',
            color: status === 'done' ? 'green.300' : status === 'current' ? 'blue.300' : 'gray.500',
          })}
        >
          {status === 'done' ? 'Complete' : status === 'current' ? 'In Progress' : 'Upcoming'}
        </span>
      </div>

      {/* Phase Content */}
      {status === 'current' ? (
        <div className={css({ p: 4 })}>
          {/* Card Carousel */}
          <CardCarousel
            cards={phase.cards}
            currentCardIndex={currentCardIndex}
            // Model selection
            modelType={modelType}
            modelsSummary={modelsSummary}
            modelsSummaryLoading={modelsSummaryLoading}
            onSelectModel={onSelectModel}
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
            bestAccuracy={bestAccuracy}
            datasetInfo={datasetInfo}
            result={result}
            error={error}
            // Summaries
            getCardSummary={getCardSummary}
            // Actions
            onProgress={onProgress}
            onStartTraining={onStartTraining}
            onCancel={onCancel}
            onTrainAgain={onTrainAgain}
            onSyncComplete={onSyncComplete}
            onDataWarningAcknowledged={onDataWarningAcknowledged}
            canStartTraining={canStartTraining}
          />

          {/* Step Progress - only for multi-card phases */}
          {phase.cards.length > 1 && (
            <StepProgress
              steps={phase.cards.map((cardId) => CARDS[cardId].title)}
              currentIndex={currentCardIndex}
            />
          )}
        </div>
      ) : (
        /* Collapsed summary for done/upcoming */
        <div className={css({ px: 4, py: 2 })}>
          {status === 'done' ? (
            <div className={css({ display: 'flex', gap: 3, flexWrap: 'wrap' })}>
              {phase.cards.map((cardId) => {
                const summary = getCardSummary(cardId)
                const cardDef = CARDS[cardId]
                return (
                  <div
                    key={cardId}
                    className={css({
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.5,
                      px: 2,
                      py: 1,
                      bg: 'gray.800',
                      borderRadius: 'md',
                      fontSize: 'xs',
                    })}
                  >
                    <span>{cardDef.icon}</span>
                    <span className={css({ color: 'gray.400' })}>{cardDef.title}:</span>
                    <span
                      className={css({
                        color: 'green.400',
                        fontWeight: 'medium',
                      })}
                    >
                      {summary?.value || '✓'}
                    </span>
                  </div>
                )
              })}
            </div>
          ) : (
            <div
              className={css({
                fontSize: 'xs',
                color: 'gray.500',
                fontStyle: 'italic',
              })}
            >
              {phase.id === 'results' ? 'Waiting for training to complete...' : 'Waiting...'}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
