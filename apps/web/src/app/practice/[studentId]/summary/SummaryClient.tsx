'use client'

import * as Dialog from '@radix-ui/react-dialog'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { PageWithNav } from '@/components/PageWithNav'
// Direct imports instead of barrel to reduce compilation scope
import { AllProblemsSection } from '@/components/practice/AllProblemsSection'
import { calculateAutoPauseInfo } from '@/components/practice/autoPauseCalculator'
import { ContentBannerSlot, ProjectingBanner } from '@/components/practice/BannerSlots'
import type { OfflineAttachment } from '@/components/practice/OfflineWorkSection'
import { OfflineWorkSection } from '@/components/practice/OfflineWorkSection'
import type { PhotoViewerEditorPhoto } from '@/components/practice/PhotoViewerEditor'
import { PracticeSubNav } from '@/components/practice/PracticeSubNav'
import { ProblemsToReviewPanel } from '@/components/practice/ProblemsToReviewPanel'
import type { ScrollspySection } from '@/components/practice/ScrollspyNav'
import { ScrollspyNav } from '@/components/practice/ScrollspyNav'
import { SessionHero } from '@/components/practice/SessionHero'
import { SkillsPanel } from '@/components/practice/SkillsPanel'
import { StartPracticeModal } from '@/components/practice/StartPracticeModal'
import {
  filterProblemsNeedingAttention,
  getProblemsWithContext,
} from '@/components/practice/sessionSummaryUtils'
import { useDocumentDetection } from '@/components/practice/useDocumentDetection'
import type { ProblemCorrection } from '@/components/worksheet-parsing'
import { Z_INDEX } from '@/constants/zIndex'
import type { ParsingStatus } from '@/db/schema/practice-attachments'

// Dynamic imports for heavy components (OpenCV, PhotoViewerEditor)
// These are loaded on-demand to reduce initial compilation time
const PhotoViewerEditor = dynamic(
  () => import('@/components/practice/PhotoViewerEditor').then((m) => m.PhotoViewerEditor),
  { ssr: false }
)

const DocumentAdjuster = dynamic(
  () => import('@/components/practice/DocumentAdjuster').then((m) => m.DocumentAdjuster),
  { ssr: false }
)

const FullscreenCamera = dynamic(() => import('./FullscreenCamera'), {
  ssr: false,
})

import { useToast } from '@/components/common/ToastContext'
import {
  SessionModeBannerProvider,
  useSessionModeBanner,
} from '@/contexts/SessionModeBannerContext'
import { useTheme } from '@/contexts/ThemeContext'
import { VisualDebugProvider } from '@/contexts/VisualDebugContext'
import type { Player } from '@/db/schema/players'
import type { SessionPlan, SlotResult } from '@/db/schema/session-plans'
import { canUploadPhotos, usePlayerAccess } from '@/hooks/usePlayerAccess'
import { useSessionMode } from '@/hooks/useSessionMode'
import {
  useApproveAndCreateSession,
  useCancelParsing,
  useInitializeReview,
  useReparseSelected,
  useStartParsing,
  useSubmitCorrections,
} from '@/hooks/useWorksheetParsing'
import { computeBktFromHistory, type SkillBktResult } from '@/lib/curriculum/bkt'
import type { ProblemResultWithContext } from '@/lib/curriculum/session-planner'
import { api } from '@/lib/queryClient'
import { attachmentKeys } from '@/lib/queryKeys'
import { PARSING_MODEL_CONFIGS } from '@/lib/worksheet-parsing'
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

  const [showStartPracticeModal, setShowStartPracticeModal] = useState(false)
  const [showCamera, setShowCamera] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Unified photo viewer/editor state
  const [viewerOpen, setViewerOpen] = useState(false)
  const [viewerIndex, setViewerIndex] = useState(0)
  const [viewerMode, setViewerMode] = useState<'view' | 'edit' | 'review'>('view')

  // File upload adjustment state (for processing files through DocumentAdjuster)
  const [fileQueue, setFileQueue] = useState<File[]>([])
  const [uploadAdjustmentState, setUploadAdjustmentState] = useState<{
    originalFile: File
    sourceCanvas: HTMLCanvasElement
    corners: Array<{ x: number; y: number }>
  } | null>(null)

  // Document detection hook for file uploads and gallery edits
  // OpenCV is lazy-loaded only when actually needed (not on page load)
  const {
    ensureOpenCVLoaded,
    detectQuadsInImage,
    loadImageToCanvas,
    cv: opencvRef,
  } = useDocumentDetection()

  // Session mode - single source of truth for session planning decisions
  const { data: sessionMode, isLoading: isLoadingSessionMode } = useSessionMode(studentId)

  // Player access - pre-flight authorization check for upload capability
  const { data: playerAccess } = usePlayerAccess(studentId)
  const canUpload = canUploadPhotos(playerAccess)

  const queryClient = useQueryClient()

  // Type for session attachment from API
  interface SessionAttachmentResponse {
    id: string
    url: string
    originalUrl: string | null
    corners: Array<{ x: number; y: number }> | null
    rotation: 0 | 90 | 180 | 270
    // Parsing fields
    parsingStatus: string | null
    parsedAt: string | null
    parsingError: string | null
    rawParsingResult: object | null
    approvedResult: object | null
    confidenceScore: number | null
    needsReview: boolean
    sessionCreated: boolean
    createdSessionId: string | null
    // Review progress (for resumable reviews)
    reviewProgress: object | null
    // LLM metadata
    llm: {
      provider: string | null
      model: string | null
      promptUsed: string | null
      rawResponse: string | null
      jsonSchema: string | null
      imageSource: string | null
      attempts: number | null
      usage: {
        promptTokens: number | null
        completionTokens: number | null
        totalTokens: number | null
      }
    } | null
  }

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
  const startParsing = useStartParsing(studentId, session?.id ?? '')
  const cancelParsing = useCancelParsing(studentId, session?.id ?? '')

  // Approve and create session mutation
  const approveAndCreateSession = useApproveAndCreateSession(studentId, session?.id ?? '')

  // Submit corrections mutation
  const submitCorrections = useSubmitCorrections(studentId, session?.id ?? '')

  // Re-parse selected problems mutation
  const reparseSelected = useReparseSelected(studentId, session?.id ?? '')

  // Initialize review progress mutation (for starting the review workflow)
  const initializeReview = useInitializeReview(studentId, session?.id ?? '')

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

  // Upload photos with optional original preservation and corners
  const uploadPhotos = useCallback(
    async (
      photos: File[],
      originals?: File[],
      cornersData?: Array<Array<{ x: number; y: number }> | null>,
      rotationData?: Array<0 | 90 | 180 | 270>
    ) => {
      if (!session?.id || photos.length === 0) return

      setIsUploading(true)
      setUploadError(null)

      try {
        const formData = new FormData()
        for (const file of photos) {
          formData.append('photos', file)
        }
        // Add original files if provided (for cropped uploads)
        if (originals) {
          for (const file of originals) {
            formData.append('originals', file)
          }
        }
        // Add corners data if provided (for restoring crop positions later)
        if (cornersData) {
          for (const corners of cornersData) {
            formData.append('corners', corners ? JSON.stringify(corners) : '')
          }
        }
        // Add rotation data if provided
        if (rotationData) {
          for (const rotation of rotationData) {
            formData.append('rotation', rotation.toString())
          }
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
          queryKey: attachmentKeys.session(studentId, session.id),
        })
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : 'Failed to upload photos')
      } finally {
        setIsUploading(false)
      }
    },
    [studentId, session?.id, queryClient]
  )

  // Process next file in queue - load, detect quads, show adjuster
  const processNextFile = useCallback(async () => {
    if (fileQueue.length === 0) {
      setUploadAdjustmentState(null)
      return
    }

    const nextFile = fileQueue[0]

    // Load file to canvas (doesn't require OpenCV)
    const canvas = await loadImageToCanvas(nextFile)
    if (!canvas) {
      console.warn('Failed to load image:', nextFile.name)
      // Skip this file and process next
      setFileQueue((prev) => prev.slice(1))
      return
    }

    // Ensure OpenCV is loaded before detecting quads (lazy load)
    await ensureOpenCVLoaded()

    // Detect quads (or get fallback corners if OpenCV failed to load)
    const result = detectQuadsInImage(canvas)

    // Show adjustment UI
    setUploadAdjustmentState({
      originalFile: nextFile,
      sourceCanvas: result.sourceCanvas,
      corners: result.corners,
    })
  }, [fileQueue, loadImageToCanvas, ensureOpenCVLoaded, detectQuadsInImage])

  // Start processing queue when files are added
  useEffect(() => {
    if (fileQueue.length > 0 && !uploadAdjustmentState) {
      processNextFile()
    }
  }, [fileQueue, uploadAdjustmentState, processNextFile])

  // Handle adjustment confirm - upload cropped + original with corners and rotation, process next
  const handleUploadAdjustmentConfirm = useCallback(
    async (
      croppedFile: File,
      corners: Array<{ x: number; y: number }>,
      rotation: 0 | 90 | 180 | 270
    ) => {
      if (!uploadAdjustmentState) return

      // Upload both cropped and original, with corners and rotation for later re-editing
      await uploadPhotos([croppedFile], [uploadAdjustmentState.originalFile], [corners], [rotation])

      // Remove from queue and process next
      setFileQueue((prev) => prev.slice(1))
      setUploadAdjustmentState(null)
    },
    [uploadAdjustmentState, uploadPhotos]
  )

  // Handle adjustment skip - upload original only, process next
  const handleUploadAdjustmentSkip = useCallback(async () => {
    if (!uploadAdjustmentState) return

    // Upload original only (no crop)
    await uploadPhotos([uploadAdjustmentState.originalFile])

    // Remove from queue and process next
    setFileQueue((prev) => prev.slice(1))
    setUploadAdjustmentState(null)
  }, [uploadAdjustmentState, uploadPhotos])

  // Handle adjustment cancel - clear queue
  const handleUploadAdjustmentCancel = useCallback(() => {
    setFileQueue([])
    setUploadAdjustmentState(null)
  }, [])

  // Handle photo edit confirm from PhotoViewerEditor
  const handlePhotoEditConfirm = useCallback(
    async (
      photoId: string,
      croppedFile: File,
      corners: Array<{ x: number; y: number }>,
      rotation: 0 | 90 | 180 | 270
    ) => {
      try {
        setIsUploading(true)
        const formData = new FormData()
        formData.append('file', croppedFile)
        formData.append('corners', JSON.stringify(corners))
        formData.append('rotation', rotation.toString())

        const response = await fetch(`/api/curriculum/${studentId}/attachments/${photoId}`, {
          method: 'PATCH',
          body: formData,
        })

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || 'Failed to update photo')
        }

        // Refresh attachments
        if (session?.id) {
          queryClient.invalidateQueries({
            queryKey: attachmentKeys.session(studentId, session.id),
          })
        }
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : 'Failed to update photo')
      } finally {
        setIsUploading(false)
      }
    },
    [studentId, session?.id, queryClient]
  )

  // Handle file selection - queue files for adjustment
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : []
    const imageFiles = files.filter((f) => f.type.startsWith('image/'))
    if (imageFiles.length > 0) {
      setFileQueue((prev) => [...prev, ...imageFiles])
    }
    e.target.value = ''
  }, [])

  // Handle drag and drop - queue files for adjustment
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const files = Array.from(e.dataTransfer.files)
    const imageFiles = files.filter((f) => f.type.startsWith('image/'))
    if (imageFiles.length > 0) {
      setFileQueue((prev) => [...prev, ...imageFiles])
    }
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setDragOver(false)
  }, [])

  // Handle camera capture - receives cropped file, original file, corners, and rotation
  const handleCameraCapture = useCallback(
    (
      croppedFile: File,
      originalFile: File,
      corners: Array<{ x: number; y: number }>,
      rotation: 0 | 90 | 180 | 270
    ) => {
      setShowCamera(false)
      uploadPhotos([croppedFile], [originalFile], [corners], [rotation])
    },
    [uploadPhotos]
  )

  // Handle photo deletion
  const deletePhoto = useCallback(
    async (attachmentId: string) => {
      if (!session?.id) return

      setDeletingId(attachmentId)
      try {
        const response = await fetch(`/api/curriculum/${studentId}/attachments/${attachmentId}`, {
          method: 'DELETE',
        })

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || 'Failed to delete photo')
        }

        // Refresh attachments
        queryClient.invalidateQueries({
          queryKey: attachmentKeys.session(studentId, session.id),
        })
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : 'Failed to delete photo')
      } finally {
        setDeletingId(null)
      }
    },
    [studentId, session?.id, queryClient]
  )

  // Open photo viewer at specific photo with optional mode
  const openViewer = useCallback((index: number, mode: 'view' | 'edit' | 'review') => {
    setViewerIndex(index)
    setViewerMode(mode)
    setViewerOpen(true)
  }, [])

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

                    {/* Evidence section: Photos + All Problems */}
                    <div data-scrollspy-section="evidence">
                      <OfflineWorkSection
                        attachments={attachments}
                        fileInputRef={fileInputRef}
                        isUploading={isUploading}
                        uploadError={uploadError}
                        deletingId={deletingId}
                        parsingId={
                          startParsing.isPending
                            ? typeof startParsing.variables === 'string'
                              ? startParsing.variables
                              : ((startParsing.variables as { attachmentId: string } | undefined)
                                  ?.attachmentId ?? null)
                            : null
                        }
                        dragOver={dragOver}
                        isDark={isDark}
                        canUpload={canUpload}
                        studentId={studentId}
                        studentName={player.name}
                        classroomId={playerAccess?.classroomId}
                        onFileSelect={handleFileSelect}
                        onDrop={handleDrop}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onOpenCamera={() => setShowCamera(true)}
                        onOpenViewer={openViewer}
                        onDeletePhoto={deletePhoto}
                        onParse={(attachmentId) => startParsing.mutate({ attachmentId })}
                        onCancelParsing={(attachmentId) => cancelParsing.mutate(attachmentId)}
                        reparsingPhotoId={
                          reparseSelected.isPending
                            ? ((reparseSelected.variables as { attachmentId: string })
                                ?.attachmentId ?? null)
                            : null
                        }
                        onInitializeReview={async (attachmentId) => {
                          await initializeReview.mutateAsync({ attachmentId })
                        }}
                        initializingReviewId={
                          initializeReview.isPending
                            ? ((initializeReview.variables as { attachmentId: string })
                                ?.attachmentId ?? null)
                            : null
                        }
                        onApproveAll={async (attachmentId) => {
                          await approveAndCreateSession.mutateAsync(attachmentId)
                        }}
                        approvingId={
                          approveAndCreateSession.isPending
                            ? ((approveAndCreateSession.variables as string) ?? null)
                            : null
                        }
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
          initialIndex={viewerIndex}
          initialMode={viewerMode}
          isOpen={viewerOpen}
          onClose={() => setViewerOpen(false)}
          onEditConfirm={handlePhotoEditConfirm}
          onParse={(attachmentId, modelConfigId, additionalContext, preservedBoundingBoxes) =>
            startParsing.mutate({
              attachmentId,
              modelConfigId,
              additionalContext,
              preservedBoundingBoxes,
            })
          }
          parsingPhotoId={
            startParsing.isPending
              ? ((typeof startParsing.variables === 'string'
                  ? startParsing.variables
                  : (startParsing.variables as { attachmentId: string })?.attachmentId) ?? null)
              : null
          }
          modelConfigs={PARSING_MODEL_CONFIGS}
          onApprove={async (attachmentId) => {
            try {
              const result = await approveAndCreateSession.mutateAsync(attachmentId)
              showSuccess(
                'Session Updated',
                `${result.problemCount} problem${result.problemCount === 1 ? '' : 's'} added to session`
              )
              // Close the viewer and refresh the page to show updated session data
              setViewerOpen(false)
              router.refresh()
            } catch (error) {
              showError(
                'Failed to create session',
                error instanceof Error ? error.message : 'Please try again'
              )
            }
          }}
          approvingPhotoId={
            approveAndCreateSession.isPending
              ? ((approveAndCreateSession.variables as string) ?? null)
              : null
          }
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
          onReparseSelected={async (
            attachmentId,
            problemIndices,
            boundingBoxes,
            additionalContext
          ) => {
            await reparseSelected.mutateAsync({
              attachmentId,
              problemIndices,
              boundingBoxes,
              additionalContext,
            })
          }}
          reparsingPhotoId={
            reparseSelected.isPending
              ? ((reparseSelected.variables as { attachmentId: string })?.attachmentId ?? null)
              : null
          }
          onCancelParsing={(attachmentId) => cancelParsing.mutate(attachmentId)}
        />

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
              <VisualDebugProvider>
                <Dialog.Title className={css({ srOnly: true })}>Take Photo</Dialog.Title>
                <Dialog.Description className={css({ srOnly: true })}>
                  Camera viewfinder. Tap capture to take a photo.
                </Dialog.Description>
                <FullscreenCamera
                  onCapture={handleCameraCapture}
                  onClose={() => setShowCamera(false)}
                />
              </VisualDebugProvider>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>

        {/* File Upload Adjustment Modal */}
        {uploadAdjustmentState && opencvRef && (
          <Dialog.Root open={true} onOpenChange={() => handleUploadAdjustmentCancel()}>
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
                  Adjust Photo {fileQueue.length > 0 ? `(1 of ${fileQueue.length + 1})` : ''}
                </Dialog.Title>
                <Dialog.Description className={css({ srOnly: true })}>
                  Drag corners to crop the document. Tap Done to confirm or Skip to use original.
                </Dialog.Description>
                <DocumentAdjuster
                  sourceCanvas={uploadAdjustmentState.sourceCanvas}
                  initialCorners={uploadAdjustmentState.corners}
                  onConfirm={handleUploadAdjustmentConfirm}
                  onCancel={handleUploadAdjustmentCancel}
                  onSkip={handleUploadAdjustmentSkip}
                  cv={opencvRef}
                  detectQuadsInImage={detectQuadsInImage}
                />
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
        )}
      </PageWithNav>
    </SessionModeBannerProvider>
  )
}
