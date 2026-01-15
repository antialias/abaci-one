'use client'

import type { ReactNode } from 'react'
import { css } from '../../../styled-system/css'

// ============================================================================
// Types
// ============================================================================

export interface CalibrationControlsProps {
  /** Called when rotate left is clicked */
  onRotateLeft: () => void
  /** Called when rotate right is clicked */
  onRotateRight: () => void
  /** Called when cancel is clicked */
  onCancel: () => void
  /** Called when done is clicked */
  onDone: () => void
  /** Whether controls are disabled */
  isDisabled?: boolean
  /** Number of columns being calibrated */
  columnCount?: number
  /** Show compact version (no instructions text) */
  compact?: boolean
}

// ============================================================================
// Component
// ============================================================================

/**
 * CalibrationControls - Control buttons for calibration mode
 *
 * Renders calibration controls OUTSIDE the video area:
 * - Brief instructions
 * - Rotate left/right buttons
 * - Cancel and Done buttons
 *
 * This component should be placed below or beside the video feed,
 * not overlaid on top of it.
 */
export function CalibrationControls({
  onRotateLeft,
  onRotateRight,
  onCancel,
  onDone,
  isDisabled = false,
  columnCount,
  compact = false,
}: CalibrationControlsProps): ReactNode {
  return (
    <div
      data-component="calibration-controls"
      className={css({
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        p: 3,
        bg: 'gray.800',
        borderRadius: 'lg',
      })}
    >
      {/* Instructions */}
      {!compact && (
        <div
          data-element="calibration-instructions"
          className={css({
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
          })}
        >
          <p
            className={css({
              fontSize: 'sm',
              fontWeight: 'medium',
              color: 'white',
            })}
          >
            Calibration Mode
          </p>
          <p className={css({ fontSize: 'xs', color: 'gray.400' })}>
            Drag corners to match your abacus. Yellow lines = column dividers.
          </p>
          {columnCount && (
            <p className={css({ fontSize: 'xs', color: 'gray.500' })}>{columnCount} columns</p>
          )}
        </div>
      )}

      {/* Button row */}
      <div
        className={css({
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          flexWrap: 'wrap',
        })}
      >
        {/* Rotation buttons */}
        <div className={css({ display: 'flex', gap: 1 })}>
          <button
            type="button"
            onClick={onRotateLeft}
            disabled={isDisabled}
            data-action="rotate-left"
            className={css({
              px: 2,
              py: 1.5,
              bg: 'blue.600',
              color: 'white',
              borderRadius: 'md',
              fontSize: 'sm',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: isDisabled ? 0.5 : 1,
              _hover: { bg: isDisabled ? 'blue.600' : 'blue.500' },
              _disabled: { cursor: 'not-allowed' },
            })}
            title="Rotate 90° left"
          >
            ↺
          </button>
          <button
            type="button"
            onClick={onRotateRight}
            disabled={isDisabled}
            data-action="rotate-right"
            className={css({
              px: 2,
              py: 1.5,
              bg: 'blue.600',
              color: 'white',
              borderRadius: 'md',
              fontSize: 'sm',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: isDisabled ? 0.5 : 1,
              _hover: { bg: isDisabled ? 'blue.600' : 'blue.500' },
              _disabled: { cursor: 'not-allowed' },
            })}
            title="Rotate 90° right"
          >
            ↻
          </button>
        </div>

        {/* Spacer */}
        <div className={css({ flex: 1 })} />

        {/* Cancel / Done buttons */}
        <div className={css({ display: 'flex', gap: 2 })}>
          <button
            type="button"
            onClick={onCancel}
            disabled={isDisabled}
            data-action="cancel-calibration"
            className={css({
              px: 3,
              py: 1.5,
              bg: 'gray.700',
              color: 'white',
              borderRadius: 'md',
              fontSize: 'sm',
              border: 'none',
              cursor: 'pointer',
              opacity: isDisabled ? 0.5 : 1,
              _hover: { bg: isDisabled ? 'gray.700' : 'gray.600' },
              _disabled: { cursor: 'not-allowed' },
            })}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onDone}
            disabled={isDisabled}
            data-action="finish-calibration"
            className={css({
              px: 3,
              py: 1.5,
              bg: 'green.600',
              color: 'white',
              borderRadius: 'md',
              fontSize: 'sm',
              fontWeight: 'medium',
              border: 'none',
              cursor: 'pointer',
              opacity: isDisabled ? 0.5 : 1,
              _hover: { bg: isDisabled ? 'green.600' : 'green.500' },
              _disabled: { cursor: 'not-allowed' },
            })}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}

export default CalibrationControls
