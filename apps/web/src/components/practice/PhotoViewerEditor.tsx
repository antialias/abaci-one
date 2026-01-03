"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Z_INDEX } from "@/constants/zIndex";
import { css } from "../../../styled-system/css";
import { DocumentAdjuster } from "./DocumentAdjuster";
import { useDocumentDetection } from "./useDocumentDetection";
import {
  BoundingBoxOverlay,
  DebugContentModal,
  EditableProblemRow,
  type ProblemCorrection,
} from "@/components/worksheet-parsing";

import type {
  WorksheetParsingResult,
  ModelConfig,
} from "@/lib/worksheet-parsing";
import { cropImageWithCanvas } from "@/lib/worksheet-parsing";
import { useVisualDebug } from "@/contexts/VisualDebugContext";

/** LLM metadata for debugging */
export interface LLMMetadata {
  provider: string | null;
  model: string | null;
  promptUsed: string | null;
  rawResponse: string | null;
  jsonSchema: string | null;
  imageSource: string | null;
  attempts: number | null;
  usage: {
    promptTokens: number | null;
    completionTokens: number | null;
    totalTokens: number | null;
  };
}

export interface PhotoViewerEditorPhoto {
  id: string;
  url: string;
  originalUrl: string | null;
  corners: Array<{ x: number; y: number }> | null;
  rotation: 0 | 90 | 180 | 270;
  /** Parsing status for this photo */
  parsingStatus?:
    | "pending"
    | "processing"
    | "needs_review"
    | "approved"
    | "failed"
    | null;
  /** Number of problems found (if parsed) */
  problemCount?: number;
  /** Whether a session was created from this photo */
  sessionCreated?: boolean;
  /** Full parsing result for review mode */
  rawParsingResult?: WorksheetParsingResult | null;
  /** LLM metadata for debugging */
  llm?: LLMMetadata | null;
}

interface PhotoViewerEditorProps {
  /** Array of photos to display */
  photos: PhotoViewerEditorPhoto[];
  /** Index of the initially selected photo */
  initialIndex: number;
  /** Initial mode - 'view' shows photo, 'edit' shows crop UI, 'review' shows parsed problems */
  initialMode: "view" | "edit" | "review";
  /** Whether the viewer is open */
  isOpen: boolean;
  /** Callback when viewer should close */
  onClose: () => void;
  /** Callback when photo is edited (re-cropped) */
  onEditConfirm: (
    photoId: string,
    croppedFile: File,
    corners: Array<{ x: number; y: number }>,
    rotation: 0 | 90 | 180 | 270,
  ) => Promise<void>;
  /** Callback to parse worksheet (optional - if not provided, no parse button shown) */
  onParse?: (
    photoId: string,
    modelConfigId?: string,
    additionalContext?: string,
    preservedBoundingBoxes?: Record<
      number,
      { x: number; y: number; width: number; height: number }
    >,
  ) => void;
  /** ID of the photo currently being parsed (null if none) */
  parsingPhotoId?: string | null;
  /** Available model configurations for parsing */
  modelConfigs?: ModelConfig[];
  /** Callback to approve parsed worksheet and create session */
  onApprove?: (photoId: string) => void;
  /** ID of photo currently being approved (null if none) */
  approvingPhotoId?: string | null;
  /** Callback to submit corrections to parsed problems */
  onSubmitCorrection?: (
    photoId: string,
    correction: ProblemCorrection,
  ) => Promise<void>;
  /** Problem number currently being saved (null if none) */
  savingProblemNumber?: number | null;
  /** Callback to re-parse selected problems */
  onReparseSelected?: (
    photoId: string,
    problemIndices: number[],
    boundingBoxes: Array<{
      x: number;
      y: number;
      width: number;
      height: number;
    }>,
    additionalContext?: string,
  ) => Promise<void>;
  /** Whether selective re-parsing is in progress */
  isReparsingSelected?: boolean;
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
  onParse,
  parsingPhotoId = null,
  modelConfigs = [],
  onApprove,
  approvingPhotoId = null,
  onSubmitCorrection,
  savingProblemNumber = null,
  onReparseSelected,
  isReparsingSelected = false,
}: PhotoViewerEditorProps): ReactNode {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [mode, setMode] = useState<"view" | "edit" | "review">(initialMode);
  const [selectedProblemIndex, setSelectedProblemIndex] = useState<
    number | null
  >(null);
  const [isLoadingOriginal, setIsLoadingOriginal] = useState(false);
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const { isVisualDebugEnabled } = useVisualDebug();
  const modelDropdownRef = useRef<HTMLDivElement>(null);
  const reviewImageRef = useRef<HTMLImageElement>(null);
  const [editState, setEditState] = useState<{
    sourceCanvas: HTMLCanvasElement;
    corners: Array<{ x: number; y: number }>;
    rotation: 0 | 90 | 180 | 270;
  } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  // Re-parse hints modal state
  const [showReparseModal, setShowReparseModal] = useState(false);
  const [reparseHints, setReparseHints] = useState("");
  // Selection for selective re-parsing (no mode toggle needed - always selectable)
  const [selectedForReparse, setSelectedForReparse] = useState<Set<number>>(
    new Set(),
  );
  // Adjusted bounding boxes for selected problems (overrides original when re-parsing)
  const [adjustedBoxes, setAdjustedBoxes] = useState<
    Map<number, { x: number; y: number; width: number; height: number }>
  >(new Map());
  // Pre-flight confirmation for re-parse
  const [showReparsePreview, setShowReparsePreview] = useState(false);
  // Cropped image previews for re-parse confirmation (keyed by problem index)
  const [croppedPreviews, setCroppedPreviews] = useState<Map<number, string>>(
    new Map(),
  );
  // Thumbnails for all problems in the list (keyed by problem index)
  const [problemThumbnails, setProblemThumbnails] = useState<
    Map<number, string>
  >(new Map());
  // Flag to prevent auto-reload after saving (which clears editState)
  const [editCompleted, setEditCompleted] = useState(false);
  // Debug content modal state
  const [debugModal, setDebugModal] = useState<{
    isOpen: boolean;
    title: string;
    content: string;
    contentType: "text" | "json" | "markdown";
  }>({ isOpen: false, title: "", content: "", contentType: "text" });

  const {
    isReady: isDetectionReady,
    detectQuadsInImage,
    loadImageToCanvas,
    cv: opencvRef,
  } = useDocumentDetection();

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(initialIndex);
      setMode(initialMode);
      setEditState(null);
      setEditCompleted(false);
    }
  }, [isOpen, initialIndex, initialMode]);

  // Auto-load original for edit mode on open
  // Don't auto-load if edit was completed (user clicked Done) - prevents re-triggering edit mode
  useEffect(() => {
    if (
      isOpen &&
      initialMode === "edit" &&
      !editState &&
      isDetectionReady &&
      !editCompleted
    ) {
      loadOriginalForEditing();
    }
  }, [isOpen, initialMode, editState, isDetectionReady, editCompleted]);

  const currentPhoto = photos[currentIndex];
  const hasMultiple = photos.length > 1;

  // Navigate to previous photo (view mode only)
  const goToPrevious = useCallback(() => {
    if (mode === "view") {
      setCurrentIndex((prev) => (prev > 0 ? prev - 1 : photos.length - 1));
    }
  }, [mode, photos.length]);

  // Navigate to next photo (view mode only)
  const goToNext = useCallback(() => {
    if (mode === "view") {
      setCurrentIndex((prev) => (prev < photos.length - 1 ? prev + 1 : 0));
    }
  }, [mode, photos.length]);

  // Load original image for editing
  const loadOriginalForEditing = useCallback(async () => {
    if (!currentPhoto || !isDetectionReady) return;

    setIsLoadingOriginal(true);
    try {
      // Fetch original image (falls back to cropped for legacy attachments)
      const originalUrl = currentPhoto.originalUrl || currentPhoto.url;
      const response = await fetch(originalUrl);
      if (!response.ok) throw new Error("Failed to load original image");

      const blob = await response.blob();
      const file = new File([blob], "original.jpg", { type: blob.type });

      const canvas = await loadImageToCanvas(file);
      if (!canvas) throw new Error("Failed to load image to canvas");

      // Use saved corners if available, otherwise detect
      let corners: Array<{ x: number; y: number }>;
      if (currentPhoto.corners && currentPhoto.corners.length === 4) {
        corners = currentPhoto.corners;
      } else {
        const result = detectQuadsInImage(canvas);
        corners = result.corners;
      }

      // Use saved rotation if available
      const rotation = currentPhoto.rotation || 0;

      setEditState({ sourceCanvas: canvas, corners, rotation });
      setMode("edit");
    } catch (err) {
      console.error("Failed to load original for editing:", err);
    } finally {
      setIsLoadingOriginal(false);
    }
  }, [currentPhoto, isDetectionReady, loadImageToCanvas, detectQuadsInImage]);

  // Handle entering edit mode
  const handleEnterEditMode = useCallback(() => {
    if (editState) {
      // Already loaded, just switch mode
      setMode("edit");
    } else {
      // Need to load original
      loadOriginalForEditing();
    }
  }, [editState, loadOriginalForEditing]);

  // Handle edit confirm
  const handleEditConfirm = useCallback(
    async (
      croppedFile: File,
      corners: Array<{ x: number; y: number }>,
      rotation: 0 | 90 | 180 | 270,
    ) => {
      if (!currentPhoto) return;

      setIsSaving(true);
      try {
        await onEditConfirm(currentPhoto.id, croppedFile, corners, rotation);
        // Mark edit as completed before clearing state to prevent auto-reload
        setEditCompleted(true);
        // After saving, clear edit state so it reloads with new data next time
        setEditState(null);

        // If opened directly in edit mode, close the viewer entirely
        // Otherwise, return to view mode
        if (initialMode === "edit") {
          onClose();
        } else {
          setMode("view");
        }
      } catch (err) {
        console.error("Failed to save edit:", err);
      } finally {
        setIsSaving(false);
      }
    },
    [currentPhoto, onEditConfirm, initialMode, onClose],
  );

  // Handle edit cancel - return to view mode, or close if opened directly in edit mode
  const handleEditCancel = useCallback(() => {
    if (initialMode === "edit") {
      onClose();
    } else {
      setMode("view");
    }
  }, [initialMode, onClose]);

  // Toggle a problem for re-parsing
  const toggleProblemForReparse = useCallback((index: number) => {
    setSelectedForReparse((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  // Clear all selections
  const clearSelections = useCallback(() => {
    setSelectedForReparse(new Set());
    setAdjustedBoxes(new Map());
  }, []);

  // Handle adjusting a bounding box
  const handleAdjustBox = useCallback(
    (
      index: number,
      box: { x: number; y: number; width: number; height: number },
    ) => {
      setAdjustedBoxes((prev) => {
        const next = new Map(prev);
        next.set(index, box);
        return next;
      });
    },
    [],
  );

  // Show pre-flight confirmation for re-parse
  const handleReparseSelected = useCallback(() => {
    if (!currentPhoto || selectedForReparse.size === 0) return;
    setShowReparsePreview(true);
  }, [currentPhoto, selectedForReparse]);

  // Cancel pre-flight and go back to selection
  const cancelReparsePreview = useCallback(() => {
    setShowReparsePreview(false);
  }, []);

  // Confirm and execute re-parse
  const confirmReparseSelected = useCallback(async () => {
    if (!currentPhoto || !onReparseSelected || selectedForReparse.size === 0)
      return;

    const problems = currentPhoto.rawParsingResult?.problems ?? [];
    const indices = Array.from(selectedForReparse).sort((a, b) => a - b);

    // Use adjusted boxes if available, otherwise use original
    const boundingBoxes = indices
      .map((i) => {
        const adjusted = adjustedBoxes.get(i);
        if (adjusted) return adjusted;
        return problems[i]?.problemBoundingBox;
      })
      .filter(Boolean) as Array<{
      x: number;
      y: number;
      width: number;
      height: number;
    }>;

    if (boundingBoxes.length !== indices.length) {
      console.error("Missing bounding boxes for some selected problems");
      return;
    }

    await onReparseSelected(currentPhoto.id, indices, boundingBoxes);

    // Clear selections after re-parsing
    setShowReparsePreview(false);
    setSelectedForReparse(new Set());
    setAdjustedBoxes(new Map());
  }, [currentPhoto, onReparseSelected, selectedForReparse, adjustedBoxes]);

  // Bulk exclude selected problems
  const handleExcludeSelected = useCallback(async () => {
    if (!currentPhoto || !onSubmitCorrection || selectedForReparse.size === 0)
      return;

    const problems = currentPhoto.rawParsingResult?.problems ?? [];
    const indices = Array.from(selectedForReparse).sort((a, b) => a - b);

    // Submit exclude correction for each selected problem
    for (const index of indices) {
      const problem = problems[index];
      if (problem && !problem.excluded) {
        await onSubmitCorrection(currentPhoto.id, {
          problemNumber: problem.problemNumber,
          shouldExclude: true,
        });
      }
    }

    // Clear selections after excluding
    setSelectedForReparse(new Set());
    setAdjustedBoxes(new Map());
  }, [currentPhoto, onSubmitCorrection, selectedForReparse]);

  // Bulk restore selected problems
  const handleRestoreSelected = useCallback(async () => {
    if (!currentPhoto || !onSubmitCorrection || selectedForReparse.size === 0)
      return;

    const problems = currentPhoto.rawParsingResult?.problems ?? [];
    const indices = Array.from(selectedForReparse).sort((a, b) => a - b);

    // Submit restore correction for each selected excluded problem
    for (const index of indices) {
      const problem = problems[index];
      if (problem?.excluded) {
        await onSubmitCorrection(currentPhoto.id, {
          problemNumber: problem.problemNumber,
          shouldRestore: true,
        });
      }
    }

    // Clear selections after restoring
    setSelectedForReparse(new Set());
    setAdjustedBoxes(new Map());
  }, [currentPhoto, onSubmitCorrection, selectedForReparse]);

  // Count how many selected problems are excluded vs non-excluded
  const selectedExcludedCount = useMemo(() => {
    if (!currentPhoto || selectedForReparse.size === 0)
      return { excluded: 0, nonExcluded: 0 };

    const problems = currentPhoto.rawParsingResult?.problems ?? [];
    let excluded = 0;
    let nonExcluded = 0;

    for (const index of selectedForReparse) {
      const problem = problems[index];
      if (problem?.excluded) {
        excluded++;
      } else if (problem) {
        nonExcluded++;
      }
    }

    return { excluded, nonExcluded };
  }, [currentPhoto, selectedForReparse]);

  // Get bounding boxes for preview (memoized for rendering)
  const reparsePreviewData = useMemo(() => {
    if (!currentPhoto || selectedForReparse.size === 0) return [];

    const problems = currentPhoto.rawParsingResult?.problems ?? [];
    const indices = Array.from(selectedForReparse).sort((a, b) => a - b);

    return indices
      .map((i) => {
        const problem = problems[i];
        if (!problem) return null;
        const box = adjustedBoxes.get(i) ?? problem.problemBoundingBox;
        const isAdjusted = adjustedBoxes.has(i);
        return { index: i, problem, box, isAdjusted };
      })
      .filter(Boolean) as Array<{
      index: number;
      problem: (typeof problems)[number];
      box: { x: number; y: number; width: number; height: number };
      isAdjusted: boolean;
    }>;
  }, [currentPhoto, selectedForReparse, adjustedBoxes]);

  // Generate cropped previews when entering re-parse confirmation
  useEffect(() => {
    if (
      !showReparsePreview ||
      !currentPhoto ||
      reparsePreviewData.length === 0
    ) {
      setCroppedPreviews(new Map());
      return;
    }

    let cancelled = false;

    async function generatePreviews() {
      const previews = new Map<number, string>();

      for (const { index, box } of reparsePreviewData) {
        if (cancelled) break;
        try {
          const croppedUrl = await cropImageWithCanvas(currentPhoto!.url, box);
          previews.set(index, croppedUrl);
          // Update state progressively so user sees previews appear
          if (!cancelled) {
            setCroppedPreviews(new Map(previews));
          }
        } catch (err) {
          console.error(`Failed to crop preview for problem ${index}:`, err);
        }
      }
    }

    generatePreviews();
    return () => {
      cancelled = true;
    };
  }, [showReparsePreview, currentPhoto, reparsePreviewData]);

  // Track which photo we last generated thumbnails for
  const lastThumbnailPhotoRef = useRef<string | null>(null);

  // Generate thumbnails for all problems when photo changes
  useEffect(() => {
    const problems = currentPhoto?.rawParsingResult?.problems;
    if (!currentPhoto || !problems || problems.length === 0) {
      setProblemThumbnails(new Map());
      lastThumbnailPhotoRef.current = null;
      return;
    }

    // Only regenerate all if the photo changed
    if (lastThumbnailPhotoRef.current === currentPhoto.id) {
      return;
    }
    lastThumbnailPhotoRef.current = currentPhoto.id;

    let cancelled = false;

    async function generateAllThumbnails() {
      const thumbnails = new Map<number, string>();

      for (let i = 0; i < problems!.length; i++) {
        if (cancelled) break;
        const problem = problems![i];
        const box = problem.problemBoundingBox;
        try {
          const croppedUrl = await cropImageWithCanvas(currentPhoto!.url, box);
          thumbnails.set(i, croppedUrl);
          // Update state progressively
          if (!cancelled) {
            setProblemThumbnails(new Map(thumbnails));
          }
        } catch (err) {
          console.error(`Failed to generate thumbnail for problem ${i}:`, err);
        }
      }
    }

    generateAllThumbnails();
    return () => {
      cancelled = true;
    };
  }, [currentPhoto]);

  // Track which adjusted boxes we've already regenerated thumbnails for
  const lastAdjustedBoxesRef = useRef<Map<number, string>>(new Map());

  // Regenerate only the specific thumbnail when a box is adjusted
  useEffect(() => {
    if (!currentPhoto) return;

    // Find which indices were newly adjusted or changed
    const indicesToUpdate: number[] = [];
    for (const [index, box] of adjustedBoxes) {
      const boxKey = JSON.stringify(box);
      if (lastAdjustedBoxesRef.current.get(index) !== boxKey) {
        indicesToUpdate.push(index);
        lastAdjustedBoxesRef.current.set(index, boxKey);
      }
    }

    if (indicesToUpdate.length === 0) return;

    let cancelled = false;

    async function updateAdjustedThumbnails() {
      for (const index of indicesToUpdate) {
        if (cancelled) break;
        const box = adjustedBoxes.get(index);
        if (!box) continue;
        try {
          const croppedUrl = await cropImageWithCanvas(currentPhoto!.url, box);
          if (!cancelled) {
            setProblemThumbnails((prev) => {
              const next = new Map(prev);
              next.set(index, croppedUrl);
              return next;
            });
          }
        } catch (err) {
          console.error(
            `Failed to update thumbnail for problem ${index}:`,
            err,
          );
        }
      }
    }

    updateAdjustedThumbnails();
    return () => {
      cancelled = true;
    };
  }, [currentPhoto, adjustedBoxes]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (mode === "edit") {
        // In edit mode, Escape cancels - close if opened in edit mode, otherwise go to view
        if (e.key === "Escape") {
          if (initialMode === "edit") {
            onClose();
          } else {
            setMode("view");
          }
        }
        return;
      }

      if (mode === "review") {
        // In review mode, Escape goes back to view mode (or closes if opened in review mode)
        if (e.key === "Escape") {
          if (initialMode === "review") {
            onClose();
          } else {
            setMode("view");
            setSelectedProblemIndex(null);
          }
        }
        return;
      }

      // View mode keyboard shortcuts
      switch (e.key) {
        case "Escape":
          onClose();
          break;
        case "ArrowLeft":
          goToPrevious();
          break;
        case "ArrowRight":
          goToNext();
          break;
        case "e":
        case "E":
          handleEnterEditMode();
          break;
        case "r":
        case "R":
          // Enter review mode if the current photo has parsing results
          if (currentPhoto?.rawParsingResult) {
            setMode("review");
          }
          break;
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [
    isOpen,
    mode,
    initialMode,
    onClose,
    goToPrevious,
    goToNext,
    handleEnterEditMode,
    currentPhoto,
  ]);

  // Close model dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        modelDropdownRef.current &&
        !modelDropdownRef.current.contains(e.target as Node)
      ) {
        setIsModelDropdownOpen(false);
      }
    }
    if (isModelDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isModelDropdownOpen]);

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [isOpen]);

  if (!isOpen || photos.length === 0) return null;

  // Edit mode loading - show loading screen while preparing editor
  if (mode === "edit" && (!editState || !opencvRef || isLoadingOriginal)) {
    return (
      <div
        data-component="photo-viewer-editor"
        data-mode="edit-loading"
        className={css({
          position: "fixed",
          inset: 0,
          zIndex: Z_INDEX.MODAL,
          backgroundColor: "rgba(0, 0, 0, 0.9)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
          fontSize: "lg",
        })}
      >
        Loading editor...
      </div>
    );
  }

  // Edit mode - show DocumentAdjuster
  if (mode === "edit" && editState && opencvRef) {
    return (
      <div
        data-component="photo-viewer-editor"
        data-mode="edit"
        className={css({
          position: "fixed",
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
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              bg: "rgba(0, 0, 0, 0.5)",
              color: "white",
              fontSize: "xl",
            })}
          >
            Saving...
          </div>
        )}
      </div>
    );
  }

  // Review mode - split-view with image + bounding boxes and problem list
  if (mode === "review" && currentPhoto?.rawParsingResult) {
    const parsingResult = currentPhoto.rawParsingResult;
    const problems = parsingResult.problems ?? [];
    const llm = currentPhoto.llm;

    return (
      <div
        data-component="photo-viewer-editor"
        data-mode="review"
        className={css({
          position: "fixed",
          inset: 0,
          zIndex: Z_INDEX.MODAL,
          backgroundColor: "gray.900",
          display: "flex",
          flexDirection: "column",
        })}
      >
        {/* Top toolbar */}
        <div
          data-element="review-toolbar"
          className={css({
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: 3,
            borderBottom: "1px solid",
            borderColor: "gray.700",
            backgroundColor: "gray.800",
          })}
        >
          <div
            className={css({ display: "flex", alignItems: "center", gap: 3 })}
          >
            {/* Back button */}
            <button
              type="button"
              data-action="back-to-view"
              onClick={() => {
                setMode("view");
                setSelectedProblemIndex(null);
              }}
              className={css({
                px: 3,
                py: 2,
                display: "flex",
                alignItems: "center",
                gap: 2,
                fontSize: "sm",
                fontWeight: "medium",
                color: "white",
                backgroundColor: "gray.700",
                border: "none",
                borderRadius: "lg",
                cursor: "pointer",
                _hover: { backgroundColor: "gray.600" },
              })}
            >
              ← Back
            </button>

            {/* Status badges */}
            <div
              data-element="review-status"
              className={css({
                px: 3,
                py: 1,
                fontSize: "sm",
                fontWeight: "medium",
                borderRadius: "md",
                backgroundColor:
                  parsingResult.needsReview ||
                  parsingResult.overallConfidence < 0.8
                    ? "yellow.500"
                    : "green.500",
                color:
                  parsingResult.needsReview ||
                  parsingResult.overallConfidence < 0.8
                    ? "yellow.900"
                    : "white",
              })}
            >
              {problems.length} problems •{" "}
              {Math.round((parsingResult.overallConfidence ?? 0) * 100)}%
              confidence
              {parsingResult.needsReview && " • Needs Review"}
            </div>
          </div>

          <div
            className={css({ display: "flex", alignItems: "center", gap: 2 })}
          >
            {/* Re-parse button - handles full flow: select → preview → confirm */}
            {onParse && !currentPhoto.sessionCreated && (
              <button
                type="button"
                data-action={
                  showReparsePreview
                    ? "confirm-reparse"
                    : selectedForReparse.size > 0
                      ? "reparse-selected"
                      : "reparse-with-hints"
                }
                onClick={() => {
                  if (showReparsePreview) {
                    // In preview mode: confirm and execute
                    confirmReparseSelected();
                  } else if (selectedForReparse.size > 0) {
                    // Has selections: enter preview mode
                    handleReparseSelected();
                  } else {
                    // No selections: open hints modal for full re-parse
                    setShowReparseModal(true);
                  }
                }}
                disabled={
                  parsingPhotoId === currentPhoto.id || isReparsingSelected
                }
                className={css({
                  px: 3,
                  py: 2,
                  fontSize: "sm",
                  fontWeight: "medium",
                  color: "white",
                  backgroundColor: showReparsePreview
                    ? "green.600"
                    : "orange.600",
                  border: "none",
                  borderRadius: "lg",
                  cursor: "pointer",
                  _hover: {
                    backgroundColor: showReparsePreview
                      ? "green.700"
                      : "orange.700",
                  },
                  _disabled: { opacity: 0.5, cursor: "wait" },
                })}
              >
                {parsingPhotoId === currentPhoto.id || isReparsingSelected
                  ? "⏳ Re-parsing..."
                  : showReparsePreview
                    ? `✓ Confirm Re-parse (${selectedForReparse.size})`
                    : selectedForReparse.size > 0
                      ? `🔄 Re-parse (${selectedForReparse.size} selected)`
                      : "🔄 Re-parse"}
              </button>
            )}
            {/* Cancel button - only shown in preview mode */}
            {showReparsePreview && (
              <button
                type="button"
                data-action="cancel-reparse-preview"
                onClick={cancelReparsePreview}
                className={css({
                  px: 3,
                  py: 2,
                  fontSize: "sm",
                  color: "gray.300",
                  backgroundColor: "transparent",
                  border: "none",
                  borderRadius: "lg",
                  cursor: "pointer",
                  _hover: { backgroundColor: "gray.700" },
                })}
              >
                Cancel
              </button>
            )}

            {/* Approve button */}
            {onApprove && !currentPhoto.sessionCreated && (
              <button
                type="button"
                data-action="approve-and-create-session"
                onClick={() => onApprove(currentPhoto.id)}
                disabled={approvingPhotoId === currentPhoto.id}
                className={css({
                  px: 4,
                  py: 2,
                  fontSize: "sm",
                  fontWeight: "medium",
                  color: "white",
                  backgroundColor: "green.600",
                  border: "none",
                  borderRadius: "lg",
                  cursor: "pointer",
                  _hover: { backgroundColor: "green.700" },
                  _disabled: { opacity: 0.5, cursor: "wait" },
                })}
              >
                {approvingPhotoId === currentPhoto.id
                  ? "Creating Session..."
                  : "✓ Approve & Create Session"}
              </button>
            )}

            {/* Close button */}
            <button
              type="button"
              data-action="close-review"
              onClick={onClose}
              className={css({
                width: "40px",
                height: "40px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.5rem",
                color: "gray.400",
                backgroundColor: "transparent",
                border: "none",
                borderRadius: "50%",
                cursor: "pointer",
                _hover: { backgroundColor: "gray.700", color: "white" },
              })}
              aria-label="Close"
            >
              ×
            </button>
          </div>
        </div>

        {/* Main split-view content */}
        <div
          data-element="review-content"
          className={css({
            flex: 1,
            display: "flex",
            overflow: "hidden",
          })}
        >
          {/* Left side - Image with bounding boxes */}
          <div
            data-element="review-image-panel"
            className={css({
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 4,
              backgroundColor: "gray.950",
              overflow: "hidden",
              position: "relative",
            })}
          >
            <div
              data-element="image-container"
              className={css({
                position: "relative",
                maxWidth: "100%",
                maxHeight: "100%",
              })}
            >
              {/* biome-ignore lint/performance/noImgElement: API-served images */}
              <img
                ref={reviewImageRef}
                src={currentPhoto.url}
                alt="Worksheet"
                className={css({
                  maxWidth: "100%",
                  maxHeight: "calc(100vh - 150px)",
                  objectFit: "contain",
                  borderRadius: "lg",
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
              width: "400px",
              flexShrink: 0,
              display: "flex",
              flexDirection: "column",
              borderLeft: "1px solid",
              borderColor: "gray.700",
              backgroundColor: "gray.800",
              overflow: "hidden",
            })}
          >
            {/* Problem list */}
            <div
              data-element="problem-list"
              className={css({
                flex: 1,
                display: "flex",
                flexDirection: "column",
                overflow: "auto",
                padding: 3,
                minHeight: 0,
              })}
            >
              {/* Header with selection mode toggle */}
              <h3
                className={css({
                  fontSize: "sm",
                  fontWeight: "semibold",
                  color: "gray.400",
                  textTransform: "uppercase",
                  letterSpacing: "wide",
                  marginBottom: 3,
                })}
              >
                Extracted Problems ({problems.length})
              </h3>

              {/* Pre-flight confirmation for re-parse */}
              {showReparsePreview ? (
                <div
                  data-element="reparse-preflight"
                  className={css({
                    display: "flex",
                    flexDirection: "column",
                    gap: 3,
                    flex: 1,
                    minHeight: 0,
                  })}
                >
                  {/* Pre-flight header */}
                  <div
                    className={css({
                      display: "flex",
                      alignItems: "center",
                      gap: 2,
                      padding: 3,
                      backgroundColor: "orange.900",
                      borderRadius: "lg",
                      border: "2px solid token(colors.orange.600)",
                    })}
                  >
                    <span className={css({ fontSize: "lg" })}>⚠️</span>
                    <div>
                      <div
                        className={css({
                          fontWeight: "semibold",
                          color: "orange.200",
                          fontSize: "sm",
                        })}
                      >
                        Confirm Re-parse
                      </div>
                      <div
                        className={css({ fontSize: "xs", color: "orange.300" })}
                      >
                        Review the cropped regions below before proceeding
                      </div>
                    </div>
                  </div>

                  {/* Cropped region previews */}
                  <div
                    className={css({
                      display: "flex",
                      flexDirection: "column",
                      gap: 2,
                      flex: 1,
                      overflowY: "auto",
                      minHeight: 0,
                    })}
                  >
                    {reparsePreviewData.map(
                      ({ index, problem, box, isAdjusted }) => (
                        <div
                          key={index}
                          className={css({
                            display: "flex",
                            gap: 3,
                            padding: 2,
                            backgroundColor: "gray.800",
                            borderRadius: "md",
                            border: "1px solid token(colors.gray.700)",
                          })}
                        >
                          {/* Cropped image preview - exact same crop as sent to LLM */}
                          <div
                            className={css({
                              position: "relative",
                              minWidth: "80px",
                              maxWidth: "200px",
                              backgroundColor: "gray.900",
                              borderRadius: "sm",
                              overflow: "hidden",
                              flexShrink: 0,
                            })}
                          >
                            {croppedPreviews.get(index) ? (
                              <img
                                src={croppedPreviews.get(index)}
                                alt={`Problem ${index + 1} cropped region`}
                                className={css({
                                  display: "block",
                                  width: "100%",
                                  height: "auto",
                                })}
                              />
                            ) : (
                              <div
                                className={css({
                                  width: "120px",
                                  height: "80px",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  color: "gray.500",
                                  fontSize: "xs",
                                })}
                              >
                                Loading...
                              </div>
                            )}
                            {isAdjusted && (
                              <div
                                className={css({
                                  position: "absolute",
                                  top: 1,
                                  right: 1,
                                  padding: "2px 4px",
                                  backgroundColor: "orange.600",
                                  borderRadius: "sm",
                                  fontSize: "10px",
                                  color: "white",
                                  fontWeight: "bold",
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
                                fontWeight: "medium",
                                color: "gray.200",
                                fontSize: "sm",
                                marginBottom: 1,
                              })}
                            >
                              Problem #{index + 1}
                            </div>
                            <div
                              className={css({
                                fontSize: "xs",
                                color: "gray.400",
                              })}
                            >
                              {problem.terms
                                .map((t, i) =>
                                  i === 0
                                    ? t
                                    : t >= 0
                                      ? ` + ${t}`
                                      : ` − ${Math.abs(t)}`,
                                )
                                .join("")}{" "}
                              = {problem.studentAnswer ?? "?"}
                            </div>
                            <div
                              className={css({
                                fontSize: "xs",
                                color: "gray.500",
                                marginTop: 1,
                              })}
                            >
                              Region: {(box.x * 100).toFixed(0)}%,{" "}
                              {(box.y * 100).toFixed(0)}% →{" "}
                              {((box.x + box.width) * 100).toFixed(0)}%,{" "}
                              {((box.y + box.height) * 100).toFixed(0)}%
                            </div>
                          </div>
                        </div>
                      ),
                    )}
                  </div>
                </div>
              ) : problems.length === 0 ? (
                <div className={css({ color: "gray.500", fontSize: "sm" })}>
                  No problems extracted from this worksheet.
                </div>
              ) : (
                <div
                  className={css({
                    display: "flex",
                    flexDirection: "column",
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
                        setSelectedProblemIndex(
                          selectedProblemIndex === index ? null : index,
                        )
                      }
                      onSubmitCorrection={(correction) => {
                        if (onSubmitCorrection && currentPhoto) {
                          onSubmitCorrection(currentPhoto.id, correction);
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
                  display: "flex",
                  flexDirection: "column",
                  gap: 2,
                  padding: "8px 12px",
                  borderTop: "1px solid",
                  borderColor: "gray.700",
                  backgroundColor: "gray.850",
                  flexShrink: 0,
                })}
              >
                <div
                  className={css({
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  })}
                >
                  <span className={css({ fontSize: "sm", color: "gray.400" })}>
                    {selectedForReparse.size} problem
                    {selectedForReparse.size === 1 ? "" : "s"} selected
                  </span>
                  <button
                    type="button"
                    data-action="clear-selection"
                    onClick={clearSelections}
                    className={css({
                      padding: "4px 12px",
                      fontSize: "sm",
                      color: "gray.400",
                      backgroundColor: "transparent",
                      border: "none",
                      borderRadius: "md",
                      cursor: "pointer",
                      _hover: {
                        backgroundColor: "gray.700",
                        color: "gray.300",
                      },
                    })}
                  >
                    Clear
                  </button>
                </div>
                {/* Bulk action buttons */}
                <div
                  className={css({
                    display: "flex",
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
                        padding: "6px 12px",
                        fontSize: "sm",
                        fontWeight: "medium",
                        color: "red.300",
                        backgroundColor: "red.900/30",
                        border: "1px solid token(colors.red.700)",
                        borderRadius: "md",
                        cursor: "pointer",
                        _hover: {
                          backgroundColor: "red.900/50",
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
                        padding: "6px 12px",
                        fontSize: "sm",
                        fontWeight: "medium",
                        color: "green.300",
                        backgroundColor: "green.900/30",
                        border: "1px solid token(colors.green.700)",
                        borderRadius: "md",
                        cursor: "pointer",
                        _hover: {
                          backgroundColor: "green.900/50",
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
              <div
                data-element="debug-panel"
                className={css({
                  borderTop: "1px solid",
                  borderColor: "gray.700",
                  padding: 3,
                  backgroundColor: "gray.900",
                })}
              >
                <h3
                  className={css({
                    fontSize: "xs",
                    fontWeight: "semibold",
                    color: "gray.500",
                    textTransform: "uppercase",
                    letterSpacing: "wide",
                    marginBottom: 2,
                  })}
                >
                  LLM Debug Info
                </h3>
                <div
                  className={css({
                    display: "grid",
                    gridTemplateColumns: "auto 1fr",
                    gap: 1,
                    fontSize: "xs",
                    fontFamily: "mono",
                  })}
                >
                  <span className={css({ color: "gray.500" })}>Provider:</span>
                  <span className={css({ color: "gray.300" })}>
                    {llm.provider ?? "unknown"}
                  </span>

                  <span className={css({ color: "gray.500" })}>Model:</span>
                  <span className={css({ color: "gray.300" })}>
                    {llm.model ?? "unknown"}
                  </span>

                  <span className={css({ color: "gray.500" })}>Image:</span>
                  <span className={css({ color: "gray.300" })}>
                    {llm.imageSource ?? "cropped"} ✓
                  </span>

                  <span className={css({ color: "gray.500" })}>Attempts:</span>
                  <span className={css({ color: "gray.300" })}>
                    {llm.attempts ?? 1}
                  </span>

                  <span className={css({ color: "gray.500" })}>Tokens:</span>
                  <span className={css({ color: "gray.300" })}>
                    {llm.usage?.totalTokens ?? "?"} (
                    {llm.usage?.promptTokens ?? "?"} in /{" "}
                    {llm.usage?.completionTokens ?? "?"} out)
                  </span>
                </div>

                {/* Debug content buttons */}
                <div
                  className={css({
                    display: "flex",
                    gap: 2,
                    marginTop: 2,
                    borderTop: "1px solid",
                    borderColor: "gray.800",
                    paddingTop: 2,
                  })}
                >
                  {llm.promptUsed && (
                    <button
                      type="button"
                      onClick={() =>
                        setDebugModal({
                          isOpen: true,
                          title: "LLM Prompt",
                          content: llm.promptUsed!,
                          contentType: "text",
                        })
                      }
                      className={css({
                        fontSize: "xs",
                        color: "gray.400",
                        backgroundColor: "gray.800",
                        border: "none",
                        borderRadius: "sm",
                        padding: "0.25rem 0.5rem",
                        cursor: "pointer",
                        _hover: { backgroundColor: "gray.700", color: "white" },
                      })}
                    >
                      View Prompt ({llm.promptUsed.length.toLocaleString()}{" "}
                      chars)
                    </button>
                  )}
                  {llm.rawResponse && (
                    <button
                      type="button"
                      onClick={() =>
                        setDebugModal({
                          isOpen: true,
                          title: "Raw LLM Response",
                          content: llm.rawResponse!,
                          contentType: "json",
                        })
                      }
                      className={css({
                        fontSize: "xs",
                        color: "gray.400",
                        backgroundColor: "gray.800",
                        border: "none",
                        borderRadius: "sm",
                        padding: "0.25rem 0.5rem",
                        cursor: "pointer",
                        _hover: { backgroundColor: "gray.700", color: "white" },
                      })}
                    >
                      View Response ({llm.rawResponse.length.toLocaleString()}{" "}
                      chars)
                    </button>
                  )}
                  {llm.jsonSchema && (
                    <button
                      type="button"
                      onClick={() =>
                        setDebugModal({
                          isOpen: true,
                          title: "JSON Schema (with field descriptions)",
                          content: llm.jsonSchema!,
                          contentType: "json",
                        })
                      }
                      className={css({
                        fontSize: "xs",
                        color: "gray.400",
                        backgroundColor: "gray.800",
                        border: "none",
                        borderRadius: "sm",
                        padding: "0.25rem 0.5rem",
                        cursor: "pointer",
                        _hover: { backgroundColor: "gray.700", color: "white" },
                      })}
                    >
                      View Schema ({llm.jsonSchema.length.toLocaleString()}{" "}
                      chars)
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer keyboard hints */}
        <div
          data-element="review-footer"
          className={css({
            textAlign: "center",
            padding: 2,
            fontSize: "xs",
            color: "gray.600",
            borderTop: "1px solid",
            borderColor: "gray.800",
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
        {showReparseModal && (
          <div
            data-element="reparse-modal-overlay"
            className={css({
              position: "fixed",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "rgba(0, 0, 0, 0.6)",
              zIndex: Z_INDEX.MODAL + 1,
            })}
            onClick={() => setShowReparseModal(false)}
          >
            <div
              data-element="reparse-modal"
              className={css({
                width: "500px",
                maxWidth: "90vw",
                backgroundColor: "gray.800",
                borderRadius: "xl",
                padding: 6,
                boxShadow: "0 20px 60px rgba(0, 0, 0, 0.5)",
              })}
              onClick={(e) => e.stopPropagation()}
            >
              <h2
                className={css({
                  fontSize: "lg",
                  fontWeight: "semibold",
                  color: "white",
                  marginBottom: 4,
                })}
              >
                🔄 Re-parse with Hints
              </h2>

              <p
                className={css({
                  fontSize: "sm",
                  color: "gray.400",
                  marginBottom: 4,
                })}
              >
                Provide additional context to help the AI better understand this
                worksheet. This is useful when problems were mis-parsed or
                handwriting is difficult to read.
              </p>

              <textarea
                value={reparseHints}
                onChange={(e) => setReparseHints(e.target.value)}
                placeholder="Example hints:&#10;- Problems #3-5 are subtraction, not addition&#10;- The student writes 7s that look like 1s&#10;- There are 20 problems total, arranged in 4 rows"
                className={css({
                  width: "100%",
                  height: "150px",
                  px: 3,
                  py: 2,
                  fontSize: "sm",
                  backgroundColor: "gray.900",
                  color: "white",
                  border: "1px solid",
                  borderColor: "gray.600",
                  borderRadius: "lg",
                  resize: "vertical",
                  _focus: {
                    outline: "none",
                    borderColor: "orange.500",
                    boxShadow: "0 0 0 2px token(colors.orange.500/20)",
                  },
                  _placeholder: {
                    color: "gray.500",
                  },
                })}
              />

              <div
                className={css({
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 3,
                  marginTop: 4,
                })}
              >
                <button
                  type="button"
                  onClick={() => {
                    setShowReparseModal(false);
                    setReparseHints("");
                  }}
                  className={css({
                    px: 4,
                    py: 2,
                    fontSize: "sm",
                    fontWeight: "medium",
                    color: "white",
                    backgroundColor: "gray.700",
                    border: "none",
                    borderRadius: "lg",
                    cursor: "pointer",
                    _hover: { backgroundColor: "gray.600" },
                  })}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (onParse && currentPhoto) {
                      // Pass adjusted bounding boxes if any exist
                      const preserved =
                        adjustedBoxes.size > 0
                          ? Object.fromEntries(adjustedBoxes.entries())
                          : undefined;
                      onParse(
                        currentPhoto.id,
                        undefined,
                        reparseHints || undefined,
                        preserved,
                      );
                      setShowReparseModal(false);
                      setReparseHints("");
                    }
                  }}
                  disabled={parsingPhotoId === currentPhoto.id}
                  className={css({
                    px: 4,
                    py: 2,
                    fontSize: "sm",
                    fontWeight: "medium",
                    color: "white",
                    backgroundColor: "orange.600",
                    border: "none",
                    borderRadius: "lg",
                    cursor: "pointer",
                    _hover: { backgroundColor: "orange.700" },
                    _disabled: { opacity: 0.5, cursor: "wait" },
                  })}
                >
                  {parsingPhotoId === currentPhoto.id
                    ? "Re-parsing..."
                    : "Re-parse Worksheet"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // View mode - show lightbox-style viewer
  return (
    <div
      data-component="photo-viewer-editor"
      data-mode="view"
      className={css({
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.9)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        zIndex: Z_INDEX.MODAL,
        padding: "1rem",
      })}
      onClick={onClose}
    >
      {/* Close button */}
      <button
        type="button"
        data-action="close-viewer"
        onClick={onClose}
        className={css({
          position: "absolute",
          top: "1rem",
          right: "1rem",
          width: "44px",
          height: "44px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "2rem",
          color: "white",
          backgroundColor: "rgba(255, 255, 255, 0.1)",
          border: "none",
          borderRadius: "50%",
          cursor: "pointer",
          transition: "background-color 0.2s",
          _hover: {
            backgroundColor: "rgba(255, 255, 255, 0.2)",
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
          position: "absolute",
          top: "1rem",
          left: "1rem",
          display: "flex",
          gap: 2,
        })}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Edit button */}
        <button
          type="button"
          data-action="enter-edit-mode"
          onClick={handleEnterEditMode}
          disabled={isLoadingOriginal || !isDetectionReady}
          className={css({
            px: 4,
            py: 2,
            display: "flex",
            alignItems: "center",
            gap: 2,
            fontSize: "sm",
            fontWeight: "medium",
            color: "white",
            backgroundColor: "rgba(255, 255, 255, 0.1)",
            border: "none",
            borderRadius: "lg",
            cursor: "pointer",
            transition: "background-color 0.2s",
            _hover: {
              backgroundColor: "rgba(255, 255, 255, 0.2)",
            },
            _disabled: {
              opacity: 0.5,
              cursor: "not-allowed",
            },
          })}
          aria-label="Edit photo"
        >
          {isLoadingOriginal ? (
            "Loading..."
          ) : (
            <>
              <span>✏️</span>
              <span>Edit</span>
            </>
          )}
        </button>

        {/* Parse button - split button with model selection dropdown */}
        {onParse &&
          (!currentPhoto.parsingStatus ||
            currentPhoto.parsingStatus === "failed") &&
          !currentPhoto.sessionCreated && (
            <div
              ref={modelDropdownRef}
              data-element="parse-split-button"
              className={css({ position: "relative", display: "flex" })}
            >
              {/* Main parse button */}
              <button
                type="button"
                data-action="parse-worksheet"
                onClick={() => {
                  setIsModelDropdownOpen(false);
                  // Pass adjusted bounding boxes if any exist
                  const preserved =
                    adjustedBoxes.size > 0
                      ? Object.fromEntries(adjustedBoxes.entries())
                      : undefined;
                  onParse(currentPhoto.id, undefined, undefined, preserved);
                }}
                disabled={parsingPhotoId === currentPhoto.id}
                className={css({
                  px: 4,
                  py: 2,
                  display: "flex",
                  alignItems: "center",
                  gap: 2,
                  fontSize: "sm",
                  fontWeight: "medium",
                  color: "white",
                  backgroundColor:
                    currentPhoto.parsingStatus === "failed"
                      ? "orange.500"
                      : "blue.500",
                  border: "none",
                  borderRadius: modelConfigs.length > 0 ? "8px 0 0 8px" : "lg",
                  cursor: "pointer",
                  transition: "background-color 0.2s",
                  _hover: {
                    backgroundColor:
                      currentPhoto.parsingStatus === "failed"
                        ? "orange.600"
                        : "blue.600",
                  },
                  _disabled: {
                    backgroundColor: "gray.500",
                    cursor: "wait",
                  },
                })}
                aria-label={
                  currentPhoto.parsingStatus === "failed"
                    ? "Retry parsing"
                    : "Parse worksheet"
                }
              >
                {parsingPhotoId === currentPhoto.id ? (
                  <>
                    <span>⏳</span>
                    <span>Analyzing...</span>
                  </>
                ) : currentPhoto.parsingStatus === "failed" ? (
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

              {/* Dropdown toggle button - only show if we have model configs */}
              {modelConfigs.length > 0 && (
                <>
                  <button
                    type="button"
                    data-action="toggle-model-dropdown"
                    onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
                    disabled={parsingPhotoId === currentPhoto.id}
                    className={css({
                      px: 2,
                      py: 2,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "sm",
                      color: "white",
                      backgroundColor:
                        currentPhoto.parsingStatus === "failed"
                          ? "orange.600"
                          : "blue.600",
                      borderLeft: "1px solid rgba(255, 255, 255, 0.2)",
                      border: "none",
                      borderRadius: "0 8px 8px 0",
                      cursor: "pointer",
                      transition: "background-color 0.2s",
                      _hover: {
                        backgroundColor:
                          currentPhoto.parsingStatus === "failed"
                            ? "orange.700"
                            : "blue.700",
                      },
                      _disabled: {
                        backgroundColor: "gray.500",
                        cursor: "wait",
                      },
                    })}
                    aria-label="Select model"
                    aria-expanded={isModelDropdownOpen}
                  >
                    <span
                      className={css({
                        transform: isModelDropdownOpen
                          ? "rotate(180deg)"
                          : "none",
                        transition: "transform 0.2s",
                      })}
                    >
                      ▾
                    </span>
                  </button>

                  {/* Dropdown menu */}
                  {isModelDropdownOpen && (
                    <div
                      data-element="model-dropdown"
                      className={css({
                        position: "absolute",
                        top: "100%",
                        left: 0,
                        marginTop: 1,
                        minWidth: "280px",
                        backgroundColor: "gray.800",
                        borderRadius: "lg",
                        boxShadow: "0 10px 40px rgba(0, 0, 0, 0.5)",
                        border: "1px solid",
                        borderColor: "gray.700",
                        overflow: "hidden",
                        zIndex: 10,
                      })}
                    >
                      <div
                        className={css({
                          px: 3,
                          py: 2,
                          fontSize: "xs",
                          fontWeight: "semibold",
                          color: "gray.400",
                          textTransform: "uppercase",
                          letterSpacing: "wide",
                          borderBottom: "1px solid",
                          borderColor: "gray.700",
                        })}
                      >
                        Select Model
                      </div>
                      {modelConfigs.map((config) => (
                        <button
                          key={config.id}
                          type="button"
                          data-action={`parse-with-model-${config.id}`}
                          onClick={() => {
                            setIsModelDropdownOpen(false);
                            // Pass adjusted bounding boxes if any exist
                            const preserved =
                              adjustedBoxes.size > 0
                                ? Object.fromEntries(adjustedBoxes.entries())
                                : undefined;
                            onParse(
                              currentPhoto.id,
                              config.id,
                              undefined,
                              preserved,
                            );
                          }}
                          className={css({
                            width: "100%",
                            px: 3,
                            py: 3,
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "flex-start",
                            gap: 1,
                            textAlign: "left",
                            backgroundColor: "transparent",
                            border: "none",
                            cursor: "pointer",
                            transition: "background-color 0.1s",
                            _hover: { backgroundColor: "gray.700" },
                          })}
                        >
                          <div
                            className={css({
                              display: "flex",
                              alignItems: "center",
                              gap: 2,
                              width: "100%",
                            })}
                          >
                            <span
                              className={css({
                                color: "white",
                                fontWeight: "medium",
                              })}
                            >
                              {config.name}
                            </span>
                            {config.isDefault && (
                              <span
                                className={css({
                                  px: 2,
                                  py: 0.5,
                                  fontSize: "xs",
                                  backgroundColor: "blue.600",
                                  color: "white",
                                  borderRadius: "md",
                                })}
                              >
                                Default
                              </span>
                            )}
                          </div>
                          <span
                            className={css({
                              fontSize: "xs",
                              color: "gray.400",
                            })}
                          >
                            {config.description}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

        {/* Parsing status badge - don't show for 'failed' since retry button is shown instead */}
        {currentPhoto.parsingStatus &&
          currentPhoto.parsingStatus !== "failed" && (
            <div
              data-element="parsing-status-badge"
              className={css({
                px: 4,
                py: 2,
                display: "flex",
                alignItems: "center",
                gap: 2,
                fontSize: "sm",
                fontWeight: "medium",
                borderRadius: "lg",
                backgroundColor:
                  currentPhoto.parsingStatus === "processing"
                    ? "blue.500"
                    : currentPhoto.parsingStatus === "needs_review"
                      ? "yellow.500"
                      : currentPhoto.parsingStatus === "approved"
                        ? "green.500"
                        : "gray.500",
                color:
                  currentPhoto.parsingStatus === "needs_review"
                    ? "yellow.900"
                    : "white",
              })}
            >
              {currentPhoto.parsingStatus === "processing" && "⏳"}
              {currentPhoto.parsingStatus === "needs_review" && "⚠️"}
              {currentPhoto.parsingStatus === "approved" && "✓"}
              {currentPhoto.parsingStatus === "processing"
                ? "Analyzing..."
                : currentPhoto.parsingStatus === "needs_review"
                  ? `${currentPhoto.problemCount ?? "?"} problems (needs review)`
                  : currentPhoto.parsingStatus === "approved"
                    ? `${currentPhoto.problemCount ?? "?"} problems`
                    : currentPhoto.parsingStatus}
            </div>
          )}

        {/* Session created badge */}
        {currentPhoto.sessionCreated && (
          <div
            data-element="session-created-badge"
            className={css({
              px: 4,
              py: 2,
              display: "flex",
              alignItems: "center",
              gap: 2,
              fontSize: "sm",
              fontWeight: "medium",
              borderRadius: "lg",
              backgroundColor: "green.600",
              color: "white",
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
            onClick={() => setMode("review")}
            className={css({
              px: 4,
              py: 2,
              display: "flex",
              alignItems: "center",
              gap: 2,
              fontSize: "sm",
              fontWeight: "medium",
              color: "white",
              backgroundColor: "purple.500",
              border: "none",
              borderRadius: "lg",
              cursor: "pointer",
              transition: "background-color 0.2s",
              _hover: {
                backgroundColor: "purple.600",
              },
            })}
            aria-label="Review parsed problems"
          >
            <span>📋</span>
            <span>
              Review ({currentPhoto.rawParsingResult.problems?.length ?? 0})
            </span>
          </button>
        )}
      </div>

      {/* Previous button */}
      {hasMultiple && (
        <button
          type="button"
          data-action="previous-photo"
          onClick={(e) => {
            e.stopPropagation();
            goToPrevious();
          }}
          className={css({
            position: "absolute",
            left: "1rem",
            top: "50%",
            transform: "translateY(-50%)",
            width: "48px",
            height: "48px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "1.5rem",
            color: "white",
            backgroundColor: "rgba(255, 255, 255, 0.1)",
            border: "none",
            borderRadius: "50%",
            cursor: "pointer",
            transition: "background-color 0.2s",
            _hover: {
              backgroundColor: "rgba(255, 255, 255, 0.2)",
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
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          maxWidth: "100%",
          maxHeight: "calc(100vh - 120px)",
          padding: "0 60px",
        })}
        onClick={(e) => e.stopPropagation()}
      >
        {/* biome-ignore lint/performance/noImgElement: API-served images */}
        <img
          src={currentPhoto.url}
          alt={`Photo ${currentIndex + 1}`}
          className={css({
            maxWidth: "100%",
            maxHeight: "100%",
            objectFit: "contain",
            borderRadius: "8px",
            boxShadow: "0 4px 20px rgba(0, 0, 0, 0.5)",
          })}
        />
      </div>

      {/* Next button */}
      {hasMultiple && (
        <button
          type="button"
          data-action="next-photo"
          onClick={(e) => {
            e.stopPropagation();
            goToNext();
          }}
          className={css({
            position: "absolute",
            right: "1rem",
            top: "50%",
            transform: "translateY(-50%)",
            width: "48px",
            height: "48px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "1.5rem",
            color: "white",
            backgroundColor: "rgba(255, 255, 255, 0.1)",
            border: "none",
            borderRadius: "50%",
            cursor: "pointer",
            transition: "background-color 0.2s",
            _hover: {
              backgroundColor: "rgba(255, 255, 255, 0.2)",
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
          position: "absolute",
          bottom: "1.5rem",
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 2,
        })}
      >
        {hasMultiple && (
          <div
            data-element="photo-counter"
            className={css({
              padding: "0.5rem 1rem",
              backgroundColor: "rgba(0, 0, 0, 0.6)",
              borderRadius: "20px",
              color: "white",
              fontSize: "0.875rem",
              fontWeight: "500",
            })}
          >
            {currentIndex + 1} / {photos.length}
          </div>
        )}
        <div
          data-element="keyboard-hint"
          className={css({
            color: "gray.500",
            fontSize: "xs",
          })}
        >
          Press E to edit{currentPhoto.rawParsingResult ? " • R to review" : ""}{" "}
          • Arrow keys to navigate • Esc to close
        </div>
      </div>
    </div>
  );
}

export default PhotoViewerEditor;
