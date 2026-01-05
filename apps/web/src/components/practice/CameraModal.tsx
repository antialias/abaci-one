'use client'

import * as Dialog from '@radix-ui/react-dialog'
import dynamic from 'next/dynamic'
import type { Corner, Rotation } from '@/types/attachments'
import { Z_INDEX } from '@/constants/zIndex'
import { VisualDebugProvider } from '@/contexts/VisualDebugContext'
import { css } from '../../../styled-system/css'

// Dynamic import for heavy camera component
const FullscreenCamera = dynamic(
  () => import('@/app/practice/[studentId]/summary/FullscreenCamera'),
  { ssr: false }
)

export interface CameraModalProps {
  /** Whether the modal is open */
  isOpen: boolean
  /** Callback when modal is closed */
  onClose: () => void
  /** Callback when a photo is captured */
  onCapture: (croppedFile: File, originalFile: File, corners: Corner[], rotation: Rotation) => void
}

/**
 * Fullscreen camera modal for capturing worksheet photos
 *
 * Wraps FullscreenCamera in a Dialog for proper accessibility
 * and overlay handling.
 */
export function CameraModal({ isOpen, onClose, onCapture }: CameraModalProps) {
  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay
          className={css({
            position: 'fixed',
            inset: 0,
            bg: 'black',
            zIndex: Z_INDEX.MODAL,
          })}
        />
        <Dialog.Content
          className={css({
            position: 'fixed',
            inset: 0,
            zIndex: Z_INDEX.MODAL + 1,
            outline: 'none',
          })}
        >
          <VisualDebugProvider>
            <Dialog.Title className={css({ srOnly: true })}>Take Photo</Dialog.Title>
            <Dialog.Description className={css({ srOnly: true })}>
              Camera viewfinder. Tap capture to take a photo.
            </Dialog.Description>
            <FullscreenCamera onCapture={onCapture} onClose={onClose} />
          </VisualDebugProvider>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export default CameraModal
