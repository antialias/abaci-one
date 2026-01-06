'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { css } from '../../../../styled-system/css'

interface TrainingConfig {
  epochs: number
  batchSize: number
  validationSplit: number
  augmentation: boolean
}

interface HardwareInfo {
  available: boolean
  device: string
  deviceName: string
  deviceType: string
  details: Record<string, unknown>
  error: string | null
  hint?: string
}

interface EpochData {
  epoch: number
  total_epochs: number
  loss: number
  accuracy: number
  val_loss: number
  val_accuracy: number
}

interface DatasetInfo {
  total_images: number
  digit_counts: Record<number, number>
  train_count?: number
  val_count?: number
}

interface TrainingResult {
  final_accuracy: number
  final_loss: number
  epochs_trained: number
  output_dir: string
  tfjs_exported: boolean
}

type TrainingPhase = 'idle' | 'setup' | 'loading' | 'training' | 'exporting' | 'complete' | 'error'

export default function TrainModelPage() {
  // Configuration
  const [config, setConfig] = useState<TrainingConfig>({
    epochs: 50,
    batchSize: 32,
    validationSplit: 0.2,
    augmentation: true,
  })

  // Hardware info
  const [hardwareInfo, setHardwareInfo] = useState<HardwareInfo | null>(null)
  const [hardwareLoading, setHardwareLoading] = useState(true)

  // Training state
  const [phase, setPhase] = useState<TrainingPhase>('idle')
  const [statusMessage, setStatusMessage] = useState<string>('')
  const [epochHistory, setEpochHistory] = useState<EpochData[]>([])
  const [currentEpoch, setCurrentEpoch] = useState<EpochData | null>(null)
  const [datasetInfo, setDatasetInfo] = useState<DatasetInfo | null>(null)
  const [result, setResult] = useState<TrainingResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [logs, setLogs] = useState<string[]>([])

  // Refs
  const eventSourceRef = useRef<EventSource | null>(null)
  const logsEndRef = useRef<HTMLDivElement>(null)

  // Fetch hardware info on mount
  useEffect(() => {
    async function fetchHardware() {
      try {
        const response = await fetch('/api/vision-training/hardware')
        const data = await response.json()
        setHardwareInfo(data)
      } catch {
        setHardwareInfo({
          available: false,
          device: 'unknown',
          deviceName: 'Failed to detect',
          deviceType: 'unknown',
          details: {},
          error: 'Failed to fetch hardware info',
        })
      } finally {
        setHardwareLoading(false)
      }
    }
    fetchHardware()
  }, [])

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      eventSourceRef.current?.close()
    }
  }, [])

  // Start training
  const startTraining = useCallback(async () => {
    // Reset state
    setPhase('setup')
    setStatusMessage('Starting training...')
    setEpochHistory([])
    setCurrentEpoch(null)
    setDatasetInfo(null)
    setResult(null)
    setError(null)
    setLogs([])

    try {
      // Start training via POST, which returns SSE stream
      const response = await fetch('/api/vision-training/train', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          epochs: config.epochs,
          batchSize: config.batchSize,
          validationSplit: config.validationSplit,
          noAugmentation: !config.augmentation,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to start training')
      }

      // Read SSE stream
      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('No response body')
      }

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })

        // Parse SSE events
        const lines = buffer.split('\n')
        buffer = lines.pop() || '' // Keep incomplete line in buffer

        let eventType = ''
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            eventType = line.slice(7)
          } else if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6))
            handleEvent(eventType, data)
          }
        }
      }
    } catch (err) {
      setPhase('error')
      setError(err instanceof Error ? err.message : 'Unknown error')
    }
  }, [config])

  // Handle SSE events
  const handleEvent = useCallback((eventType: string, data: Record<string, unknown>) => {
    switch (eventType) {
      case 'started':
        setPhase('setup')
        setStatusMessage('Training started...')
        break

      case 'status':
        setStatusMessage(data.message as string)
        if (data.phase) {
          setPhase(data.phase as TrainingPhase)
        }
        break

      case 'dataset_loaded':
        setDatasetInfo({
          total_images: data.total_images as number,
          digit_counts: data.digit_counts as Record<number, number>,
        })
        break

      case 'epoch': {
        const epochData = data as unknown as EpochData
        setCurrentEpoch(epochData)
        setEpochHistory((prev) => [...prev, epochData])
        setPhase('training')
        break
      }

      case 'exported':
        setStatusMessage(`Model exported: ${(data.model_size_mb as number).toFixed(2)} MB`)
        break

      case 'complete':
        setPhase('complete')
        setResult(data as unknown as TrainingResult)
        setStatusMessage('Training complete!')
        break

      case 'error':
        setPhase('error')
        setError(data.message as string)
        break

      case 'log':
        setLogs((prev) => [...prev, data.message as string])
        break

      case 'cancelled':
        setPhase('idle')
        setStatusMessage('Training cancelled')
        break

      case 'finished':
        // Final event
        break
    }
  }, [])

  // Cancel training
  const cancelTraining = useCallback(async () => {
    try {
      await fetch('/api/vision-training/train', { method: 'DELETE' })
      setStatusMessage('Cancelling...')
    } catch {
      // Ignore errors
    }
  }, [])

  // Calculate progress percentage
  const progressPercent = currentEpoch
    ? Math.round((currentEpoch.epoch / currentEpoch.total_epochs) * 100)
    : 0

  // Best accuracy from history
  const bestAccuracy =
    epochHistory.length > 0 ? Math.max(...epochHistory.map((e) => e.val_accuracy)) : 0

  return (
    <div
      data-component="train-model-page"
      className={css({
        minHeight: '100vh',
        bg: 'gray.900',
        color: 'gray.100',
        p: 4,
      })}
    >
      {/* Header */}
      <header className={css({ mb: 6 })}>
        <div className={css({ display: 'flex', alignItems: 'center', gap: 4, mb: 2 })}>
          <Link
            href="/vision-training"
            className={css({
              color: 'blue.400',
              textDecoration: 'none',
              _hover: { textDecoration: 'underline' },
            })}
          >
            &larr; Back to Training Data
          </Link>
        </div>
        <h1 className={css({ fontSize: '2xl', fontWeight: 'bold', mb: 2 })}>
          Train Column Classifier
        </h1>
        <p className={css({ color: 'gray.400', fontSize: 'sm' })}>
          Train the CNN model to recognize abacus column digits from collected images
        </p>
      </header>

      <div
        className={css({
          display: 'grid',
          gridTemplateColumns: { base: '1fr', lg: '1fr 1fr' },
          gap: 6,
        })}
      >
        {/* Left Column: Configuration & Controls */}
        <div className={css({ display: 'flex', flexDirection: 'column', gap: 4 })}>
          {/* Configuration Panel */}
          <div
            data-element="config-panel"
            className={css({
              p: 4,
              bg: 'gray.800',
              borderRadius: 'lg',
            })}
          >
            <h2 className={css({ fontSize: 'lg', fontWeight: 'semibold', mb: 4 })}>
              Training Configuration
            </h2>

            <div className={css({ display: 'flex', flexDirection: 'column', gap: 4 })}>
              {/* Epochs */}
              <div>
                <label
                  className={css({ display: 'block', fontSize: 'sm', color: 'gray.400', mb: 1 })}
                >
                  Epochs
                </label>
                <input
                  type="number"
                  min={1}
                  max={200}
                  value={config.epochs}
                  onChange={(e) =>
                    setConfig((c) => ({ ...c, epochs: parseInt(e.target.value, 10) || 50 }))
                  }
                  disabled={phase !== 'idle'}
                  className={css({
                    width: '100%',
                    px: 3,
                    py: 2,
                    bg: 'gray.700',
                    border: '1px solid',
                    borderColor: 'gray.600',
                    borderRadius: 'md',
                    color: 'gray.100',
                    _disabled: { opacity: 0.5, cursor: 'not-allowed' },
                  })}
                />
                <p className={css({ fontSize: 'xs', color: 'gray.500', mt: 1 })}>
                  Number of training passes through the dataset
                </p>
              </div>

              {/* Batch Size */}
              <div>
                <label
                  className={css({ display: 'block', fontSize: 'sm', color: 'gray.400', mb: 1 })}
                >
                  Batch Size
                </label>
                <select
                  value={config.batchSize}
                  onChange={(e) =>
                    setConfig((c) => ({ ...c, batchSize: parseInt(e.target.value, 10) }))
                  }
                  disabled={phase !== 'idle'}
                  className={css({
                    width: '100%',
                    px: 3,
                    py: 2,
                    bg: 'gray.700',
                    border: '1px solid',
                    borderColor: 'gray.600',
                    borderRadius: 'md',
                    color: 'gray.100',
                    _disabled: { opacity: 0.5, cursor: 'not-allowed' },
                  })}
                >
                  <option value={16}>16</option>
                  <option value={32}>32</option>
                  <option value={64}>64</option>
                  <option value={128}>128</option>
                </select>
              </div>

              {/* Validation Split */}
              <div>
                <label
                  className={css({ display: 'block', fontSize: 'sm', color: 'gray.400', mb: 1 })}
                >
                  Validation Split: {(config.validationSplit * 100).toFixed(0)}%
                </label>
                <input
                  type="range"
                  min={0.1}
                  max={0.4}
                  step={0.05}
                  value={config.validationSplit}
                  onChange={(e) =>
                    setConfig((c) => ({ ...c, validationSplit: parseFloat(e.target.value) }))
                  }
                  disabled={phase !== 'idle'}
                  className={css({ width: '100%' })}
                />
              </div>

              {/* Augmentation Toggle */}
              <label
                className={css({
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                  cursor: 'pointer',
                })}
              >
                <input
                  type="checkbox"
                  checked={config.augmentation}
                  onChange={(e) => setConfig((c) => ({ ...c, augmentation: e.target.checked }))}
                  disabled={phase !== 'idle'}
                  className={css({ width: '18px', height: '18px' })}
                />
                <span className={css({ fontSize: 'sm' })}>Enable data augmentation</span>
              </label>
            </div>
          </div>

          {/* Hardware Info */}
          <div
            data-element="hardware-info"
            className={css({
              p: 4,
              bg: hardwareInfo?.error ? 'red.900/30' : 'gray.800',
              borderRadius: 'lg',
              border: '1px solid',
              borderColor: hardwareInfo?.error
                ? 'red.700'
                : hardwareInfo?.deviceType === 'gpu'
                  ? 'green.700'
                  : 'gray.700',
            })}
          >
            <div className={css({ display: 'flex', alignItems: 'center', gap: 3 })}>
              {/* Device icon */}
              <div
                className={css({
                  width: '40px',
                  height: '40px',
                  borderRadius: 'lg',
                  bg: hardwareLoading
                    ? 'gray.700'
                    : hardwareInfo?.deviceType === 'gpu'
                      ? 'green.600'
                      : hardwareInfo?.error
                        ? 'red.600'
                        : 'blue.600',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 'xl',
                })}
              >
                {hardwareLoading ? '...' : hardwareInfo?.deviceType === 'gpu' ? '⚡' : '💻'}
              </div>

              <div className={css({ flex: 1 })}>
                <div className={css({ fontSize: 'xs', color: 'gray.400', textTransform: 'uppercase' })}>
                  Training Hardware
                </div>
                {hardwareLoading ? (
                  <div className={css({ fontSize: 'md', color: 'gray.400' })}>Detecting...</div>
                ) : hardwareInfo?.error ? (
                  <div className={css({ fontSize: 'md', color: 'red.300' })}>
                    {hardwareInfo.deviceName}
                  </div>
                ) : (
                  <div className={css({ fontSize: 'md', fontWeight: 'semibold' })}>
                    {hardwareInfo?.deviceName}
                  </div>
                )}
              </div>

              {/* GPU badge */}
              {!hardwareLoading && hardwareInfo?.deviceType === 'gpu' && (
                <div
                  className={css({
                    px: 2,
                    py: 1,
                    bg: 'green.600',
                    borderRadius: 'md',
                    fontSize: 'xs',
                    fontWeight: 'semibold',
                    color: 'white',
                  })}
                >
                  GPU
                </div>
              )}
              {!hardwareLoading && hardwareInfo?.deviceType === 'cpu' && (
                <div
                  className={css({
                    px: 2,
                    py: 1,
                    bg: 'blue.600',
                    borderRadius: 'md',
                    fontSize: 'xs',
                    fontWeight: 'semibold',
                    color: 'white',
                  })}
                >
                  CPU
                </div>
              )}
            </div>

            {/* Error details */}
            {hardwareInfo?.error && (
              <div className={css({ mt: 2, fontSize: 'sm', color: 'red.300' })}>
                {hardwareInfo.error}
                {hardwareInfo.hint && (
                  <span className={css({ display: 'block', color: 'gray.400', mt: 1 })}>
                    Hint: {hardwareInfo.hint}
                  </span>
                )}
              </div>
            )}

            {/* Additional details */}
            {!hardwareLoading && !hardwareInfo?.error && hardwareInfo?.details && (
              <div className={css({ mt: 2, fontSize: 'xs', color: 'gray.500' })}>
                {hardwareInfo.details.tensorflowVersion && (
                  <span>TensorFlow {hardwareInfo.details.tensorflowVersion as string}</span>
                )}
                {hardwareInfo.details.systemMemory && (
                  <span> • {hardwareInfo.details.systemMemory as string} RAM</span>
                )}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className={css({ display: 'flex', gap: 3 })}>
            {phase === 'idle' && (
              <button
                type="button"
                onClick={startTraining}
                className={css({
                  flex: 1,
                  px: 6,
                  py: 3,
                  bg: 'green.600',
                  color: 'white',
                  fontWeight: 'semibold',
                  borderRadius: 'lg',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 'lg',
                  _hover: { bg: 'green.700' },
                })}
              >
                Start Training
              </button>
            )}

            {phase !== 'idle' && phase !== 'complete' && phase !== 'error' && (
              <button
                type="button"
                onClick={cancelTraining}
                className={css({
                  flex: 1,
                  px: 6,
                  py: 3,
                  bg: 'red.600',
                  color: 'white',
                  fontWeight: 'semibold',
                  borderRadius: 'lg',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 'lg',
                  _hover: { bg: 'red.700' },
                })}
              >
                Cancel Training
              </button>
            )}

            {(phase === 'complete' || phase === 'error') && (
              <button
                type="button"
                onClick={() => {
                  setPhase('idle')
                  setError(null)
                }}
                className={css({
                  flex: 1,
                  px: 6,
                  py: 3,
                  bg: 'blue.600',
                  color: 'white',
                  fontWeight: 'semibold',
                  borderRadius: 'lg',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 'lg',
                  _hover: { bg: 'blue.700' },
                })}
              >
                Train Again
              </button>
            )}
          </div>

          {/* Dataset Info */}
          {datasetInfo && (
            <div
              data-element="dataset-info"
              className={css({
                p: 4,
                bg: 'gray.800',
                borderRadius: 'lg',
              })}
            >
              <h3 className={css({ fontSize: 'md', fontWeight: 'semibold', mb: 3 })}>
                Dataset: {datasetInfo.total_images} images
              </h3>
              <div className={css({ display: 'flex', gap: 2, flexWrap: 'wrap' })}>
                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
                  <div
                    key={d}
                    className={css({
                      px: 2,
                      py: 1,
                      bg: 'gray.700',
                      borderRadius: 'md',
                      fontSize: 'sm',
                      fontFamily: 'mono',
                    })}
                  >
                    {d}: {datasetInfo.digit_counts[d] || 0}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Progress & Results */}
        <div className={css({ display: 'flex', flexDirection: 'column', gap: 4 })}>
          {/* Status */}
          <div
            data-element="status-panel"
            className={css({
              p: 4,
              bg: 'gray.800',
              borderRadius: 'lg',
            })}
          >
            <div className={css({ display: 'flex', alignItems: 'center', gap: 3, mb: 3 })}>
              {/* Status indicator */}
              <div
                className={css({
                  width: '12px',
                  height: '12px',
                  borderRadius: 'full',
                  bg:
                    phase === 'idle'
                      ? 'gray.500'
                      : phase === 'complete'
                        ? 'green.500'
                        : phase === 'error'
                          ? 'red.500'
                          : 'blue.500',
                  animation:
                    phase === 'training' || phase === 'loading' ? 'pulse 1.5s infinite' : 'none',
                })}
              />
              <span className={css({ fontSize: 'lg', fontWeight: 'semibold' })}>
                {phase === 'idle' && 'Ready to train'}
                {phase === 'setup' && 'Setting up...'}
                {phase === 'loading' && 'Loading dataset...'}
                {phase === 'training' &&
                  `Training: Epoch ${currentEpoch?.epoch || 0}/${currentEpoch?.total_epochs || config.epochs}`}
                {phase === 'exporting' && 'Exporting model...'}
                {phase === 'complete' && 'Training Complete!'}
                {phase === 'error' && 'Error'}
              </span>
            </div>

            {statusMessage && (
              <p className={css({ color: 'gray.400', fontSize: 'sm' })}>{statusMessage}</p>
            )}

            {/* Progress bar */}
            {phase === 'training' && currentEpoch && (
              <div className={css({ mt: 4 })}>
                <div className={css({ display: 'flex', justifyContent: 'space-between', mb: 1 })}>
                  <span className={css({ fontSize: 'sm', color: 'gray.400' })}>Progress</span>
                  <span className={css({ fontSize: 'sm', fontFamily: 'mono' })}>
                    {progressPercent}%
                  </span>
                </div>
                <div
                  className={css({
                    height: '8px',
                    bg: 'gray.700',
                    borderRadius: 'full',
                    overflow: 'hidden',
                  })}
                >
                  <div
                    className={css({
                      height: '100%',
                      bg: 'blue.500',
                      borderRadius: 'full',
                      transition: 'width 0.3s ease',
                    })}
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            )}

            {/* Error display */}
            {error && (
              <div
                className={css({
                  mt: 4,
                  p: 3,
                  bg: 'red.900/50',
                  border: '1px solid',
                  borderColor: 'red.700',
                  borderRadius: 'md',
                  color: 'red.200',
                })}
              >
                {error}
              </div>
            )}

            {/* Result display */}
            {result && (
              <div
                className={css({
                  mt: 4,
                  p: 4,
                  bg: 'green.900/30',
                  border: '1px solid',
                  borderColor: 'green.700',
                  borderRadius: 'lg',
                })}
              >
                <h4 className={css({ fontWeight: 'semibold', color: 'green.300', mb: 2 })}>
                  Training Results
                </h4>
                <div className={css({ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3 })}>
                  <div>
                    <div className={css({ fontSize: 'xs', color: 'gray.400' })}>Final Accuracy</div>
                    <div
                      className={css({ fontSize: 'xl', fontWeight: 'bold', color: 'green.300' })}
                    >
                      {(result.final_accuracy * 100).toFixed(1)}%
                    </div>
                  </div>
                  <div>
                    <div className={css({ fontSize: 'xs', color: 'gray.400' })}>Epochs Trained</div>
                    <div className={css({ fontSize: 'xl', fontWeight: 'bold' })}>
                      {result.epochs_trained}
                    </div>
                  </div>
                  <div>
                    <div className={css({ fontSize: 'xs', color: 'gray.400' })}>Final Loss</div>
                    <div className={css({ fontSize: 'lg', fontFamily: 'mono' })}>
                      {result.final_loss.toFixed(4)}
                    </div>
                  </div>
                  <div>
                    <div className={css({ fontSize: 'xs', color: 'gray.400' })}>TensorFlow.js</div>
                    <div className={css({ fontSize: 'lg' })}>
                      {result.tfjs_exported ? '✓ Exported' : '✗ Not exported'}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Live Metrics */}
          {currentEpoch && (
            <div
              data-element="metrics-panel"
              className={css({
                p: 4,
                bg: 'gray.800',
                borderRadius: 'lg',
              })}
            >
              <h3 className={css({ fontSize: 'md', fontWeight: 'semibold', mb: 3 })}>
                Current Epoch Metrics
              </h3>
              <div className={css({ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 })}>
                <div>
                  <div className={css({ fontSize: 'xs', color: 'gray.400' })}>Training Loss</div>
                  <div className={css({ fontSize: 'lg', fontFamily: 'mono' })}>
                    {currentEpoch.loss.toFixed(4)}
                  </div>
                </div>
                <div>
                  <div className={css({ fontSize: 'xs', color: 'gray.400' })}>
                    Training Accuracy
                  </div>
                  <div className={css({ fontSize: 'lg', fontFamily: 'mono' })}>
                    {(currentEpoch.accuracy * 100).toFixed(1)}%
                  </div>
                </div>
                <div>
                  <div className={css({ fontSize: 'xs', color: 'gray.400' })}>Validation Loss</div>
                  <div className={css({ fontSize: 'lg', fontFamily: 'mono' })}>
                    {currentEpoch.val_loss.toFixed(4)}
                  </div>
                </div>
                <div>
                  <div className={css({ fontSize: 'xs', color: 'gray.400' })}>
                    Validation Accuracy
                  </div>
                  <div className={css({ fontSize: 'lg', fontFamily: 'mono', color: 'green.400' })}>
                    {(currentEpoch.val_accuracy * 100).toFixed(1)}%
                  </div>
                </div>
              </div>
              {epochHistory.length > 1 && (
                <div
                  className={css({ mt: 3, pt: 3, borderTop: '1px solid', borderColor: 'gray.700' })}
                >
                  <span className={css({ fontSize: 'sm', color: 'gray.400' })}>
                    Best validation accuracy: {(bestAccuracy * 100).toFixed(1)}%
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Training History Chart (simple text version) */}
          {epochHistory.length > 0 && (
            <div
              data-element="history-panel"
              className={css({
                p: 4,
                bg: 'gray.800',
                borderRadius: 'lg',
                maxHeight: '200px',
                overflow: 'auto',
              })}
            >
              <h3 className={css({ fontSize: 'md', fontWeight: 'semibold', mb: 3 })}>
                Training History
              </h3>
              <div className={css({ fontFamily: 'mono', fontSize: 'xs' })}>
                {epochHistory.slice(-10).map((e) => (
                  <div
                    key={e.epoch}
                    className={css({
                      display: 'flex',
                      justifyContent: 'space-between',
                      py: 1,
                      borderBottom: '1px solid',
                      borderColor: 'gray.700',
                    })}
                  >
                    <span>Epoch {e.epoch}</span>
                    <span className={css({ color: 'gray.400' })}>
                      loss: {e.loss.toFixed(3)} | acc: {(e.accuracy * 100).toFixed(1)}% | val_acc:{' '}
                      {(e.val_accuracy * 100).toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Logs */}
          {logs.length > 0 && (
            <div
              data-element="logs-panel"
              className={css({
                p: 4,
                bg: 'gray.800',
                borderRadius: 'lg',
                maxHeight: '150px',
                overflow: 'auto',
              })}
            >
              <h3 className={css({ fontSize: 'md', fontWeight: 'semibold', mb: 2 })}>Logs</h3>
              <div className={css({ fontFamily: 'mono', fontSize: 'xs', color: 'gray.400' })}>
                {logs.map((log, i) => (
                  <div key={i}>{log}</div>
                ))}
                <div ref={logsEndRef} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
