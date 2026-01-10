'use client'

import * as Dialog from '@radix-ui/react-dialog'
import { css } from '../../../../../styled-system/css'
import { Z_INDEX } from '@/constants/zIndex'
import { UnifiedDataPanel } from './data-panel/UnifiedDataPanel'

interface TrainingDataHubModalProps {
  isOpen: boolean
  onClose: () => void
  onDataChanged: () => void
}

/**
 * Training Data Hub Modal
 *
 * Modal wrapper for column classifier data panel.
 * Provides quick access to column classifier training data management.
 */
export function TrainingDataHubModal({
  isOpen,
  onClose,
  onDataChanged,
}: TrainingDataHubModalProps) {
  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay
          className={css({
            position: 'fixed',
            inset: 0,
            bg: 'black/80',
            backdropFilter: 'blur(4px)',
            animation: 'fadeIn 0.2s ease',
          })}
          style={{ zIndex: Z_INDEX.MODAL }}
        />
        <Dialog.Content
          className={css({
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: { base: '100vw', lg: '95vw' },
            maxWidth: '1400px',
            height: { base: '100vh', lg: '90vh' },
            maxHeight: '900px',
            bg: 'gray.900',
            borderRadius: { base: '0', lg: 'xl' },
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            animation: 'slideIn 0.3s ease',
          })}
          style={{ zIndex: Z_INDEX.MODAL + 1 }}
        >
          {/* Accessible title (visually hidden) */}
          <Dialog.Title className={css({ srOnly: true })}>Training Data Hub</Dialog.Title>
          <Dialog.Description className={css({ srOnly: true })}>
            Manage and capture training data for the digit classifier
          </Dialog.Description>

          {/* Close button */}
          <Dialog.Close
            className={css({
              position: 'absolute',
              top: 2,
              right: 2,
              p: 2,
              bg: 'transparent',
              border: 'none',
              color: 'gray.400',
              cursor: 'pointer',
              borderRadius: 'md',
              zIndex: 10,
              _hover: { color: 'gray.200', bg: 'gray.800' },
            })}
          >
            ✕
          </Dialog.Close>

          {/* Panel content */}
          <div className={css({ flex: 1, overflow: 'hidden' })}>
            <UnifiedDataPanel modelType="column-classifier" onDataChanged={onDataChanged} />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export default TrainingDataHubModal
