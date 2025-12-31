'use client'

import * as Dialog from '@radix-ui/react-dialog'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import { PageWithNav } from '@/components/PageWithNav'
import {
  ContentBannerSlot,
  PracticeSubNav,
  ProjectingBanner,
  SessionSummary,
  StartPracticeModal,
} from '@/components/practice'
import { Z_INDEX } from '@/constants/zIndex'
import {
  SessionModeBannerProvider,
  useSessionModeBanner,
} from '@/contexts/SessionModeBannerContext'
import { useTheme } from '@/contexts/ThemeContext'
import type { Player } from '@/db/schema/players'
import type { SessionPlan } from '@/db/schema/session-plans'
import { useSessionMode } from '@/hooks/useSessionMode'
import type { ProblemResultWithContext } from '@/lib/curriculum/session-planner'
import { api } from '@/lib/queryClient'
import { css } from '../../../../../styled-system/css'

// Combined height of sticky elements above content area
// Main nav (80px) + Sub-nav (~56px with padding)
const STICKY_HEADER_OFFSET = 136

// ============================================================================
// Helper Component for Banner Action Registration
// ============================================================================

/**
 * Registers the action callback with the banner context.
 * Must be inside SessionModeBannerProvider to access context.
 */
function BannerActionRegistrar({ onAction }: { onAction: () => void }) {
  const { setOnAction } = useSessionModeBanner()

  useEffect(() => {
    setOnAction(onAction)
  }, [onAction, setOnAction])

  return null
}

interface SummaryClientProps {
  studentId: string
  player: Player
  session: SessionPlan | null
  /** Average seconds per problem from recent sessions */
  avgSecondsPerProblem?: number
  /** Problem history for BKT computation in weak skills targeting */
  problemHistory?: ProblemResultWithContext[]
  /** Whether we just transitioned from active practice to this summary */
  justCompleted?: boolean
}

/**
 * Summary Client Component
 *
 * Displays the session results and provides navigation options.
 * Handles three cases:
 * - In-progress session: shows partial results
 * - Completed session: shows full results
 * - No session: shows empty state
 */
export function SummaryClient({
  studentId,
  player,
  session,
  avgSecondsPerProblem = 40,
  problemHistory,
  justCompleted = false,
}: SummaryClientProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const [showStartPracticeModal, setShowStartPracticeModal] = useState(false)
  const [showCamera, setShowCamera] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Session mode - single source of truth for session planning decisions
  const { data: sessionMode, isLoading: isLoadingSessionMode } = useSessionMode(studentId)

  const queryClient = useQueryClient()

  // Fetch attachments for this session
  const { data: attachmentsData } = useQuery({
    queryKey: ['session-attachments', studentId, session?.id],
    queryFn: async () => {
      if (!session?.id) return { attachments: [] }
      const res = await api(`curriculum/${studentId}/sessions/${session.id}/attachments`)
      if (!res.ok) return { attachments: [] }
      return res.json() as Promise<{ attachments: Array<{ id: string; url: string }> }>
    },
    enabled: !!session?.id,
  })

  const attachments = attachmentsData?.attachments ?? []
  const hasPhotos = attachments.length > 0

  const isInProgress = session?.startedAt && !session?.completedAt

  // Check if session has actual problems (not just photos)
  const sessionResults = (session?.results ?? []) as Array<unknown>
  const hasProblems = sessionResults.length > 0

  // Upload photos immediately
  const uploadPhotos = useCallback(
    async (files: File[]) => {
      if (!session?.id || files.length === 0) return

      // Filter for images only
      const imageFiles = files.filter((f) => f.type.startsWith('image/'))
      if (imageFiles.length === 0) {
        setUploadError('No valid image files selected')
        return
      }

      setIsUploading(true)
      setUploadError(null)

      try {
        const formData = new FormData()
        for (const file of imageFiles) {
          formData.append('photos', file)
        }

        const response = await fetch(
          `/api/curriculum/${studentId}/sessions/${session.id}/attachments`,
          { method: 'POST', body: formData }
        )

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || 'Failed to upload photos')
        }

        // Refresh attachments
        queryClient.invalidateQueries({
          queryKey: ['session-attachments', studentId, session.id],
        })
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : 'Failed to upload photos')
      } finally {
        setIsUploading(false)
      }
    },
    [studentId, session?.id, queryClient]
  )

  // Handle file selection
  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files ? Array.from(e.target.files) : []
      uploadPhotos(files)
      e.target.value = ''
    },
    [uploadPhotos]
  )

  // Handle drag and drop
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      const files = Array.from(e.dataTransfer.files)
      uploadPhotos(files)
    },
    [uploadPhotos]
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setDragOver(false)
  }, [])

  // Handle camera capture
  const handleCameraCapture = useCallback(
    (file: File) => {
      setShowCamera(false)
      uploadPhotos([file])
    },
    [uploadPhotos]
  )

  // Handle practice again - show the start practice modal
  const handlePracticeAgain = useCallback(() => {
    setShowStartPracticeModal(true)
  }, [])

  // Determine header text based on session state
  // Only shown for photo-only sessions and no-session state
  // (SessionSummary handles its own header for sessions with problems)
  const headerTitle = isInProgress
    ? 'Session In Progress'
    : session
      ? 'Practice Session'
      : 'No Sessions Yet'

  const headerSubtitle = isInProgress
    ? `${player.name} is currently practicing`
    : session
      ? hasPhotos
        ? 'Photos from practice'
        : 'Add photos from practice'
      : `${player.name} hasn't completed any sessions yet`

  return (
    <SessionModeBannerProvider sessionMode={sessionMode ?? null} isLoading={isLoadingSessionMode}>
      <BannerActionRegistrar onAction={handlePracticeAgain} />
      {/* Single ProjectingBanner renders at provider level */}
      <ProjectingBanner />
      <PageWithNav>
        {/* Practice Sub-Navigation */}
        <PracticeSubNav student={player} pageContext="summary" />

        <main
          data-component="practice-summary-page"
          className={css({
            minHeight: '100vh',
            backgroundColor: isDark ? 'gray.900' : 'gray.50',
            paddingTop: '2rem',
            paddingLeft: '2rem',
            paddingRight: '2rem',
            paddingBottom: '2rem',
          })}
        >
          <div
            className={css({
              maxWidth: '800px',
              margin: '0 auto',
            })}
          >
            {/* Header - only show when SessionSummary won't (photo-only or no session) */}
            {!hasProblems && (
              <header
                className={css({
                  textAlign: 'center',
                  marginBottom: '2rem',
                })}
              >
                <h1
                  className={css({
                    fontSize: '1.5rem',
                    fontWeight: 'bold',
                    color: isDark ? 'white' : 'gray.800',
                    marginBottom: '0.5rem',
                  })}
                >
                  {headerTitle}
                </h1>
                <p
                  className={css({
                    fontSize: '0.875rem',
                    color: isDark ? 'gray.400' : 'gray.600',
                  })}
                >
                  {headerSubtitle}
                </p>
              </header>
            )}

            {/* Session mode banner - renders in-flow, projects to nav on scroll */}
            <ContentBannerSlot
              stickyOffset={STICKY_HEADER_OFFSET}
              className={css({ marginBottom: '1.5rem' })}
            />

            {/* Session Summary or Empty State */}
            {session ? (
              <>
                {/* Only show stats/problems if session has actual problems */}
                {hasProblems && (
                  <SessionSummary
                    plan={session}
                    studentId={studentId}
                    studentName={player.name}
                    problemHistory={problemHistory}
                    justCompleted={justCompleted}
                  />
                )}

                {/* Photos Section - Drop Target */}
                <div
                  data-section="session-photos"
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  className={css({
                    marginTop: hasProblems ? '2rem' : '0',
                    padding: '1.5rem',
                    backgroundColor: isDark ? 'gray.800' : 'white',
                    borderRadius: '16px',
                    border: '2px solid',
                    borderColor: dragOver ? 'blue.400' : isDark ? 'gray.700' : 'gray.200',
                    borderStyle: dragOver ? 'dashed' : 'solid',
                    transition: 'all 0.2s',
                  })}
                >
                  {/* Hidden file input */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleFileSelect}
                    className={css({ display: 'none' })}
                  />

                  {/* Header with action buttons */}
                  <div
                    className={css({
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '1rem',
                      flexWrap: 'wrap',
                      gap: '0.5rem',
                    })}
                  >
                    <h3
                      className={css({
                        fontSize: '1.125rem',
                        fontWeight: 'bold',
                        color: isDark ? 'white' : 'gray.800',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                      })}
                    >
                      <span>📷</span> Practice Photos
                      {hasPhotos && (
                        <span
                          className={css({
                            fontSize: '0.875rem',
                            fontWeight: 'normal',
                            color: isDark ? 'gray.400' : 'gray.500',
                          })}
                        >
                          ({attachments.length})
                        </span>
                      )}
                    </h3>

                    {/* Action buttons */}
                    <div className={css({ display: 'flex', gap: '0.5rem' })}>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                        className={css({
                          px: 3,
                          py: 1.5,
                          bg: isDark ? 'blue.600' : 'blue.500',
                          color: 'white',
                          borderRadius: 'md',
                          fontSize: 'sm',
                          fontWeight: 'medium',
                          cursor: 'pointer',
                          _hover: { bg: isDark ? 'blue.500' : 'blue.600' },
                          _disabled: { opacity: 0.5, cursor: 'not-allowed' },
                        })}
                      >
                        {isUploading ? 'Uploading...' : 'Choose Files'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowCamera(true)}
                        disabled={isUploading}
                        className={css({
                          px: 3,
                          py: 1.5,
                          bg: isDark ? 'green.600' : 'green.500',
                          color: 'white',
                          borderRadius: 'md',
                          fontSize: 'sm',
                          fontWeight: 'medium',
                          cursor: 'pointer',
                          _hover: { bg: isDark ? 'green.500' : 'green.600' },
                          _disabled: { opacity: 0.5, cursor: 'not-allowed' },
                        })}
                      >
                        📷 Camera
                      </button>
                    </div>
                  </div>

                  {/* Upload error */}
                  {uploadError && (
                    <div
                      className={css({
                        mb: 3,
                        p: 2,
                        bg: 'red.50',
                        border: '1px solid',
                        borderColor: 'red.200',
                        borderRadius: 'md',
                        color: 'red.700',
                        fontSize: 'sm',
                      })}
                    >
                      {uploadError}
                    </div>
                  )}

                  {/* Photo grid or empty state */}
                  {hasPhotos ? (
                    <div
                      className={css({
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
                        gap: '0.75rem',
                      })}
                    >
                      {attachments.map((att) => (
                        <div
                          key={att.id}
                          className={css({
                            aspectRatio: '1',
                            borderRadius: 'lg',
                            overflow: 'hidden',
                            bg: 'gray.100',
                          })}
                        >
                          {/* biome-ignore lint/a11y/useAltText: decorative thumbnail */}
                          {/* biome-ignore lint/performance/noImgElement: API-served images */}
                          <img
                            src={att.url}
                            className={css({
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover',
                            })}
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p
                      className={css({
                        color: isDark ? 'gray.400' : 'gray.500',
                        fontSize: '0.875rem',
                        textAlign: 'center',
                        py: 4,
                      })}
                    >
                      {dragOver
                        ? 'Drop photos here to upload'
                        : 'Drag photos here or use the buttons above'}
                    </p>
                  )}
                </div>
              </>
            ) : (
              <div
                className={css({
                  padding: '3rem',
                  textAlign: 'center',
                  backgroundColor: isDark ? 'gray.800' : 'white',
                  borderRadius: '16px',
                  border: '1px solid',
                  borderColor: isDark ? 'gray.700' : 'gray.200',
                })}
              >
                <p
                  className={css({
                    fontSize: '1.125rem',
                    color: isDark ? 'gray.400' : 'gray.600',
                  })}
                >
                  Start a practice session to see results here.
                </p>
              </div>
            )}
          </div>
        </main>

        {/* Start Practice Modal */}
        {showStartPracticeModal && sessionMode && (
          <StartPracticeModal
            studentId={studentId}
            studentName={player.name}
            focusDescription={sessionMode.focusDescription}
            sessionMode={sessionMode}
            avgSecondsPerProblem={avgSecondsPerProblem}
            existingPlan={null}
            problemHistory={problemHistory}
            onClose={() => setShowStartPracticeModal(false)}
            onStarted={() => setShowStartPracticeModal(false)}
          />
        )}

        {/* Fullscreen Camera Modal */}
        <Dialog.Root open={showCamera} onOpenChange={setShowCamera}>
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
              <Dialog.Title className={css({ srOnly: true })}>Take Photo</Dialog.Title>
              <Dialog.Description className={css({ srOnly: true })}>
                Camera viewfinder. Tap capture to take a photo.
              </Dialog.Description>
              <FullscreenCamera
                onCapture={handleCameraCapture}
                onClose={() => setShowCamera(false)}
              />
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </PageWithNav>
    </SessionModeBannerProvider>
  )
}

// =============================================================================
// Fullscreen Camera Component
// =============================================================================

interface FullscreenCameraProps {
  onCapture: (file: File) => void
  onClose: () => void
}

function FullscreenCamera({ onCapture, onClose }: FullscreenCameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const [isReady, setIsReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isCapturing, setIsCapturing] = useState(false)

  useEffect(() => {
    let cancelled = false

    const startCamera = async () => {
      try {
        const constraints: MediaStreamConstraints = {
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        }

        const stream = await navigator.mediaDevices.getUserMedia(constraints)

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }

        streamRef.current = stream

        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
          if (!cancelled) {
            setIsReady(true)
          }
        }
      } catch (err) {
        if (cancelled) return
        console.error('Camera access error:', err)
        setError('Camera access denied. Please allow camera access and try again.')
      }
    }

    startCamera()

    return () => {
      cancelled = true
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
        streamRef.current = null
      }
    }
  }, [])

  const capturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current) return

    setIsCapturing(true)
    try {
      const video = videoRef.current
      const canvas = canvasRef.current

      canvas.width = video.videoWidth
      canvas.height = video.videoHeight

      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Could not get canvas context')

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => {
            if (b) resolve(b)
            else reject(new Error('Failed to create blob'))
          },
          'image/jpeg',
          0.9
        )
      })

      const file = new File([blob], `photo-${Date.now()}.jpg`, {
        type: 'image/jpeg',
      })

      onCapture(file)
    } catch (err) {
      console.error('Capture error:', err)
      setError('Failed to capture photo. Please try again.')
    } finally {
      setIsCapturing(false)
    }
  }

  return (
    <div
      data-component="fullscreen-camera"
      className={css({
        position: 'absolute',
        inset: 0,
        bg: 'black',
      })}
    >
      <video
        ref={videoRef}
        playsInline
        muted
        className={css({
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
        })}
      />

      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {!isReady && !error && (
        <div
          className={css({
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bg: 'black',
          })}
        >
          <div className={css({ color: 'white', fontSize: 'xl' })}>Starting camera...</div>
        </div>
      )}

      {error && (
        <div
          className={css({
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            bg: 'black',
            p: 6,
          })}
        >
          <div className={css({ color: 'red.400', fontSize: 'lg', textAlign: 'center', mb: 4 })}>
            {error}
          </div>
          <button
            type="button"
            onClick={onClose}
            className={css({
              px: 6,
              py: 3,
              bg: 'white',
              color: 'black',
              borderRadius: 'full',
              fontSize: 'lg',
              fontWeight: 'bold',
              cursor: 'pointer',
            })}
          >
            Close
          </button>
        </div>
      )}

      {!error && (
        <>
          <button
            type="button"
            onClick={onClose}
            className={css({
              position: 'absolute',
              top: 4,
              right: 4,
              width: '48px',
              height: '48px',
              bg: 'rgba(0, 0, 0, 0.5)',
              color: 'white',
              borderRadius: 'full',
              fontSize: '2xl',
              fontWeight: 'bold',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backdropFilter: 'blur(4px)',
              _hover: { bg: 'rgba(0, 0, 0, 0.7)' },
            })}
          >
            ×
          </button>

          <div
            className={css({
              position: 'absolute',
              bottom: 8,
              left: '50%',
              transform: 'translateX(-50%)',
            })}
          >
            <button
              type="button"
              onClick={capturePhoto}
              disabled={isCapturing || !isReady}
              className={css({
                width: '80px',
                height: '80px',
                bg: 'white',
                borderRadius: 'full',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
                border: '4px solid',
                borderColor: 'gray.300',
                transition: 'all 0.15s',
                _hover: { transform: 'scale(1.05)' },
                _active: { transform: 'scale(0.95)' },
                _disabled: { opacity: 0.5, cursor: 'not-allowed' },
              })}
            >
              {isCapturing ? (
                <div className={css({ fontSize: 'sm', color: 'gray.600' })}>...</div>
              ) : (
                <div
                  className={css({
                    width: '64px',
                    height: '64px',
                    bg: 'white',
                    borderRadius: 'full',
                    border: '2px solid',
                    borderColor: 'gray.400',
                  })}
                />
              )}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
