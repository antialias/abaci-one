'use client'

import { createContext, useContext, useMemo, type ReactNode } from 'react'
import type {
  SamplesData,
  DatasetInfo,
  EpochData,
  TrainingConfig,
  TrainingResult,
} from './wizard/types'

export interface DiagnosticReason {
  type: 'imbalance' | 'insufficient-data' | 'poor-convergence' | 'unknown'
  severity: 'warning' | 'error'
  title: string
  description: string
  action: string
  details?: {
    underrepresented?: number[]
    minCount?: number
    maxCount?: number
    totalImages?: number
  }
}

interface TrainingDiagnostics {
  // Raw data
  samples: SamplesData | null
  datasetInfo: DatasetInfo | null
  epochHistory: EpochData[]
  config: TrainingConfig
  result: TrainingResult | null

  // Computed diagnostics
  shouldShowRemediation: boolean
  reasons: DiagnosticReason[]
}

const TrainingDiagnosticsContext = createContext<TrainingDiagnostics | null>(null)

export function useTrainingDiagnostics(): TrainingDiagnostics {
  const ctx = useContext(TrainingDiagnosticsContext)
  if (!ctx) {
    throw new Error('useTrainingDiagnostics must be used within TrainingDiagnosticsProvider')
  }
  return ctx
}

interface ProviderProps {
  samples: SamplesData | null
  datasetInfo: DatasetInfo | null
  epochHistory: EpochData[]
  config: TrainingConfig
  result: TrainingResult | null
  children: ReactNode
}

export function TrainingDiagnosticsProvider({
  samples,
  datasetInfo,
  epochHistory,
  config,
  result,
  children,
}: ProviderProps) {
  const diagnostics = useMemo(() => {
    const reasons = analyzeDiagnostics(result, samples, datasetInfo, epochHistory)
    const accuracy = result?.final_accuracy ?? 0

    return {
      samples,
      datasetInfo,
      epochHistory,
      config,
      result,
      shouldShowRemediation: accuracy < 0.5 || (accuracy < 0.7 && reasons.length > 0),
      reasons,
    }
  }, [samples, datasetInfo, epochHistory, config, result])

  return (
    <TrainingDiagnosticsContext.Provider value={diagnostics}>
      {children}
    </TrainingDiagnosticsContext.Provider>
  )
}

function analyzeDiagnostics(
  result: TrainingResult | null,
  samples: SamplesData | null,
  datasetInfo: DatasetInfo | null,
  epochHistory: EpochData[]
): DiagnosticReason[] {
  if (!result) return []

  const accuracy = result.final_accuracy
  const reasons: DiagnosticReason[] = []

  // 1. Check for data imbalance
  if (samples) {
    const counts = Object.values(samples.digits).map((d) => d.count)
    const max = Math.max(...counts)
    const min = Math.min(...counts)

    if (max > min * 5 && min < 10) {
      const underrepresented = Object.entries(samples.digits)
        .filter(([, d]) => d.count < max / 3)
        .map(([digit]) => parseInt(digit, 10))

      reasons.push({
        type: 'imbalance',
        severity: 'error',
        title: 'Data imbalance',
        description: `Some digits have very few samples (${min}) while others have many (${max})`,
        action: `Collect more samples for digits: ${underrepresented.join(', ')}`,
        details: { underrepresented, minCount: min, maxCount: max },
      })
    }
  }

  // 2. Check for insufficient total data
  const total = datasetInfo?.total_images ?? samples?.totalImages ?? 0
  if (total < 200) {
    reasons.push({
      type: 'insufficient-data',
      severity: total < 100 ? 'error' : 'warning',
      title: 'Insufficient training data',
      description: `Only ${total} images available`,
      action: 'Collect at least 200 images (20+ per digit)',
      details: { totalImages: total },
    })
  }

  // 3. Check for poor convergence (accuracy barely improved during training)
  if (epochHistory.length >= 2) {
    const firstAcc = epochHistory[0]?.val_accuracy ?? 0
    const lastAcc = epochHistory[epochHistory.length - 1]?.val_accuracy ?? 0
    const improvement = lastAcc - firstAcc

    if (improvement < 0.1 && accuracy < 0.5) {
      reasons.push({
        type: 'poor-convergence',
        severity: 'warning',
        title: 'Model failed to learn',
        description: 'Accuracy barely improved during training',
        action: 'Check data quality - images may be too noisy or inconsistent',
      })
    }
  }

  // 4. Unknown issue if accuracy is bad but no clear reason
  if (accuracy < 0.5 && reasons.length === 0) {
    reasons.push({
      type: 'unknown',
      severity: 'warning',
      title: 'Unexpected low accuracy',
      description: 'Data appears adequate but accuracy is poor',
      action: 'Try training again or review captured images for quality issues',
    })
  }

  return reasons
}
