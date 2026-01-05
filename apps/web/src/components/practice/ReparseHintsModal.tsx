'use client'

/**
 * ReparseHintsModal - Modal for providing hints when re-parsing a worksheet
 *
 * Allows users to provide additional context to help the AI
 * better understand handwriting or correct parsing errors.
 */

import { type ReactNode, useState, useCallback } from 'react'
import { css } from '../../../styled-system/css'
import { Z_INDEX } from '@/constants/zIndex'

export interface ReparseHintsModalProps {
  /** Whether the modal is open */
  isOpen: boolean
  /** Callback to close the modal */
  onClose: () => void
  /** Callback when user confirms re-parse with hints */
  onConfirm: (hints: string | undefined) => void
  /** Whether a parse is currently in progress */
  isProcessing: boolean
}

export function ReparseHintsModal({
  isOpen,
  onClose,
  onConfirm,
  isProcessing,
}: ReparseHintsModalProps): ReactNode {
  const [hints, setHints] = useState('')

  const handleClose = useCallback(() => {
    setHints('')
    onClose()
  }, [onClose])

  const handleConfirm = useCallback(() => {
    onConfirm(hints || undefined)
    setHints('')
  }, [hints, onConfirm])

  if (!isOpen) return null

  return (
    <div
      data-element="reparse-modal-overlay"
      className={css({
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        zIndex: Z_INDEX.MODAL + 1,
      })}
      onClick={handleClose}
    >
      <div
        data-element="reparse-modal"
        className={css({
          width: '500px',
          maxWidth: '90vw',
          backgroundColor: 'gray.800',
          borderRadius: 'xl',
          padding: 6,
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
        })}
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          className={css({
            fontSize: 'lg',
            fontWeight: 'semibold',
            color: 'white',
            marginBottom: 4,
          })}
        >
          Re-parse with Hints
        </h2>

        <p
          className={css({
            fontSize: 'sm',
            color: 'gray.400',
            marginBottom: 4,
          })}
        >
          Provide additional context to help the AI better understand this worksheet. This is useful
          when problems were mis-parsed or handwriting is difficult to read.
        </p>

        <textarea
          value={hints}
          onChange={(e) => setHints(e.target.value)}
          placeholder="Example hints:&#10;- Problems #3-5 are subtraction, not addition&#10;- The student writes 7s that look like 1s&#10;- There are 20 problems total, arranged in 4 rows"
          className={css({
            width: '100%',
            height: '150px',
            px: 3,
            py: 2,
            fontSize: 'sm',
            backgroundColor: 'gray.900',
            color: 'white',
            border: '1px solid',
            borderColor: 'gray.600',
            borderRadius: 'lg',
            resize: 'vertical',
            _focus: {
              outline: 'none',
              borderColor: 'orange.500',
              boxShadow: '0 0 0 2px token(colors.orange.500/20)',
            },
            _placeholder: {
              color: 'gray.500',
            },
          })}
        />

        <div
          className={css({
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 3,
            marginTop: 4,
          })}
        >
          <button
            type="button"
            onClick={handleClose}
            className={css({
              px: 4,
              py: 2,
              fontSize: 'sm',
              fontWeight: 'medium',
              color: 'white',
              backgroundColor: 'gray.700',
              border: 'none',
              borderRadius: 'lg',
              cursor: 'pointer',
              _hover: { backgroundColor: 'gray.600' },
            })}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isProcessing}
            className={css({
              px: 4,
              py: 2,
              fontSize: 'sm',
              fontWeight: 'medium',
              color: 'white',
              backgroundColor: 'orange.600',
              border: 'none',
              borderRadius: 'lg',
              cursor: 'pointer',
              _hover: { backgroundColor: 'orange.700' },
              _disabled: { opacity: 0.5, cursor: 'wait' },
            })}
          >
            {isProcessing ? 'Re-parsing...' : 'Re-parse Worksheet'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ReparseHintsModal
