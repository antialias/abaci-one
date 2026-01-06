'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { css } from '../../../../styled-system/css'
import { TrainingWizard } from './components/wizard/TrainingWizard'
import type {
  SamplesData,
  HardwareInfo,
  PreflightInfo,
  ServerPhase,
  TrainingConfig,
  EpochData,
  DatasetInfo,
  TrainingResult,
} from './components/wizard/types'

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

  // Preflight/dependency info
  const [preflightInfo, setPreflightInfo] = useState<PreflightInfo | null>(null)
  const [preflightLoading, setPreflightLoading] = useState(true)

  // Training state
  const [serverPhase, setServerPhase] = useState<ServerPhase>('idle')
  const [statusMessage, setStatusMessage] = useState<string>('')
  const [epochHistory, setEpochHistory] = useState<EpochData[]>([])
  const [currentEpoch, setCurrentEpoch] = useState<EpochData | null>(null)
  const [datasetInfo, setDatasetInfo] = useState<DatasetInfo | null>(null)
  const [result, setResult] = useState<TrainingResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Training data samples
  const [samples, setSamples] = useState<SamplesData | null>(null)
  const [samplesLoading, setSamplesLoading] = useState(true)

  // Refs
  const eventSourceRef = useRef<EventSource | null>(null)
  // Track stderr logs for error messages
  const stderrLogsRef = useRef<string[]>([])

  // Fetch training samples
  const fetchSamples = useCallback(async () => {
    setSamplesLoading(true)
    try {
      const response = await fetch('/api/vision-training/samples')
      const data = await response.json()
      setSamples(data)
    } catch {
      setSamples(null)
    } finally {
      setSamplesLoading(false)
    }
  }, [])

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
        venv: { exists: false, python: '', isAppleSilicon: false, hasGpu: false },
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

  useEffect(() => {
    fetchHardware()
    fetchSamples()
    fetchPreflight()
  }, [fetchHardware, fetchSamples, fetchPreflight])

  useEffect(() => {
    return () => {
      eventSourceRef.current?.close()
    }
  }, [])

  // Get all tile images for background
  const allTileImages = samples ? Object.values(samples.digits).flatMap((d) => d.tilePaths) : []

  // Start training
  const startTraining = useCallback(async () => {
    setServerPhase('setup')
    setStatusMessage('Initializing...')
    setEpochHistory([])
    setCurrentEpoch(null)
    setDatasetInfo(null)
    setResult(null)
    setError(null)

    try {
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
  }, [config])

  const handleEvent = useCallback((eventType: string, data: Record<string, unknown>) => {
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
        setServerPhase('training')
        break
      }
      case 'exported':
        setServerPhase('exporting')
        break
      case 'complete':
        setServerPhase('complete')
        setResult(data as unknown as TrainingResult)
        break
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
    }
  }, [])

  const cancelTraining = useCallback(async () => {
    try {
      await fetch('/api/vision-training/train', { method: 'DELETE' })
    } catch {
      // Ignore
    }
  }, [])

  const resetToIdle = useCallback(() => {
    setServerPhase('idle')
    setResult(null)
    setError(null)
  }, [])

  return (
    <div
      data-component="train-model-page"
      className={css({
        minHeight: '100vh',
        bg: 'gray.900',
        color: 'gray.100',
        position: 'relative',
        overflow: 'hidden',
      })}
    >
      {/* Tiled Background Effect */}
      {allTileImages.length > 0 && (
        <div
          data-element="tiled-background"
          className={css({
            position: 'absolute',
            inset: 0,
            overflow: 'hidden',
            opacity: 0.04,
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
            {Array.from({ length: Math.ceil(800 / Math.max(1, allTileImages.length)) })
              .flatMap(() => allTileImages)
              .slice(0, 800)
              .map((src, i) => (
                <img
                  key={`${src}-${i}`}
                  src={src}
                  alt=""
                  className={css({
                    width: '60px',
                    height: '60px',
                    objectFit: 'cover',
                    borderRadius: 'sm',
                    filter: 'grayscale(100%)',
                  })}
                />
              ))}
          </div>
        </div>
      )}
      {/* Header */}
      <header
        className={css({
          p: 4,
          borderBottom: '1px solid',
          borderColor: 'gray.800',
          position: 'relative',
          zIndex: 1,
        })}
      >
        <Link
          href="/vision-training"
          className={css({
            color: 'gray.400',
            textDecoration: 'none',
            fontSize: 'sm',
            _hover: { color: 'gray.200' },
          })}
        >
          ← Back to Training Data
        </Link>
      </header>

      {/* Main Content - Centered */}
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
            Train Column Classifier
          </h1>
          <p className={css({ color: 'gray.400', fontSize: 'sm' })}>
            Teach the model to recognize abacus digits from your collected images
          </p>
        </div>

        {/* Training Wizard - handles all phases */}
        <TrainingWizard
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
          serverPhase={serverPhase}
          statusMessage={statusMessage}
          currentEpoch={currentEpoch}
          epochHistory={epochHistory}
          datasetInfo={datasetInfo}
          result={result}
          error={error}
          onStart={startTraining}
          onCancel={cancelTraining}
          onReset={resetToIdle}
          onSyncComplete={fetchSamples}
        />
      </main>
    </div>
  )
}
