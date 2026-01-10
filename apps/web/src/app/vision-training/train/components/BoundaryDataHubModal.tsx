'use client'

import * as Dialog from '@radix-ui/react-dialog'
import { css } from '../../../../../styled-system/css'
import { Z_INDEX } from '@/constants/zIndex'
import { BoundaryDataPanel } from './BoundaryDataPanel'

interface BoundaryDataHubModalProps {
  isOpen: boolean
  onClose: () => void
  onDataChanged: () => void
}

/**
 * Boundary Data Hub Modal
 *
 * Modal wrapper for BoundaryDataPanel.
 * Provides quick access to boundary detector training data management.
 */
export function BoundaryDataHubModal({
  isOpen,
  onClose,
  onDataChanged,
}: BoundaryDataHubModalProps) {
  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay
          className={css({
            position: 'fixed',
            inset: 0,
            bg: 'black/80',
            animation: 'fadeIn 0.2s ease-out',
          })}
          style={{ zIndex: Z_INDEX.MODAL }}
        />
        <Dialog.Content
          className={css({
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '95vw',
            maxWidth: '1000px',
            maxHeight: '90vh',
            bg: 'gray.900',
            borderRadius: 'xl',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            animation: 'scaleIn 0.2s ease-out',
          })}
          style={{ zIndex: Z_INDEX.MODAL + 1 }}
        >
          {/* Header */}
          <div
            className={css({
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              p: 4,
              borderBottom: '1px solid',
              borderColor: 'gray.800',
            })}
          >
            <div className={css({ display: 'flex', alignItems: 'center', gap: 3 })}>
              <span className={css({ fontSize: 'xl' })}>🎯</span>
              <div>
                <Dialog.Title
                  className={css({ fontSize: 'lg', fontWeight: 'bold', color: 'gray.100' })}
                >
                  Boundary Training Data
                </Dialog.Title>
                <Dialog.Description className={css({ fontSize: 'sm', color: 'gray.400' })}>
                  Manage boundary detector training samples
                </Dialog.Description>
              </div>
            </div>
            <Dialog.Close
              className={css({
                p: 2,
                bg: 'transparent',
                border: 'none',
                color: 'gray.400',
                cursor: 'pointer',
                borderRadius: 'md',
                _hover: { color: 'gray.200', bg: 'gray.800' },
              })}
            >
              ✕
            </Dialog.Close>
          </div>

          {/* Panel content */}
          <div className={css({ flex: 1, overflow: 'hidden' })}>
            <BoundaryDataPanel onDataChanged={onDataChanged} />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
