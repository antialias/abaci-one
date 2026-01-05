'use client'

import * as Dialog from '@radix-ui/react-dialog'
import dynamic from 'next/dynamic'
import type { DocumentAdjustmentState, Corner, Rotation } from '@/types/attachments'
import type { DetectQuadsInImageResult } from '@/components/practice/useDocumentDetection'
import { Z_INDEX } from '@/constants/zIndex'
import { css } from '../../../styled-system/css'

// Dynamic import for heavy OpenCV-dependent component
const DocumentAdjuster = dynamic(
  () => import('@/components/practice/DocumentAdjuster').then((m) => m.DocumentAdjuster),
  { ssr: false }
)

export interface DocumentAdjustmentModalProps {
  /** Current adjustment state (null when closed) */
  state: DocumentAdjustmentState | null
  /** Number of files remaining in queue (for "1 of N" display) */
  queueLength: number
  /** OpenCV reference */
  opencvRef: unknown
  /** Function to detect quads in an image */
  detectQuadsInImage: (canvas: HTMLCanvasElement) => DetectQuadsInImageResult
  /** Callback when adjustment is confirmed */
  onConfirm: (croppedFile: File, corners: Corner[], rotation: Rotation) => Promise<void>
  /** Callback when adjustment is skipped (use original) */
  onSkip: () => Promise<void>
  /** Callback when adjustment is cancelled (clear queue) */
  onCancel: () => void
}

/**
 * Modal for adjusting document perspective crop before upload
 *
 * Shows the DocumentAdjuster component in a fullscreen dialog,
 * allowing users to adjust corners and rotation before confirming.
 */
export function DocumentAdjustmentModal({
  state,
  queueLength,
  opencvRef,
  detectQuadsInImage,
  onConfirm,
  onSkip,
  onCancel,
}: DocumentAdjustmentModalProps) {
  const isOpen = state !== null && opencvRef !== null

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onCancel()}>
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
          <Dialog.Title className={css({ srOnly: true })}>
            Adjust Photo {queueLength > 0 ? `(1 of ${queueLength + 1})` : ''}
          </Dialog.Title>
          <Dialog.Description className={css({ srOnly: true })}>
            Drag corners to crop the document. Tap Done to confirm or Skip to use original.
          </Dialog.Description>
          {state !== null && opencvRef !== null && (
            <DocumentAdjuster
              sourceCanvas={state.sourceCanvas}
              initialCorners={state.corners}
              onConfirm={onConfirm}
              onCancel={onCancel}
              onSkip={onSkip}
              cv={opencvRef}
              detectQuadsInImage={detectQuadsInImage}
            />
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export default DocumentAdjustmentModal
