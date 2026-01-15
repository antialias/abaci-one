'use client'

import { css } from '@styled/css'
import { stack } from '@styled/patterns'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { UploadWorksheetModal } from '@/components/worksheets/UploadWorksheetModal'
import { useTheme } from '@/contexts/ThemeContext'
import { extractConfigFields } from '../utils/extractConfigFields'
import { GenerateButton } from './GenerateButton'
import { ShareModal } from './ShareModal'
import { useWorksheetConfig } from './WorksheetConfigContext'

interface ActionsSidebarProps {
  onGenerate: () => Promise<void>
  status: 'idle' | 'generating' | 'success' | 'error'
}

export function ActionsSidebar({ onGenerate, status }: ActionsSidebarProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const router = useRouter()
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
  const [isShareModalOpen, setIsShareModalOpen] = useState(false)
  const [isGeneratingShare, setIsGeneratingShare] = useState(false)
  const [justCopied, setJustCopied] = useState(false)
  const { formState } = useWorksheetConfig()

  // Upload complete handler
  const handleUploadComplete = (attemptId: string) => {
    router.push(`/worksheets/attempts/${attemptId}`)
  }

  // Quick share - copy link to clipboard without showing modal
  const handleQuickShare = async () => {
    setIsGeneratingShare(true)
    setJustCopied(false)

    try {
      const response = await fetch('/api/worksheets/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          worksheetType: 'addition',
          config: extractConfigFields(formState),
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to create share link')
      }

      const data = await response.json()
      await navigator.clipboard.writeText(data.url)

      setJustCopied(true)
      setTimeout(() => setJustCopied(false), 2000)
    } catch (err) {
      console.error('Failed to create share link:', err)
      // TODO: Show error toast
    } finally {
      setIsGeneratingShare(false)
    }
  }

  return (
    <>
      <div
        data-component="actions-sidebar"
        className={css({
          h: 'full',
          bg: isDark ? 'gray.800' : 'white',
          rounded: 'xl',
          shadow: 'card',
          p: '4',
          overflow: 'auto',
        })}
      >
        <div className={stack({ gap: '4' })}>
          {/* Generate Button */}
          <GenerateButton
            status={status === 'success' ? 'idle' : status}
            onGenerate={onGenerate}
            isDark={isDark}
          />

          {/* Share Button with Copy Shortcut */}
          <div
            data-component="share-button-group"
            className={css({
              w: 'full',
              display: 'flex',
              rounded: 'xl',
              overflow: 'hidden',
              shadow: 'md',
              border: '2px solid',
              borderColor: 'blue.700',
            })}
          >
            {/* Main share button - opens QR modal */}
            <button
              data-action="show-qr-code"
              onClick={() => setIsShareModalOpen(true)}
              className={css({
                flex: '1',
                px: '6',
                py: '4',
                bg: 'blue.600',
                color: 'white',
                fontSize: 'md',
                fontWeight: 'bold',
                transition: 'all 0.2s',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '2',
                border: 'none',
                outline: 'none',
                _hover: {
                  bg: 'blue.700',
                  transform: 'translateY(-1px)',
                },
                _active: {
                  transform: 'translateY(0)',
                },
              })}
            >
              <span className={css({ fontSize: 'xl' })}>📱</span>
              <span>Share</span>
            </button>

            {/* Copy shortcut */}
            <button
              data-action="copy-share-link"
              onClick={handleQuickShare}
              disabled={isGeneratingShare}
              title={justCopied ? 'Copied!' : 'Copy share link'}
              className={css({
                px: '4',
                py: '4',
                bg: justCopied ? 'green.600' : 'blue.600',
                color: 'white',
                fontSize: 'xl',
                cursor: isGeneratingShare ? 'wait' : 'pointer',
                border: 'none',
                borderLeft: '1px solid',
                borderColor: justCopied ? 'green.700' : 'blue.700',
                outline: 'none',
                transition: 'all 0.2s',
                opacity: isGeneratingShare ? '0.6' : '1',
                _hover:
                  isGeneratingShare || justCopied
                    ? {}
                    : {
                        bg: 'blue.700',
                        transform: 'translateY(-1px)',
                      },
                _active:
                  isGeneratingShare || justCopied
                    ? {}
                    : {
                        transform: 'translateY(0)',
                      },
              })}
            >
              {isGeneratingShare ? '⏳' : justCopied ? '✓' : '📋'}
            </button>
          </div>

          {/* Upload Worksheet Button */}
          <button
            data-action="upload-worksheet"
            onClick={() => setIsUploadModalOpen(true)}
            className={css({
              w: 'full',
              px: '6',
              py: '4',
              bg: 'purple.600',
              color: 'white',
              fontSize: 'md',
              fontWeight: 'bold',
              rounded: 'xl',
              shadow: 'md',
              transition: 'all 0.2s',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '2',
              border: '2px solid',
              borderColor: 'purple.700',
              _hover: {
                bg: 'purple.700',
                borderColor: 'purple.800',
                transform: 'translateY(-1px)',
                shadow: 'lg',
              },
              _active: {
                transform: 'translateY(0)',
              },
            })}
          >
            <span className={css({ fontSize: 'xl' })}>⬆️</span>
            <span>Upload</span>
          </button>
        </div>
      </div>

      {/* Share Modal */}
      <ShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        worksheetType="addition"
        config={formState}
        isDark={isDark}
      />

      {/* Upload Worksheet Modal */}
      <UploadWorksheetModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onUploadComplete={handleUploadComplete}
      />
    </>
  )
}
