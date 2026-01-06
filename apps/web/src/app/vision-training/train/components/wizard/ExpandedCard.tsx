'use client'

import { css } from '../../../../../../styled-system/css'
import { DataCard } from './cards/DataCard'
import { HardwareCard } from './cards/HardwareCard'
import { DependencyCard } from './cards/DependencyCard'
import { ConfigCard } from './cards/ConfigCard'
import { SetupCard } from './cards/SetupCard'
import { LoadingCard } from './cards/LoadingCard'
import { TrainingCard } from './cards/TrainingCard'
import { ExportCard } from './cards/ExportCard'
import { ResultsCard } from './cards/ResultsCard'
import {
  CARDS,
  type CardId,
  type SamplesData,
  type HardwareInfo,
  type PreflightInfo,
  type TrainingConfig,
  type ServerPhase,
  type EpochData,
  type DatasetInfo,
  type TrainingResult,
} from './types'

interface ExpandedCardProps {
  cardId: CardId
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
  // Actions
  onProgress: () => void
  onStartTraining: () => void
  onCancel: () => void
  onTrainAgain: () => void
  onSyncComplete?: () => void
  onDataWarningAcknowledged?: () => void
  canStartTraining: boolean
}

export function ExpandedCard({
  cardId,
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
  onProgress,
  onStartTraining,
  onCancel,
  onTrainAgain,
  onSyncComplete,
  onDataWarningAcknowledged,
  canStartTraining,
}: ExpandedCardProps) {
  const cardDef = CARDS[cardId]

  const renderCardContent = () => {
    switch (cardId) {
      case 'data':
        return (
          <DataCard
            samples={samples}
            samplesLoading={samplesLoading}
            onProgress={onProgress}
            onSyncComplete={onSyncComplete}
            onDataWarningAcknowledged={onDataWarningAcknowledged}
          />
        )
      case 'hardware':
        return (
          <HardwareCard
            hardwareInfo={hardwareInfo}
            hardwareLoading={hardwareLoading}
            fetchHardware={fetchHardware}
            onProgress={onProgress}
          />
        )
      case 'dependencies':
        return (
          <DependencyCard
            preflightInfo={preflightInfo}
            preflightLoading={preflightLoading}
            fetchPreflight={fetchPreflight}
            onProgress={onProgress}
          />
        )
      case 'config':
        return (
          <ConfigCard
            config={config}
            setConfig={setConfig}
            isGpu={isGpu}
            onStartTraining={onStartTraining}
            canStart={canStartTraining}
          />
        )
      case 'setup':
        return <SetupCard message={statusMessage} />
      case 'loading':
        return <LoadingCard datasetInfo={datasetInfo} message={statusMessage} />
      case 'training':
        return (
          <TrainingCard
            currentEpoch={currentEpoch}
            totalEpochs={config.epochs}
            bestAccuracy={bestAccuracy}
            onCancel={onCancel}
          />
        )
      case 'export':
        return <ExportCard message={statusMessage} />
      case 'results':
        return <ResultsCard result={result} error={error} onTrainAgain={onTrainAgain} />
      default:
        return null
    }
  }

  return (
    <div
      data-element="expanded-card"
      data-card={cardId}
      className={css({
        flex: '1 1 300px',
        maxWidth: '400px',
        minHeight: '200px',
        bg: 'gray.800',
        borderRadius: 'xl',
        border: '2px solid',
        borderColor: 'blue.500',
        boxShadow: 'lg',
        overflow: 'hidden',
        transition: 'all 0.3s ease',
      })}
    >
      {/* Card Header */}
      <div
        className={css({
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          p: 3,
          borderBottom: '1px solid',
          borderColor: 'gray.700',
          bg: 'gray.850',
        })}
      >
        <span className={css({ fontSize: 'lg' })}>{cardDef.icon}</span>
        <span className={css({ fontWeight: 'semibold', color: 'gray.100' })}>{cardDef.title}</span>
      </div>

      {/* Card Content */}
      <div className={css({ p: 4 })}>{renderCardContent()}</div>
    </div>
  )
}
