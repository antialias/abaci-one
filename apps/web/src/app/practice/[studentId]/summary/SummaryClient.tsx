'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useState } from 'react'
import { PageWithNav } from '@/components/PageWithNav'
import {
  ContentBannerSlot,
  PracticeSubNav,
  ProjectingBanner,
  SessionPhotoGallery,
  SessionSummary,
  StartPracticeModal,
} from '@/components/practice'
import { api } from '@/lib/queryClient'
import { useTheme } from '@/contexts/ThemeContext'
import {
  SessionModeBannerProvider,
  useSessionModeBanner,
} from '@/contexts/SessionModeBannerContext'
import type { Player } from '@/db/schema/players'
import type { SessionPlan } from '@/db/schema/session-plans'
import { useSessionMode } from '@/hooks/useSessionMode'
import type { ProblemResultWithContext } from '@/lib/curriculum/session-planner'
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
}: SummaryClientProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const [showStartPracticeModal, setShowStartPracticeModal] = useState(false)
  const [showPhotoGallery, setShowPhotoGallery] = useState(false)
  const [galleryUploadMode, setGalleryUploadMode] = useState(false)

  // Session mode - single source of truth for session planning decisions
  const { data: sessionMode, isLoading: isLoadingSessionMode } = useSessionMode(studentId)

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

  const queryClient = useQueryClient()

  // Handle opening gallery for viewing photos
  const handleViewPhotos = useCallback(() => {
    setGalleryUploadMode(false)
    setShowPhotoGallery(true)
  }, [])

  // Handle opening gallery for adding photos
  const handleAddPhotos = useCallback(() => {
    setGalleryUploadMode(true)
    setShowPhotoGallery(true)
  }, [])

  // Refresh attachments query after upload
  const handlePhotosUploaded = useCallback(() => {
    queryClient.invalidateQueries({
      queryKey: ['session-attachments', studentId, session?.id],
    })
  }, [queryClient, studentId, session?.id])

  // Handle practice again - show the start practice modal
  const handlePracticeAgain = useCallback(() => {
    setShowStartPracticeModal(true)
  }, [])

  // Determine header text based on session state
  const headerTitle = isInProgress
    ? 'Session In Progress'
    : session
      ? 'Session Complete'
      : 'No Sessions Yet'

  const headerSubtitle = isInProgress
    ? `${player.name} is currently practicing`
    : session
      ? 'Great work on your practice session!'
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
            {/* Header */}
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

            {/* Session mode banner - renders in-flow, projects to nav on scroll */}
            <ContentBannerSlot
              stickyOffset={STICKY_HEADER_OFFSET}
              className={css({ marginBottom: '1.5rem' })}
            />

            {/* Session Summary or Empty State */}
            {session ? (
              <>
                <SessionSummary
                  plan={session}
                  studentId={studentId}
                  studentName={player.name}
                  onPracticeAgain={handlePracticeAgain}
                  problemHistory={problemHistory}
                />

                {/* Photos Section */}
                <div
                  data-section="session-photos"
                  className={css({
                    marginTop: '2rem',
                    padding: '1.5rem',
                    backgroundColor: isDark ? 'gray.800' : 'white',
                    borderRadius: '16px',
                    border: '1px solid',
                    borderColor: isDark ? 'gray.700' : 'gray.200',
                  })}
                >
                  <div
                    className={css({
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '1rem',
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
                    <button
                      type="button"
                      onClick={handleAddPhotos}
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
                      })}
                    >
                      Add Photos
                    </button>
                  </div>

                  {hasPhotos ? (
                    <div
                      className={css({
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
                        gap: '0.75rem',
                      })}
                    >
                      {attachments.slice(0, 6).map((att) => (
                        <button
                          key={att.id}
                          type="button"
                          onClick={handleViewPhotos}
                          className={css({
                            aspectRatio: '1',
                            borderRadius: 'lg',
                            overflow: 'hidden',
                            bg: 'gray.100',
                            cursor: 'pointer',
                            border: '2px solid transparent',
                            transition: 'all 0.15s',
                            _hover: {
                              borderColor: 'blue.500',
                              transform: 'scale(1.02)',
                            },
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
                        </button>
                      ))}
                      {attachments.length > 6 && (
                        <button
                          type="button"
                          onClick={handleViewPhotos}
                          className={css({
                            aspectRatio: '1',
                            borderRadius: 'lg',
                            bg: isDark ? 'gray.700' : 'gray.200',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 'lg',
                            fontWeight: 'bold',
                            color: isDark ? 'gray.300' : 'gray.600',
                            cursor: 'pointer',
                            _hover: {
                              bg: isDark ? 'gray.600' : 'gray.300',
                            },
                          })}
                        >
                          +{attachments.length - 6}
                        </button>
                      )}
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
                      No photos attached. Add photos of student work to keep a visual record.
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
                    marginBottom: '1.5rem',
                  })}
                >
                  Start a practice session to see results here.
                </p>
                <button
                  type="button"
                  onClick={handlePracticeAgain}
                  className={css({
                    padding: '0.75rem 1.5rem',
                    fontSize: '1rem',
                    fontWeight: 'bold',
                    color: 'white',
                    backgroundColor: 'blue.500',
                    borderRadius: '8px',
                    border: 'none',
                    cursor: 'pointer',
                    _hover: { backgroundColor: 'blue.600' },
                  })}
                >
                  Start Practice
                </button>
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

        {/* Photo Gallery Modal */}
        {showPhotoGallery && session && (
          <SessionPhotoGallery
            playerId={studentId}
            sessionId={session.id}
            isOpen={true}
            onClose={() => setShowPhotoGallery(false)}
            initialShowUpload={galleryUploadMode}
            onPhotosUploaded={handlePhotosUploaded}
          />
        )}
      </PageWithNav>
    </SessionModeBannerProvider>
  )
}
