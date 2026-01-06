'use client'

import { css } from '../../../../../../../styled-system/css'
import type { EpochData } from '../types'

interface TrainingCardProps {
  currentEpoch: EpochData | null
  totalEpochs: number
  bestAccuracy: number
  onCancel: () => void
}

export function TrainingCard({
  currentEpoch,
  totalEpochs,
  bestAccuracy,
  onCancel,
}: TrainingCardProps) {
  if (!currentEpoch) {
    return (
      <div className={css({ textAlign: 'center', py: 6 })}>
        <div className={css({ fontSize: '2xl', mb: 3, animation: 'spin 1s linear infinite' })}>
          🏋️
        </div>
        <div className={css({ color: 'gray.400' })}>Starting training...</div>
      </div>
    )
  }

  const progressPercent = Math.round((currentEpoch.epoch / currentEpoch.total_epochs) * 100)

  return (
    <div className={css({ textAlign: 'center' })}>
      {/* Epoch counter */}
      <div className={css({ fontSize: 'xs', color: 'gray.500', mb: 1 })}>
        Epoch {currentEpoch.epoch} of {totalEpochs}
      </div>

      {/* Main accuracy */}
      <div
        className={css({
          fontSize: '3xl',
          fontWeight: 'bold',
          color: 'green.400',
          mb: 0.5,
        })}
      >
        {(currentEpoch.val_accuracy * 100).toFixed(1)}%
      </div>
      <div className={css({ fontSize: 'xs', color: 'gray.500', mb: 3 })}>Validation Accuracy</div>

      {/* Progress bar */}
      <div className={css({ mb: 3 })}>
        <div
          className={css({
            height: '8px',
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
              transition: 'width 0.3s ease',
            })}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className={css({ fontSize: 'xs', color: 'gray.600', mt: 1 })}>
          {progressPercent}% complete
        </div>
      </div>

      {/* Metrics grid */}
      <div
        className={css({
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 2,
          p: 2,
          bg: 'gray.900',
          borderRadius: 'lg',
          fontSize: 'xs',
          mb: 4,
        })}
      >
        <div>
          <div className={css({ color: 'gray.600' })}>Loss</div>
          <div className={css({ fontFamily: 'mono', color: 'gray.300' })}>
            {currentEpoch.loss.toFixed(4)}
          </div>
        </div>
        <div>
          <div className={css({ color: 'gray.600' })}>Train Acc</div>
          <div className={css({ fontFamily: 'mono', color: 'gray.300' })}>
            {(currentEpoch.accuracy * 100).toFixed(1)}%
          </div>
        </div>
        <div>
          <div className={css({ color: 'gray.600' })}>Best</div>
          <div className={css({ fontFamily: 'mono', color: 'green.400' })}>
            {(bestAccuracy * 100).toFixed(1)}%
          </div>
        </div>
      </div>

      {/* Cancel button */}
      <button
        type="button"
        onClick={onCancel}
        className={css({
          px: 4,
          py: 2,
          bg: 'transparent',
          color: 'gray.500',
          fontSize: 'sm',
          borderRadius: 'lg',
          border: '1px solid',
          borderColor: 'gray.700',
          cursor: 'pointer',
          _hover: { borderColor: 'gray.600', color: 'gray.400' },
        })}
      >
        Cancel Training
      </button>
    </div>
  )
}
