'use client'

import { css } from '../../../../../../../styled-system/css'
import type { DatasetInfo } from '../types'

interface LoadingCardProps {
  datasetInfo: DatasetInfo | null
  message: string
}

export function LoadingCard({ datasetInfo, message }: LoadingCardProps) {
  return (
    <div className={css({ textAlign: 'center', py: 6 })}>
      <div className={css({ fontSize: '2xl', mb: 3, animation: 'spin 1s linear infinite' })}>📥</div>
      <div className={css({ fontSize: 'lg', fontWeight: 'medium', color: 'gray.200', mb: 2 })}>
        Loading Dataset
      </div>
      <div className={css({ color: 'gray.400', fontSize: 'sm', mb: 3 })}>
        {message || 'Loading training images...'}
      </div>

      {datasetInfo && (
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
            {datasetInfo.total_images.toLocaleString()}
          </span>
          <span className={css({ color: 'gray.400' })}> images loaded</span>
        </div>
      )}
    </div>
  )
}
