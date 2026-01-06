'use client'

import { useEffect, useRef, useState } from 'react'
import { css } from '../../../../../../../styled-system/css'
import type { HardwareInfo } from '../types'

interface HardwareCardProps {
  hardwareInfo: HardwareInfo | null
  hardwareLoading: boolean
  fetchHardware: () => void
  onProgress: () => void
}

const AUTO_PROGRESS_DELAY = 2000

export function HardwareCard({
  hardwareInfo,
  hardwareLoading,
  fetchHardware,
  onProgress,
}: HardwareCardProps) {
  const [countdown, setCountdown] = useState(AUTO_PROGRESS_DELAY)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const isReady = hardwareInfo && !hardwareInfo.error && !hardwareLoading

  // Auto-progress countdown
  useEffect(() => {
    if (!isReady) {
      setCountdown(AUTO_PROGRESS_DELAY)
      return
    }

    // Start countdown
    const startTime = Date.now()
    const tick = () => {
      const elapsed = Date.now() - startTime
      const remaining = Math.max(0, AUTO_PROGRESS_DELAY - elapsed)
      setCountdown(remaining)

      if (remaining <= 0) {
        onProgress()
      } else {
        timerRef.current = setTimeout(tick, 50)
      }
    }

    timerRef.current = setTimeout(tick, 50)

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
    }
  }, [isReady, onProgress])

  const handleSkip = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
    }
    onProgress()
  }

  if (hardwareLoading) {
    return (
      <div className={css({ textAlign: 'center', py: 6 })}>
        <div className={css({ fontSize: '2xl', mb: 2, animation: 'spin 1s linear infinite' })}>
          ⚙️
        </div>
        <div className={css({ color: 'gray.400' })}>Detecting hardware...</div>
      </div>
    )
  }

  if (hardwareInfo?.error) {
    const isUnsupportedPlatform = hardwareInfo.device === 'unsupported'

    return (
      <div className={css({ textAlign: 'center', py: 4 })}>
        <div className={css({ fontSize: '2xl', mb: 2 })}>{isUnsupportedPlatform ? '🚫' : '⚠️'}</div>
        <div className={css({ color: isUnsupportedPlatform ? 'yellow.400' : 'red.400', mb: 2 })}>
          {isUnsupportedPlatform ? 'Platform Not Supported' : 'Hardware setup failed'}
        </div>
        <div className={css({ fontSize: 'sm', color: 'gray.400', mb: 4, px: 2 })}>
          {isUnsupportedPlatform
            ? 'Training requires macOS, Linux x86_64, or Windows. Run training on your local development machine instead.'
            : hardwareInfo.error}
        </div>
        {!isUnsupportedPlatform && (
          <button
            type="button"
            onClick={fetchHardware}
            className={css({
              px: 4,
              py: 2,
              bg: 'blue.600',
              color: 'white',
              borderRadius: 'lg',
              border: 'none',
              cursor: 'pointer',
              _hover: { bg: 'blue.500' },
            })}
          >
            Retry Detection
          </button>
        )}
      </div>
    )
  }

  if (!hardwareInfo) {
    return (
      <div className={css({ textAlign: 'center', py: 6 })}>
        <div className={css({ color: 'gray.500' })}>No hardware detected</div>
      </div>
    )
  }

  const isGpu = hardwareInfo.deviceType === 'gpu'
  const progressPercent = ((AUTO_PROGRESS_DELAY - countdown) / AUTO_PROGRESS_DELAY) * 100

  return (
    <div className={css({ textAlign: 'center' })}>
      {/* Device Icon */}
      <div className={css({ fontSize: '3xl', mb: 2 })}>{isGpu ? '⚡' : '💻'}</div>

      {/* Device Name */}
      <div className={css({ fontSize: 'xl', fontWeight: 'bold', color: 'gray.100', mb: 1 })}>
        {hardwareInfo.deviceName}
      </div>

      {/* Device Type Badge */}
      <div
        className={css({
          display: 'inline-block',
          px: 3,
          py: 1,
          borderRadius: 'full',
          fontSize: 'sm',
          fontWeight: 'bold',
          bg: isGpu ? 'green.700' : 'blue.700',
          color: 'white',
          mb: 3,
        })}
      >
        {hardwareInfo.deviceType.toUpperCase()}
        {isGpu && ' Acceleration'}
      </div>

      {/* Hint */}
      <div className={css({ fontSize: 'sm', color: 'gray.400', mb: 4 })}>
        {isGpu ? 'Training will be fast!' : 'CPU training available'}
      </div>

      {/* TensorFlow version */}
      {typeof hardwareInfo.details?.tensorflowVersion === 'string' && (
        <div className={css({ fontSize: 'xs', color: 'gray.500', mb: 4 })}>
          TensorFlow {hardwareInfo.details.tensorflowVersion}
        </div>
      )}

      {/* Auto-progress bar */}
      <div className={css({ mb: 3 })}>
        <div
          className={css({
            height: '4px',
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
              transition: 'width 0.05s linear',
            })}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Continue button */}
      <button
        type="button"
        onClick={handleSkip}
        className={css({
          width: '100%',
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
        Continue →
      </button>
    </div>
  )
}
