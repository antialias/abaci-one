'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { css } from '../../../../../../../styled-system/css'
import type { SamplesData, ModelType } from '../types'
import { isColumnClassifierSamples } from '../types'
import { TrainingDataCapture } from '../../TrainingDataCapture'
import { BoundaryDataCapture } from '../../BoundaryDataCapture'
import { TrainingDataHubModal } from '../../TrainingDataHubModal'
import { BoundaryDataHubModal } from '../../BoundaryDataHubModal'
import { SyncHistoryIndicator } from '../../SyncHistoryIndicator'

interface DataCardProps {
  samples: SamplesData | null
  samplesLoading: boolean
  modelType: ModelType
  onProgress: () => void
  onSyncComplete?: () => void
  onDataWarningAcknowledged?: () => void
}

const COLUMN_CLASSIFIER_REQUIREMENTS = {
  minTotal: 50,
  minPerDigit: 3,
  goodTotal: 200,
  goodPerDigit: 10,
}

const BOUNDARY_DETECTOR_REQUIREMENTS = {
  minTotal: 50,
  goodTotal: 200,
}

interface SyncStatus {
  available: boolean
  remote?: { host: string; totalImages: number }
  local?: { totalImages: number }
  needsSync?: boolean
  newOnRemote?: number
  newOnLocal?: number
  excludedByDeletion?: number
  error?: string
}

interface SyncProgress {
  phase: 'idle' | 'connecting' | 'syncing' | 'complete' | 'error'
  message: string
  filesTransferred?: number
  bytesTransferred?: number
}

const QUALITY_CONFIG: Record<
  SamplesData['dataQuality'],
  { color: string; label: string; barWidth: string }
> = {
  none: { color: 'gray.500', label: 'No Data', barWidth: '0%' },
  insufficient: { color: 'red.400', label: 'Insufficient', barWidth: '20%' },
  minimal: { color: 'yellow.400', label: 'Minimal', barWidth: '50%' },
  good: { color: 'green.400', label: 'Good', barWidth: '80%' },
  excellent: { color: 'green.300', label: 'Excellent', barWidth: '100%' },
}

type AcquireTab = 'sync' | 'capture' | null

interface ColumnClassifierRequirements {
  needsMore: boolean
  totalNeeded: number
  missingDigits: number[]
  message: string
}

interface BoundaryDetectorRequirements {
  needsMore: boolean
  totalNeeded: number
  message: string
}

type Requirements = ColumnClassifierRequirements | BoundaryDetectorRequirements

function hasDigitRequirements(req: Requirements): req is ColumnClassifierRequirements {
  return 'missingDigits' in req
}

function computeRequirements(samples: SamplesData | null): Requirements {
  if (!samples || !samples.hasData) {
    // Default to column classifier requirements when no data
    return {
      needsMore: true,
      totalNeeded: COLUMN_CLASSIFIER_REQUIREMENTS.minTotal,
      missingDigits: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
      message: `Need ${COLUMN_CLASSIFIER_REQUIREMENTS.minTotal}+ images total, ${COLUMN_CLASSIFIER_REQUIREMENTS.minPerDigit}+ per digit`,
    }
  }

  if (isColumnClassifierSamples(samples)) {
    // Column classifier requirements
    const digitCounts = Object.entries(samples.digits).map(([digit, data]) => ({
      digit: parseInt(digit, 10),
      count: data.count,
    }))

    const missingDigits = digitCounts
      .filter((d) => d.count < COLUMN_CLASSIFIER_REQUIREMENTS.minPerDigit)
      .map((d) => d.digit)

    const totalNeeded = Math.max(0, COLUMN_CLASSIFIER_REQUIREMENTS.minTotal - samples.totalImages)
    const needsMore =
      samples.totalImages < COLUMN_CLASSIFIER_REQUIREMENTS.minTotal || missingDigits.length > 0

    let message = ''
    if (needsMore) {
      const parts = []
      if (totalNeeded > 0) {
        parts.push(`${totalNeeded} more images`)
      }
      if (missingDigits.length > 0) {
        parts.push(
          `digits ${missingDigits.join(', ')} need ${COLUMN_CLASSIFIER_REQUIREMENTS.minPerDigit}+ each`
        )
      }
      message = `Need: ${parts.join('; ')}`
    }

    return { needsMore, totalNeeded, missingDigits, message }
  }
  // Boundary detector requirements
  const totalNeeded = Math.max(0, BOUNDARY_DETECTOR_REQUIREMENTS.minTotal - samples.totalFrames)
  const needsMore = samples.totalFrames < BOUNDARY_DETECTOR_REQUIREMENTS.minTotal

  const message = needsMore ? `Need ${totalNeeded} more frames` : ''

  return { needsMore, totalNeeded, message }
}

export function DataCard({
  samples,
  samplesLoading,
  modelType,
  onProgress,
  onSyncComplete,
  onDataWarningAcknowledged,
}: DataCardProps) {
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null)
  const [syncProgress, setSyncProgress] = useState<SyncProgress>({
    phase: 'idle',
    message: '',
  })
  const [syncChecking, setSyncChecking] = useState(true)
  const [activeTab, setActiveTab] = useState<AcquireTab>(null)
  const [showContinueWarning, setShowContinueWarning] = useState(false)
  const [hubModalOpen, setHubModalOpen] = useState(false)
  const [syncHistoryRefreshTrigger, setSyncHistoryRefreshTrigger] = useState(0)
  const [boundaryHubModalOpen, setBoundaryHubModalOpen] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const requirements = computeRequirements(samples)
  const isReady =
    samples?.hasData && samples.dataQuality !== 'none' && samples.dataQuality !== 'insufficient'
  const isSyncing = syncProgress.phase === 'connecting' || syncProgress.phase === 'syncing'

  // Auto-open capture tab for boundary detector (it's the primary way to add data)
  useEffect(() => {
    if (modelType === 'boundary-detector' && activeTab === null) {
      setActiveTab('capture')
    }
  }, [modelType, activeTab])

  const handleContinueAnyway = useCallback(() => {
    if (!samples?.hasData) return
    onDataWarningAcknowledged?.()
    onProgress()
  }, [samples, onProgress, onDataWarningAcknowledged])

  // Check sync availability on mount (and when modelType changes)
  useEffect(() => {
    const checkSync = async () => {
      setSyncChecking(true)
      try {
        const response = await fetch(`/api/vision-training/sync?modelType=${modelType}`)
        const data = await response.json()
        setSyncStatus(data)
      } catch {
        setSyncStatus({
          available: false,
          error: 'Failed to check sync status',
        })
      } finally {
        setSyncChecking(false)
      }
    }
    checkSync()
  }, [modelType])

  const startSync = useCallback(async () => {
    setSyncProgress({
      phase: 'connecting',
      message: 'Connecting to production...',
    })
    abortRef.current = new AbortController()

    try {
      const response = await fetch(`/api/vision-training/sync?modelType=${modelType}`, {
        method: 'POST',
        signal: abortRef.current.signal,
      })

      if (!response.ok) throw new Error('Failed to start sync')

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
            handleSyncEvent(eventType, data)
          }
        }
      }
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        setSyncProgress({ phase: 'idle', message: '' })
      } else {
        setSyncProgress({
          phase: 'error',
          message: error instanceof Error ? error.message : 'Sync failed',
        })
      }
    }
  }, [modelType])

  const handleSyncEvent = (eventType: string, data: Record<string, unknown>) => {
    switch (eventType) {
      case 'status':
        setSyncProgress({
          phase: data.phase as SyncProgress['phase'],
          message: data.message as string,
        })
        break
      case 'progress':
        setSyncProgress({
          phase: 'syncing',
          message: data.message as string,
          filesTransferred: data.filesTransferred as number,
          bytesTransferred: data.bytesTransferred as number,
        })
        break
      case 'complete':
        setSyncProgress({
          phase: 'complete',
          message: `Synced ${data.filesTransferred} files`,
          filesTransferred: data.filesTransferred as number,
        })
        setSyncStatus((prev) =>
          prev
            ? {
                ...prev,
                local: { totalImages: data.totalImages as number },
                needsSync: false,
                newOnRemote: 0,
              }
            : null
        )
        onSyncComplete?.()
        // Refresh sync history after successful sync
        setSyncHistoryRefreshTrigger((prev) => prev + 1)
        break
      case 'error':
        setSyncProgress({
          phase: 'error',
          message: data.message as string,
        })
        // Refresh sync history after failed sync too
        setSyncHistoryRefreshTrigger((prev) => prev + 1)
        break
    }
  }

  const cancelSync = useCallback(() => {
    abortRef.current?.abort()
    setSyncProgress({ phase: 'idle', message: '' })
  }, [])

  const toggleTab = (tab: AcquireTab) => {
    setActiveTab(activeTab === tab ? null : tab)
  }

  if (samplesLoading && syncChecking) {
    return (
      <div className={css({ textAlign: 'center', py: 4 })}>
        <span
          className={css({
            fontSize: 'lg',
            animation: 'spin 1s linear infinite',
          })}
        >
          ⏳
        </span>
        <div className={css({ color: 'gray.400', mt: 2 })}>Loading...</div>
      </div>
    )
  }

  const syncAvailable = syncStatus?.available
  const hasNewOnRemote = (syncStatus?.newOnRemote ?? 0) > 0

  return (
    <div>
      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 1: Current Data Status
          ═══════════════════════════════════════════════════════════════════ */}
      {samples?.hasData ? (
        <div className={css({ mb: 4 })}>
          {/* Count - different label for each model type */}
          <div
            className={css({
              fontSize: 'xl',
              fontWeight: 'bold',
              color: 'gray.100',
              mb: 3,
            })}
          >
            {isColumnClassifierSamples(samples)
              ? `${samples.totalImages.toLocaleString()} images`
              : `${samples.totalFrames.toLocaleString()} frames`}
          </div>

          {/* Quality indicator */}
          <div className={css({ mb: 3 })}>
            <div
              className={css({
                display: 'flex',
                justifyContent: 'space-between',
                mb: 1,
              })}
            >
              <span className={css({ fontSize: 'sm', color: 'gray.400' })}>Quality</span>
              <span
                className={css({
                  fontSize: 'sm',
                  fontWeight: 'medium',
                  color: QUALITY_CONFIG[samples.dataQuality].color,
                })}
              >
                {QUALITY_CONFIG[samples.dataQuality].label}
              </span>
            </div>
            <div
              className={css({
                height: '6px',
                bg: 'gray.700',
                borderRadius: 'full',
                overflow: 'hidden',
              })}
            >
              <div
                className={css({
                  height: '100%',
                  bg: QUALITY_CONFIG[samples.dataQuality].color,
                  borderRadius: 'full',
                  transition: 'width 0.3s ease',
                })}
                style={{ width: QUALITY_CONFIG[samples.dataQuality].barWidth }}
              />
            </div>
          </div>

          {/* Digit distribution mini-chart (column classifier only) */}
          {isColumnClassifierSamples(samples) && (
            <div className={css({ mb: 3 })}>
              <div className={css({ fontSize: 'xs', color: 'gray.500', mb: 2 })}>Distribution</div>
              <div
                className={css({
                  display: 'flex',
                  gap: 1,
                  justifyContent: 'space-between',
                })}
              >
                {Object.entries(samples.digits).map(([digit, data]) => {
                  const digitNum = parseInt(digit, 10)
                  const maxCount = Math.max(...Object.values(samples.digits).map((d) => d.count))
                  const barHeight = maxCount > 0 ? (data.count / maxCount) * 30 : 0
                  const isMissing =
                    hasDigitRequirements(requirements) &&
                    requirements.missingDigits.includes(digitNum)
                  return (
                    <div
                      key={digit}
                      className={css({
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        flex: 1,
                      })}
                    >
                      <div
                        className={css({
                          width: '100%',
                          bg: isMissing ? 'red.500' : 'blue.600',
                          borderRadius: 'sm',
                          transition: 'height 0.3s ease',
                        })}
                        style={{
                          height: `${Math.max(barHeight, isMissing ? 4 : 0)}px`,
                        }}
                      />
                      <span
                        className={css({
                          fontSize: 'xs',
                          color: isMissing ? 'red.400' : 'gray.500',
                          mt: 1,
                          fontWeight: isMissing ? 'bold' : 'normal',
                        })}
                      >
                        {digit}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Device info (boundary detector only) */}
          {!isColumnClassifierSamples(samples) && samples.deviceCount > 0 && (
            <div className={css({ mb: 3 })}>
              <div className={css({ fontSize: 'xs', color: 'gray.500', mb: 1 })}>Sources</div>
              <div className={css({ fontSize: 'sm', color: 'gray.400' })}>
                {samples.deviceCount} {samples.deviceCount === 1 ? 'device' : 'devices'}
              </div>
            </div>
          )}

          {/* Manage Data button - different modal for each model type */}
          {modelType === 'column-classifier' && (
            <button
              type="button"
              onClick={() => setHubModalOpen(true)}
              className={css({
                width: '100%',
                py: 2,
                mb: 3,
                bg: 'gray.700',
                color: 'gray.300',
                borderRadius: 'lg',
                border: 'none',
                cursor: 'pointer',
                fontSize: 'sm',
                fontWeight: 'medium',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2,
                _hover: { bg: 'gray.600', color: 'gray.100' },
              })}
            >
              <span>📁</span>
              <span>Manage Data</span>
              <span className={css({ color: 'gray.500' })}>→</span>
            </button>
          )}
          {modelType === 'boundary-detector' && (
            <button
              type="button"
              onClick={() => setBoundaryHubModalOpen(true)}
              className={css({
                width: '100%',
                py: 2,
                mb: 3,
                bg: 'gray.700',
                color: 'gray.300',
                borderRadius: 'lg',
                border: 'none',
                cursor: 'pointer',
                fontSize: 'sm',
                fontWeight: 'medium',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2,
                _hover: { bg: 'gray.600', color: 'gray.100' },
              })}
            >
              <span>🎯</span>
              <span>Manage Frames</span>
              <span className={css({ color: 'gray.500' })}>→</span>
            </button>
          )}

          {/* Requirements warning */}
          {requirements.needsMore && (
            <div
              className={css({
                p: 2,
                bg: 'yellow.900/30',
                border: '1px solid',
                borderColor: 'yellow.700/50',
                borderRadius: 'md',
                fontSize: 'sm',
                color: 'yellow.300',
              })}
            >
              ⚠️ {requirements.message}
            </div>
          )}
        </div>
      ) : (
        <div className={css({ textAlign: 'center', py: 4, mb: 4 })}>
          <div className={css({ fontSize: '2xl', mb: 2 })}>📷</div>
          <div className={css({ color: 'gray.300', mb: 2 })}>No training data yet</div>
          <div className={css({ fontSize: 'sm', color: 'gray.500', mb: 3 })}>
            {modelType === 'boundary-detector'
              ? 'Use the Capture tab below to collect frames'
              : requirements.message}
          </div>
          {/* Only show hub modal button for column classifier */}
          {modelType === 'column-classifier' && (
            <button
              type="button"
              onClick={() => setHubModalOpen(true)}
              className={css({
                py: 2,
                px: 4,
                bg: 'blue.600',
                color: 'white',
                borderRadius: 'lg',
                border: 'none',
                cursor: 'pointer',
                fontSize: 'sm',
                fontWeight: 'medium',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 2,
                _hover: { bg: 'blue.500' },
              })}
            >
              <span>📸</span>
              <span>Capture Training Data</span>
            </button>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 2: Get More Data (Tabbed)
          ═══════════════════════════════════════════════════════════════════ */}
      {!isSyncing && (
        <div
          className={css({
            mb: 4,
            border: '1px solid',
            borderColor: 'gray.700',
            borderRadius: 'lg',
            overflow: 'hidden',
          })}
        >
          {/* Section header */}
          <div
            className={css({
              px: 3,
              py: 2,
              bg: 'gray.800',
              borderBottom: '1px solid',
              borderColor: 'gray.700',
              fontSize: 'xs',
              fontWeight: 'medium',
              color: 'gray.400',
              textTransform: 'uppercase',
              letterSpacing: 'wide',
            })}
          >
            Get More Data
          </div>

          {/* Tab buttons */}
          <div className={css({ display: 'flex' })}>
            {/* Sync tab - available for both model types */}
            {syncAvailable && (
              <button
                type="button"
                onClick={() => toggleTab('sync')}
                className={css({
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 2,
                  py: 3,
                  px: 3,
                  bg: activeTab === 'sync' ? 'blue.900/40' : 'transparent',
                  borderBottom: activeTab === 'sync' ? '2px solid' : '2px solid transparent',
                  borderColor: activeTab === 'sync' ? 'blue.500' : 'transparent',
                  color: activeTab === 'sync' ? 'blue.300' : 'gray.400',
                  cursor: 'pointer',
                  fontSize: 'sm',
                  fontWeight: 'medium',
                  transition: 'all 0.2s',
                  _hover: { bg: 'gray.800', color: 'gray.200' },
                })}
              >
                <span>☁️</span>
                <span>Sync</span>
                {hasNewOnRemote && (
                  <span
                    className={css({
                      px: 1.5,
                      py: 0.5,
                      bg: 'green.600',
                      color: 'white',
                      borderRadius: 'full',
                      fontSize: 'xs',
                      fontWeight: 'bold',
                    })}
                  >
                    {syncStatus?.newOnRemote}
                  </span>
                )}
              </button>
            )}

            {/* Capture tab */}
            <button
              type="button"
              onClick={() => toggleTab('capture')}
              className={css({
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2,
                py: 3,
                px: 3,
                bg: activeTab === 'capture' ? 'blue.900/40' : 'transparent',
                borderBottom: activeTab === 'capture' ? '2px solid' : '2px solid transparent',
                borderColor: activeTab === 'capture' ? 'blue.500' : 'transparent',
                color: activeTab === 'capture' ? 'blue.300' : 'gray.400',
                cursor: 'pointer',
                fontSize: 'sm',
                fontWeight: 'medium',
                transition: 'all 0.2s',
                _hover: { bg: 'gray.800', color: 'gray.200' },
              })}
            >
              <span>📸</span>
              <span>Capture</span>
            </button>
          </div>

          {/* Tab content */}
          {activeTab === 'sync' && syncAvailable && (
            <div className={css({ p: 3, bg: 'gray.850' })}>
              {syncProgress.phase === 'complete' ? (
                <div
                  className={css({
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    color: 'green.400',
                    fontSize: 'sm',
                  })}
                >
                  <span>✅</span>
                  <span>{syncProgress.message}</span>
                </div>
              ) : (
                <>
                  <div
                    className={css({
                      fontSize: 'sm',
                      color: 'gray.400',
                      mb: 3,
                    })}
                  >
                    <strong className={css({ color: 'blue.400' })}>
                      {syncStatus?.remote?.totalImages?.toLocaleString() ?? 0}
                    </strong>{' '}
                    {modelType === 'boundary-detector' ? 'frames' : 'images'} on{' '}
                    {syncStatus?.remote?.host ?? 'production'}
                    {hasNewOnRemote && (
                      <span className={css({ color: 'green.400' })}>
                        {' '}
                        ({syncStatus?.newOnRemote} new)
                      </span>
                    )}
                    {!hasNewOnRemote &&
                      syncStatus?.newOnLocal !== undefined &&
                      syncStatus.newOnLocal > 0 && (
                        <span className={css({ color: 'gray.500' })}> (in sync)</span>
                      )}
                  </div>

                  {/* Show excluded count if any */}
                  {(syncStatus?.excludedByDeletion ?? 0) > 0 && (
                    <div
                      className={css({
                        fontSize: 'xs',
                        color: 'gray.500',
                        mb: 3,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                      })}
                    >
                      <span>🚫</span>
                      <span>
                        {syncStatus?.excludedByDeletion} files excluded (previously deleted locally)
                      </span>
                    </div>
                  )}

                  {/* Sync history indicator */}
                  <div className={css({ mb: 3 })}>
                    <SyncHistoryIndicator
                      modelType={modelType}
                      refreshTrigger={syncHistoryRefreshTrigger}
                    />
                  </div>

                  {syncProgress.phase === 'error' && (
                    <div
                      className={css({
                        color: 'red.400',
                        fontSize: 'sm',
                        mb: 3,
                      })}
                    >
                      {syncProgress.message}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={startSync}
                    disabled={!hasNewOnRemote}
                    className={css({
                      width: '100%',
                      py: 2,
                      bg: hasNewOnRemote ? 'blue.600' : 'gray.700',
                      color: hasNewOnRemote ? 'white' : 'gray.500',
                      borderRadius: 'lg',
                      border: 'none',
                      cursor: hasNewOnRemote ? 'pointer' : 'not-allowed',
                      fontWeight: 'medium',
                      fontSize: 'sm',
                      _hover: hasNewOnRemote ? { bg: 'blue.500' } : {},
                    })}
                  >
                    {hasNewOnRemote
                      ? `Download ${syncStatus?.newOnRemote} ${modelType === 'boundary-detector' ? 'Frames' : 'Images'}`
                      : 'Already in sync'}
                  </button>
                </>
              )}
            </div>
          )}

          {activeTab === 'capture' && (
            <div className={css({ p: 3, bg: 'gray.850' })}>
              {modelType === 'boundary-detector' ? (
                <BoundaryDataCapture onSamplesCollected={() => onSyncComplete?.()} />
              ) : (
                <TrainingDataCapture onSamplesCollected={() => onSyncComplete?.()} />
              )}
            </div>
          )}
        </div>
      )}

      {/* Syncing in progress (replaces tabs while syncing) */}
      {isSyncing && (
        <div
          className={css({
            mb: 4,
            p: 3,
            bg: 'blue.900/30',
            border: '1px solid',
            borderColor: 'blue.700',
            borderRadius: 'lg',
          })}
        >
          <div
            className={css({
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              mb: 2,
            })}
          >
            <span className={css({ animation: 'spin 1s linear infinite' })}>🔄</span>
            <span className={css({ fontSize: 'sm', color: 'gray.300' })}>
              {syncProgress.message}
            </span>
          </div>
          {syncProgress.filesTransferred !== undefined && syncProgress.filesTransferred > 0 && (
            <div className={css({ fontSize: 'xs', color: 'gray.500', mb: 3 })}>
              {syncProgress.filesTransferred} files transferred
            </div>
          )}
          <button
            type="button"
            onClick={cancelSync}
            className={css({
              width: '100%',
              py: 2,
              bg: 'transparent',
              color: 'gray.400',
              borderRadius: 'lg',
              border: '1px solid',
              borderColor: 'gray.600',
              cursor: 'pointer',
              fontSize: 'sm',
              _hover: { borderColor: 'gray.500', color: 'gray.300' },
            })}
          >
            Cancel
          </button>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 3: Continue Button
          ═══════════════════════════════════════════════════════════════════ */}
      {samples?.hasData && !isSyncing && (
        <div>
          {isReady ? (
            <>
              <div
                className={css({
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                  mb: 3,
                })}
              >
                <span className={css({ color: 'green.400' })}>✓</span>
                <span className={css({ color: 'green.400', fontSize: 'sm' })}>Ready to train</span>
              </div>
              <button
                type="button"
                onClick={onProgress}
                className={css({
                  width: '100%',
                  py: 2,
                  bg: 'green.600',
                  color: 'white',
                  borderRadius: 'lg',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: 'medium',
                  _hover: { bg: 'green.500' },
                })}
              >
                Continue →
              </button>
            </>
          ) : !showContinueWarning ? (
            <button
              type="button"
              onClick={() => setShowContinueWarning(true)}
              className={css({
                width: '100%',
                py: 2,
                bg: 'transparent',
                color: 'gray.400',
                borderRadius: 'lg',
                border: '1px solid',
                borderColor: 'gray.600',
                cursor: 'pointer',
                fontSize: 'sm',
                _hover: { borderColor: 'gray.500', color: 'gray.300' },
              })}
            >
              Continue anyway...
            </button>
          ) : (
            <div
              className={css({
                p: 3,
                bg: 'red.900/30',
                border: '1px solid',
                borderColor: 'red.700/50',
                borderRadius: 'lg',
              })}
            >
              <div className={css({ fontSize: 'sm', color: 'red.300', mb: 3 })}>
                ⚠️ <strong>Warning:</strong> Training with insufficient data may produce a poor
                model.
              </div>
              <div className={css({ display: 'flex', gap: 2 })}>
                <button
                  type="button"
                  onClick={() => setShowContinueWarning(false)}
                  className={css({
                    flex: 1,
                    py: 2,
                    bg: 'transparent',
                    color: 'gray.400',
                    borderRadius: 'md',
                    border: '1px solid',
                    borderColor: 'gray.600',
                    cursor: 'pointer',
                    fontSize: 'sm',
                    _hover: { borderColor: 'gray.500' },
                  })}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleContinueAnyway}
                  className={css({
                    flex: 1,
                    py: 2,
                    bg: 'red.700',
                    color: 'white',
                    borderRadius: 'md',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 'sm',
                    fontWeight: 'medium',
                    _hover: { bg: 'red.600' },
                  })}
                >
                  Continue Anyway
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Training Data Hub Modal (Column Classifier) */}
      <TrainingDataHubModal
        isOpen={hubModalOpen}
        onClose={() => setHubModalOpen(false)}
        onDataChanged={() => onSyncComplete?.()}
      />

      {/* Boundary Data Hub Modal (Boundary Detector) */}
      <BoundaryDataHubModal
        isOpen={boundaryHubModalOpen}
        onClose={() => setBoundaryHubModalOpen(false)}
        onDataChanged={() => onSyncComplete?.()}
      />
    </div>
  )
}
