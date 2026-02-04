'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import type { Socket } from 'socket.io-client'
import { createSocket } from '@/lib/socket'
import { css } from '../../../../../styled-system/css'
import { TrainingDiagnosticsProvider } from '../../train/components/TrainingDiagnosticsContext'
import { TrainingWizard } from '../../train/components/wizard/TrainingWizard'
import { useModelType } from '../../hooks/useModelType'
import type {
  SamplesData,
  HardwareInfo,
  PreflightInfo,
  ServerPhase,
  TrainingConfig,
  EpochData,
  DatasetInfo,
  TrainingResult,
  LoadingProgress,
} from '../../train/components/wizard/types'
import { isColumnClassifierSamples } from '../../train/components/wizard/types'

// localStorage key for config persistence
const STORAGE_KEY_CONFIG = 'vision-training-config'

/**
 * Training manifest for filtered data selection
 */
interface TrainingManifest {
  id: string
  modelType: 'column-classifier' | 'boundary-detector'
  createdAt: string
  filters: {
    captureType?: 'passive' | 'explicit' | 'all'
    deviceId?: string
    digit?: number
  }
  items: Array<
    | { type: 'column'; digit: number; filename: string }
    | { type: 'boundary'; deviceId: string; baseName: string }
  >
}

/** Animated background tile that transitions between image and digit */
function AnimatedTile({ src, digit, index }: { src: string; digit: number; index: number }) {
  const [showDigit, setShowDigit] = useState(false)

  useEffect(() => {
    // Random initial delay so tiles don't all animate together
    const initialDelay = Math.random() * 10000

    const startAnimation = () => {
      // Random interval between 3-8 seconds
      const interval = 3000 + Math.random() * 5000

      const timer = setInterval(() => {
        setShowDigit((prev) => !prev)
        // Stay in the new state for 1-3 seconds before potentially switching back
        setTimeout(
          () => {
            // 50% chance to switch back
            if (Math.random() > 0.5) {
              setShowDigit((prev) => !prev)
            }
          },
          1000 + Math.random() * 2000
        )
      }, interval)

      return timer
    }

    const delayTimer = setTimeout(() => {
      const animTimer = startAnimation()
      return () => clearInterval(animTimer)
    }, initialDelay)

    return () => clearTimeout(delayTimer)
  }, [])

  return (
    <div
      className={css({
        width: '60px',
        height: '60px',
        position: 'relative',
        borderRadius: 'sm',
        overflow: 'hidden',
      })}
    >
      {/* Image layer */}
      <img
        src={src}
        alt=""
        className={css({
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          filter: 'grayscale(100%)',
          transition: 'opacity 0.8s ease-in-out',
        })}
        style={{ opacity: showDigit ? 0 : 1 }}
      />
      {/* Digit layer */}
      <div
        className={css({
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '2xl',
          fontWeight: 'bold',
          color: 'gray.400',
          fontFamily: 'mono',
          transition: 'opacity 0.8s ease-in-out',
        })}
        style={{ opacity: showDigit ? 1 : 0 }}
      >
        {digit}
      </div>
    </div>
  )
}

// Default config
const DEFAULT_CONFIG: TrainingConfig = {
  epochs: 50,
  batchSize: 32,
  validationSplit: 0.2,
  colorAugmentation: false,
}

/**
 * Training Wizard Page
 *
 * Located at /vision-training/[model]/train
 * Model type is determined by the URL path.
 */
export default function TrainModelPage() {
  // Get model type from URL path - this is the single source of truth
  const modelType = useModelType()

  // Get manifest ID from URL query params (for filtered training)
  const searchParams = useSearchParams()
  const manifestId = searchParams.get('manifest')

  // Manifest state
  const [manifest, setManifest] = useState<TrainingManifest | null>(null)
  const [manifestLoading, setManifestLoading] = useState(false)
  const [manifestError, setManifestError] = useState<string | null>(null)

  // Configuration - will be loaded from localStorage if available
  const [config, setConfig] = useState<TrainingConfig>(DEFAULT_CONFIG)
  const configInitializedRef = useRef(false)

  // Load config from localStorage on mount
  useEffect(() => {
    if (configInitializedRef.current) return
    configInitializedRef.current = true

    try {
      const saved = localStorage.getItem(STORAGE_KEY_CONFIG)
      if (saved) {
        const savedConfig = JSON.parse(saved) as TrainingConfig
        setConfig(savedConfig)
      }
    } catch {
      // Ignore
    }
  }, [])

  // Save config to localStorage when it changes
  useEffect(() => {
    if (!configInitializedRef.current) return

    try {
      localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(config))
    } catch {
      // Ignore
    }
  }, [config])

  // Hardware info
  const [hardwareInfo, setHardwareInfo] = useState<HardwareInfo | null>(null)
  const [hardwareLoading, setHardwareLoading] = useState(true)

  // Preflight/dependency info
  const [preflightInfo, setPreflightInfo] = useState<PreflightInfo | null>(null)
  const [preflightLoading, setPreflightLoading] = useState(true)

  // Training state
  const [serverPhase, setServerPhase] = useState<ServerPhase>('idle')
  const [statusMessage, setStatusMessage] = useState<string>('')
  const [epochHistory, setEpochHistory] = useState<EpochData[]>([])
  const [currentEpoch, setCurrentEpoch] = useState<EpochData | null>(null)
  const [datasetInfo, setDatasetInfo] = useState<DatasetInfo | null>(null)
  const [loadingProgress, setLoadingProgress] = useState<LoadingProgress | null>(null)
  const [result, setResult] = useState<TrainingResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Training data samples
  const [samples, setSamples] = useState<SamplesData | null>(null)
  const [samplesLoading, setSamplesLoading] = useState(true)

  // Refs
  const socketRef = useRef<Socket | null>(null)
  const currentTaskIdRef = useRef<string | null>(null)
  // Track stderr logs for error messages
  const stderrLogsRef = useRef<string[]>([])

  // Fetch training samples for the model type (from URL)
  const fetchSamples = useCallback(async () => {
    setSamplesLoading(true)
    try {
      const response = await fetch(`/api/vision-training/samples?type=${modelType}`)
      const data = await response.json()
      setSamples(data)
    } catch {
      setSamples(null)
    } finally {
      setSamplesLoading(false)
    }
  }, [modelType])

  // Fetch hardware info
  const fetchHardware = useCallback(async () => {
    setHardwareLoading(true)
    setHardwareInfo(null)
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
  }, [])

  // Fetch preflight/dependency info
  const fetchPreflight = useCallback(async () => {
    setPreflightLoading(true)
    setPreflightInfo(null)
    try {
      const response = await fetch('/api/vision-training/preflight')
      const data = await response.json()
      setPreflightInfo(data)
    } catch {
      setPreflightInfo({
        ready: false,
        platform: { supported: false, reason: 'Failed to check dependencies' },
        venv: {
          exists: false,
          python: '',
          isAppleSilicon: false,
          hasGpu: false,
        },
        dependencies: {
          allInstalled: false,
          installed: [],
          missing: [],
          error: 'Failed to fetch',
        },
      })
    } finally {
      setPreflightLoading(false)
    }
  }, [])

  // Fetch initial data (hardware, preflight)
  useEffect(() => {
    fetchHardware()
    fetchPreflight()
  }, [fetchHardware, fetchPreflight])

  // Fetch samples when model type changes
  useEffect(() => {
    fetchSamples()
  }, [fetchSamples])

  // Fetch manifest if manifestId is provided in URL
  useEffect(() => {
    if (!manifestId) {
      setManifest(null)
      setManifestError(null)
      return
    }

    const fetchManifest = async () => {
      setManifestLoading(true)
      setManifestError(null)
      try {
        const response = await fetch(`/api/vision-training/manifests/${manifestId}`)
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('Manifest not found. It may have been deleted.')
          }
          throw new Error(`Failed to fetch manifest: ${response.statusText}`)
        }
        const data = await response.json()
        setManifest(data)
      } catch (err) {
        setManifestError(err instanceof Error ? err.message : 'Failed to load manifest')
        setManifest(null)
      } finally {
        setManifestLoading(false)
      }
    }

    fetchManifest()
  }, [manifestId])

  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect()
        socketRef.current = null
      }
    }
  }, [])

  // Get all tile images with their digits for background (column classifier only)
  const allTiles = useMemo(() => {
    if (!samples || !isColumnClassifierSamples(samples)) return []
    return Object.entries(samples.digits).flatMap(([digit, data]) =>
      data.tilePaths.map((src) => ({ src, digit: parseInt(digit, 10) }))
    )
  }, [samples])

  /**
   * Subscribe to a training task via Socket.IO
   */
  const subscribeToTask = useCallback(
    (taskId: string) => {
      // Clean up existing socket
      if (socketRef.current) {
        socketRef.current.emit('task:unsubscribe', currentTaskIdRef.current)
        socketRef.current.disconnect()
      }

      currentTaskIdRef.current = taskId

      const socket = createSocket({
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 5,
      })
      socketRef.current = socket

      const handleConnect = () => {
        console.log('[Training] Socket connected, subscribing to task:', taskId)
        socket.emit('task:subscribe', taskId)
      }

      socket.on('connect', handleConnect)
      if (socket.connected) handleConnect()

      // Handle task state (for reconnection)
      socket.on(
        'task:state',
        (task: { id: string; status: string; progress: number; progressMessage: string | null }) => {
          if (task.progress > 0 || task.progressMessage) {
            setStatusMessage(task.progressMessage || `Progress: ${task.progress}%`)
          }
        }
      )

      // Handle task events
      socket.on(
        'task:event',
        (event: { taskId: string; eventType: string; payload: unknown; replayed?: boolean }) => {
          if (event.taskId !== taskId) return

          const payload = event.payload as Record<string, unknown>

          switch (event.eventType) {
            // === Lifecycle events ===
            case 'started':
              setServerPhase('setup')
              setStatusMessage('Training started')
              stderrLogsRef.current = []
              break

            case 'progress':
              if (payload.message) {
                setStatusMessage(payload.message as string)
              }
              break

            case 'failed': {
              setServerPhase('error')
              const stderrText = stderrLogsRef.current.join('\n')
              const errorMatch = stderrText.match(/(ValueError|Exception|Error):\s*(.+?)(?:\n|$)/s)
              if (errorMatch) {
                setError(errorMatch[0].trim())
              } else if (stderrLogsRef.current.length > 0) {
                setError(stderrLogsRef.current.slice(-3).join('\n'))
              } else {
                setError((payload.error as string) ?? 'Training failed')
              }
              socket.emit('task:unsubscribe', taskId)
              socket.disconnect()
              socketRef.current = null
              currentTaskIdRef.current = null
              break
            }

            case 'cancelled':
              setServerPhase('idle')
              socket.emit('task:unsubscribe', taskId)
              socket.disconnect()
              socketRef.current = null
              currentTaskIdRef.current = null
              break

            // === Domain events ===
            case 'train_started':
              setServerPhase('setup')
              setStatusMessage('Training initialized')
              break

            case 'log':
              if (payload.source === 'stderr' && payload.message) {
                stderrLogsRef.current.push(payload.message as string)
                if (stderrLogsRef.current.length > 20) {
                  stderrLogsRef.current.shift()
                }
              }
              break

            case 'dataset_loaded':
            case 'dataset_info': {
              setLoadingProgress(null)
              const d = (payload.data as Record<string, unknown>) ?? payload
              if (modelType === 'column-classifier') {
                setDatasetInfo({
                  type: 'column-classifier',
                  total_images: d.total_images as number,
                  digit_counts: d.digit_counts as Record<number, number>,
                })
              } else if (modelType === 'boundary-detector') {
                setDatasetInfo({
                  type: 'boundary-detector',
                  total_frames: (d.total_frames as number) || (d.total_images as number) || 0,
                  device_count: (d.device_count as number) || 1,
                  color_augmentation_enabled: d.color_augmentation_enabled as boolean | undefined,
                  raw_frames: d.raw_frames as number | undefined,
                })
              }
              break
            }

            case 'epoch': {
              const epochData: EpochData = {
                epoch: (payload.epoch as number) ?? 0,
                total_epochs: (payload.totalEpochs as number) ?? 0,
                loss: (payload.loss as number) ?? 0,
                accuracy: (payload.accuracy as number) ?? 0,
                val_loss: (payload.valLoss as number) ?? 0,
                val_accuracy: (payload.valAccuracy as number) ?? 0,
              }
              setCurrentEpoch(epochData)
              setEpochHistory((prev) => [...prev, epochData])
              setServerPhase('training')
              break
            }

            case 'train_complete': {
              // Session is saved server-side by the task handler.
              // Just update UI state.
              const d = (payload.data as Record<string, unknown>) ?? payload
              setServerPhase('complete')
              setResult(d as unknown as TrainingResult)
              socket.emit('task:unsubscribe', taskId)
              socket.disconnect()
              socketRef.current = null
              currentTaskIdRef.current = null
              break
            }

            case 'completed':
              // Lifecycle safety net — if train_complete was missed
              socket.emit('task:unsubscribe', taskId)
              socket.disconnect()
              socketRef.current = null
              currentTaskIdRef.current = null
              break

            case 'subprocess_event': {
              // Catch-all for Python events not explicitly handled
              const subType = payload.eventType as string
              const subData = (payload.data as Record<string, unknown>) ?? {}
              if (subType === 'loading_progress') {
                setLoadingProgress({
                  step: subData.step as LoadingProgress['step'],
                  current: subData.current as number,
                  total: subData.total as number,
                  message: subData.message as string,
                })
                setStatusMessage(subData.message as string)
              } else if (subType === 'exported') {
                setServerPhase('exporting')
              } else if (subType === 'status') {
                setStatusMessage(subData.message as string)
                if (subData.phase) setServerPhase(subData.phase as ServerPhase)
              } else {
                console.log(`[Training] Unhandled subprocess event: ${subType}`, subData)
              }
              break
            }

            default:
              console.log(`[Training] Unhandled event: ${event.eventType}`, payload)
          }
        }
      )

      socket.on('task:error', (data: { taskId: string; error: string }) => {
        if (data.taskId === taskId) {
          setServerPhase('error')
          setError(data.error)
          socket.disconnect()
          socketRef.current = null
          currentTaskIdRef.current = null
        }
      })
    },
    [modelType]
  )

  // Reconnect to in-progress training task on page load
  useEffect(() => {
    async function checkForActiveTask() {
      try {
        const response = await fetch('/api/vision-training/train/task')
        if (!response.ok) return

        const { taskId, status } = await response.json()
        if (taskId && (status === 'running' || status === 'pending')) {
          console.log('[Training] Reconnecting to active task:', taskId)
          setServerPhase('setup')
          setStatusMessage('Reconnecting to training...')
          subscribeToTask(taskId)
        }
      } catch {
        // Silently fail — not critical
      }
    }
    checkForActiveTask()
  }, [subscribeToTask])

  // Start training
  const startTraining = useCallback(async () => {
    setServerPhase('setup')
    setStatusMessage('Initializing...')
    setEpochHistory([])
    setCurrentEpoch(null)
    setDatasetInfo(null)
    setLoadingProgress(null)
    setResult(null)
    setError(null)

    // Cancel any existing socket subscription
    if (socketRef.current && currentTaskIdRef.current) {
      socketRef.current.emit('task:cancel', currentTaskIdRef.current)
      socketRef.current.emit('task:unsubscribe', currentTaskIdRef.current)
      socketRef.current.disconnect()
      socketRef.current = null
      currentTaskIdRef.current = null
    }

    try {
      const response = await fetch('/api/vision-training/train/task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelType,
          epochs: config.epochs,
          batchSize: config.batchSize,
          validationSplit: config.validationSplit,
          colorAugmentation: config.colorAugmentation,
          manifestId: manifest?.id,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to start training')
      }

      const { taskId, status } = await response.json()
      console.log('[Training] Task API response:', { taskId, status })

      // Subscribe to task events via Socket.IO
      subscribeToTask(taskId)
    } catch (err) {
      setServerPhase('error')
      setError(err instanceof Error ? err.message : 'Unknown error')
    }
  }, [config, modelType, manifest, subscribeToTask])

  const cancelTraining = useCallback(async () => {
    try {
      // Cancel via task system
      if (currentTaskIdRef.current && socketRef.current) {
        socketRef.current.emit('task:cancel', currentTaskIdRef.current)
      }
      await fetch('/api/vision-training/train/task', { method: 'DELETE' })
    } catch {
      // Ignore
    }
  }, [])

  const handleStopAndSave = useCallback(async () => {
    try {
      const response = await fetch('/api/vision-training/train/task', {
        method: 'PUT',
      })
      if (!response.ok) {
        console.error('[Training] Stop and save request failed:', await response.text())
      }
    } catch (e) {
      console.error('[Training] Stop and save error:', e)
    }
  }, [])

  const resetToIdle = useCallback(() => {
    setServerPhase('idle')
    setResult(null)
    setError(null)
  }, [])

  // Re-run training with the same config (called from results page)
  const handleRerunTraining = useCallback(() => {
    // Reset training state but keep config
    setServerPhase('idle')
    setResult(null)
    setError(null)
    setEpochHistory([])
    setCurrentEpoch(null)
    setDatasetInfo(null)
    setLoadingProgress(null)
    // Start training immediately
    // Use setTimeout to ensure state is updated before starting
    setTimeout(() => {
      startTraining()
    }, 0)
  }, [startTraining])

  return (
    <div
      data-component="train-model-page"
      className={css({
        bg: 'gray.900',
        color: 'gray.100',
        position: 'relative',
        overflow: 'hidden',
        pt: 4,
      })}
      style={{ minHeight: 'calc(100vh - 120px)' }}
    >
      {/* Tiled Background Effect */}
      {allTiles.length > 0 && (
        <div
          data-element="tiled-background"
          className={css({
            position: 'absolute',
            inset: 0,
            overflow: 'hidden',
            opacity: 0.12,
            pointerEvents: 'none',
            zIndex: 0,
          })}
        >
          <div
            className={css({
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, 60px)',
              gap: 2,
              transform: 'rotate(-5deg)',
              transformOrigin: 'center center',
              width: '120vw',
              height: '120vh',
              marginLeft: '-10vw',
              marginTop: '-10vh',
            })}
          >
            {/* Repeat tiles to fill background (need ~600+ for full coverage) */}
            {Array.from({
              length: Math.ceil(800 / Math.max(1, allTiles.length)),
            })
              .flatMap(() => allTiles)
              .slice(0, 800)
              .map((tile, i) => (
                <AnimatedTile
                  key={`${tile.src}-${i}`}
                  src={tile.src}
                  digit={tile.digit}
                  index={i}
                />
              ))}
          </div>
        </div>
      )}

      {/* Main Content - Centered (no header needed, nav is in layout) */}
      <main
        className={css({
          maxWidth: '800px',
          mx: 'auto',
          p: 6,
          position: 'relative',
          zIndex: 1,
        })}
      >
        {/* Manifest Summary Banner (when training on filtered data) */}
        {manifestId && (
          <div
            data-element="manifest-banner"
            className={css({
              mb: 6,
              p: 4,
              bg: 'purple.900/30',
              border: '1px solid',
              borderColor: 'purple.700/50',
              borderRadius: 'lg',
            })}
          >
            {manifestLoading ? (
              <div
                className={css({
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                  color: 'purple.300',
                })}
              >
                <span className={css({ animation: 'spin 1s linear infinite' })}>⏳</span>
                <span>Loading manifest...</span>
              </div>
            ) : manifestError ? (
              <div className={css({ color: 'red.400' })}>
                <strong>Error:</strong> {manifestError}
              </div>
            ) : manifest ? (
              <div>
                <div className={css({ display: 'flex', alignItems: 'center', gap: 2, mb: 2 })}>
                  <span className={css({ fontSize: 'lg' })}>🎯</span>
                  <h3 className={css({ fontSize: 'md', fontWeight: 'bold', color: 'purple.200' })}>
                    Training on Filtered Dataset
                  </h3>
                </div>
                <div
                  className={css({
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 4,
                    fontSize: 'sm',
                    color: 'gray.300',
                  })}
                >
                  <div>
                    <span className={css({ color: 'gray.500' })}>Items:</span>{' '}
                    <strong className={css({ color: 'purple.300' })}>
                      {manifest.items.length}
                    </strong>
                  </div>
                  {manifest.filters.captureType && manifest.filters.captureType !== 'all' && (
                    <div>
                      <span className={css({ color: 'gray.500' })}>Capture:</span>{' '}
                      <strong>{manifest.filters.captureType}</strong>
                    </div>
                  )}
                  {manifest.filters.deviceId && (
                    <div>
                      <span className={css({ color: 'gray.500' })}>Device:</span>{' '}
                      <strong>{manifest.filters.deviceId}</strong>
                    </div>
                  )}
                  {manifest.filters.digit !== undefined && (
                    <div>
                      <span className={css({ color: 'gray.500' })}>Digit:</span>{' '}
                      <strong>{manifest.filters.digit}</strong>
                    </div>
                  )}
                  <div>
                    <span className={css({ color: 'gray.500' })}>Created:</span>{' '}
                    <span>{new Date(manifest.createdAt).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        )}

        {/* Title */}
        <div className={css({ textAlign: 'center', mb: 6 })}>
          <h1 className={css({ fontSize: '2xl', fontWeight: 'bold', mb: 2 })}>
            {modelType === 'column-classifier'
              ? 'Train Column Classifier'
              : modelType === 'boundary-detector'
                ? 'Train Boundary Detector'
                : 'Train Vision Model'}
          </h1>
          <p className={css({ color: 'gray.400', fontSize: 'sm' })}>
            {modelType === 'column-classifier'
              ? 'Teach the model to recognize abacus digits from your collected images'
              : modelType === 'boundary-detector'
                ? 'Teach the model to detect abacus boundaries without markers'
                : 'Select a model to train from your collected data'}
          </p>
        </div>

        {/* Training Wizard - handles all phases */}
        <TrainingDiagnosticsProvider
          samples={samples}
          datasetInfo={datasetInfo}
          epochHistory={epochHistory}
          config={config}
          result={result}
        >
          <TrainingWizard
            // Model type (from URL path - single source of truth)
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
            // Training state
            serverPhase={serverPhase}
            statusMessage={statusMessage}
            currentEpoch={currentEpoch}
            epochHistory={epochHistory}
            datasetInfo={datasetInfo}
            loadingProgress={loadingProgress}
            result={result}
            error={error}
            // Actions
            onStart={startTraining}
            onCancel={cancelTraining}
            onStopAndSave={handleStopAndSave}
            onReset={resetToIdle}
            onSyncComplete={fetchSamples}
            onRerunTraining={handleRerunTraining}
          />
        </TrainingDiagnosticsProvider>
      </main>
    </div>
  )
}
