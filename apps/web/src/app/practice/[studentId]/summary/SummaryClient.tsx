'use client'

import { useQuery } from '@tanstack/react-query'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { PageWithNav } from '@/components/PageWithNav'
// Direct imports instead of barrel to reduce compilation scope
import { AllProblemsSection } from '@/components/practice/AllProblemsSection'
import { calculateAutoPauseInfo } from '@/components/practice/autoPauseCalculator'
import { ContentBannerSlot, ProjectingBanner } from '@/components/practice/BannerSlots'
import { CameraModal } from '@/components/practice/CameraModal'
import { DocumentAdjustmentModal } from '@/components/practice/DocumentAdjustmentModal'
import type { OfflineAttachment } from '@/components/practice/OfflineWorkSection'
import { OfflineWorkSection } from '@/components/practice/OfflineWorkSection'
import type { PhotoViewerEditorPhoto } from '@/components/practice/PhotoViewerEditor'
import { PracticeSubNav } from '@/components/practice/PracticeSubNav'
import { ProblemsToReviewPanel } from '@/components/practice/ProblemsToReviewPanel'
import type { ScrollspySection } from '@/components/practice/ScrollspyNav'
import { ScrollspyNav } from '@/components/practice/ScrollspyNav'
import { SessionHero } from '@/components/practice/SessionHero'
import { SkillsPanel } from '@/components/practice/SkillsPanel'

// Dynamic import: StartPracticeModal → SkillTutorialLauncher → TutorialPlayer → @soroban/abacus-react
// This breaks the dependency chain that pulls the entire abacus library into page.js
const StartPracticeModal = dynamic(
  () => import('@/components/practice/StartPracticeModal').then((m) => m.StartPracticeModal),
  { ssr: false }
)

import {
  filterProblemsNeedingAttention,
  getProblemsWithContext,
} from '@/components/practice/sessionSummaryUtils'
import type { ProblemCorrection } from '@/components/worksheet-parsing'
import type { ParsingStatus } from '@/db/schema/practice-attachments'

// Dynamic imports for heavy components (OpenCV, PhotoViewerEditor)
// These are loaded on-demand to reduce initial compilation time
const PhotoViewerEditor = dynamic(
  () => import('@/components/practice/PhotoViewerEditor').then((m) => m.PhotoViewerEditor),
  { ssr: false }
)

const VisionRecordingPlayer = dynamic(
  () => import('@/components/vision/VisionRecordingPlayer').then((m) => m.VisionRecordingPlayer),
  { ssr: false }
)

import { useToast } from '@/components/common/ToastContext'
import { GuestProgressBanner, recordGuestSession } from '@/components/GuestProgressBanner'
import {
  SessionModeBannerProvider,
  useSessionModeBanner,
} from '@/contexts/SessionModeBannerContext'
import { useTheme } from '@/contexts/ThemeContext'
import { WorksheetParsingProvider } from '@/contexts/WorksheetParsingContext'
import type { Player } from '@/db/schema/players'
import type { SessionPlan, SlotResult } from '@/db/schema/session-plans'
import { usePhotoManagement } from '@/hooks/usePhotoManagement'
import { usePhotoViewer } from '@/hooks/usePhotoViewer'
import { canUploadPhotos, usePlayerAccess } from '@/hooks/usePlayerAccess'
import { useSessionMode } from '@/hooks/useSessionMode'
import { useSessionRecording } from '@/hooks/useSessionRecording'
import {
  getPendingAttachmentId,
  useApproveAndCreateSession,
  useCancelParsing,
  useInitializeReview,
  useSubmitCorrections,
  useUnapproveWorksheet,
  useUpdateReviewProgress,
} from '@/hooks/useWorksheetParsing'
import { computeBktFromHistory, type SkillBktResult } from '@/lib/curriculum/bkt'
import type { ProblemResultWithContext } from '@/lib/curriculum/session-planner'
import { api } from '@/lib/queryClient'
import { attachmentKeys } from '@/lib/queryKeys'
import type { SessionAttachmentResponse } from '@/types/attachments'
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
  /** Previous session accuracy (0-1) for trend comparison */
  previousAccuracy?: number | null
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
  previousAccuracy = null,
}: SummaryClientProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const { showSuccess, showError } = useToast()
  const router = useRouter()

  // Record guest session completion for "save your progress" prompts
  useEffect(() => {
    if (justCompleted) {
      recordGuestSession()
    }
  }, [justCompleted])

  // UI state
  const [showStartPracticeModal, setShowStartPracticeModal] = useState(false)

  // Photo management hook (camera, upload, drag-drop, document adjustment)
  const photoManagement = usePhotoManagement({
    studentId,
    sessionId: session?.id,
    onError: (msg) => showError(msg),
  })

  // Photo viewer hook (modal state)
  const photoViewer = usePhotoViewer()

  // Session mode - single source of truth for session planning decisions
  const { data: sessionModeData, isLoading: isLoadingSessionMode } = useSessionMode(studentId)
  const sessionMode = sessionModeData?.sessionMode
  const comfortLevel = sessionModeData?.comfortLevel
  const comfortByMode = sessionModeData?.comfortByMode

  // Player access - pre-flight authorization check for upload capability
  const { data: playerAccess } = usePlayerAccess(studentId)
  const canUpload = canUploadPhotos(playerAccess)

  // Vision recording for this session (if available)
  const { data: recordingData, isLoading: isLoadingRecording } = useSessionRecording(
    studentId,
    session?.id ?? ''
  )

  // Fetch attachments for this session (includes parsing data)
  const { data: attachmentsData } = useQuery({
    queryKey: session?.id ? attachmentKeys.session(studentId, session.id) : ['no-session'],
    queryFn: async (): Promise<{
      attachments: SessionAttachmentResponse[]
    }> => {
      if (!session?.id) return { attachments: [] }
      const res = await api(`curriculum/${studentId}/sessions/${session.id}/attachments`)
      if (!res.ok) return { attachments: [] }
      return res.json() as Promise<{
        attachments: SessionAttachmentResponse[]
      }>
    },
    enabled: !!session?.id,
  })

  // Map API response to OfflineAttachment type (cast parsingStatus and rawParsingResult)
  const attachments: OfflineAttachment[] = (attachmentsData?.attachments ?? []).map((att) => ({
    id: att.id,
    url: att.url,
    parsingStatus: att.parsingStatus as ParsingStatus | null,
    rawParsingResult: att.rawParsingResult as OfflineAttachment['rawParsingResult'],
    needsReview: att.needsReview,
    sessionCreated: att.sessionCreated,
    reviewProgress: att.reviewProgress as OfflineAttachment['reviewProgress'],
  }))

  // Worksheet parsing mutations
  const cancelParsing = useCancelParsing(studentId, session?.id ?? '')

  // Approve and create session mutation
  const approveAndCreateSession = useApproveAndCreateSession(studentId, session?.id ?? '')

  // Submit corrections mutation
  const submitCorrections = useSubmitCorrections(studentId, session?.id ?? '')

  // Initialize review progress mutation (for starting the review workflow)
  const initializeReview = useInitializeReview(studentId, session?.id ?? '')

  // Unapprove/revert worksheet mutation (for testing/corrections)
  const unapproveWorksheet = useUnapproveWorksheet(studentId, session?.id ?? '')

  // Update review progress (for focus review mode individual problem updates)
  const updateReviewProgress = useUpdateReviewProgress(studentId, session?.id ?? '')

  // Map attachments to PhotoViewerEditorPhoto type for the viewer
  const viewerPhotos: PhotoViewerEditorPhoto[] = (attachmentsData?.attachments ?? []).map(
    (att): PhotoViewerEditorPhoto => ({
      id: att.id,
      url: att.url,
      originalUrl: att.originalUrl,
      corners: att.corners,
      rotation: att.rotation,
      parsingStatus: att.parsingStatus as PhotoViewerEditorPhoto['parsingStatus'],
      // Prefer approvedResult (user-corrected) over rawParsingResult (original LLM output)
      problemCount: (
        (att.approvedResult ?? att.rawParsingResult) as {
          problems?: unknown[]
        } | null
      )?.problems?.length,
      sessionCreated: att.sessionCreated,
      rawParsingResult:
        (att.approvedResult ?? att.rawParsingResult)
          ? ((att.approvedResult ?? att.rawParsingResult) as NonNullable<
              PhotoViewerEditorPhoto['rawParsingResult']
            >)
          : null,
      llm: att.llm as PhotoViewerEditorPhoto['llm'],
    })
  )

  const hasPhotos = attachments.length > 0

  const isInProgress = session?.startedAt && !session?.completedAt

  // Check if session has actual problems (not just photos)
  const sessionResults = (session?.results ?? []) as SlotResult[]
  const hasProblems = sessionResults.length > 0

  // Compute current session accuracy for guest banner
  const sessionAccuracy = useMemo(() => {
    if (sessionResults.length === 0) return null
    const correct = sessionResults.filter((r) => r.isCorrect).length
    return correct / sessionResults.length
  }, [sessionResults])

  // Compute BKT from problem history to get skill masteries
  const skillMasteries = useMemo<Record<string, SkillBktResult>>(() => {
    if (!problemHistory || problemHistory.length === 0) {
      return {}
    }
    const bktResult = computeBktFromHistory(problemHistory)
    // Convert array to record for easy lookup
    return Object.fromEntries(bktResult.skills.map((skill) => [skill.skillId, skill]))
  }, [problemHistory])

  // Calculate auto-pause info for determining slow problems
  const autoPauseInfo = useMemo(() => {
    if (!hasProblems)
      return {
        threshold: 0,
        stats: { sampleCount: 0, meanMs: 0, stdDevMs: 0 },
      }
    return calculateAutoPauseInfo(sessionResults)
  }, [hasProblems, sessionResults])

  // Get problems that need attention (incorrect, slow, or used heavy help)
  const problemsNeedingAttention = useMemo(() => {
    if (!session || !hasProblems) return []
    const problemsWithContext = getProblemsWithContext(session)
    return filterProblemsNeedingAttention(problemsWithContext, autoPauseInfo.threshold)
  }, [session, hasProblems, autoPauseInfo.threshold])

  // Define scrollspy sections to match plan: Overview | Skills | Review | Evidence
  const scrollspySections = useMemo<ScrollspySection[]>(() => {
    const sections: ScrollspySection[] = []
    if (hasProblems) {
      sections.push({ id: 'overview', label: 'Overview' })
      sections.push({ id: 'skills', label: 'Skills' })
      sections.push({ id: 'review', label: 'Review' })
    }
    sections.push({ id: 'evidence', label: 'Evidence' })
    return sections
  }, [hasProblems])

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
      <WorksheetParsingProvider playerId={studentId} sessionId={session?.id ?? ''}>
        <BannerActionRegistrar onAction={handlePracticeAgain} />
        {/* Single ProjectingBanner renders at provider level */}
        <ProjectingBanner />
        <PageWithNav>
          {/* Practice Sub-Navigation */}
          <PracticeSubNav student={player} pageContext="summary" />

          {/* Guest save-your-progress banner */}
          <GuestProgressBanner
            sessionAccuracy={sessionAccuracy}
            previousAccuracy={previousAccuracy}
          />

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
                maxWidth: '1400px',
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

              {/* Mobile scrollspy navigation */}
              {session && scrollspySections.length > 1 && (
                <ScrollspyNav
                  sections={scrollspySections}
                  topOffset={STICKY_HEADER_OFFSET + 60}
                  isDark={isDark}
                />
              )}

              {/* Session Summary or Empty State */}
              {session ? (
                <>
                  {/* Responsive two-column layout for desktop
                    Plan: Left (~45%) = Hero + Evidence, Right (~55%) = Skills + Review */}
                  <div
                    data-layout="summary-grid"
                    className={css({
                      display: 'grid',
                      gap: '1.5rem',
                      // Mobile: single column
                      gridTemplateColumns: '1fr',
                      // Desktop (1200px+): two columns per plan spec
                      '@media (min-width: 1200px)': {
                        gridTemplateColumns: hasProblems ? '45% 55%' : '1fr',
                        gap: '2rem',
                        alignItems: 'start',
                      },
                    })}
                  >
                    {/* Left column: Hero + Evidence (Photos + All Problems) */}
                    <div
                      data-column="hero-evidence"
                      className={css({
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '1.5rem',
                        // On mobile, this appears first
                        order: 1,
                      })}
                    >
                      {/* Session Hero - celebration header, stats, trend */}
                      {hasProblems && (
                        <div data-scrollspy-section="overview">
                          <SessionHero
                            plan={session}
                            studentName={player.name}
                            justCompleted={justCompleted}
                            previousAccuracy={previousAccuracy ?? null}
                            isDark={isDark}
                          />
                        </div>
                      )}

                      {/* Vision recording playback (if available) */}
                      {recordingData?.hasRecording &&
                        recordingData.recording?.status === 'ready' &&
                        recordingData.recording?.videoUrl &&
                        recordingData.recording?.durationMs && (
                          <div
                            data-scrollspy-section="recording"
                            className={css({
                              mb: 6,
                              px: { base: 4, md: 0 },
                            })}
                          >
                            <h3
                              className={css({
                                fontSize: 'lg',
                                fontWeight: 'semibold',
                                color: isDark ? 'gray.100' : 'gray.900',
                                mb: 3,
                              })}
                            >
                              Session Recording
                            </h3>
                            <VisionRecordingPlayer
                              videoUrl={recordingData.recording.videoUrl}
                              durationMs={recordingData.recording.durationMs}
                              problemMarkers={recordingData.recording.problemMarkers}
                            />
                          </div>
                        )}

                      {/* Evidence section: Photos + All Problems */}
                      <div data-scrollspy-section="evidence">
                        <OfflineWorkSection
                          attachments={attachments}
                          fileInputRef={photoManagement.fileInputRef}
                          isUploading={photoManagement.isUploading}
                          uploadError={photoManagement.uploadError}
                          deletingId={photoManagement.deletingId}
                          parsingId={null}
                          dragOver={photoManagement.dragOver}
                          isDark={isDark}
                          canUpload={canUpload}
                          studentId={studentId}
                          studentName={player.name}
                          classroomId={playerAccess?.classroomId}
                          onFileSelect={photoManagement.handleFileSelect}
                          onDrop={photoManagement.handleDrop}
                          onDragOver={photoManagement.handleDragOver}
                          onDragLeave={photoManagement.handleDragLeave}
                          onOpenCamera={photoManagement.openCamera}
                          onOpenViewer={photoViewer.open}
                          onDeletePhoto={photoManagement.deletePhoto}
                          onCancelParsing={(attachmentId) => cancelParsing.mutate(attachmentId)}
                          reparsingPhotoId={null}
                          onInitializeReview={async (attachmentId) => {
                            await initializeReview.mutateAsync(attachmentId)
                          }}
                          initializingReviewId={getPendingAttachmentId(initializeReview)}
                          onApproveAll={async (attachmentId) => {
                            try {
                              const result = await approveAndCreateSession.mutateAsync(attachmentId)
                              showSuccess(
                                `Added ${result.problemCount} problems to session (${result.correctCount}/${result.problemCount} correct)`
                              )
                            } catch (err) {
                              showError(
                                err instanceof Error ? err.message : 'Failed to approve worksheet'
                              )
                            }
                          }}
                          approvingId={getPendingAttachmentId(approveAndCreateSession)}
                          onUnapprove={async (attachmentId) => {
                            try {
                              const result = await unapproveWorksheet.mutateAsync(attachmentId)
                              showSuccess(result.message)
                            } catch (err) {
                              showError(
                                err instanceof Error ? err.message : 'Failed to revert worksheet'
                              )
                            }
                          }}
                          unaprovingId={getPendingAttachmentId(unapproveWorksheet)}
                        />
                        {/* All Problems - complete session listing */}
                        {hasProblems && (
                          <div className={css({ marginTop: '1.5rem' })}>
                            <AllProblemsSection plan={session} isDark={isDark} />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right column: Skills + Review */}
                    {hasProblems && (
                      <div
                        data-column="skills-review"
                        className={css({
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '1.5rem',
                          // On mobile, this appears second
                          order: 2,
                          '@media (min-width: 1200px)': {
                            position: 'sticky',
                            top: '160px', // Below nav
                          },
                        })}
                      >
                        {/* Skills Panel */}
                        <div data-scrollspy-section="skills">
                          <SkillsPanel results={sessionResults} isDark={isDark} />
                        </div>

                        {/* Problems to Review */}
                        <div data-scrollspy-section="review">
                          <ProblemsToReviewPanel
                            problems={problemsNeedingAttention}
                            results={sessionResults}
                            skillMasteries={skillMasteries}
                            totalProblems={sessionResults.length}
                            isDark={isDark}
                          />
                        </div>
                      </div>
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
              comfortLevel={comfortLevel}
              comfortByMode={comfortByMode}
              avgSecondsPerProblem={avgSecondsPerProblem}
              existingPlan={null}
              problemHistory={problemHistory}
              onClose={() => setShowStartPracticeModal(false)}
              onStarted={() => setShowStartPracticeModal(false)}
            />
          )}

          {/* Photo Viewer/Editor */}
          <PhotoViewerEditor
            photos={viewerPhotos}
            initialIndex={photoViewer.index}
            initialMode={photoViewer.mode}
            isOpen={photoViewer.isOpen}
            onClose={photoViewer.close}
            onEditConfirm={photoManagement.handlePhotoEditConfirm}
            onApprove={async (attachmentId) => {
              try {
                const result = await approveAndCreateSession.mutateAsync(attachmentId)
                showSuccess(
                  'Session Updated',
                  `${result.problemCount} problem${result.problemCount === 1 ? '' : 's'} added to session`
                )
                // Close the viewer and refresh the page to show updated session data
                photoViewer.close()
                router.refresh()
              } catch (error) {
                showError(
                  'Failed to create session',
                  error instanceof Error ? error.message : 'Please try again'
                )
              }
            }}
            approvingPhotoId={getPendingAttachmentId(approveAndCreateSession)}
            onSubmitCorrection={async (attachmentId, correction) => {
              await submitCorrections.mutateAsync({
                attachmentId,
                corrections: [correction],
              })
            }}
            savingProblemNumber={
              submitCorrections.isPending
                ? ((
                    submitCorrections.variables as {
                      attachmentId: string
                      corrections: ProblemCorrection[]
                    }
                  )?.corrections?.[0]?.problemNumber ?? null)
                : null
            }
            onCancelParsing={(attachmentId) => cancelParsing.mutate(attachmentId)}
            onApproveProblem={async (photoId, problemIndex) => {
              await updateReviewProgress.mutateAsync({
                attachmentId: photoId,
                problemUpdate: {
                  index: problemIndex,
                  reviewStatus: 'approved',
                },
              })
            }}
            onFlagProblem={async (photoId, problemIndex) => {
              await updateReviewProgress.mutateAsync({
                attachmentId: photoId,
                problemUpdate: { index: problemIndex, reviewStatus: 'flagged' },
              })
            }}
            onFocusReviewComplete={async (photoId) => {
              // Mark review as completed and trigger approval flow
              await updateReviewProgress.mutateAsync({
                attachmentId: photoId,
                status: 'completed',
              })
              showSuccess('Review complete', 'All problems have been reviewed')
            }}
          />

          {/* Fullscreen Camera Modal */}
          <CameraModal
            isOpen={photoManagement.showCamera}
            onClose={photoManagement.closeCamera}
            onCapture={photoManagement.handleCameraCapture}
          />

          {/* File Upload Adjustment Modal */}
          <DocumentAdjustmentModal
            state={photoManagement.adjustmentState}
            queueLength={photoManagement.queueLength}
            opencvRef={photoManagement.opencvRef}
            detectQuadsInImage={photoManagement.detectQuadsInImage}
            onConfirm={photoManagement.handleAdjustmentConfirm}
            onSkip={photoManagement.handleAdjustmentSkip}
            onCancel={photoManagement.handleAdjustmentCancel}
          />
        </PageWithNav>
      </WorksheetParsingProvider>
    </SessionModeBannerProvider>
  )
}
