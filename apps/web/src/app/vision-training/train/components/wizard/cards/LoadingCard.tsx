'use client'

import { css } from '../../../../../../../styled-system/css'
import type { DatasetInfo, LoadingProgress } from '../types'
import { isColumnClassifierDatasetInfo, isBoundaryDetectorDatasetInfo } from '../types'

interface LoadingCardProps {
  datasetInfo: DatasetInfo | null
  loadingProgress: LoadingProgress | null
  message: string
}

export function LoadingCard({ datasetInfo, loadingProgress, message }: LoadingCardProps) {
  // Get display text based on dataset type
  const getDatasetDisplayInfo = () => {
    if (!datasetInfo) return null

    if (isColumnClassifierDatasetInfo(datasetInfo)) {
      return {
        count: datasetInfo.total_images.toLocaleString(),
        label: 'images loaded',
        augmented: false,
        rawCount: null,
      }
    }

    if (isBoundaryDetectorDatasetInfo(datasetInfo)) {
      return {
        count: datasetInfo.total_frames.toLocaleString(),
        label: 'frames loaded',
        augmented: datasetInfo.color_augmentation_enabled || false,
        rawCount: datasetInfo.raw_frames?.toLocaleString() || null,
      }
    }

    return null
  }

  const displayInfo = getDatasetDisplayInfo()

  // Calculate progress percentage
  const progressPercent =
    loadingProgress && loadingProgress.total > 0
      ? Math.round((loadingProgress.current / loadingProgress.total) * 100)
      : 0

  // Get step label for display
  const getStepLabel = () => {
    if (!loadingProgress) return null
    switch (loadingProgress.step) {
      case 'scanning':
        return 'Scanning files'
      case 'loading_raw':
        return 'Loading raw frames'
      case 'augmenting':
        return 'Augmenting data'
      case 'finalizing':
        return 'Finalizing'
      default:
        return 'Processing'
    }
  }

  return (
    <div className={css({ textAlign: 'center', py: 4 })}>
      <div
        className={css({
          fontSize: '2xl',
          mb: 3,
          animation: 'spin 1s linear infinite',
        })}
      >
        📥
      </div>
      <div
        className={css({
          fontSize: 'lg',
          fontWeight: 'medium',
          color: 'gray.200',
          mb: 2,
        })}
      >
        Loading Dataset
      </div>

      {/* Progress bar and counts */}
      {loadingProgress && loadingProgress.total > 0 && (
        <div className={css({ mb: 3 })}>
          {/* Step label - use message if available, otherwise fallback to step label */}
          <div className={css({ fontSize: 'xs', color: 'gray.500', mb: 1 })}>
            {loadingProgress.message || getStepLabel()}
          </div>

          {/* Progress bar */}
          <div
            className={css({
              height: '8px',
              bg: 'gray.700',
              borderRadius: 'full',
              overflow: 'hidden',
              mb: 1,
            })}
          >
            <div
              className={css({
                height: '100%',
                bg: 'blue.500',
                borderRadius: 'full',
                transition: 'width 0.2s ease',
              })}
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Progress text */}
          <div className={css({ fontSize: 'sm', color: 'gray.400' })}>
            <span className={css({ color: 'blue.400', fontWeight: 'medium' })}>
              {loadingProgress.current.toLocaleString()}
            </span>
            <span className={css({ color: 'gray.600' })}> / </span>
            <span>{loadingProgress.total.toLocaleString()}</span>
            <span className={css({ color: 'gray.600', ml: 2 })}>({progressPercent}%)</span>
          </div>
        </div>
      )}

      {/* Status message when no progress data */}
      {!loadingProgress && (
        <div className={css({ color: 'gray.400', fontSize: 'sm', mb: 3 })}>
          {message || 'Loading training data...'}
        </div>
      )}

      {/* Final loaded count (shown when dataset_loaded fires) */}
      {displayInfo && (
        <div
          className={css({
            display: 'inline-flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 1,
          })}
        >
          <div
            className={css({
              display: 'inline-block',
              px: 3,
              py: 1.5,
              bg: 'gray.700',
              borderRadius: 'lg',
              fontSize: 'sm',
            })}
          >
            <span className={css({ color: 'blue.400', fontWeight: 'bold' })}>
              {displayInfo.count}
            </span>
            <span className={css({ color: 'gray.400' })}> {displayInfo.label}</span>
          </div>
          {displayInfo.augmented && displayInfo.rawCount && (
            <div className={css({ fontSize: 'xs', color: 'gray.500' })}>
              <span className={css({ color: 'green.400' })}>🎨</span> Color augmentation from{' '}
              {displayInfo.rawCount} originals
            </div>
          )}
        </div>
      )}
    </div>
  )
}
