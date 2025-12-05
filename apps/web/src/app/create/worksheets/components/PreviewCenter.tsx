'use client'

import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { css } from '@styled/css'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { WorksheetFormState } from '@/app/create/worksheets/types'
import { UploadWorksheetModal } from '@/components/worksheets/UploadWorksheetModal'
import { useTheme } from '@/contexts/ThemeContext'
import { extractConfigFields } from '../utils/extractConfigFields'
import { FloatingPageIndicator } from './FloatingPageIndicator'
import { ShareModal } from './ShareModal'
import { useWorksheetConfig } from './WorksheetConfigContext'
import { WorksheetPreview } from './WorksheetPreview'
import { DuplicateWarningBanner } from './worksheet-preview/DuplicateWarningBanner'
import { WorksheetPreviewProvider } from './worksheet-preview/WorksheetPreviewContext'

// Dice face configurations: positions of dots for faces 1-6
const DICE_FACES = [
  // Face 1: center dot
  [[12, 12]],
  // Face 2: diagonal dots
  [
    [8, 8],
    [16, 16],
  ],
  // Face 3: diagonal line
  [
    [8, 8],
    [12, 12],
    [16, 16],
  ],
  // Face 4: four corners
  [
    [8, 8],
    [16, 8],
    [8, 16],
    [16, 16],
  ],
  // Face 5: four corners + center
  [
    [8, 8],
    [16, 8],
    [12, 12],
    [8, 16],
    [16, 16],
  ],
  // Face 6: two columns of three
  [
    [8, 6],
    [8, 12],
    [8, 18],
    [16, 6],
    [16, 12],
    [16, 18],
  ],
]

/**
 * Animated dice icon that shows rolling dice with changing faces
 * @param isRolling - When true, shows a rolling animation with changing faces
 * @param currentFace - The current face to display (1-6), used during rolling
 */
function DiceIcon({
  className,
  isRolling,
  currentFace = 5,
}: {
  className?: string
  isRolling?: boolean
  currentFace?: number
}) {
  const dots = DICE_FACES[(currentFace - 1) % 6]

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      width="22"
      height="22"
      style={{
        animation: isRolling ? 'diceRoll 0.4s ease-in-out infinite' : 'none',
        transformOrigin: 'center',
      }}
    >
      <rect x="2" y="2" width="20" height="20" rx="2" />
      {dots.map(([cx, cy], i) => (
        <circle
          key={`${cx}-${cy}-${i}`}
          cx={cx}
          cy={cy}
          r="1.5"
          fill="currentColor"
          stroke="none"
        />
      ))}
    </svg>
  )
}

interface PreviewCenterProps {
  formState: WorksheetFormState
  initialPreview?: string[]
  onGenerate: () => Promise<void>
  status: 'idle' | 'generating' | 'success' | 'error'
  isReadOnly?: boolean
  onShare?: () => Promise<void>
  onEdit?: () => void
}

export function PreviewCenter({
  formState,
  initialPreview,
  onGenerate,
  status,
  isReadOnly = false,
  onShare,
  onEdit,
}: PreviewCenterProps) {
  const router = useRouter()
  const { resolvedTheme } = useTheme()
  const { onChange } = useWorksheetConfig()
  const isDark = resolvedTheme === 'dark'
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [isScrolling, setIsScrolling] = useState(false)
  const scrollTimeoutRef = useRef<NodeJS.Timeout>()
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
  const [isShareModalOpen, setIsShareModalOpen] = useState(false)
  const [isGeneratingShare, setIsGeneratingShare] = useState(false)
  const [justCopied, setJustCopied] = useState(false)
  const [isShuffling, setIsShuffling] = useState(false)
  // Default to face derived from initial seed (2-6, excluding 1)
  const [diceFace, setDiceFace] = useState(() => (formState.seed % 5) + 2)
  const shuffleTimeoutRef = useRef<NodeJS.Timeout>()
  const diceFaceIntervalRef = useRef<NodeJS.Timeout>()
  const isGenerating = status === 'generating'
  const [pageData, setPageData] = useState<{
    currentPage: number
    totalPages: number
    jumpToPage: (pageIndex: number) => void
  } | null>(null)

  // Shuffle problems by generating a new random seed
  const handleShuffle = useCallback(() => {
    // Generate a new random seed (use modulo to keep it in 32-bit int range)
    const newSeed = Date.now() % 2147483647
    onChange({ seed: newSeed })

    // Start rolling animation
    setIsShuffling(true)

    // Clear any existing intervals/timeouts
    if (shuffleTimeoutRef.current) {
      clearTimeout(shuffleTimeoutRef.current)
    }
    if (diceFaceIntervalRef.current) {
      clearInterval(diceFaceIntervalRef.current)
    }

    // Cycle through dice faces rapidly
    diceFaceIntervalRef.current = setInterval(() => {
      setDiceFace((prev) => (prev % 6) + 1)
    }, 100) // Change face every 100ms

    // Stop animation after preview should have updated (debounce time + render time)
    shuffleTimeoutRef.current = setTimeout(() => {
      setIsShuffling(false)
      if (diceFaceIntervalRef.current) {
        clearInterval(diceFaceIntervalRef.current)
      }
      // End on a face derived from the seed (2-6, excluding 1 so it's clearly a dice)
      // Also ensure it's different from the current face by offsetting if collision
      setDiceFace((currentFace) => {
        const baseFace = (newSeed % 5) + 2 // Results in 2, 3, 4, 5, or 6
        if (baseFace === currentFace) {
          // If same, rotate to next face (wrapping 6 -> 2, skipping 1)
          return baseFace === 6 ? 2 : baseFace + 1
        }
        return baseFace
      })
    }, 1500) // 1.5 seconds should cover debounce + render
  }, [onChange])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (shuffleTimeoutRef.current) {
        clearTimeout(shuffleTimeoutRef.current)
      }
      if (diceFaceIntervalRef.current) {
        clearInterval(diceFaceIntervalRef.current)
      }
    }
  }, [])

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
      data-component="preview-center"
      className={css({
        h: 'full',
        w: 'full',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        position: 'relative',
      })}
    >
      {/* Inject keyframes for dice roll animation */}
      <style>
        {`
          @keyframes diceRoll {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>

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
        {/* Main Action Button - Edit in read-only mode, Download in edit mode */}
        <button
          type="button"
          data-action={isReadOnly ? 'edit-worksheet' : 'download-pdf'}
          onClick={isReadOnly ? onEdit : onGenerate}
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
          {isReadOnly ? (
            <>
              <span className={css({ fontSize: 'lg' })}>✏️</span>
              <span>Edit</span>
            </>
          ) : isGenerating ? (
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

        {/* Shuffle Button - only in edit mode (1/3 split secondary action) */}
        {!isReadOnly && (
          <button
            type="button"
            data-action="shuffle-problems"
            onClick={handleShuffle}
            disabled={isGenerating}
            title="Shuffle problems (generate new set)"
            className={css({
              px: '3',
              py: '2.5',
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
            <DiceIcon isRolling={isShuffling} currentFace={diceFace} />
          </button>
        )}

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
              {/* Read-only mode shows Download and Share */}
              {isReadOnly ? (
                <>
                  <DropdownMenu.Item
                    data-action="download-worksheet"
                    onClick={onGenerate}
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
                        bg: 'blue.50',
                        color: 'blue.700',
                      },
                      _focus: {
                        bg: 'blue.50',
                        color: 'blue.700',
                      },
                    })}
                  >
                    <span className={css({ fontSize: 'lg' })}>⬇️</span>
                    <span>Download</span>
                  </DropdownMenu.Item>

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
                        onClick={onShare}
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
                          _hover:
                            isGeneratingShare || justCopied
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
                </>
              ) : (
                <>
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
                          _hover:
                            isGeneratingShare || justCopied
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
                </>
              )}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>

      {/* Share Modal and Upload Modal (only shown in edit mode) */}
      {!isReadOnly && (
        <>
          <ShareModal
            isOpen={isShareModalOpen}
            onClose={() => setIsShareModalOpen(false)}
            worksheetType="addition"
            config={formState}
            isDark={isDark}
          />

          <UploadWorksheetModal
            isOpen={isUploadModalOpen}
            onClose={() => setIsUploadModalOpen(false)}
            onUploadComplete={handleUploadComplete}
          />
        </>
      )}

      {/* Floating elements - positioned absolutely relative to preview-center */}
      <WorksheetPreviewProvider formState={formState}>
        {/* Dismissable warning banner */}
        <DuplicateWarningBanner />

        {/* Floating page indicator */}
        {pageData && pageData.totalPages > 1 && (
          <FloatingPageIndicator
            currentPage={pageData.currentPage}
            totalPages={pageData.totalPages}
            onJumpToPage={pageData.jumpToPage}
            isScrolling={isScrolling}
          />
        )}
      </WorksheetPreviewProvider>

      <div
        ref={scrollContainerRef}
        className={css({
          flex: '1',
          w: 'full',
          minH: 'full',
          h: 'full',
          overflow: 'auto',
        })}
      >
        <WorksheetPreview
          formState={formState}
          initialData={initialPreview}
          isScrolling={isScrolling}
          onPageDataReady={setPageData}
        />
      </div>
    </div>
  )
}
