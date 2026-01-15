'use client'

import { css } from '../../../../../../styled-system/css'
import type { ColumnDataItem } from './types'

export interface ColumnGridItemProps {
  /** The column image data */
  item: ColumnDataItem
  /** Whether this item is selected (for multi-select) */
  isSelected: boolean
  /** Whether this item is focused (showing in detail panel) */
  isFocused: boolean
  /** Handler for selection toggle (receives shiftKey for range selection) */
  onSelect: (shiftKey: boolean) => void
  /** Handler for viewing item details (double-click or button) */
  onViewDetails: () => void
  /** Handler for deleting this item */
  onDelete: () => void
}

/**
 * Grid item for column classifier images.
 * Shows the image with digit badge, selection checkbox, and hover actions.
 * Uses uniform square aspect ratio for grid consistency,
 * with objectFit: contain to preserve image proportions.
 */
export function ColumnGridItem({
  item,
  isSelected,
  isFocused,
  onSelect,
  onViewDetails,
  onDelete,
}: ColumnGridItemProps) {
  return (
    <div
      data-item-id={item.id}
      data-selected={isSelected}
      data-focused={isFocused}
      className={css({
        position: 'relative',
        aspectRatio: '1',
        bg: 'gray.900',
        border: '2px solid',
        borderColor: isFocused ? 'purple.500' : isSelected ? 'blue.500' : 'gray.700',
        borderRadius: 'lg',
        // Note: NO overflow:hidden here - allows dropdown to escape
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        _hover: {
          borderColor: isFocused ? 'purple.400' : isSelected ? 'blue.400' : 'gray.600',
          '& [data-element="hover-actions"]': {
            opacity: 1,
          },
        },
      })}
      onClick={(e) => onSelect(e.shiftKey)}
      onDoubleClick={onViewDetails}
    >
      {/* Image wrapper with overflow hidden for rounded corners */}
      <div
        data-element="image-wrapper"
        className={css({
          position: 'absolute',
          inset: 0,
          borderRadius: 'md',
          overflow: 'hidden',
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
      </div>

      {/* Selection checkbox indicator */}
      {isSelected && (
        <div
          data-element="selection-indicator"
          className={css({
            position: 'absolute',
            top: 1,
            left: 1,
            width: '20px',
            height: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bg: 'blue.500',
            color: 'white',
            borderRadius: 'sm',
            fontSize: 'xs',
            fontWeight: 'bold',
          })}
        >
          ✓
        </div>
      )}

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

      {/* Hover actions */}
      <div
        data-element="hover-actions"
        className={css({
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          display: 'flex',
          gap: 1,
          p: 1,
          bg: 'linear-gradient(transparent, rgba(0,0,0,0.8))',
          opacity: 0,
          transition: 'opacity 0.15s ease',
        })}
        onClick={(e) => e.stopPropagation()}
      >
        {/* View details button */}
        <button
          type="button"
          data-action="view-details"
          onClick={onViewDetails}
          className={css({
            flex: 1,
            py: 1,
            fontSize: '2xs',
            color: 'blue.400',
            bg: 'gray.900/80',
            border: 'none',
            borderRadius: 'sm',
            cursor: 'pointer',
            _hover: { bg: 'blue.900/80' },
          })}
        >
          👁
        </button>

        {/* Delete button */}
        <button
          type="button"
          data-action="delete-image"
          onClick={onDelete}
          className={css({
            flex: 1,
            py: 1,
            fontSize: '2xs',
            color: 'red.400',
            bg: 'gray.900/80',
            border: 'none',
            borderRadius: 'sm',
            cursor: 'pointer',
            _hover: { bg: 'red.900/80' },
          })}
        >
          🗑️
        </button>
      </div>
    </div>
  )
}
