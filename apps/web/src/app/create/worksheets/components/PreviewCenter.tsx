'use client'

import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { css } from '@styled/css'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import type { WorksheetFormState } from '@/app/create/worksheets/types'
import { UploadWorksheetModal } from '@/components/worksheets/UploadWorksheetModal'
import { useTheme } from '@/contexts/ThemeContext'
import { extractConfigFields } from '../utils/extractConfigFields'
import { ShareModal } from './ShareModal'
import { WorksheetPreview } from './WorksheetPreview'

interface PreviewCenterProps {
  formState: WorksheetFormState
  initialPreview?: string[]
  onGenerate: () => Promise<void>
  status: 'idle' | 'generating' | 'success' | 'error'
}

export function PreviewCenter({
  formState,
  initialPreview,
  onGenerate,
  status,
}: PreviewCenterProps) {
  const router = useRouter()
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [isScrolling, setIsScrolling] = useState(false)
  const scrollTimeoutRef = useRef<NodeJS.Timeout>()
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
  const [isShareModalOpen, setIsShareModalOpen] = useState(false)
  const [isGeneratingShare, setIsGeneratingShare] = useState(false)
  const [justCopied, setJustCopied] = useState(false)
  const isGenerating = status === 'generating'

  // Detect scrolling in the scroll container
  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return

    const handleScroll = () => {
      setIsScrolling(true)

      // Clear existing timeout
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current)
      }

      // Set new timeout to hide after 1 second of no scrolling
      scrollTimeoutRef.current = setTimeout(() => {
        setIsScrolling(false)
      }, 1000)
    }

    container.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      container.removeEventListener('scroll', handleScroll)
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current)
      }
    }
  }, [])

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
    <div
      ref={scrollContainerRef}
      data-component="preview-center"
      className={css({
        h: 'full',
        w: 'full',
        overflow: 'auto',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        position: 'relative',
      })}
    >
      {/* Floating Action Button - Top Right */}
      <div
        data-component="floating-action-button"
        className={css({
          position: 'fixed',
          top: '24',
          right: '4',
          zIndex: 1000,
          display: 'flex',
          borderRadius: 'lg',
          overflow: 'hidden',
          shadow: 'lg',
          border: '2px solid',
          borderColor: 'brand.700',
        })}
      >
        {/* Main Download Button */}
        <button
          type="button"
          data-action="download-pdf"
          onClick={onGenerate}
          disabled={isGenerating}
          className={css({
            px: '4',
            py: '2.5',
            bg: 'brand.600',
            color: 'white',
            fontSize: 'sm',
            fontWeight: 'bold',
            cursor: isGenerating ? 'not-allowed' : 'pointer',
            opacity: isGenerating ? '0.7' : '1',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '2',
            transition: 'all 0.2s',
            _hover: isGenerating
              ? {}
              : {
                  bg: 'brand.700',
                },
          })}
        >
          {isGenerating ? (
            <>
              <div
                className={css({
                  w: '4',
                  h: '4',
                  border: '2px solid',
                  borderColor: 'white',
                  borderTopColor: 'transparent',
                  rounded: 'full',
                  animation: 'spin 1s linear infinite',
                })}
              />
              <span>Generating...</span>
            </>
          ) : (
            <>
              <span className={css({ fontSize: 'lg' })}>⬇️</span>
              <span>Download</span>
            </>
          )}
        </button>

        {/* Dropdown Trigger */}
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              data-action="open-actions-dropdown"
              disabled={isGenerating}
              className={css({
                px: '2',
                bg: 'brand.600',
                color: 'white',
                cursor: isGenerating ? 'not-allowed' : 'pointer',
                opacity: isGenerating ? '0.7' : '1',
                borderLeft: '1px solid',
                borderColor: 'brand.700',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s',
                _hover: isGenerating
                  ? {}
                  : {
                      bg: 'brand.700',
                    },
              })}
            >
              <span className={css({ fontSize: 'xs' })}>▼</span>
            </button>
          </DropdownMenu.Trigger>

          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="end"
              sideOffset={4}
              className={css({
                bg: 'white',
                borderRadius: 'lg',
                shadow: 'lg',
                border: '1px solid',
                borderColor: 'gray.200',
                overflow: 'hidden',
                minW: '160px',
                zIndex: 10000,
              })}
            >
              <DropdownMenu.Item
                data-action="share-worksheet"
                asChild
                className={css({
                  outline: 'none',
                })}
              >
                <div
                  className={css({
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    w: 'full',
                  })}
                >
                  {/* Main share button - opens QR modal */}
                  <button
                    onClick={() => setIsShareModalOpen(true)}
                    className={css({
                      flex: '1',
                      px: '4',
                      py: '2.5',
                      fontSize: 'sm',
                      fontWeight: 'medium',
                      color: 'gray.700',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '2',
                      outline: 'none',
                      bg: 'transparent',
                      border: 'none',
                      _hover: {
                        bg: 'blue.50',
                        color: 'blue.700',
                      },
                    })}
                  >
                    <span className={css({ fontSize: 'lg' })}>📱</span>
                    <span>Share</span>
                  </button>

                  {/* Copy shortcut */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleQuickShare()
                    }}
                    disabled={isGeneratingShare}
                    className={css({
                      px: '3',
                      py: '2.5',
                      fontSize: 'lg',
                      color: justCopied ? 'green.700' : 'gray.600',
                      cursor: isGeneratingShare ? 'wait' : 'pointer',
                      bg: justCopied ? 'green.50' : 'transparent',
                      border: 'none',
                      borderLeft: '1px solid',
                      borderColor: 'gray.200',
                      outline: 'none',
                      opacity: isGeneratingShare ? '0.6' : '1',
                      transition: 'all 0.2s',
                      _hover: isGeneratingShare || justCopied
                        ? {}
                        : {
                            bg: 'green.50',
                            color: 'green.700',
                          },
                    })}
                    title={justCopied ? 'Copied!' : 'Copy share link'}
                  >
                    {isGeneratingShare ? '⏳' : justCopied ? '✓' : '📋'}
                  </button>
                </div>
              </DropdownMenu.Item>

              <DropdownMenu.Item
                data-action="upload-worksheet"
                onClick={() => setIsUploadModalOpen(true)}
                className={css({
                  px: '4',
                  py: '2.5',
                  fontSize: 'sm',
                  fontWeight: 'medium',
                  color: 'gray.700',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '2',
                  outline: 'none',
                  _hover: {
                    bg: 'purple.50',
                    color: 'purple.700',
                  },
                  _focus: {
                    bg: 'purple.50',
                    color: 'purple.700',
                  },
                })}
              >
                <span className={css({ fontSize: 'lg' })}>⬆️</span>
                <span>Upload</span>
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
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

      <div
        className={css({
          w: 'full',
          maxW: '1000px',
          minH: 'full',
        })}
      >
        <WorksheetPreview
          formState={formState}
          initialData={initialPreview}
          isScrolling={isScrolling}
        />
      </div>
    </div>
  )
}
