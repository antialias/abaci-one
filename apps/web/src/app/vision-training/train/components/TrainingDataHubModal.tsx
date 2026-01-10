'use client'

import * as Dialog from '@radix-ui/react-dialog'
import { css } from '../../../../../styled-system/css'
import { Z_INDEX } from '@/constants/zIndex'
import type { SamplesData } from './wizard/types'
import { ColumnClassifierDataPanel } from './ColumnClassifierDataPanel'

interface SyncStatus {
  available: boolean
  remote?: { host: string; totalImages: number }
  local?: { totalImages: number }
  needsSync?: boolean
  newOnRemote?: number
  newOnLocal?: number
  excludedByDeletion?: number
  error?: string
}

interface SyncProgress {
  phase: 'idle' | 'connecting' | 'syncing' | 'complete' | 'error'
  message: string
  filesTransferred?: number
  bytesTransferred?: number
}

interface TrainingDataHubModalProps {
  isOpen: boolean
  onClose: () => void
  samples: SamplesData | null
  onDataChanged: () => void
  syncStatus: SyncStatus | null
  syncProgress: SyncProgress
  onStartSync: () => void
  onCancelSync: () => void
}

/**
 * Training Data Hub Modal
 *
 * Modal wrapper for ColumnClassifierDataPanel.
 * Provides quick access to column classifier training data management.
 */
export function TrainingDataHubModal({
  isOpen,
  onClose,
  samples,
  onDataChanged,
  syncStatus,
  syncProgress,
  onStartSync,
  onCancelSync,
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

          {/* Header */}
          <div
            data-element="modal-header"
            className={css({
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              px: { base: 3, lg: 5 },
              py: 3,
              borderBottom: '1px solid',
              borderColor: 'gray.800',
              bg: 'gray.850',
            })}
          >
            <div
              data-element="header-title-group"
              className={css({ display: 'flex', alignItems: 'center', gap: 3 })}
            >
              <span data-element="header-icon" className={css({ fontSize: 'xl' })}>
                🎯
              </span>
              <div data-element="header-text">
                <h2
                  data-element="header-title"
                  className={css({
                    fontSize: 'lg',
                    fontWeight: 'bold',
                    color: 'gray.100',
                  })}
                >
                  Training Data Hub
                </h2>
                <div
                  data-element="header-subtitle"
                  className={css({ fontSize: 'sm', color: 'gray.500' })}
                >
                  Manage and capture training data for the digit classifier
                </div>
              </div>
            </div>

            {/* Close button */}
            <Dialog.Close asChild>
              <button
                type="button"
                data-action="close-modal"
                className={css({
                  width: '36px',
                  height: '36px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  bg: 'transparent',
                  color: 'gray.500',
                  borderRadius: 'lg',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 'lg',
                  _hover: { bg: 'gray.800', color: 'gray.300' },
                })}
              >
                ✕
              </button>
            </Dialog.Close>
          </div>

          {/* Panel content */}
          <div className={css({ flex: 1, overflow: 'hidden' })}>
            <ColumnClassifierDataPanel
              onDataChanged={onDataChanged}
              samples={samples}
              syncStatus={syncStatus}
              syncProgress={syncProgress}
              onStartSync={onStartSync}
              onCancelSync={onCancelSync}
            />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export default TrainingDataHubModal
