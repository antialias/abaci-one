'use client'

import { css } from '../../../../../../../styled-system/css'
import type { DatasetInfo } from '../types'
import { isColumnClassifierDatasetInfo, isBoundaryDetectorDatasetInfo } from '../types'

interface LoadingCardProps {
  datasetInfo: DatasetInfo | null
  message: string
}

export function LoadingCard({ datasetInfo, message }: LoadingCardProps) {
  // Get display text based on dataset type
  const getDatasetDisplayInfo = () => {
    if (!datasetInfo) return null

    if (isColumnClassifierDatasetInfo(datasetInfo)) {
      return {
        count: datasetInfo.total_images.toLocaleString(),
        label: 'images loaded',
      }
    }

    if (isBoundaryDetectorDatasetInfo(datasetInfo)) {
      return {
        count: datasetInfo.total_frames.toLocaleString(),
        label: 'frames loaded',
      }
    }

    return null
  }

  const displayInfo = getDatasetDisplayInfo()

  return (
    <div className={css({ textAlign: 'center', py: 6 })}>
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
      <div className={css({ color: 'gray.400', fontSize: 'sm', mb: 3 })}>
        {message || 'Loading training data...'}
      </div>

      {displayInfo && (
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
      )}
    </div>
  )
}
