'use client'

import { css } from '../../../../../../styled-system/css'
import type { ColumnDataItem } from './types'

export interface ColumnGridItemProps {
  /** The column image data */
  item: ColumnDataItem
  /** Whether this item is selected */
  isSelected: boolean
  /** Click handler */
  onClick: () => void
}

/**
 * Grid item for column classifier images.
 * Shows the image with digit badge.
 * Uses uniform square aspect ratio for grid consistency,
 * with objectFit: contain to preserve image proportions.
 */
export function ColumnGridItem({ item, isSelected, onClick }: ColumnGridItemProps) {
  return (
    <button
      type="button"
      data-item-id={item.id}
      onClick={onClick}
      className={css({
        position: 'relative',
        aspectRatio: '1',
        bg: 'gray.900',
        border: '2px solid',
        borderColor: isSelected ? 'blue.500' : 'gray.700',
        borderRadius: 'lg',
        overflow: 'hidden',
        cursor: 'pointer',
        _hover: { borderColor: 'blue.400' },
      })}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={item.imagePath}
        alt={`Digit ${item.digit}`}
        className={css({
          width: '100%',
          height: '100%',
          objectFit: 'contain',
        })}
      />

      {/* Digit badge */}
      <div
        className={css({
          position: 'absolute',
          bottom: 1,
          right: 1,
          px: 1.5,
          py: 0.5,
          bg: 'black/70',
          color: 'white',
          fontSize: 'xs',
          fontWeight: 'bold',
          borderRadius: 'sm',
        })}
      >
        {item.digit}
      </div>
    </button>
  )
}
