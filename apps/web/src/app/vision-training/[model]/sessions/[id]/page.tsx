'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { css } from '../../../../../../styled-system/css'
import { useModelType } from '../../../hooks/useModelType'
import { getModelEntry } from '../../../registry'
import type {
  TrainingConfig,
  TrainingResult,
  EpochData,
  DatasetInfo,
  TrainingHardwareInfo,
  TrainingEnvironmentInfo,
} from '../../../train/components/wizard/types'

type ModelType = 'column-classifier' | 'boundary-detector'

interface FullSession {
  id: string
  modelType: ModelType
  displayName: string
  config: TrainingConfig
  datasetInfo: DatasetInfo
  result: TrainingResult
  epochHistory: EpochData[]
  modelPath: string
  isActive: boolean
  notes: string | null
  tags: string[]
  createdAt: number
  trainedAt: number
}

function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${Math.round(seconds)}s`
  }
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = Math.round(seconds % 60)
  if (minutes < 60) {
    return `${minutes}m ${remainingSeconds}s`
  }
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return `${hours}h ${remainingMinutes}m`
}

function formatDate(timestamp: number | string): string {
  const date = typeof timestamp === 'string' ? new Date(timestamp) : new Date(timestamp)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

interface TrainingGraphProps {
  epochHistory: EpochData[]
  modelType: ModelType
}

function TrainingGraph({ epochHistory, modelType }: TrainingGraphProps) {
  if (!epochHistory || epochHistory.length === 0) {
    return (
      <div className={css({ color: 'gray.500', textAlign: 'center', py: 8 })}>
        No epoch history available
      </div>
    )
  }

  const maxEpochs = epochHistory.length
  const maxLoss = Math.max(...epochHistory.map((e) => Math.max(e.loss, e.val_loss)))
  const minLoss = Math.min(...epochHistory.map((e) => Math.min(e.loss, e.val_loss)))
  const lossRange = maxLoss - minLoss || 1

  // For boundary detector, also show pixel error if available
  const hasPixelError =
    modelType === 'boundary-detector' && epochHistory.some((e) => e.val_pixel_error)
  const maxPixelError = hasPixelError
    ? Math.max(...epochHistory.map((e) => e.val_pixel_error || 0))
    : 0

  const width = 400
  const height = 200
  const padding = { top: 20, right: 60, bottom: 30, left: 50 }
  const graphWidth = width - padding.left - padding.right
  const graphHeight = height - padding.top - padding.bottom

  const scaleX = (epoch: number) => padding.left + (epoch / maxEpochs) * graphWidth
  const scaleY = (loss: number) => padding.top + (1 - (loss - minLoss) / lossRange) * graphHeight
  const scaleYPixel = (px: number) => padding.top + (1 - px / (maxPixelError || 1)) * graphHeight

  const trainLossPath = epochHistory
    .map((e, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(e.epoch)} ${scaleY(e.loss)}`)
    .join(' ')

  const valLossPath = epochHistory
    .map((e, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(e.epoch)} ${scaleY(e.val_loss)}`)
    .join(' ')

  const pixelErrorPath = hasPixelError
    ? epochHistory
        .map(
          (e, i) =>
            `${i === 0 ? 'M' : 'L'} ${scaleX(e.epoch)} ${scaleYPixel(e.val_pixel_error || 0)}`
        )
        .join(' ')
    : ''

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className={css({ width: '100%', maxWidth: '500px' })}>
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((frac) => (
          <line
            key={frac}
            x1={padding.left}
            y1={padding.top + frac * graphHeight}
            x2={width - padding.right}
            y2={padding.top + frac * graphHeight}
            stroke="#374151"
            strokeWidth="1"
          />
        ))}

        {/* Training loss line */}
        <path d={trainLossPath} fill="none" stroke="#60A5FA" strokeWidth="2" />

        {/* Validation loss line */}
        <path d={valLossPath} fill="none" stroke="#F87171" strokeWidth="2" />

        {/* Pixel error line (secondary axis) */}
        {hasPixelError && (
          <path
            d={pixelErrorPath}
            fill="none"
            stroke="#FBBF24"
            strokeWidth="2"
            strokeDasharray="4,4"
          />
        )}

        {/* Y-axis labels (loss) */}
        <text x={padding.left - 5} y={padding.top} fill="#9CA3AF" fontSize="10" textAnchor="end">
          {maxLoss.toFixed(3)}
        </text>
        <text
          x={padding.left - 5}
          y={padding.top + graphHeight}
          fill="#9CA3AF"
          fontSize="10"
          textAnchor="end"
        >
          {minLoss.toFixed(3)}
        </text>

        {/* Y-axis labels (pixel error) */}
        {hasPixelError && (
          <>
            <text
              x={width - padding.right + 5}
              y={padding.top}
              fill="#FBBF24"
              fontSize="10"
              textAnchor="start"
            >
              {maxPixelError.toFixed(1)}px
            </text>
            <text
              x={width - padding.right + 5}
              y={padding.top + graphHeight}
              fill="#FBBF24"
              fontSize="10"
              textAnchor="start"
            >
              0px
            </text>
          </>
        )}

        {/* X-axis labels */}
        <text x={padding.left} y={height - 5} fill="#9CA3AF" fontSize="10" textAnchor="middle">
          1
        </text>
        <text
          x={width - padding.right}
          y={height - 5}
          fill="#9CA3AF"
          fontSize="10"
          textAnchor="middle"
        >
          {maxEpochs}
        </text>
        <text
          x={padding.left + graphWidth / 2}
          y={height - 5}
          fill="#9CA3AF"
          fontSize="10"
          textAnchor="middle"
        >
          Epoch
        </text>
      </svg>

      {/* Legend */}
      <div
        className={css({
          display: 'flex',
          gap: 4,
          justifyContent: 'center',
          mt: 2,
          fontSize: 'xs',
        })}
      >
        <div className={css({ display: 'flex', alignItems: 'center', gap: 1 })}>
          <div
            className={css({
              width: 3,
              height: 3,
              borderRadius: 'full',
              bg: '#60A5FA',
            })}
          />
          <span className={css({ color: 'gray.400' })}>Train Loss</span>
        </div>
        <div className={css({ display: 'flex', alignItems: 'center', gap: 1 })}>
          <div
            className={css({
              width: 3,
              height: 3,
              borderRadius: 'full',
              bg: '#F87171',
            })}
          />
          <span className={css({ color: 'gray.400' })}>Val Loss</span>
        </div>
        {hasPixelError && (
          <div className={css({ display: 'flex', alignItems: 'center', gap: 1 })}>
            <div
              className={css({
                width: 3,
                height: 3,
                borderRadius: 'full',
                bg: '#FBBF24',
              })}
            />
            <span className={css({ color: 'gray.400' })}>Pixel Error</span>
          </div>
        )}
      </div>
    </div>
  )
}

interface InfoRowProps {
  label: string
  value: string | number | undefined | null
  highlight?: boolean
}

function InfoRow({ label, value, highlight }: InfoRowProps) {
  if (value === undefined || value === null) return null
  return (
    <div
      className={css({
        display: 'flex',
        justifyContent: 'space-between',
        py: 1.5,
        borderBottom: '1px solid',
        borderColor: 'gray.800',
      })}
    >
      <span className={css({ color: 'gray.400', fontSize: 'sm' })}>{label}</span>
      <span
        className={css({
          fontWeight: highlight ? 'bold' : 'medium',
          color: highlight ? 'green.400' : 'gray.200',
          fontSize: 'sm',
        })}
      >
        {value}
      </span>
    </div>
  )
}

/**
 * Session Detail Page
 *
 * Located at /vision-training/[model]/sessions/[id]
 */
export default function SessionDetailPage({ params }: { params: { id: string } }) {
  const modelType = useModelType()
  const modelEntry = getModelEntry(modelType)

  const [session, setSession] = useState<FullSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchSession = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/vision/sessions/${params.id}`)
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Session not found')
        }
        throw new Error('Failed to fetch session')
      }
      const data = await response.json()
      setSession(data.session)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [params.id])

  useEffect(() => {
    fetchSession()
  }, [fetchSession])

  if (loading) {
    return (
      <div
        className={css({
          bg: 'gray.900',
          color: 'gray.100',
          pt: 4,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        })}
        style={{ minHeight: 'calc(100vh - 120px)' }}
      >
        Loading...
      </div>
    )
  }

  if (error || !session || !session.result) {
    return (
      <div
        className={css({
          bg: 'gray.900',
          color: 'gray.100',
          pt: 4,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
        })}
        style={{ minHeight: 'calc(100vh - 120px)' }}
      >
        <div className={css({ color: 'red.400' })}>
          Error: {error || (!session ? 'Session not found' : 'Session has no result data')}
        </div>
        <Link
          href={`/vision-training/${modelType}/sessions`}
          className={css({ color: 'blue.400', textDecoration: 'underline' })}
        >
          Back to Sessions
        </Link>
      </div>
    )
  }

  // Extract metadata from result
  const result = session.result
  const hardware = (result as TrainingResult & { hardware?: TrainingHardwareInfo }).hardware
  const environment = (result as TrainingResult & { environment?: TrainingEnvironmentInfo })
    .environment
  const startedAt = (result as TrainingResult & { started_at?: string }).started_at
  const completedAt = (result as TrainingResult & { completed_at?: string }).completed_at
  const durationSeconds = (result as TrainingResult & { training_duration_seconds?: number })
    .training_duration_seconds
  const epochHistoryFromResult = (result as TrainingResult & { epoch_history?: EpochData[] })
    .epoch_history

  // Use epoch history from result if available, otherwise fall back to session.epochHistory
  const epochHistory = epochHistoryFromResult || session.epochHistory || []

  return (
    <div
      data-component="session-detail-page"
      className={css({
        bg: 'gray.900',
        color: 'gray.100',
        pt: 4,
      })}
      style={{ minHeight: 'calc(100vh - 120px)' }}
    >
      {/* Page header */}
      <div
        className={css({
          p: 4,
          borderBottom: '1px solid',
          borderColor: 'gray.800',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        })}
      >
        <div>
          <h1 className={css({ fontSize: 'xl', fontWeight: 'bold' })}>{session.displayName}</h1>
          <div className={css({ display: 'flex', gap: 2, mt: 2 })}>
            <span
              className={css({
                px: 2,
                py: 0.5,
                bg: session.modelType === 'column-classifier' ? 'purple.600/30' : 'orange.600/30',
                color: session.modelType === 'column-classifier' ? 'purple.300' : 'orange.300',
                fontSize: 'xs',
                fontWeight: 'medium',
                borderRadius: 'md',
              })}
            >
              {modelEntry.label}
            </span>
            {session.isActive && (
              <span
                className={css({
                  px: 2,
                  py: 0.5,
                  bg: 'green.600',
                  color: 'white',
                  fontSize: 'xs',
                  fontWeight: 'bold',
                  borderRadius: 'md',
                })}
              >
                ACTIVE
              </span>
            )}
          </div>
        </div>
        <Link
          href={`/vision-training/${modelType}/test?session=${session.id}`}
          className={css({
            px: 4,
            py: 2,
            bg: 'blue.600',
            color: 'white',
            borderRadius: 'lg',
            textDecoration: 'none',
            fontWeight: 'medium',
            fontSize: 'sm',
            _hover: { bg: 'blue.500' },
          })}
        >
          Test This Model
        </Link>
      </div>

      <main className={css({ p: 4, maxWidth: '1200px', mx: 'auto' })}>
        <div
          className={css({
            display: 'grid',
            gap: 4,
            gridTemplateColumns: { base: '1fr', lg: '1fr 1fr' },
          })}
        >
          {/* Training Graph */}
          <div
            className={css({
              p: 4,
              bg: 'gray.800',
              borderRadius: 'lg',
              gridColumn: { lg: 'span 2' },
            })}
          >
            <h2 className={css({ fontSize: 'lg', fontWeight: 'semibold', mb: 4 })}>
              Training Progress
            </h2>
            <TrainingGraph epochHistory={epochHistory} modelType={session.modelType} />
          </div>

          {/* Results */}
          <div className={css({ p: 4, bg: 'gray.800', borderRadius: 'lg' })}>
            <h2 className={css({ fontSize: 'lg', fontWeight: 'semibold', mb: 4 })}>Results</h2>
            <InfoRow
              label="Final Accuracy"
              value={`${((result.final_accuracy ?? 0) * 100).toFixed(1)}%`}
              highlight
            />
            <InfoRow label="Final Loss" value={(result.final_loss ?? 0).toFixed(4)} />
            {session.modelType === 'boundary-detector' && 'final_pixel_error' in result && (
              <InfoRow
                label="Pixel Error"
                value={`${(result.final_pixel_error as number).toFixed(1)}px`}
                highlight
              />
            )}
            <InfoRow label="Epochs Trained" value={result.epochs_trained} />
            <InfoRow label="TF.js Exported" value={result.tfjs_exported ? 'Yes' : 'No'} />
          </div>

          {/* Timing */}
          <div className={css({ p: 4, bg: 'gray.800', borderRadius: 'lg' })}>
            <h2 className={css({ fontSize: 'lg', fontWeight: 'semibold', mb: 4 })}>Timing</h2>
            {startedAt && <InfoRow label="Started" value={formatDate(startedAt)} />}
            {completedAt && <InfoRow label="Completed" value={formatDate(completedAt)} />}
            {durationSeconds && (
              <InfoRow label="Duration" value={formatDuration(durationSeconds)} highlight />
            )}
            <InfoRow label="Trained At" value={formatDate(session.trainedAt)} />
          </div>

          {/* Configuration */}
          <div className={css({ p: 4, bg: 'gray.800', borderRadius: 'lg' })}>
            <h2 className={css({ fontSize: 'lg', fontWeight: 'semibold', mb: 4 })}>
              Configuration
            </h2>
            <InfoRow label="Epochs" value={session.config.epochs} />
            <InfoRow label="Batch Size" value={session.config.batchSize} />
            <InfoRow
              label="Validation Split"
              value={`${((session.config.validationSplit ?? 0.2) * 100).toFixed(0)}%`}
            />
            <InfoRow
              label="Color Augmentation"
              value={session.config.colorAugmentation ? 'Yes' : 'No'}
            />
            {session.config.heatmap_size && (
              <InfoRow label="Heatmap Size" value={session.config.heatmap_size} />
            )}
            {session.config.marker_masking !== undefined && (
              <InfoRow
                label="Marker Masking"
                value={session.config.marker_masking ? 'Yes' : 'No'}
              />
            )}
          </div>

          {/* Hardware */}
          {hardware && (
            <div className={css({ p: 4, bg: 'gray.800', borderRadius: 'lg' })}>
              <h2
                className={css({
                  fontSize: 'lg',
                  fontWeight: 'semibold',
                  mb: 4,
                })}
              >
                Hardware
              </h2>
              <InfoRow label="Device" value={hardware.deviceName} highlight />
              <InfoRow label="Device Type" value={hardware.deviceType?.toUpperCase()} />
              {hardware.chipType && <InfoRow label="Chip" value={hardware.chipType} />}
              {hardware.systemMemory && <InfoRow label="Memory" value={hardware.systemMemory} />}
              {hardware.tensorflowVersion && (
                <InfoRow label="TensorFlow" value={hardware.tensorflowVersion} />
              )}
              {hardware.platform && <InfoRow label="Platform" value={hardware.platform} />}
            </div>
          )}

          {/* Environment */}
          {environment && (
            <div className={css({ p: 4, bg: 'gray.800', borderRadius: 'lg' })}>
              <h2
                className={css({
                  fontSize: 'lg',
                  fontWeight: 'semibold',
                  mb: 4,
                })}
              >
                Environment
              </h2>
              <InfoRow label="Hostname" value={environment.hostname} highlight />
              <InfoRow label="User" value={environment.username} />
              <InfoRow label="Python" value={environment.pythonVersion} />
              <InfoRow label="Architecture" value={environment.architecture} />
              <InfoRow label="Platform" value={environment.platform} />
            </div>
          )}

          {/* Dataset Info */}
          <div className={css({ p: 4, bg: 'gray.800', borderRadius: 'lg' })}>
            <h2 className={css({ fontSize: 'lg', fontWeight: 'semibold', mb: 4 })}>Dataset</h2>
            {'total_frames' in session.datasetInfo && (
              <InfoRow label="Total Frames" value={session.datasetInfo.total_frames} />
            )}
            {'total_images' in session.datasetInfo && (
              <InfoRow label="Total Images" value={session.datasetInfo.total_images} />
            )}
            {'device_count' in session.datasetInfo && (
              <InfoRow label="Devices" value={session.datasetInfo.device_count} />
            )}
            {'color_augmentation_enabled' in session.datasetInfo && (
              <InfoRow
                label="Color Augmentation"
                value={session.datasetInfo.color_augmentation_enabled ? 'Yes' : 'No'}
              />
            )}
          </div>

          {/* Model Info */}
          <div className={css({ p: 4, bg: 'gray.800', borderRadius: 'lg' })}>
            <h2 className={css({ fontSize: 'lg', fontWeight: 'semibold', mb: 4 })}>Model Files</h2>
            <InfoRow label="Session ID" value={session.id} />
            <InfoRow label="Model Path" value={session.modelPath} />
            {session.notes && <InfoRow label="Notes" value={session.notes} />}
          </div>
        </div>
      </main>
    </div>
  )
}
