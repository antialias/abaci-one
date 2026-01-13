'use client'

import { css } from '../../../../../../styled-system/css'
import { CardCarousel } from './CardCarousel'
import { StepProgress } from './StepProgress'
import {
  CARDS,
  type PhaseDefinition,
  type PhaseStatus,
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

interface PhaseSectionProps {
  phase: PhaseDefinition
  phaseIndex: number
  status: PhaseStatus
  currentCardIndex: number
  onGoToCard: (phaseIndex: number, cardIndex: number) => void
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

const STATUS_STYLES: Record<PhaseStatus, { borderColor: string; bg: string; opacity: number }> = {
  done: { borderColor: 'green.600', bg: 'gray.850', opacity: 1 },
  current: { borderColor: 'blue.500', bg: 'gray.800', opacity: 1 },
  upcoming: { borderColor: 'gray.700', bg: 'gray.850', opacity: 0.6 },
}

export function PhaseSection({
  phase,
  phaseIndex,
  status,
  currentCardIndex,
  onGoToCard,
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
          {/* Card Carousel - for current phase */}
          <CardCarousel
            cards={phase.cards}
            currentCardIndex={currentCardIndex}
            onCardClick={(cardIndex) => onGoToCard(phaseIndex, cardIndex)}
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
            // Summaries
            getCardSummary={getCardSummary}
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
            <div
              className={css({
                display: 'flex',
                gap: 3,
                flexWrap: 'wrap',
                cursor: 'pointer',
              })}
              onClick={() => onGoToCard(phaseIndex, phase.cards.length - 1)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  onGoToCard(phaseIndex, phase.cards.length - 1)
                }
              }}
              role="button"
              tabIndex={0}
              title={`Go back to ${phase.title}`}
            >
              {phase.cards.map((cardId, cardIndex) => {
                const summary = getCardSummary(cardId)
                const cardDef = CARDS[cardId]
                return (
                  <div
                    key={cardId}
                    onClick={(e) => {
                      e.stopPropagation()
                      onGoToCard(phaseIndex, cardIndex)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.stopPropagation()
                        onGoToCard(phaseIndex, cardIndex)
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    title={`Go back to ${cardDef.title}`}
                    className={css({
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.5,
                      px: 2,
                      py: 1,
                      bg: 'gray.800',
                      borderRadius: 'md',
                      fontSize: 'xs',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      _hover: {
                        bg: 'gray.700',
                        transform: 'scale(1.02)',
                      },
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
