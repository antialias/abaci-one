'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { css } from '../../../../../../../styled-system/css'
import type { PreflightInfo } from '../types'

interface DependencyCardProps {
  preflightInfo: PreflightInfo | null
  preflightLoading: boolean
  fetchPreflight: () => void
  onProgress: () => void
}

const AUTO_PROGRESS_DELAY = 2000

export function DependencyCard({
  preflightInfo,
  preflightLoading,
  fetchPreflight,
  onProgress,
}: DependencyCardProps) {
  const [countdown, setCountdown] = useState(AUTO_PROGRESS_DELAY)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const isReady = preflightInfo?.ready && !preflightLoading

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

  const handleSkip = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
    }
    onProgress()
  }, [onProgress])

  const handleRetry = useCallback(() => {
    fetchPreflight()
  }, [fetchPreflight])

  if (preflightLoading) {
    return (
      <div
        data-component="dependency-card"
        data-status="loading"
        className={css({ textAlign: 'center', py: 6 })}
      >
        <div
          className={css({
            fontSize: '2xl',
            mb: 2,
            animation: 'spin 1s linear infinite',
          })}
        >
          📦
        </div>
        <div className={css({ color: 'gray.400' })}>Checking dependencies...</div>
      </div>
    )
  }

  // Show error if there's a platform or venv issue
  if (preflightInfo && (!preflightInfo.platform.supported || preflightInfo.venv.error)) {
    const errorMessage = preflightInfo.platform.reason || preflightInfo.venv.error

    return (
      <div
        data-component="dependency-card"
        data-status="error"
        className={css({ textAlign: 'center', py: 4 })}
      >
        <div className={css({ fontSize: '2xl', mb: 2 })}>🚫</div>
        <div className={css({ color: 'red.400', mb: 2, fontWeight: 'medium' })}>
          Environment Error
        </div>
        <div className={css({ fontSize: 'sm', color: 'gray.400', mb: 4, px: 2 })}>
          {errorMessage}
        </div>
        <button
          type="button"
          onClick={handleRetry}
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
          Retry
        </button>
      </div>
    )
  }

  // Show missing dependencies
  if (preflightInfo && !preflightInfo.dependencies.allInstalled) {
    const { missing, installed, error } = preflightInfo.dependencies

    return (
      <div
        data-component="dependency-card"
        data-status="missing"
        className={css({ textAlign: 'center', py: 4 })}
      >
        <div className={css({ fontSize: '2xl', mb: 2 })}>⚠️</div>
        <div className={css({ color: 'yellow.400', mb: 2, fontWeight: 'medium' })}>
          Missing Dependencies
        </div>

        {error && (
          <div className={css({ fontSize: 'sm', color: 'red.400', mb: 3, px: 2 })}>{error}</div>
        )}

        {/* Missing packages */}
        <div className={css({ mb: 4 })}>
          <div
            className={css({
              fontSize: 'xs',
              color: 'gray.500',
              mb: 2,
              textTransform: 'uppercase',
            })}
          >
            Missing ({missing.length})
          </div>
          <div
            className={css({
              display: 'flex',
              flexWrap: 'wrap',
              gap: 1,
              justifyContent: 'center',
            })}
          >
            {missing.map((pkg) => (
              <span
                key={pkg.pipName}
                className={css({
                  px: 2,
                  py: 0.5,
                  bg: 'red.900/50',
                  color: 'red.300',
                  borderRadius: 'md',
                  fontSize: 'xs',
                  fontFamily: 'mono',
                })}
              >
                {pkg.name}
              </span>
            ))}
          </div>
        </div>

        {/* Installed packages */}
        {installed.length > 0 && (
          <div className={css({ mb: 4 })}>
            <div
              className={css({
                fontSize: 'xs',
                color: 'gray.500',
                mb: 2,
                textTransform: 'uppercase',
              })}
            >
              Installed ({installed.length})
            </div>
            <div
              className={css({
                display: 'flex',
                flexWrap: 'wrap',
                gap: 1,
                justifyContent: 'center',
              })}
            >
              {installed.map((pkg) => (
                <span
                  key={pkg.pipName}
                  className={css({
                    px: 2,
                    py: 0.5,
                    bg: 'green.900/50',
                    color: 'green.300',
                    borderRadius: 'md',
                    fontSize: 'xs',
                    fontFamily: 'mono',
                  })}
                >
                  {pkg.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className={css({ fontSize: 'xs', color: 'gray.500', mb: 4, px: 4 })}>
          Install missing packages manually, then retry:
          <div
            className={css({
              fontFamily: 'mono',
              mt: 1,
              color: 'gray.400',
              fontSize: 'xs',
              wordBreak: 'break-all',
            })}
          >
            pip install {missing.map((p) => p.pipName).join(' ')}
          </div>
        </div>

        <button
          type="button"
          onClick={handleRetry}
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
          Check Again
        </button>
      </div>
    )
  }

  if (!preflightInfo) {
    return (
      <div
        data-component="dependency-card"
        data-status="empty"
        className={css({ textAlign: 'center', py: 6 })}
      >
        <div className={css({ color: 'gray.500' })}>No dependency info</div>
        <button
          type="button"
          onClick={handleRetry}
          className={css({
            mt: 3,
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
          Check Dependencies
        </button>
      </div>
    )
  }

  // All dependencies installed!
  const { installed } = preflightInfo.dependencies
  const progressPercent = ((AUTO_PROGRESS_DELAY - countdown) / AUTO_PROGRESS_DELAY) * 100

  return (
    <div
      data-component="dependency-card"
      data-status="ready"
      className={css({ textAlign: 'center' })}
    >
      {/* Success Icon */}
      <div className={css({ fontSize: '3xl', mb: 2 })}>✅</div>

      {/* Title */}
      <div
        className={css({
          fontSize: 'xl',
          fontWeight: 'bold',
          color: 'gray.100',
          mb: 1,
        })}
      >
        All Dependencies Ready
      </div>

      {/* Badge */}
      <div
        className={css({
          display: 'inline-block',
          px: 3,
          py: 1,
          borderRadius: 'full',
          fontSize: 'sm',
          fontWeight: 'bold',
          bg: 'green.700',
          color: 'white',
          mb: 3,
        })}
      >
        {installed.length} packages installed
      </div>

      {/* Installed packages list */}
      <div className={css({ mb: 4 })}>
        <div
          className={css({
            display: 'flex',
            flexWrap: 'wrap',
            gap: 1,
            justifyContent: 'center',
          })}
        >
          {installed.map((pkg) => (
            <span
              key={pkg.pipName}
              className={css({
                px: 2,
                py: 0.5,
                bg: 'green.900/50',
                color: 'green.300',
                borderRadius: 'md',
                fontSize: 'xs',
                fontFamily: 'mono',
              })}
            >
              {pkg.name}
            </span>
          ))}
        </div>
      </div>

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
              bg: 'green.500',
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
    </div>
  )
}
