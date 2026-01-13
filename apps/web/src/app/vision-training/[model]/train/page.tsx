'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
  const eventSourceRef = useRef<EventSource | null>(null)
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

  useEffect(() => {
    return () => {
      eventSourceRef.current?.close()
    }
  }, [])

  // Get all tile images with their digits for background (column classifier only)
  const allTiles = useMemo(() => {
    if (!samples || !isColumnClassifierSamples(samples)) return []
    return Object.entries(samples.digits).flatMap(([digit, data]) =>
      data.tilePaths.map((src) => ({ src, digit: parseInt(digit, 10) }))
    )
  }, [samples])

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

    try {
      const response = await fetch('/api/vision-training/train', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelType,
          epochs: config.epochs,
          batchSize: config.batchSize,
          validationSplit: config.validationSplit,
          colorAugmentation: config.colorAugmentation,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to start training')
      }

      const reader = response.body?.getReader()
      if (!reader) throw new Error('No response body')

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

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
      setServerPhase('error')
      setError(err instanceof Error ? err.message : 'Unknown error')
    }
  }, [config, modelType])

  const handleEvent = useCallback(
    (eventType: string, data: Record<string, unknown>) => {
      switch (eventType) {
        case 'started':
          setServerPhase('setup')
          setStatusMessage('Training started')
          // Reset stderr logs on new training
          stderrLogsRef.current = []
          break
        case 'status':
          setStatusMessage(data.message as string)
          if (data.phase) setServerPhase(data.phase as ServerPhase)
          break
        case 'log':
          // Track stderr logs for error messages
          if (data.type === 'stderr' && data.message) {
            stderrLogsRef.current.push(data.message as string)
            // Keep only last 20 lines to avoid memory issues
            if (stderrLogsRef.current.length > 20) {
              stderrLogsRef.current.shift()
            }
          }
          break
        case 'loading_progress':
          setLoadingProgress({
            step: data.step as LoadingProgress['step'],
            current: data.current as number,
            total: data.total as number,
            message: data.message as string,
          })
          setStatusMessage(data.message as string)
          break
        case 'dataset_loaded':
          // Clear loading progress when done
          setLoadingProgress(null)
          // Different fields depending on model type
          if (modelType === 'column-classifier') {
            setDatasetInfo({
              type: 'column-classifier',
              total_images: data.total_images as number,
              digit_counts: data.digit_counts as Record<number, number>,
            })
          } else if (modelType === 'boundary-detector') {
            setDatasetInfo({
              type: 'boundary-detector',
              total_frames: (data.total_frames as number) || (data.total_images as number) || 0,
              device_count: (data.device_count as number) || 1,
              color_augmentation_enabled: data.color_augmentation_enabled as boolean | undefined,
              raw_frames: data.raw_frames as number | undefined,
            })
          }
          break
        case 'epoch': {
          const epochData = data as unknown as EpochData
          setCurrentEpoch(epochData)
          setEpochHistory((prev) => [...prev, epochData])
          setServerPhase('training')
          break
        }
        case 'exported':
          setServerPhase('exporting')
          break
        case 'complete': {
          setServerPhase('complete')
          const completeResult = data as unknown as TrainingResult
          setResult(completeResult)

          // Debug logging to diagnose session save issues
          console.log('[Training] Complete event received:', {
            modelType,
            hasDatasetInfo: !!datasetInfo,
            hasConfig: !!config,
            session_id: completeResult.session_id,
            tfjs_exported: completeResult.tfjs_exported,
            output_dir: (completeResult as { output_dir?: string }).output_dir,
            rawData: data,
          })

          // Save session to database if we have all required data
          if (
            modelType &&
            datasetInfo &&
            config &&
            completeResult.session_id &&
            completeResult.tfjs_exported
          ) {
            // Get model path relative to data/vision-training/models/
            // The output_dir from the script is e.g. "data/vision-training/models/boundary-detector/abc123"
            // We want just "boundary-detector/abc123" for the modelPath field
            const outputDir = (completeResult as { output_dir?: string }).output_dir || ''
            const modelPath = outputDir.replace(/^\.?\/?(data\/vision-training\/models\/)?/, '')

            // Create a display name from model type and date
            const now = new Date()
            const displayName = `${modelType === 'column-classifier' ? 'Column Classifier' : 'Boundary Detector'} - ${now.toLocaleDateString()}`

            // Prepare epoch history with required fields
            const epochHistoryForSession = epochHistory.map((e) => ({
              epoch: e.epoch,
              total_epochs: e.total_epochs,
              loss: e.loss,
              val_loss: e.val_loss,
              accuracy: e.accuracy,
              val_accuracy: e.val_accuracy,
              val_pixel_error: e.val_pixel_error,
              val_heaven_accuracy: e.val_heaven_accuracy,
              val_earth_accuracy: e.val_earth_accuracy,
            }))

            // POST to sessions API
            fetch('/api/vision/sessions', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                modelType,
                displayName,
                config,
                datasetInfo,
                result: completeResult,
                epochHistory: epochHistoryForSession,
                modelPath,
                setActive: true, // Auto-activate on successful training
              }),
            })
              .then((res) => {
                if (!res.ok) {
                  console.error('[Training] Failed to save session:', res.statusText)
                } else {
                  console.log('[Training] Session saved successfully')
                }
              })
              .catch((err) => {
                console.error('[Training] Error saving session:', err)
              })
          } else {
            console.warn('[Training] Skipping session save - missing required data:', {
              modelType: !!modelType,
              datasetInfo: !!datasetInfo,
              config: !!config,
              session_id: !!completeResult.session_id,
              tfjs_exported: !!completeResult.tfjs_exported,
            })
          }
          break
        }
        case 'error': {
          setServerPhase('error')
          // Extract meaningful error from stderr logs
          const stderrText = stderrLogsRef.current.join('\n')
          // Look for Python ValueError, Exception, or Error messages
          const errorMatch = stderrText.match(/(ValueError|Exception|Error):\s*(.+?)(?:\n|$)/s)
          if (errorMatch) {
            setError(errorMatch[0].trim())
          } else if (stderrLogsRef.current.length > 0) {
            // Use last few stderr lines if no specific error pattern found
            setError(stderrLogsRef.current.slice(-3).join('\n'))
          } else {
            setError(data.message as string)
          }
          break
        }
        case 'cancelled':
          setServerPhase('idle')
          break
        default:
          // Log unhandled events for debugging
          console.log(`[Training] Event: ${eventType}`, data)
      }
    },
    [modelType]
  )

  const cancelTraining = useCallback(async () => {
    try {
      await fetch('/api/vision-training/train', { method: 'DELETE' })
    } catch {
      // Ignore
    }
  }, [])

  const handleStopAndSave = useCallback(async () => {
    try {
      const response = await fetch('/api/vision-training/train', {
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
      style={{ minHeight: 'calc(100vh - var(--nav-height))' }}
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
