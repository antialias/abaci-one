'use client'

import { useCallback, useEffect, useState } from 'react'
import { css } from '../../../../../../styled-system/css'
import { PhaseSection } from './PhaseSection'
import {
  PHASES,
  serverPhaseToWizardPosition,
  type SamplesData,
  type HardwareInfo,
  type TrainingConfig,
  type ServerPhase,
  type EpochData,
  type DatasetInfo,
  type TrainingResult,
  type PhaseStatus,
} from './types'

interface TrainingWizardProps {
  // Data state
  samples: SamplesData | null
  samplesLoading: boolean
  // Hardware state
  hardwareInfo: HardwareInfo | null
  hardwareLoading: boolean
  fetchHardware: () => void
  // Config state
  config: TrainingConfig
  setConfig: (config: TrainingConfig | ((prev: TrainingConfig) => TrainingConfig)) => void
  // Training state (from server)
  serverPhase: ServerPhase
  statusMessage: string
  currentEpoch: EpochData | null
  epochHistory: EpochData[]
  datasetInfo: DatasetInfo | null
  result: TrainingResult | null
  error: string | null
  // Actions
  onStart: () => void
  onCancel: () => void
  onReset: () => void
  onSyncComplete?: () => void
}

export function TrainingWizard({
  samples,
  samplesLoading,
  hardwareInfo,
  hardwareLoading,
  fetchHardware,
  config,
  setConfig,
  serverPhase,
  statusMessage,
  currentEpoch,
  epochHistory,
  datasetInfo,
  result,
  error,
  onStart,
  onCancel,
  onReset,
  onSyncComplete,
}: TrainingWizardProps) {
  // Wizard position state
  const [currentPhaseIndex, setCurrentPhaseIndex] = useState(0)
  const [currentCardIndex, setCurrentCardIndex] = useState(0)

  // Derive state
  const isGpu = hardwareInfo?.deviceType === 'gpu'
  const bestAccuracy = epochHistory.length > 0 ? Math.max(...epochHistory.map((e) => e.val_accuracy)) : 0
  const hasEnoughData = samples?.hasData && samples.dataQuality !== 'none' && samples.dataQuality !== 'insufficient'

  // Sync wizard position with server phase during training
  useEffect(() => {
    if (serverPhase !== 'idle') {
      const { phaseIndex, cardIndex } = serverPhaseToWizardPosition(serverPhase)
      setCurrentPhaseIndex(phaseIndex)
      setCurrentCardIndex(cardIndex)
    }
  }, [serverPhase])

  // Progress to next card
  const progressToNextCard = useCallback(() => {
    const currentPhase = PHASES[currentPhaseIndex]

    if (currentCardIndex < currentPhase.cards.length - 1) {
      // More cards in this phase
      setCurrentCardIndex((prev) => prev + 1)
    } else if (currentPhaseIndex < PHASES.length - 1) {
      // Move to next phase
      setCurrentPhaseIndex((prev) => prev + 1)
      setCurrentCardIndex(0)
    }
  }, [currentPhaseIndex, currentCardIndex])

  // Handle starting training (transition from config to training phase)
  const handleStartTraining = useCallback(() => {
    // Move to training phase
    setCurrentPhaseIndex(1)
    setCurrentCardIndex(0)
    // Trigger actual training
    onStart()
  }, [onStart])

  // Handle train again (reset to preparation)
  const handleTrainAgain = useCallback(() => {
    setCurrentPhaseIndex(0)
    setCurrentCardIndex(0)
    onReset()
  }, [onReset])

  // Get phase status based on current position
  const getPhaseStatus = (phaseIndex: number): PhaseStatus => {
    if (phaseIndex < currentPhaseIndex) return 'done'
    if (phaseIndex === currentPhaseIndex) return 'current'
    return 'upcoming'
  }

  // Card summaries for done states
  const getCardSummary = (cardId: string): { label: string; value: string } | null => {
    switch (cardId) {
      case 'data':
        if (!samples?.hasData) return null
        return { label: 'Images', value: `${samples.totalImages}` }
      case 'hardware':
        if (!hardwareInfo) return null
        return {
          label: hardwareInfo.deviceType === 'gpu' ? 'GPU' : 'CPU',
          value: hardwareInfo.deviceName.split(' ').slice(0, 2).join(' ')
        }
      case 'config':
        return { label: 'Epochs', value: `${config.epochs}` }
      case 'setup':
        return { label: 'Ready', value: '✓' }
      case 'loading':
        return { label: 'Loaded', value: datasetInfo ? `${datasetInfo.total_images}` : '✓' }
      case 'training':
        return { label: 'Accuracy', value: `${(bestAccuracy * 100).toFixed(0)}%` }
      case 'export':
        return { label: 'Exported', value: '✓' }
      case 'results':
        return result ? { label: 'Final', value: `${(result.final_accuracy * 100).toFixed(1)}%` } : null
      default:
        return null
    }
  }

  return (
    <div
      data-component="training-wizard"
      className={css({
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      })}
    >
      {PHASES.map((phase, phaseIndex) => (
        <PhaseSection
          key={phase.id}
          phase={phase}
          status={getPhaseStatus(phaseIndex)}
          currentCardIndex={phaseIndex === currentPhaseIndex ? currentCardIndex : -1}
          // Data for cards
          samples={samples}
          samplesLoading={samplesLoading}
          hardwareInfo={hardwareInfo}
          hardwareLoading={hardwareLoading}
          fetchHardware={fetchHardware}
          config={config}
          setConfig={setConfig}
          isGpu={isGpu}
          // Training data
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
          onProgress={progressToNextCard}
          onStartTraining={handleStartTraining}
          onCancel={onCancel}
          onTrainAgain={handleTrainAgain}
          onSyncComplete={onSyncComplete}
          // Validation
          canStartTraining={!!hasEnoughData && !hardwareLoading && !hardwareInfo?.error}
        />
      ))}
    </div>
  )
}
