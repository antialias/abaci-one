'use client'

import { useState } from 'react'
import { css } from '../../../../../../styled-system/css'
import type { ColumnDataItem } from './types'
import { MiniColumnTester } from './MiniColumnTester'

export interface ColumnDetailContentProps {
  /** The selected column image */
  item: ColumnDataItem
  /** Handler to delete the item */
  onDelete: () => void
  /** Whether delete is in progress */
  isDeleting: boolean
  /** Handler to reclassify the item to a different digit */
  onReclassify: (newDigit: number) => void
  /** Whether reclassification is in progress */
  isReclassifying: boolean
}

/**
 * Detail content for column classifier images.
 * Shows preview, digit info, reclassify controls, and metadata.
 */
export function ColumnDetailContent({
  item,
  onDelete,
  isDeleting,
  onReclassify,
  isReclassifying,
}: ColumnDetailContentProps) {
  const [selectedNewDigit, setSelectedNewDigit] = useState<number | null>(null)

  const handleReclassify = () => {
    if (selectedNewDigit !== null && selectedNewDigit !== item.digit) {
      onReclassify(selectedNewDigit)
      setSelectedNewDigit(null)
    }
  }

  return (
    <div
      data-component="column-detail-content"
      className={css({
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        height: '100%',
        overflow: 'auto',
      })}
    >
      {/* Large preview */}
      <div
        className={css({
          position: 'relative',
          borderRadius: 'md',
          overflow: 'hidden',
          bg: 'gray.800',
        })}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.imagePath}
          alt={`Digit ${item.digit}`}
          className={css({ width: '100%', display: 'block' })}
        />

        {/* Current digit badge */}
        <div
          className={css({
            position: 'absolute',
            top: 2,
            right: 2,
            px: 3,
            py: 1,
            bg: 'blue.600',
            color: 'white',
            fontSize: 'lg',
            fontWeight: 'bold',
            borderRadius: 'md',
          })}
        >
          {item.digit}
        </div>
      </div>

      {/* Reclassify section */}
      <div
        className={css({
          p: 3,
          bg: 'gray.900',
          borderRadius: 'md',
          border: '1px solid',
          borderColor: 'gray.700',
        })}
      >
        <div className={css({ fontSize: 'sm', fontWeight: 'medium', color: 'gray.300', mb: 2 })}>
          Reclassify to different digit
        </div>

        {/* Digit selector */}
        <div className={css({ display: 'flex', gap: 1, mb: 3 })}>
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
            <button
              key={digit}
              type="button"
              onClick={() => setSelectedNewDigit(digit === item.digit ? null : digit)}
              disabled={digit === item.digit}
              className={css({
                flex: 1,
                py: 2,
                border: '2px solid',
                borderColor:
                  digit === item.digit
                    ? 'gray.600'
                    : selectedNewDigit === digit
                      ? 'green.500'
                      : 'gray.700',
                borderRadius: 'md',
                bg: selectedNewDigit === digit ? 'green.900/30' : 'gray.800',
                color:
                  digit === item.digit
                    ? 'gray.600'
                    : selectedNewDigit === digit
                      ? 'green.300'
                      : 'gray.300',
                fontSize: 'sm',
                fontWeight: 'bold',
                cursor: digit === item.digit ? 'not-allowed' : 'pointer',
                _hover: digit !== item.digit ? { borderColor: 'green.400' } : {},
              })}
            >
              {digit}
            </button>
          ))}
        </div>

        {/* Apply button */}
        <button
          type="button"
          onClick={handleReclassify}
          disabled={selectedNewDigit === null || isReclassifying}
          className={css({
            width: '100%',
            py: 2,
            bg: selectedNewDigit !== null ? 'green.600' : 'gray.700',
            color: selectedNewDigit !== null ? 'white' : 'gray.500',
            border: 'none',
            borderRadius: 'md',
            fontWeight: 'medium',
            cursor: selectedNewDigit !== null ? 'pointer' : 'not-allowed',
            _hover: selectedNewDigit !== null ? { bg: 'green.500' } : {},
            _disabled: { opacity: 0.5, cursor: 'not-allowed' },
          })}
        >
          {isReclassifying
            ? 'Moving...'
            : selectedNewDigit !== null
              ? `Move to digit ${selectedNewDigit}`
              : 'Select a digit to move'}
        </button>
      </div>

      {/* Model Tester */}
      <MiniColumnTester imagePath={item.imagePath} groundTruthDigit={item.digit} />

      {/* Metadata */}
      <div className={css({ fontSize: 'sm' })}>
        <div className={css({ color: 'gray.400', mb: 1 })}>Filename</div>
        <div className={css({ color: 'gray.200', fontFamily: 'mono', fontSize: 'xs' })}>
          {item.filename}
        </div>
      </div>

      <div className={css({ fontSize: 'sm' })}>
        <div className={css({ color: 'gray.400', mb: 1 })}>Captured</div>
        <div className={css({ color: 'gray.200' })}>
          {item.capturedAt ? new Date(item.capturedAt).toLocaleString() : 'Unknown'}
        </div>
      </div>

      <div className={css({ fontSize: 'sm' })}>
        <div className={css({ color: 'gray.400', mb: 1 })}>Device</div>
        <div className={css({ color: 'gray.200', fontFamily: 'mono', fontSize: 'xs' })}>
          {item.deviceId}
        </div>
      </div>

      {/* Delete button */}
      <button
        type="button"
        onClick={onDelete}
        disabled={isDeleting}
        className={css({
          mt: 'auto',
          py: 2,
          bg: 'red.600/20',
          color: 'red.400',
          border: '1px solid',
          borderColor: 'red.600/50',
          borderRadius: 'md',
          cursor: 'pointer',
          fontWeight: 'medium',
          _hover: { bg: 'red.600/30', borderColor: 'red.500' },
          _disabled: { opacity: 0.5, cursor: 'not-allowed' },
        })}
      >
        {isDeleting ? 'Deleting...' : '🗑️ Delete Image'}
      </button>
    </div>
  )
}
