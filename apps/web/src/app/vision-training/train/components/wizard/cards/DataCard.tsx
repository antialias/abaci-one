'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { css } from '../../../../../../../styled-system/css'
import type { SamplesData } from '../types'
import { TrainingDataCapture } from '../../TrainingDataCapture'

interface DataCardProps {
  samples: SamplesData | null
  samplesLoading: boolean
  onProgress: () => void
  onSyncComplete?: () => void // Callback to refresh samples after sync
}

// Training data requirements
const REQUIREMENTS = {
  minTotal: 50, // Minimum total images
  minPerDigit: 3, // Minimum per digit
  goodTotal: 200, // Good total
  goodPerDigit: 10, // Good per digit
}

interface SyncStatus {
  available: boolean
  remote?: { host: string; totalImages: number }
  local?: { totalImages: number }
  needsSync?: boolean
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

/**
 * Compute what's missing from the training data
 */
function computeRequirements(samples: SamplesData | null): {
  needsMore: boolean
  totalNeeded: number
  missingDigits: number[]
  message: string
} {
  if (!samples || !samples.hasData) {
    return {
      needsMore: true,
      totalNeeded: REQUIREMENTS.minTotal,
      missingDigits: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
      message: `Need ${REQUIREMENTS.minTotal}+ images total, ${REQUIREMENTS.minPerDigit}+ per digit`,
    }
  }

  const digitCounts = Object.entries(samples.digits).map(([digit, data]) => ({
    digit: parseInt(digit, 10),
    count: data.count,
  }))

  const missingDigits = digitCounts
    .filter((d) => d.count < REQUIREMENTS.minPerDigit)
    .map((d) => d.digit)

  const totalNeeded = Math.max(0, REQUIREMENTS.minTotal - samples.totalImages)
  const needsMore = samples.totalImages < REQUIREMENTS.minTotal || missingDigits.length > 0

  let message = ''
  if (needsMore) {
    const parts = []
    if (totalNeeded > 0) {
      parts.push(`${totalNeeded} more images`)
    }
    if (missingDigits.length > 0) {
      parts.push(`digits ${missingDigits.join(', ')} need ${REQUIREMENTS.minPerDigit}+ each`)
    }
    message = `Need: ${parts.join('; ')}`
  }

  return { needsMore, totalNeeded, missingDigits, message }
}

export function DataCard({ samples, samplesLoading, onProgress, onSyncComplete }: DataCardProps) {
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null)
  const [syncProgress, setSyncProgress] = useState<SyncProgress>({ phase: 'idle', message: '' })
  const [syncChecking, setSyncChecking] = useState(true)
  const [showCapture, setShowCapture] = useState(false)
  const [showContinueWarning, setShowContinueWarning] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const requirements = computeRequirements(samples)
  const isReady =
    samples?.hasData && samples.dataQuality !== 'none' && samples.dataQuality !== 'insufficient'
  const isSyncing = syncProgress.phase === 'connecting' || syncProgress.phase === 'syncing'

  // Handle continue with insufficient data
  const handleContinueAnyway = useCallback(() => {
    if (!samples?.hasData) {
      // Can't continue with zero data
      return
    }
    onProgress()
  }, [samples, onProgress])

  // Check sync availability on mount
  useEffect(() => {
    const checkSync = async () => {
      setSyncChecking(true)
      try {
        const response = await fetch('/api/vision-training/sync')
        const data = await response.json()
        setSyncStatus(data)
      } catch {
        setSyncStatus({ available: false, error: 'Failed to check sync status' })
      } finally {
        setSyncChecking(false)
      }
    }
    checkSync()
  }, [])

  // Start sync
  const startSync = useCallback(async () => {
    setSyncProgress({ phase: 'connecting', message: 'Connecting to production...' })
    abortRef.current = new AbortController()

    try {
      const response = await fetch('/api/vision-training/sync', {
        method: 'POST',
        signal: abortRef.current.signal,
      })

      if (!response.ok) {
        throw new Error('Failed to start sync')
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
  }, [])

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
        // Update sync status with new local counts
        setSyncStatus((prev) =>
          prev
            ? {
                ...prev,
                local: { totalImages: data.totalImages as number },
                needsSync: false,
              }
            : null
        )
        // Trigger parent to refresh samples
        onSyncComplete?.()
        break
      case 'error':
        setSyncProgress({
          phase: 'error',
          message: data.message as string,
        })
        break
    }
  }

  const cancelSync = useCallback(() => {
    abortRef.current?.abort()
    setSyncProgress({ phase: 'idle', message: '' })
  }, [])

  if (samplesLoading && syncChecking) {
    return (
      <div className={css({ textAlign: 'center', py: 4 })}>
        <span className={css({ fontSize: 'lg', animation: 'spin 1s linear infinite' })}>⏳</span>
        <div className={css({ color: 'gray.400', mt: 2 })}>Loading...</div>
      </div>
    )
  }

  // Show sync UI prominently if sync is available and needed
  const showSyncUI = syncStatus?.available && (syncStatus.needsSync || !samples?.hasData)

  return (
    <div>
      {/* Sync from Production Section */}
      {showSyncUI && syncProgress.phase !== 'complete' && (
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
          <div className={css({ display: 'flex', alignItems: 'center', gap: 2, mb: 2 })}>
            <span>☁️</span>
            <span className={css({ fontWeight: 'medium', color: 'blue.300' })}>
              Production Data Available
            </span>
          </div>

          {syncStatus.remote && (
            <div className={css({ fontSize: 'sm', color: 'gray.400', mb: 3 })}>
              <strong className={css({ color: 'blue.400' })}>
                {syncStatus.remote.totalImages.toLocaleString()}
              </strong>{' '}
              images on {syncStatus.remote.host}
              {syncStatus.local && syncStatus.local.totalImages > 0 && (
                <span>
                  {' '}
                  ({(syncStatus.remote.totalImages - syncStatus.local.totalImages).toLocaleString()}{' '}
                  new)
                </span>
              )}
            </div>
          )}

          {/* Sync progress */}
          {isSyncing && (
            <div className={css({ mb: 3 })}>
              <div className={css({ display: 'flex', alignItems: 'center', gap: 2, mb: 2 })}>
                <span className={css({ animation: 'spin 1s linear infinite' })}>🔄</span>
                <span className={css({ fontSize: 'sm', color: 'gray.300' })}>
                  {syncProgress.message}
                </span>
              </div>
              {syncProgress.filesTransferred !== undefined && syncProgress.filesTransferred > 0 && (
                <div className={css({ fontSize: 'xs', color: 'gray.500' })}>
                  {syncProgress.filesTransferred} files transferred
                </div>
              )}
            </div>
          )}

          {/* Error state */}
          {syncProgress.phase === 'error' && (
            <div className={css({ color: 'red.400', fontSize: 'sm', mb: 3 })}>
              {syncProgress.message}
            </div>
          )}

          {/* Action buttons */}
          <div className={css({ display: 'flex', gap: 2 })}>
            {!isSyncing ? (
              <>
                <button
                  type="button"
                  onClick={startSync}
                  className={css({
                    flex: 1,
                    py: 2,
                    bg: 'blue.600',
                    color: 'white',
                    borderRadius: 'lg',
                    border: 'none',
                    cursor: 'pointer',
                    fontWeight: 'medium',
                    _hover: { bg: 'blue.500' },
                  })}
                >
                  Sync Now
                </button>
                {samples?.hasData && (
                  <button
                    type="button"
                    onClick={onProgress}
                    className={css({
                      px: 4,
                      py: 2,
                      bg: 'transparent',
                      color: 'gray.400',
                      borderRadius: 'lg',
                      border: '1px solid',
                      borderColor: 'gray.600',
                      cursor: 'pointer',
                      _hover: { borderColor: 'gray.500', color: 'gray.300' },
                    })}
                  >
                    Skip
                  </button>
                )}
              </>
            ) : (
              <button
                type="button"
                onClick={cancelSync}
                className={css({
                  flex: 1,
                  py: 2,
                  bg: 'transparent',
                  color: 'gray.400',
                  borderRadius: 'lg',
                  border: '1px solid',
                  borderColor: 'gray.600',
                  cursor: 'pointer',
                  _hover: { borderColor: 'gray.500', color: 'gray.300' },
                })}
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      )}

      {/* Sync complete message */}
      {syncProgress.phase === 'complete' && (
        <div
          className={css({
            mb: 4,
            p: 3,
            bg: 'green.900/30',
            border: '1px solid',
            borderColor: 'green.700',
            borderRadius: 'lg',
            display: 'flex',
            alignItems: 'center',
            gap: 2,
          })}
        >
          <span>✅</span>
          <span className={css({ color: 'green.400', fontSize: 'sm' })}>
            {syncProgress.message}
          </span>
        </div>
      )}

      {/* Inline capture toggle - always show when not syncing */}
      {!isSyncing && (
        <div className={css({ mb: 4 })}>
          <button
            type="button"
            onClick={() => setShowCapture(!showCapture)}
            className={css({
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              width: '100%',
              py: 2,
              px: 3,
              bg: showCapture ? 'blue.700/30' : 'gray.700/50',
              color: showCapture ? 'blue.300' : 'gray.300',
              borderRadius: 'lg',
              border: '1px solid',
              borderColor: showCapture ? 'blue.600' : 'gray.600',
              cursor: 'pointer',
              fontSize: 'sm',
              fontWeight: 'medium',
              transition: 'all 0.2s',
              _hover: { bg: showCapture ? 'blue.700/40' : 'gray.700' },
            })}
          >
            <span>{showCapture ? '📸' : '➕'}</span>
            <span>{showCapture ? 'Capturing...' : 'Capture Training Data'}</span>
            <span className={css({ ml: 'auto', fontSize: 'xs', color: 'gray.500' })}>
              {showCapture ? '▼' : '▶'}
            </span>
          </button>

          {showCapture && (
            <div className={css({ mt: 3 })}>
              <TrainingDataCapture onSamplesCollected={() => onSyncComplete?.()} />
            </div>
          )}
        </div>
      )}

      {/* No data state */}
      {!samples?.hasData && !showCapture && (
        <div className={css({ textAlign: 'center', py: 4 })}>
          <div className={css({ fontSize: '2xl', mb: 2 })}>📷</div>
          <div className={css({ color: 'gray.300', mb: 2 })}>No training data collected yet</div>
          <div className={css({ fontSize: 'sm', color: 'gray.500' })}>{requirements.message}</div>
        </div>
      )}

      {/* Show local data stats */}
      {samples?.hasData && (
        <>
          {/* Image count */}
          <div className={css({ fontSize: 'xl', fontWeight: 'bold', color: 'gray.100', mb: 3 })}>
            {samples.totalImages.toLocaleString()} images
          </div>

          {/* Quality indicator */}
          <div className={css({ mb: 4 })}>
            <div className={css({ display: 'flex', justifyContent: 'space-between', mb: 1 })}>
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

          {/* Digit distribution mini-chart */}
          <div className={css({ mb: 4 })}>
            <div className={css({ fontSize: 'xs', color: 'gray.500', mb: 2 })}>Distribution</div>
            <div className={css({ display: 'flex', gap: 1, justifyContent: 'space-between' })}>
              {Object.entries(samples.digits).map(([digit, data]) => {
                const digitNum = parseInt(digit, 10)
                const maxCount = Math.max(...Object.values(samples.digits).map((d) => d.count))
                const barHeight = maxCount > 0 ? (data.count / maxCount) * 30 : 0
                const isMissing = requirements.missingDigits.includes(digitNum)
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
                      style={{ height: `${Math.max(barHeight, isMissing ? 4 : 0)}px` }}
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

          {/* Requirements message when insufficient */}
          {requirements.needsMore && (
            <div
              className={css({
                mb: 3,
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

          {/* Ready indicator and continue */}
          {!isSyncing && (
            <div className={css({ mt: 4 })}>
              {isReady ? (
                <>
                  <div className={css({ display: 'flex', alignItems: 'center', gap: 2, mb: 3 })}>
                    <span className={css({ color: 'green.400' })}>✓</span>
                    <span className={css({ color: 'green.400', fontSize: 'sm' })}>
                      Ready to train
                    </span>
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
              ) : (
                <>
                  {/* Continue anyway with warning */}
                  {!showContinueWarning ? (
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
                        ⚠️ <strong>Warning:</strong> Training with insufficient data may produce a
                        poor model. Results may be inaccurate.
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
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
