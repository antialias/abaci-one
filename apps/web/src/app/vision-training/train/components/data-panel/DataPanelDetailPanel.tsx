'use client'

import { css } from '../../../../../../styled-system/css'
import type { ModelType } from '../wizard/types'
import type { AnyDataItem, ColumnDataItem } from './types'
import { isBoundaryDataItem, isColumnDataItem } from './types'
import { BoundaryDetailContent } from './BoundaryDetailContent'
import { ColumnDetailContent } from './ColumnDetailContent'

export interface DataPanelDetailPanelProps {
  /** Model type */
  modelType: ModelType
  /** Selected item (or null if nothing selected) */
  selectedItem: AnyDataItem | null
  /** Handler to close the detail panel */
  onClose: () => void
  /** Handler to delete the selected item */
  onDelete: (item: AnyDataItem) => void
  /** Whether delete is in progress */
  isDeleting: boolean
  /** Handler to reclassify (column classifier only) */
  onReclassify?: (item: ColumnDataItem, newDigit: number) => void
  /** Whether reclassification is in progress */
  isReclassifying?: boolean
}

/**
 * Shared detail panel that renders model-specific content.
 * Shows when an item is selected from the grid.
 */
export function DataPanelDetailPanel({
  modelType,
  selectedItem,
  onClose,
  onDelete,
  isDeleting,
  onReclassify,
  isReclassifying = false,
}: DataPanelDetailPanelProps) {
  if (!selectedItem) return null

  return (
    <div
      data-component="data-panel-detail"
      className={css({
        width: '320px',
        flexShrink: 0,
        bg: 'gray.800',
        borderRadius: 'lg',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      })}
    >
      {/* Header with close button */}
      <div
        className={css({
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          p: 3,
          borderBottom: '1px solid',
          borderColor: 'gray.700',
        })}
      >
        <div className={css({ fontWeight: 'medium', color: 'gray.200' })}>
          {modelType === 'boundary-detector' ? 'Frame Details' : 'Image Details'}
        </div>
        <button
          type="button"
          onClick={onClose}
          className={css({
            p: 1,
            bg: 'transparent',
            border: 'none',
            color: 'gray.400',
            cursor: 'pointer',
            borderRadius: 'md',
            _hover: { bg: 'gray.700', color: 'gray.200' },
          })}
        >
          ✕
        </button>
      </div>

      {/* Content area */}
      <div className={css({ flex: 1, p: 4, overflow: 'auto' })}>
        {modelType === 'boundary-detector' && isBoundaryDataItem(selectedItem) && (
          <BoundaryDetailContent
            item={selectedItem}
            onDelete={() => onDelete(selectedItem)}
            isDeleting={isDeleting}
          />
        )}

        {modelType === 'column-classifier' && isColumnDataItem(selectedItem) && (
          <ColumnDetailContent
            item={selectedItem}
            onDelete={() => onDelete(selectedItem)}
            isDeleting={isDeleting}
            onReclassify={(newDigit) => onReclassify?.(selectedItem, newDigit)}
            isReclassifying={isReclassifying}
          />
        )}
      </div>
    </div>
  )
}
