'use client'

import type { ReactNode } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  BoundingBoxOverlay,
  DebugContentModal,
  EditableProblemRow,
  type ProblemCorrection,
  ProblemReviewFlow,
} from '@/components/worksheet-parsing'
import { Z_INDEX } from '@/constants/zIndex'
import { useVisualDebug } from '@/contexts/VisualDebugContext'
import { useWorksheetParsingContext } from '@/contexts/WorksheetParsingContext'
import type { ReviewProgress, WorksheetParsingResult } from '@/lib/worksheet-parsing'
import { cropImageWithCanvas } from '@/lib/worksheet-parsing'
import { css } from '../../../styled-system/css'
import { DocumentAdjuster } from './DocumentAdjuster'
import { LLMDebugPanel } from './LLMDebugPanel'
import { ReparseHintsModal } from './ReparseHintsModal'
import { ReviewToolbar } from './ReviewToolbar'
import { useDocumentDetection } from './useDocumentDetection'

/** LLM metadata for debugging */
export interface LLMMetadata {
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
}

export interface PhotoViewerEditorPhoto {
  id: string
  url: string
  originalUrl: string | null
  corners: Array<{ x: number; y: number }> | null
  rotation: 0 | 90 | 180 | 270
  /** Parsing status for this photo */
  parsingStatus?: 'pending' | 'processing' | 'needs_review' | 'approved' | 'failed' | null
  /** Number of problems found (if parsed) */
  problemCount?: number
  /** Whether a session was created from this photo */
  sessionCreated?: boolean
  /** Full parsing result for review mode */
  rawParsingResult?: WorksheetParsingResult | null
  /** LLM metadata for debugging */
  llm?: LLMMetadata | null
  /** Review progress for resumable review flow */
  reviewProgress?: ReviewProgress | null
}

export interface PhotoViewerEditorProps {
  /** Array of photos to display */
  photos: PhotoViewerEditorPhoto[]
  /** Index of the initially selected photo */
  initialIndex: number
  /** Initial mode - 'view' shows photo, 'edit' shows crop UI, 'review' shows parsed problems */
  initialMode: 'view' | 'edit' | 'review'
  /** Whether the viewer is open */
  isOpen: boolean
  /** Callback when viewer should close */
  onClose: () => void
  /** Callback when photo is edited (re-cropped) */
  onEditConfirm: (
    photoId: string,
    croppedFile: File,
    corners: Array<{ x: number; y: number }>,
    rotation: 0 | 90 | 180 | 270
  ) => Promise<void>
  /** Callback to approve parsed worksheet and create session */
  onApprove?: (photoId: string) => void
  /** ID of photo currently being approved (null if none) */
  approvingPhotoId?: string | null
  /** Callback to submit corrections to parsed problems */
  onSubmitCorrection?: (photoId: string, correction: ProblemCorrection) => Promise<void>
  /** Problem number currently being saved (null if none) */
  savingProblemNumber?: number | null
  /** Callback to cancel parsing in progress */
  onCancelParsing?: (photoId: string) => void
  /** Callback when a single problem is approved in focus review mode */
  onApproveProblem?: (photoId: string, problemIndex: number) => Promise<void>
  /** Callback when a single problem is flagged in focus review mode */
  onFlagProblem?: (photoId: string, problemIndex: number) => Promise<void>
  /** Callback when focus review is complete */
  onFocusReviewComplete?: (photoId: string) => void
}

/**
 * PhotoViewerEditor - Unified photo viewer, editor, and review tool
 *
 * Combines the PhotoLightbox viewing experience with DocumentAdjuster editing:
 * - View mode: Full-screen photo view with navigation (prev/next, keyboard)
 * - Edit mode: DocumentAdjuster crop/rotate UI
 * - Review mode: Split-view with bounding boxes and problem list for parsed worksheets
 * - Seamless toggle between modes
 */
export function PhotoViewerEditor({
  photos,
  initialIndex,
  initialMode,
  isOpen,
  onClose,
  onEditConfirm,
  onApprove,
  approvingPhotoId = null,
  onSubmitCorrection,
  savingProblemNumber = null,
  onCancelParsing,
  onApproveProblem,
  onFlagProblem,
  onFocusReviewComplete,
}: PhotoViewerEditorProps): ReactNode {
  const [currentIndex, setCurrentIndex] = useState(initialIndex)
  const [mode, setMode] = useState<'view' | 'edit' | 'review'>(initialMode)
  // Review sub-mode: 'list' shows all problems in a list, 'focus' shows one problem at a time
  const [reviewSubMode, setReviewSubMode] = useState<'list' | 'focus'>('list')
  const [selectedProblemIndex, setSelectedProblemIndex] = useState<number | null>(null)
  const [isLoadingOriginal, setIsLoadingOriginal] = useState(false)
  const { isVisualDebugEnabled } = useVisualDebug()
  const reviewImageRef = useRef<HTMLImageElement>(null)
  const [editState, setEditState] = useState<{
    sourceCanvas: HTMLCanvasElement
    corners: Array<{ x: number; y: number }>
    rotation: 0 | 90 | 180 | 270
  } | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  // Re-parse hints modal state
  const [showReparseModal, setShowReparseModal] = useState(false)
  // Selection for selective re-parsing (no mode toggle needed - always selectable)
  const [selectedForReparse, setSelectedForReparse] = useState<Set<number>>(new Set())
  // Adjusted bounding boxes for selected problems (overrides original when re-parsing)
  const [adjustedBoxes, setAdjustedBoxes] = useState<
    Map<number, { x: number; y: number; width: number; height: number }>
  >(new Map())
  // Pre-flight confirmation for re-parse
  const [showReparsePreview, setShowReparsePreview] = useState(false)
  // Cropped image previews for re-parse confirmation (keyed by problem index)
  const [croppedPreviews, setCroppedPreviews] = useState<Map<number, string>>(new Map())
  // Thumbnails for all problems in the list (keyed by problem index)
  const [problemThumbnails, setProblemThumbnails] = useState<Map<number, string>>(new Map())
  // Flag to prevent auto-reload after saving (which clears editState)
  const [editCompleted, setEditCompleted] = useState(false)
  // Debug content modal state
  const [debugModal, setDebugModal] = useState<{
    isOpen: boolean
    title: string
    content: string
    contentType: 'text' | 'json' | 'markdown'
  }>({ isOpen: false, title: '', content: '', contentType: 'text' })

  // OpenCV is lazy-loaded only when actually needed (when entering edit mode)
  const {
    ensureOpenCVLoaded,
    detectQuadsInImage,
    loadImageToCanvas,
    cv: opencvRef,
  } = useDocumentDetection()

  // Use the worksheet parsing context (required)
  const parsingContext = useWorksheetParsingContext()

  // Derive streaming state from context for the current photo
  // Note: currentPhoto is defined later, but we need these for conditional checks
  // so we'll derive them based on photos[currentIndex]
  const currentPhotoId = photos[currentIndex]?.id
  const streamingState = currentPhotoId ? parsingContext.state.activeStreams.get(currentPhotoId) : undefined
  const isInitialParsing =
    streamingState?.streamType === 'initial' &&
    (streamingState.status === 'connecting' ||
      streamingState.status === 'reasoning' ||
      streamingState.status === 'generating')
  const isReparsing =
    streamingState?.streamType === 'reparse' &&
    (streamingState.status === 'connecting' || streamingState.status === 'processing')
  // Processing is determined by active streams, not database status
  // The task system (background_tasks table) is the source of truth
  const isActuallyProcessing = streamingState !== undefined

  // Handlers using context directly
  const handleParse = useCallback(
    (
      photoId: string,
      additionalContext?: string,
      preservedBoundingBoxes?: Record<
        number,
        { x: number; y: number; width: number; height: number }
      >
    ) => {
      parsingContext.startParse({
        attachmentId: photoId,
        additionalContext,
        preservedBoundingBoxes,
      })
    },
    [parsingContext]
  )

  const handleCancelStreaming = useCallback(() => {
    if (currentPhotoId) {
      parsingContext.cancel(currentPhotoId)
    }
  }, [parsingContext, currentPhotoId])

  const handleCancelStreamingReparse = useCallback(() => {
    if (currentPhotoId) {
      parsingContext.cancel(currentPhotoId)
    }
  }, [parsingContext, currentPhotoId])

  const handleApprove = useCallback(
    (photoId: string) => {
      parsingContext.approve(photoId)
    },
    [parsingContext]
  )

  const handleSubmitCorrection = useCallback(
    async (photoId: string, correction: ProblemCorrection) => {
      await parsingContext.submitCorrection(photoId, [correction])
    },
    [parsingContext]
  )

  const executeReparseSelected = useCallback(
    async (
      photoId: string,
      problemIndices: number[],
      boundingBoxes: Array<{
        x: number
        y: number
        width: number
        height: number
      }>,
      additionalContext?: string
    ) => {
      await parsingContext.startReparse({
        attachmentId: photoId,
        problemIndices,
        boundingBoxes,
        additionalContext,
      })
    },
    [parsingContext]
  )

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(initialIndex)
      setMode(initialMode)
      setEditState(null)
      setEditCompleted(false)
    }
  }, [isOpen, initialIndex, initialMode])

  // Auto-load original for edit mode on open
  // Don't auto-load if edit was completed (user clicked Done) - prevents re-triggering edit mode
  useEffect(() => {
    if (isOpen && initialMode === 'edit' && !editState && !editCompleted) {
      loadOriginalForEditing()
    }
  }, [isOpen, initialMode, editState, editCompleted])

  const currentPhoto = photos[currentIndex]
  const hasMultiple = photos.length > 1

  // Navigate to previous photo (view mode only)
  const goToPrevious = useCallback(() => {
    if (mode === 'view') {
      setCurrentIndex((prev) => (prev > 0 ? prev - 1 : photos.length - 1))
    }
  }, [mode, photos.length])

  // Navigate to next photo (view mode only)
  const goToNext = useCallback(() => {
    if (mode === 'view') {
      setCurrentIndex((prev) => (prev < photos.length - 1 ? prev + 1 : 0))
    }
  }, [mode, photos.length])

  // Load original image for editing
  const loadOriginalForEditing = useCallback(async () => {
    if (!currentPhoto) return

    setIsLoadingOriginal(true)
    try {
      // Fetch original image (falls back to cropped for legacy attachments)
      const originalUrl = currentPhoto.originalUrl || currentPhoto.url
      const response = await fetch(originalUrl)
      if (!response.ok) throw new Error('Failed to load original image')

      const blob = await response.blob()
      const file = new File([blob], 'original.jpg', { type: blob.type })

      // Load image to canvas (doesn't require OpenCV)
      const canvas = await loadImageToCanvas(file)
      if (!canvas) throw new Error('Failed to load image to canvas')

      // Always load OpenCV - DocumentAdjuster needs it for perspective transform preview
      await ensureOpenCVLoaded()

      // Use saved corners if available, otherwise detect
      let corners: Array<{ x: number; y: number }>
      if (currentPhoto.corners && currentPhoto.corners.length === 4) {
        corners = currentPhoto.corners
      } else {
        // Detect quads (OpenCV already loaded above)
        const result = detectQuadsInImage(canvas)
        corners = result.corners
      }

      // Use saved rotation if available
      const rotation = currentPhoto.rotation || 0

      setEditState({ sourceCanvas: canvas, corners, rotation })
      setMode('edit')
    } catch (err) {
      console.error('Failed to load original for editing:', err)
    } finally {
      setIsLoadingOriginal(false)
    }
  }, [currentPhoto, loadImageToCanvas, ensureOpenCVLoaded, detectQuadsInImage])

  // Handle entering edit mode
  const handleEnterEditMode = useCallback(() => {
    if (editState) {
      // Already loaded, just switch mode
      setMode('edit')
    } else {
      // Need to load original
      loadOriginalForEditing()
    }
  }, [editState, loadOriginalForEditing])

  // Handle edit confirm
  const handleEditConfirm = useCallback(
    async (
      croppedFile: File,
      corners: Array<{ x: number; y: number }>,
      rotation: 0 | 90 | 180 | 270
    ) => {
      if (!currentPhoto) return

      setIsSaving(true)
      try {
        await onEditConfirm(currentPhoto.id, croppedFile, corners, rotation)
        // Mark edit as completed before clearing state to prevent auto-reload
        setEditCompleted(true)
        // After saving, clear edit state so it reloads with new data next time
        setEditState(null)

        // If opened directly in edit mode, close the viewer entirely
        // Otherwise, return to view mode
        if (initialMode === 'edit') {
          onClose()
        } else {
          setMode('view')
        }
      } catch (err) {
        console.error('Failed to save edit:', err)
      } finally {
        setIsSaving(false)
      }
    },
    [currentPhoto, onEditConfirm, initialMode, onClose]
  )

  // Handle edit cancel - return to view mode, or close if opened directly in edit mode
  const handleEditCancel = useCallback(() => {
    if (initialMode === 'edit') {
      onClose()
    } else {
      setMode('view')
    }
  }, [initialMode, onClose])

  // Toggle a problem for re-parsing
  const toggleProblemForReparse = useCallback((index: number) => {
    setSelectedForReparse((prev) => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }, [])

  // Clear all selections
  const clearSelections = useCallback(() => {
    setSelectedForReparse(new Set())
    setAdjustedBoxes(new Map())
  }, [])

  // Handle adjusting a bounding box
  const handleAdjustBox = useCallback(
    (index: number, box: { x: number; y: number; width: number; height: number }) => {
      setAdjustedBoxes((prev) => {
        const next = new Map(prev)
        next.set(index, box)
        return next
      })
    },
    []
  )

  // Show pre-flight confirmation for re-parse
  const handleReparseSelected = useCallback(() => {
    if (!currentPhoto || selectedForReparse.size === 0) return
    setShowReparsePreview(true)
  }, [currentPhoto, selectedForReparse])

  // Cancel pre-flight and go back to selection
  const cancelReparsePreview = useCallback(() => {
    setShowReparsePreview(false)
  }, [])

  // Confirm and execute re-parse
  const confirmReparseSelected = useCallback(async () => {
    if (!currentPhoto || selectedForReparse.size === 0) return

    const problems = currentPhoto.rawParsingResult?.problems ?? []
    const indices = Array.from(selectedForReparse).sort((a, b) => a - b)

    // Use adjusted boxes if available, otherwise use original
    const boundingBoxes = indices
      .map((i) => {
        const adjusted = adjustedBoxes.get(i)
        if (adjusted) return adjusted
        return problems[i]?.problemBoundingBox
      })
      .filter(Boolean) as Array<{
      x: number
      y: number
      width: number
      height: number
    }>

    if (boundingBoxes.length !== indices.length) {
      console.error('Missing bounding boxes for some selected problems')
      return
    }

    // Clear preview mode BEFORE starting the mutation to avoid showing two cancel buttons
    // (one for "cancel preview" and one for "cancel re-parse in progress")
    setShowReparsePreview(false)
    setSelectedForReparse(new Set())
    setAdjustedBoxes(new Map())

    await executeReparseSelected(currentPhoto.id, indices, boundingBoxes)
  }, [currentPhoto, selectedForReparse, adjustedBoxes, executeReparseSelected])

  // Bulk exclude selected problems
  const handleExcludeSelected = useCallback(async () => {
    if (!currentPhoto || selectedForReparse.size === 0) return

    const problems = currentPhoto.rawParsingResult?.problems ?? []
    const indices = Array.from(selectedForReparse).sort((a, b) => a - b)

    // Submit exclude correction for each selected problem
    for (const index of indices) {
      const problem = problems[index]
      if (problem && !problem.excluded) {
        await handleSubmitCorrection(currentPhoto.id, {
          problemNumber: problem.problemNumber,
          shouldExclude: true,
        })
      }
    }

    // Clear selections after excluding
    setSelectedForReparse(new Set())
    setAdjustedBoxes(new Map())
  }, [currentPhoto, selectedForReparse, handleSubmitCorrection])

  // Bulk restore selected problems
  const handleRestoreSelected = useCallback(async () => {
    if (!currentPhoto || selectedForReparse.size === 0) return

    const problems = currentPhoto.rawParsingResult?.problems ?? []
    const indices = Array.from(selectedForReparse).sort((a, b) => a - b)

    // Submit restore correction for each selected excluded problem
    for (const index of indices) {
      const problem = problems[index]
      if (problem?.excluded) {
        await handleSubmitCorrection(currentPhoto.id, {
          problemNumber: problem.problemNumber,
          shouldRestore: true,
        })
      }
    }

    // Clear selections after restoring
    setSelectedForReparse(new Set())
    setAdjustedBoxes(new Map())
  }, [currentPhoto, selectedForReparse, handleSubmitCorrection])

  // Count how many selected problems are excluded vs non-excluded
  const selectedExcludedCount = useMemo(() => {
    if (!currentPhoto || selectedForReparse.size === 0) return { excluded: 0, nonExcluded: 0 }

    const problems = currentPhoto.rawParsingResult?.problems ?? []
    let excluded = 0
    let nonExcluded = 0

    for (const index of selectedForReparse) {
      const problem = problems[index]
      if (problem?.excluded) {
        excluded++
      } else if (problem) {
        nonExcluded++
      }
    }

    return { excluded, nonExcluded }
  }, [currentPhoto, selectedForReparse])

  // Get bounding boxes for preview (memoized for rendering)
  const reparsePreviewData = useMemo(() => {
    if (!currentPhoto || selectedForReparse.size === 0) return []

    const problems = currentPhoto.rawParsingResult?.problems ?? []
    const indices = Array.from(selectedForReparse).sort((a, b) => a - b)

    return indices
      .map((i) => {
        const problem = problems[i]
        if (!problem) return null
        const box = adjustedBoxes.get(i) ?? problem.problemBoundingBox
        const isAdjusted = adjustedBoxes.has(i)
        return { index: i, problem, box, isAdjusted }
      })
      .filter(Boolean) as Array<{
      index: number
      problem: (typeof problems)[number]
      box: { x: number; y: number; width: number; height: number }
      isAdjusted: boolean
    }>
  }, [currentPhoto, selectedForReparse, adjustedBoxes])

  // Generate cropped previews when entering re-parse confirmation
  useEffect(() => {
    if (!showReparsePreview || !currentPhoto || reparsePreviewData.length === 0) {
      setCroppedPreviews(new Map())
      return
    }

    let cancelled = false

    async function generatePreviews() {
      const previews = new Map<number, string>()

      for (const { index, box } of reparsePreviewData) {
        if (cancelled) break
        try {
          const croppedUrl = await cropImageWithCanvas(currentPhoto!.url, box)
          previews.set(index, croppedUrl)
          // Update state progressively so user sees previews appear
          if (!cancelled) {
            setCroppedPreviews(new Map(previews))
          }
        } catch (err) {
          console.error(`Failed to crop preview for problem ${index}:`, err)
        }
      }
    }

    generatePreviews()
    return () => {
      cancelled = true
    }
  }, [showReparsePreview, currentPhoto, reparsePreviewData])

  // Track which photo we last generated thumbnails for
  const lastThumbnailPhotoRef = useRef<string | null>(null)

  // Generate thumbnails for all problems when photo changes
  useEffect(() => {
    const problems = currentPhoto?.rawParsingResult?.problems
    if (!currentPhoto || !problems || problems.length === 0) {
      setProblemThumbnails(new Map())
      lastThumbnailPhotoRef.current = null
      return
    }

    // Only regenerate all if the photo changed
    if (lastThumbnailPhotoRef.current === currentPhoto.id) {
      return
    }
    lastThumbnailPhotoRef.current = currentPhoto.id

    let cancelled = false

    async function generateAllThumbnails() {
      const thumbnails = new Map<number, string>()

      for (let i = 0; i < problems!.length; i++) {
        if (cancelled) break
        const problem = problems![i]
        const box = problem.problemBoundingBox
        try {
          const croppedUrl = await cropImageWithCanvas(currentPhoto!.url, box)
          thumbnails.set(i, croppedUrl)
          // Update state progressively
          if (!cancelled) {
            setProblemThumbnails(new Map(thumbnails))
          }
        } catch (err) {
          console.error(`Failed to generate thumbnail for problem ${i}:`, err)
        }
      }
    }

    generateAllThumbnails()
    return () => {
      cancelled = true
    }
  }, [currentPhoto])

  // Track which adjusted boxes we've already regenerated thumbnails for
  const lastAdjustedBoxesRef = useRef<Map<number, string>>(new Map())

  // Regenerate only the specific thumbnail when a box is adjusted
  useEffect(() => {
    if (!currentPhoto) return

    // Find which indices were newly adjusted or changed
    const indicesToUpdate: number[] = []
    for (const [index, box] of adjustedBoxes) {
      const boxKey = JSON.stringify(box)
      if (lastAdjustedBoxesRef.current.get(index) !== boxKey) {
        indicesToUpdate.push(index)
        lastAdjustedBoxesRef.current.set(index, boxKey)
      }
    }

    if (indicesToUpdate.length === 0) return

    let cancelled = false

    async function updateAdjustedThumbnails() {
      for (const index of indicesToUpdate) {
        if (cancelled) break
        const box = adjustedBoxes.get(index)
        if (!box) continue
        try {
          const croppedUrl = await cropImageWithCanvas(currentPhoto!.url, box)
          if (!cancelled) {
            setProblemThumbnails((prev) => {
              const next = new Map(prev)
              next.set(index, croppedUrl)
              return next
            })
          }
        } catch (err) {
          console.error(`Failed to update thumbnail for problem ${index}:`, err)
        }
      }
    }

    updateAdjustedThumbnails()
    return () => {
      cancelled = true
    }
  }, [currentPhoto, adjustedBoxes])

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return

    function handleKeyDown(e: KeyboardEvent) {
      if (mode === 'edit') {
        // In edit mode, Escape cancels - close if opened in edit mode, otherwise go to view
        if (e.key === 'Escape') {
          if (initialMode === 'edit') {
            onClose()
          } else {
            setMode('view')
          }
        }
        return
      }

      if (mode === 'review') {
        // In review mode, Escape goes back to view mode (or closes if opened in review mode)
        if (e.key === 'Escape') {
          if (initialMode === 'review') {
            onClose()
          } else {
            setMode('view')
            setSelectedProblemIndex(null)
          }
        }
        return
      }

      // View mode keyboard shortcuts
      switch (e.key) {
        case 'Escape':
          onClose()
          break
        case 'ArrowLeft':
          goToPrevious()
          break
        case 'ArrowRight':
          goToNext()
          break
        case 'e':
        case 'E':
          handleEnterEditMode()
          break
        case 'r':
        case 'R':
          // Enter review mode if the current photo has parsing results
          if (currentPhoto?.rawParsingResult) {
            setMode('review')
          }
          break
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [
    isOpen,
    mode,
    initialMode,
    onClose,
    goToPrevious,
    goToNext,
    handleEnterEditMode,
    currentPhoto,
  ])

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = ''
      }
    }
  }, [isOpen])

  if (!isOpen || photos.length === 0) return null

  // Edit mode loading - show loading screen while preparing editor
  if (mode === 'edit' && (!editState || !opencvRef || isLoadingOriginal)) {
    return (
      <div
        data-component="photo-viewer-editor"
        data-mode="edit-loading"
        className={css({
          position: 'fixed',
          inset: 0,
          zIndex: Z_INDEX.MODAL,
          backgroundColor: 'rgba(0, 0, 0, 0.9)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontSize: 'lg',
        })}
      >
        Loading editor...
      </div>
    )
  }

  // Edit mode - show DocumentAdjuster
  if (mode === 'edit' && editState && opencvRef) {
    return (
      <div
        data-component="photo-viewer-editor"
        data-mode="edit"
        className={css({
          position: 'fixed',
          inset: 0,
          zIndex: Z_INDEX.MODAL,
        })}
      >
        <DocumentAdjuster
          sourceCanvas={editState.sourceCanvas}
          initialCorners={editState.corners}
          initialRotation={editState.rotation}
          onConfirm={handleEditConfirm}
          onCancel={handleEditCancel}
          cv={opencvRef}
          detectQuadsInImage={detectQuadsInImage}
        />
        {isSaving && (
          <div
            className={css({
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bg: 'rgba(0, 0, 0, 0.5)',
              color: 'white',
              fontSize: 'xl',
            })}
          >
            Saving...
          </div>
        )}
      </div>
    )
  }

  // Review mode - split-view with image + bounding boxes and problem list
  if (mode === 'review' && currentPhoto?.rawParsingResult) {
    const parsingResult = currentPhoto.rawParsingResult
    const problems = parsingResult.problems ?? []
    const llm = currentPhoto.llm

    return (
      <div
        data-component="photo-viewer-editor"
        data-mode="review"
        className={css({
          position: 'fixed',
          inset: 0,
          zIndex: Z_INDEX.MODAL,
          backgroundColor: 'gray.900',
          display: 'flex',
          flexDirection: 'column',
        })}
      >
        {/* Top toolbar */}
        <ReviewToolbar
          problems={problems}
          parsingResult={parsingResult}
          sessionCreated={currentPhoto.sessionCreated ?? false}
          reviewSubMode={reviewSubMode}
          onReviewSubModeChange={setReviewSubMode}
          showReparsePreview={showReparsePreview}
          selectedForReparseCount={selectedForReparse.size}
          canParse={true}
          isParsing={isInitialParsing}
          isReparsing={isReparsing}
          isApproving={approvingPhotoId === currentPhoto.id}
          canApprove={true}
          onBack={() => {
            setMode('view')
            setSelectedProblemIndex(null)
          }}
          onReparseClick={() => {
            if (showReparsePreview) {
              confirmReparseSelected()
            } else if (selectedForReparse.size > 0) {
              handleReparseSelected()
            } else {
              setShowReparseModal(true)
            }
          }}
          onCancelReparsePreview={cancelReparsePreview}
          onCancelParsing={() => {
            if (onCancelParsing && currentPhoto) {
              onCancelParsing(currentPhoto.id)
            }
          }}
          onApprove={() => {
            if (currentPhoto) {
              handleApprove(currentPhoto.id)
            }
          }}
          onClose={onClose}
        />

        {/* Main content area - switches between focus mode and list mode */}
        <div
          data-element="review-content"
          className={css({
            flex: 1,
            display: 'flex',
            overflow: 'hidden',
          })}
        >
          {reviewSubMode === 'focus' ? (
            /* Focus mode - one problem at a time with ProblemReviewFlow */
            <div
              data-element="focus-review-container"
              className={css({
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                padding: 4,
                overflow: 'auto',
              })}
            >
              <ProblemReviewFlow
                worksheetImageUrl={currentPhoto.url}
                parsingResult={parsingResult}
                reviewProgress={currentPhoto.reviewProgress ?? null}
                onApproveProblem={async (problemIndex) => {
                  if (onApproveProblem && currentPhoto) {
                    await onApproveProblem(currentPhoto.id, problemIndex)
                  }
                }}
                onCorrectProblem={async (problemIndex, correction) => {
                  if (currentPhoto) {
                    await handleSubmitCorrection(currentPhoto.id, correction)
                  }
                }}
                onFlagProblem={async (problemIndex) => {
                  if (onFlagProblem && currentPhoto) {
                    await onFlagProblem(currentPhoto.id, problemIndex)
                  }
                }}
                onReviewComplete={() => {
                  if (onFocusReviewComplete && currentPhoto) {
                    onFocusReviewComplete(currentPhoto.id)
                  }
                }}
                onClose={() => setReviewSubMode('list')}
                isDark={true}
              />
            </div>
          ) : (
            /* List mode - split-view with image and problem list */
            <>
              {/* Left side - Image with bounding boxes */}
              <div
                data-element="review-image-panel"
                className={css({
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 4,
                  backgroundColor: 'gray.950',
                  overflow: 'hidden',
                  position: 'relative',
                })}
              >
                <div
                  data-element="image-container"
                  className={css({
                    position: 'relative',
                    maxWidth: '100%',
                    maxHeight: '100%',
                  })}
                >
                  {/* biome-ignore lint/performance/noImgElement: API-served images */}
                  <img
                    ref={reviewImageRef}
                    src={currentPhoto.url}
                    alt="Worksheet"
                    className={css({
                      maxWidth: '100%',
                      maxHeight: 'calc(100vh - 150px)',
                      objectFit: 'contain',
                      borderRadius: 'lg',
                    })}
                  />
                  {/* Bounding box overlay for parsed problems */}
                  <BoundingBoxOverlay
                    problems={problems}
                    selectedIndex={selectedProblemIndex}
                    onSelectProblem={setSelectedProblemIndex}
                    imageRef={reviewImageRef}
                    debug={isVisualDebugEnabled}
                    selectedForReparse={selectedForReparse}
                    onToggleReparse={toggleProblemForReparse}
                    adjustedBoxes={adjustedBoxes}
                    onAdjustBox={handleAdjustBox}
                  />
                </div>
              </div>

              {/* Right side - Problem list and debug info */}
              <div
                data-element="review-sidebar"
                className={css({
                  width: '400px',
                  flexShrink: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  borderLeft: '1px solid',
                  borderColor: 'gray.700',
                  backgroundColor: 'gray.800',
                  overflow: 'hidden',
                })}
              >
                {/* Problem list */}
                <div
                  data-element="problem-list"
                  className={css({
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'auto',
                    padding: 3,
                    minHeight: 0,
                  })}
                >
                  {/* Header with selection mode toggle */}
                  <h3
                    className={css({
                      fontSize: 'sm',
                      fontWeight: 'semibold',
                      color: 'gray.400',
                      textTransform: 'uppercase',
                      letterSpacing: 'wide',
                      marginBottom: 3,
                    })}
                  >
                    Extracted Problems ({problems.length})
                  </h3>

                  {/* Streaming re-parse progress */}
                  {isReparsing && streamingState ? (
                    <div
                      data-element="streaming-reparse-progress"
                      className={css({
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 3,
                        flex: 1,
                        minHeight: 0,
                      })}
                    >
                      {/* Progress header */}
                      <div
                        className={css({
                          display: 'flex',
                          alignItems: 'center',
                          gap: 2,
                          padding: 3,
                          backgroundColor: 'blue.900',
                          borderRadius: 'lg',
                          border: '2px solid token(colors.blue.600)',
                        })}
                      >
                        <span
                          className={css({
                            fontSize: 'lg',
                            animation: 'spin 1s linear infinite',
                          })}
                        >
                          ⏳
                        </span>
                        <div>
                          <div
                            className={css({
                              fontWeight: 'semibold',
                              color: 'blue.200',
                              fontSize: 'sm',
                            })}
                          >
                            Re-parsing Problems
                          </div>
                          <div
                            className={css({
                              fontSize: 'xs',
                              color: 'blue.300',
                            })}
                          >
                            {streamingState.progressMessage ||
                              `Problem ${(streamingState.currentProblemIndex ?? 0) + 1} of ${streamingState.totalProblems ?? 0}`}
                          </div>
                        </div>
                        {/* Cancel button */}
                        <button
                          type="button"
                          onClick={handleCancelStreamingReparse}
                          className={css({
                            marginLeft: 'auto',
                            padding: '4px 12px',
                            fontSize: 'xs',
                            fontWeight: 'medium',
                            color: 'blue.300',
                            backgroundColor: 'transparent',
                            border: '1px solid token(colors.blue.500)',
                            borderRadius: 'md',
                            cursor: 'pointer',
                            _hover: {
                              backgroundColor: 'blue.800',
                            },
                          })}
                        >
                          Cancel
                        </button>
                      </div>

                      {/* Progress bar */}
                      <div
                        className={css({
                          height: '4px',
                          backgroundColor: 'gray.700',
                          borderRadius: 'full',
                          overflow: 'hidden',
                        })}
                      >
                        <div
                          className={css({
                            height: '100%',
                            backgroundColor: 'blue.500',
                            transition: 'width 0.3s ease',
                          })}
                          style={{
                            width: `${
                              (streamingState.totalProblems ?? 0) > 0
                                ? (
                                    (streamingState.currentProblemIndex ?? 0) /
                                      (streamingState.totalProblems ?? 1)
                                  ) * 100
                                : 0
                            }%`,
                          }}
                        />
                      </div>

                      {/* Reasoning text panel */}
                      {streamingState.reasoningText && (
                        <div
                          className={css({
                            flex: 1,
                            minHeight: 0,
                            overflowY: 'auto',
                            padding: 3,
                            backgroundColor: 'gray.800',
                            borderRadius: 'md',
                            border: '1px solid token(colors.gray.700)',
                          })}
                        >
                          <div
                            className={css({
                              fontSize: 'xs',
                              color: 'gray.500',
                              marginBottom: 2,
                              fontWeight: 'medium',
                            })}
                          >
                            AI Reasoning:
                          </div>
                          <pre
                            className={css({
                              fontSize: 'xs',
                              color: 'gray.400',
                              whiteSpace: 'pre-wrap',
                              wordBreak: 'break-word',
                              fontFamily: 'monospace',
                            })}
                          >
                            {streamingState.reasoningText}
                          </pre>
                        </div>
                      )}

                      {/* Completed problems list */}
                      {(streamingState.completedIndices?.length ?? 0) > 0 && (
                        <div
                          className={css({
                            fontSize: 'xs',
                            color: 'gray.500',
                          })}
                        >
                          Completed:{' '}
                          {(streamingState.completedIndices ?? [])
                            .map((i) => `#${i + 1}`)
                            .join(', ')}
                        </div>
                      )}
                    </div>
                  ) : /* Pre-flight confirmation for re-parse */
                  showReparsePreview ? (
                    <div
                      data-element="reparse-preflight"
                      className={css({
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 3,
                        flex: 1,
                        minHeight: 0,
                      })}
                    >
                      {/* Pre-flight header */}
                      <div
                        className={css({
                          display: 'flex',
                          alignItems: 'center',
                          gap: 2,
                          padding: 3,
                          backgroundColor: 'orange.900',
                          borderRadius: 'lg',
                          border: '2px solid token(colors.orange.600)',
                        })}
                      >
                        <span className={css({ fontSize: 'lg' })}>⚠️</span>
                        <div>
                          <div
                            className={css({
                              fontWeight: 'semibold',
                              color: 'orange.200',
                              fontSize: 'sm',
                            })}
                          >
                            Confirm Re-parse
                          </div>
                          <div
                            className={css({
                              fontSize: 'xs',
                              color: 'orange.300',
                            })}
                          >
                            Review the cropped regions below before proceeding
                          </div>
                        </div>
                      </div>

                      {/* Cropped region previews */}
                      <div
                        className={css({
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 2,
                          flex: 1,
                          overflowY: 'auto',
                          minHeight: 0,
                        })}
                      >
                        {reparsePreviewData.map(({ index, problem, box, isAdjusted }) => (
                          <div
                            key={index}
                            className={css({
                              display: 'flex',
                              gap: 3,
                              padding: 2,
                              backgroundColor: 'gray.800',
                              borderRadius: 'md',
                              border: '1px solid token(colors.gray.700)',
                            })}
                          >
                            {/* Cropped image preview - exact same crop as sent to LLM */}
                            <div
                              className={css({
                                position: 'relative',
                                minWidth: '80px',
                                maxWidth: '200px',
                                backgroundColor: 'gray.900',
                                borderRadius: 'sm',
                                overflow: 'hidden',
                                flexShrink: 0,
                              })}
                            >
                              {croppedPreviews.get(index) ? (
                                /* biome-ignore lint/performance/noImgElement: Dynamic preview images from canvas */
                                <img
                                  src={croppedPreviews.get(index)}
                                  alt={`Problem ${index + 1} cropped region`}
                                  className={css({
                                    display: 'block',
                                    width: '100%',
                                    height: 'auto',
                                  })}
                                />
                              ) : (
                                <div
                                  className={css({
                                    width: '120px',
                                    height: '80px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'gray.500',
                                    fontSize: 'xs',
                                  })}
                                >
                                  Loading...
                                </div>
                              )}
                              {isAdjusted && (
                                <div
                                  className={css({
                                    position: 'absolute',
                                    top: 1,
                                    right: 1,
                                    padding: '2px 4px',
                                    backgroundColor: 'orange.600',
                                    borderRadius: 'sm',
                                    fontSize: '10px',
                                    color: 'white',
                                    fontWeight: 'bold',
                                  })}
                                >
                                  ✎ Adjusted
                                </div>
                              )}
                            </div>

                            {/* Problem info */}
                            <div className={css({ flex: 1, minWidth: 0 })}>
                              <div
                                className={css({
                                  fontWeight: 'medium',
                                  color: 'gray.200',
                                  fontSize: 'sm',
                                  marginBottom: 1,
                                })}
                              >
                                Problem #{index + 1}
                              </div>
                              <div
                                className={css({
                                  fontSize: 'xs',
                                  color: 'gray.400',
                                })}
                              >
                                {problem.terms
                                  .map((t, i) =>
                                    i === 0 ? t : t >= 0 ? ` + ${t}` : ` − ${Math.abs(t)}`
                                  )
                                  .join('')}{' '}
                                = {problem.studentAnswer ?? '?'}
                              </div>
                              <div
                                className={css({
                                  fontSize: 'xs',
                                  color: 'gray.500',
                                  marginTop: 1,
                                })}
                              >
                                Region: {(box.x * 100).toFixed(0)}%, {(box.y * 100).toFixed(0)}% →{' '}
                                {((box.x + box.width) * 100).toFixed(0)}%,{' '}
                                {((box.y + box.height) * 100).toFixed(0)}%
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : problems.length === 0 ? (
                    <div className={css({ color: 'gray.500', fontSize: 'sm' })}>
                      No problems extracted from this worksheet.
                    </div>
                  ) : (
                    <div
                      className={css({
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 2,
                      })}
                    >
                      {problems.map((problem, index) => (
                        <EditableProblemRow
                          key={problem.problemNumber ?? index}
                          problem={problem}
                          index={index}
                          isSelected={selectedProblemIndex === index}
                          onSelect={() =>
                            setSelectedProblemIndex(selectedProblemIndex === index ? null : index)
                          }
                          onSubmitCorrection={(correction) => {
                            if (currentPhoto) {
                              handleSubmitCorrection(currentPhoto.id, correction)
                            }
                          }}
                          isSaving={savingProblemNumber === problem.problemNumber}
                          isDark={true}
                          hasSelections={selectedForReparse.size > 0}
                          isCheckedForReparse={selectedForReparse.has(index)}
                          onToggleReparse={toggleProblemForReparse}
                          thumbnailUrl={problemThumbnails.get(index)}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Selection info bar - fixed footer outside scrollable area */}
                {selectedForReparse.size > 0 && !showReparsePreview && (
                  <div
                    data-element="selection-toolbar"
                    className={css({
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 2,
                      padding: '8px 12px',
                      borderTop: '1px solid',
                      borderColor: 'gray.700',
                      backgroundColor: 'gray.850',
                      flexShrink: 0,
                    })}
                  >
                    <div
                      className={css({
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      })}
                    >
                      <span className={css({ fontSize: 'sm', color: 'gray.400' })}>
                        {selectedForReparse.size} problem
                        {selectedForReparse.size === 1 ? '' : 's'} selected
                      </span>
                      <button
                        type="button"
                        data-action="clear-selection"
                        onClick={clearSelections}
                        className={css({
                          padding: '4px 12px',
                          fontSize: 'sm',
                          color: 'gray.400',
                          backgroundColor: 'transparent',
                          border: 'none',
                          borderRadius: 'md',
                          cursor: 'pointer',
                          _hover: {
                            backgroundColor: 'gray.700',
                            color: 'gray.300',
                          },
                        })}
                      >
                        Clear
                      </button>
                    </div>
                    {/* Bulk action buttons */}
                    <div
                      className={css({
                        display: 'flex',
                        gap: 2,
                      })}
                    >
                      {/* Exclude button - only show if there are non-excluded problems selected */}
                      {selectedExcludedCount.nonExcluded > 0 && (
                        <button
                          type="button"
                          data-action="exclude-selected"
                          onClick={handleExcludeSelected}
                          className={css({
                            flex: 1,
                            padding: '6px 12px',
                            fontSize: 'sm',
                            fontWeight: 'medium',
                            color: 'red.300',
                            backgroundColor: 'red.900/30',
                            border: '1px solid token(colors.red.700)',
                            borderRadius: 'md',
                            cursor: 'pointer',
                            _hover: {
                              backgroundColor: 'red.900/50',
                            },
                          })}
                        >
                          Exclude ({selectedExcludedCount.nonExcluded})
                        </button>
                      )}
                      {/* Restore button - only show if there are excluded problems selected */}
                      {selectedExcludedCount.excluded > 0 && (
                        <button
                          type="button"
                          data-action="restore-selected"
                          onClick={handleRestoreSelected}
                          className={css({
                            flex: 1,
                            padding: '6px 12px',
                            fontSize: 'sm',
                            fontWeight: 'medium',
                            color: 'green.300',
                            backgroundColor: 'green.900/30',
                            border: '1px solid token(colors.green.700)',
                            borderRadius: 'md',
                            cursor: 'pointer',
                            _hover: {
                              backgroundColor: 'green.900/50',
                            },
                          })}
                        >
                          Restore ({selectedExcludedCount.excluded})
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Debug panel - LLM metadata (only shown when visual debug is enabled) */}
                {isVisualDebugEnabled && llm && (
                  <LLMDebugPanel
                    llm={llm}
                    onViewContent={(title, content, contentType) =>
                      setDebugModal({
                        isOpen: true,
                        title,
                        content,
                        contentType,
                      })
                    }
                  />
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer keyboard hints */}
        <div
          data-element="review-footer"
          className={css({
            textAlign: 'center',
            padding: 2,
            fontSize: 'xs',
            color: 'gray.600',
            borderTop: '1px solid',
            borderColor: 'gray.800',
          })}
        >
          Click a problem to highlight it on the image • Esc to go back
        </div>

        {/* Debug content modal */}
        <DebugContentModal
          title={debugModal.title}
          content={debugModal.content}
          contentType={debugModal.contentType}
          isOpen={debugModal.isOpen}
          onClose={() => setDebugModal((prev) => ({ ...prev, isOpen: false }))}
        />

        {/* Re-parse with hints modal */}
        <ReparseHintsModal
          isOpen={showReparseModal}
          onClose={() => setShowReparseModal(false)}
          onConfirm={(hints) => {
            if (currentPhoto) {
              // Pass adjusted bounding boxes if any exist
              const preserved =
                adjustedBoxes.size > 0 ? Object.fromEntries(adjustedBoxes.entries()) : undefined
              handleParse(currentPhoto.id, hints, preserved)
              setShowReparseModal(false)
            }
          }}
          isProcessing={isInitialParsing}
        />
      </div>
    )
  }

  // View mode - show lightbox-style viewer
  return (
    <div
      data-component="photo-viewer-editor"
      data-mode="view"
      className={css({
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: Z_INDEX.MODAL,
        padding: '1rem',
      })}
      onClick={onClose}
    >
      {/* Close button */}
      <button
        type="button"
        data-action="close-viewer"
        onClick={onClose}
        className={css({
          position: 'absolute',
          top: '1rem',
          right: '1rem',
          width: '44px',
          height: '44px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '2rem',
          color: 'white',
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
          border: 'none',
          borderRadius: '50%',
          cursor: 'pointer',
          transition: 'background-color 0.2s',
          _hover: {
            backgroundColor: 'rgba(255, 255, 255, 0.2)',
          },
        })}
        aria-label="Close"
      >
        ×
      </button>

      {/* Toolbar - Edit and Parse buttons */}
      <div
        data-element="viewer-toolbar"
        className={css({
          position: 'absolute',
          top: '1rem',
          left: '1rem',
          display: 'flex',
          gap: 2,
        })}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Edit button */}
        <button
          type="button"
          data-action="enter-edit-mode"
          onClick={handleEnterEditMode}
          disabled={isLoadingOriginal}
          className={css({
            px: 4,
            py: 2,
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            fontSize: 'sm',
            fontWeight: 'medium',
            color: 'white',
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            border: 'none',
            borderRadius: 'lg',
            cursor: 'pointer',
            transition: 'background-color 0.2s',
            _hover: {
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
            },
            _disabled: {
              opacity: 0.5,
              cursor: 'not-allowed',
            },
          })}
          aria-label="Edit photo"
        >
          {isLoadingOriginal ? (
            'Loading...'
          ) : (
            <>
              <span>✏️</span>
              <span>Edit</span>
            </>
          )}
        </button>

        {/* Parse button */}
        {(!currentPhoto.parsingStatus || currentPhoto.parsingStatus === 'failed') &&
          !currentPhoto.sessionCreated && (
            <button
              type="button"
              data-action="parse-worksheet"
              onClick={() => {
                const preserved =
                  adjustedBoxes.size > 0 ? Object.fromEntries(adjustedBoxes.entries()) : undefined
                handleParse(currentPhoto.id, undefined, preserved)
              }}
              disabled={isInitialParsing}
              className={css({
                px: 4,
                py: 2,
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                fontSize: 'sm',
                fontWeight: 'medium',
                color: 'white',
                backgroundColor:
                  currentPhoto.parsingStatus === 'failed' ? 'orange.500' : 'blue.500',
                border: 'none',
                borderRadius: 'lg',
                cursor: 'pointer',
                transition: 'background-color 0.2s',
                _hover: {
                  backgroundColor:
                    currentPhoto.parsingStatus === 'failed' ? 'orange.600' : 'blue.600',
                },
                _disabled: {
                  backgroundColor: 'gray.500',
                  cursor: 'wait',
                },
              })}
              aria-label={
                currentPhoto.parsingStatus === 'failed' ? 'Retry parsing' : 'Parse worksheet'
              }
            >
              {isInitialParsing ? (
                <>
                  <span
                    className={css({
                      animation: 'spin 1s linear infinite',
                    })}
                  >
                    ⏳
                  </span>
                  <span>
                    {streamingState?.status === 'connecting'
                      ? 'Connecting...'
                      : streamingState?.status === 'reasoning'
                        ? 'Thinking...'
                        : streamingState?.status === 'generating'
                          ? 'Extracting...'
                          : 'Analyzing...'}
                  </span>
                </>
              ) : currentPhoto.parsingStatus === 'failed' ? (
                <>
                  <span>🔄</span>
                  <span>Retry Parse</span>
                </>
              ) : (
                <>
                  <span>🔍</span>
                  <span>Parse Worksheet</span>
                </>
              )}
            </button>
          )}

        {/* Streaming Parse Progress Panel */}
        {isInitialParsing && streamingState && (
          <div
            data-element="streaming-parse-progress"
            className={css({
              position: 'absolute',
              bottom: '80px',
              left: '50%',
              transform: 'translateX(-50%)',
              maxWidth: '400px',
              width: '90%',
              backgroundColor: 'rgba(0, 0, 0, 0.9)',
              borderRadius: 'lg',
              padding: 3,
              border: '1px solid token(colors.blue.600)',
              boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5)',
              zIndex: Z_INDEX.MODAL + 1,
            })}
          >
            {/* Header with status and cancel */}
            <div
              className={css({
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 2,
              })}
            >
              <div
                className={css({
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                })}
              >
                <span
                  className={css({
                    animation: 'spin 1s linear infinite',
                  })}
                >
                  ⏳
                </span>
                <span
                  className={css({
                    fontSize: 'sm',
                    fontWeight: 'semibold',
                    color: 'blue.300',
                  })}
                >
                  {streamingState.status === 'connecting'
                    ? 'Connecting to AI...'
                    : streamingState.status === 'reasoning'
                      ? 'AI is analyzing worksheet...'
                      : 'Extracting problems...'}
                </span>
              </div>
              <button
                type="button"
                onClick={handleCancelStreaming}
                className={css({
                  padding: '4px 12px',
                  fontSize: 'xs',
                  fontWeight: 'medium',
                  color: 'gray.400',
                  backgroundColor: 'transparent',
                  border: '1px solid token(colors.gray.600)',
                  borderRadius: 'md',
                  cursor: 'pointer',
                  _hover: {
                    backgroundColor: 'gray.700',
                    color: 'white',
                  },
                })}
              >
                Cancel
              </button>
            </div>

            {/* Reasoning text - collapsible */}
            {streamingState.reasoningText && (
              <div
                className={css({
                  maxHeight: '120px',
                  overflowY: 'auto',
                  padding: 2,
                  backgroundColor: 'gray.800',
                  borderRadius: 'md',
                  fontSize: 'xs',
                  color: 'gray.400',
                  whiteSpace: 'pre-wrap',
                  fontFamily: 'monospace',
                })}
              >
                {streamingState.reasoningText}
              </div>
            )}

            {/* Progress indicator for problems found */}
            {(streamingState.completedProblems?.length ?? 0) > 0 && (
              <div
                className={css({
                  marginTop: 2,
                  fontSize: 'xs',
                  color: 'green.400',
                })}
              >
                Found {streamingState.completedProblems?.length ?? 0} problems...
              </div>
            )}
          </div>
        )}

        {/* Parsing status badge - show result status or active processing indicator */}
        {/* Don't show for 'failed' since retry button is shown instead */}
        {((currentPhoto.parsingStatus &&
          currentPhoto.parsingStatus !== 'failed' &&
          currentPhoto.parsingStatus !== 'processing') ||
          isActuallyProcessing) && (
          <div
            data-element="parsing-status-badge"
            className={css({
              px: 4,
              py: 2,
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              fontSize: 'sm',
              fontWeight: 'medium',
              borderRadius: 'lg',
              backgroundColor: isActuallyProcessing
                ? 'blue.500'
                : currentPhoto.parsingStatus === 'needs_review'
                  ? 'yellow.500'
                  : currentPhoto.parsingStatus === 'approved'
                    ? 'green.500'
                    : 'gray.500',
              color: currentPhoto.parsingStatus === 'needs_review' ? 'yellow.900' : 'white',
            })}
          >
            {isActuallyProcessing && '⏳'}
            {!isActuallyProcessing && currentPhoto.parsingStatus === 'needs_review' && '⚠️'}
            {!isActuallyProcessing && currentPhoto.parsingStatus === 'approved' && '✓'}
            {isActuallyProcessing
              ? 'Analyzing...'
              : currentPhoto.parsingStatus === 'needs_review'
                ? `${currentPhoto.problemCount ?? '?'} problems (needs review)`
                : currentPhoto.parsingStatus === 'approved'
                  ? `${currentPhoto.problemCount ?? '?'} problems`
                  : currentPhoto.parsingStatus}
            {/* Cancel button for processing state */}
            {isActuallyProcessing && onCancelParsing && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onCancelParsing(currentPhoto.id)
                }}
                className={css({
                  marginLeft: '0.5rem',
                  padding: '0.25rem',
                  borderRadius: 'full',
                  backgroundColor: 'rgba(255,255,255,0.2)',
                  color: 'white',
                  fontSize: '0.75rem',
                  lineHeight: '1',
                  cursor: 'pointer',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '20px',
                  height: '20px',
                  _hover: {
                    backgroundColor: 'rgba(255,255,255,0.4)',
                  },
                })}
                title="Cancel parsing"
              >
                ✕
              </button>
            )}
          </div>
        )}

        {/* Session created badge */}
        {currentPhoto.sessionCreated && (
          <div
            data-element="session-created-badge"
            className={css({
              px: 4,
              py: 2,
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              fontSize: 'sm',
              fontWeight: 'medium',
              borderRadius: 'lg',
              backgroundColor: 'green.600',
              color: 'white',
            })}
          >
            ✓ Session Created
          </div>
        )}

        {/* Review button - show if photo has parsing results */}
        {currentPhoto.rawParsingResult && !currentPhoto.sessionCreated && (
          <button
            type="button"
            data-action="enter-review-mode"
            onClick={() => setMode('review')}
            className={css({
              px: 4,
              py: 2,
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              fontSize: 'sm',
              fontWeight: 'medium',
              color: 'white',
              backgroundColor: 'purple.500',
              border: 'none',
              borderRadius: 'lg',
              cursor: 'pointer',
              transition: 'background-color 0.2s',
              _hover: {
                backgroundColor: 'purple.600',
              },
            })}
            aria-label="Review parsed problems"
          >
            <span>📋</span>
            <span>Review ({currentPhoto.rawParsingResult.problems?.length ?? 0})</span>
          </button>
        )}
      </div>

      {/* Previous button */}
      {hasMultiple && (
        <button
          type="button"
          data-action="previous-photo"
          onClick={(e) => {
            e.stopPropagation()
            goToPrevious()
          }}
          className={css({
            position: 'absolute',
            left: '1rem',
            top: '50%',
            transform: 'translateY(-50%)',
            width: '48px',
            height: '48px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.5rem',
            color: 'white',
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            border: 'none',
            borderRadius: '50%',
            cursor: 'pointer',
            transition: 'background-color 0.2s',
            _hover: {
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
            },
          })}
          aria-label="Previous photo"
        >
          ◀
        </button>
      )}

      {/* Photo container */}
      <div
        className={css({
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          maxWidth: '100%',
          maxHeight: 'calc(100vh - 120px)',
          padding: '0 60px',
        })}
        onClick={(e) => e.stopPropagation()}
      >
        {/* biome-ignore lint/performance/noImgElement: API-served images */}
        <img
          src={currentPhoto.url}
          alt={`Attachment ${currentIndex + 1}`}
          className={css({
            maxWidth: '100%',
            maxHeight: '100%',
            objectFit: 'contain',
            borderRadius: '8px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
          })}
        />
      </div>

      {/* Next button */}
      {hasMultiple && (
        <button
          type="button"
          data-action="next-photo"
          onClick={(e) => {
            e.stopPropagation()
            goToNext()
          }}
          className={css({
            position: 'absolute',
            right: '1rem',
            top: '50%',
            transform: 'translateY(-50%)',
            width: '48px',
            height: '48px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.5rem',
            color: 'white',
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            border: 'none',
            borderRadius: '50%',
            cursor: 'pointer',
            transition: 'background-color 0.2s',
            _hover: {
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
            },
          })}
          aria-label="Next photo"
        >
          ▶
        </button>
      )}

      {/* Photo counter and keyboard hint */}
      <div
        data-element="viewer-footer"
        className={css({
          position: 'absolute',
          bottom: '1.5rem',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 2,
        })}
      >
        {hasMultiple && (
          <div
            data-element="photo-counter"
            className={css({
              padding: '0.5rem 1rem',
              backgroundColor: 'rgba(0, 0, 0, 0.6)',
              borderRadius: '20px',
              color: 'white',
              fontSize: '0.875rem',
              fontWeight: '500',
            })}
          >
            {currentIndex + 1} / {photos.length}
          </div>
        )}
        <div
          data-element="keyboard-hint"
          className={css({
            color: 'gray.500',
            fontSize: 'xs',
          })}
        >
          Press E to edit{currentPhoto.rawParsingResult ? ' • R to review' : ''} • Arrow keys to
          navigate • Esc to close
        </div>
      </div>
    </div>
  )
}

export default PhotoViewerEditor
