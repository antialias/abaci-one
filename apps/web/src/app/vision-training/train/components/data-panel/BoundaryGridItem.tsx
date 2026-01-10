'use client'

import { css } from '../../../../../../styled-system/css'
import type { BoundaryDataItem } from './types'

export interface BoundaryGridItemProps {
  /** The boundary frame data */
  item: BoundaryDataItem
  /** Whether this item is selected */
  isSelected: boolean
  /** Click handler */
  onClick: () => void
}

/**
 * Grid item for boundary detector frames.
 * Shows the image with corner overlay.
 * Uses uniform 4:3 aspect ratio for grid consistency,
 * with objectFit: contain to preserve image proportions.
 */
export function BoundaryGridItem({ item, isSelected, onClick }: BoundaryGridItemProps) {
  return (
    <button
      type="button"
      data-item-id={item.id}
      onClick={onClick}
      className={css({
        position: 'relative',
        aspectRatio: '4/3',
        bg: 'gray.900',
        border: '2px solid',
        borderColor: isSelected ? 'purple.500' : 'gray.700',
        borderRadius: 'lg',
        overflow: 'hidden',
        cursor: 'pointer',
        _hover: { borderColor: 'purple.400' },
      })}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={item.imagePath}
        alt={`Frame ${item.id}`}
        className={css({
          width: '100%',
          height: '100%',
          objectFit: 'contain',
        })}
      />

      {/* Corner indicator - simple badge instead of overlay */}
      <div
        className={css({
          position: 'absolute',
          bottom: 1,
          right: 1,
          px: 1.5,
          py: 0.5,
          bg: 'purple.600/80',
          color: 'white',
          fontSize: 'xs',
          fontWeight: 'bold',
          borderRadius: 'sm',
        })}
      >
        4pt
      </div>
    </button>
  )
}
