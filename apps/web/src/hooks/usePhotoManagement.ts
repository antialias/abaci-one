"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useDocumentDetection } from "@/components/practice/useDocumentDetection";
import type {
  DocumentAdjustmentState,
  Corner,
  Rotation,
} from "@/types/attachments";
import { attachmentKeys } from "@/lib/queryKeys";

/**
 * Options for usePhotoManagement hook
 */
export interface UsePhotoManagementOptions {
  studentId: string;
  sessionId: string | undefined;
  onError?: (message: string) => void;
}

/**
 * Return type for usePhotoManagement hook
 */
export interface UsePhotoManagementReturn {
  // Camera state
  showCamera: boolean;
  openCamera: () => void;
  closeCamera: () => void;
  handleCameraCapture: (
    cropped: File,
    original: File,
    corners: Corner[],
    rotation: Rotation,
  ) => void;

  // Drag-drop state
  dragOver: boolean;
  handleDrop: (e: React.DragEvent) => void;
  handleDragOver: (e: React.DragEvent) => void;
  handleDragLeave: () => void;

  // File input
  fileInputRef: React.RefObject<HTMLInputElement>;
  handleFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;

  // Upload state
  isUploading: boolean;
  uploadError: string | null;

  // Delete state
  deletingId: string | null;
  deletePhoto: (attachmentId: string) => Promise<void>;

  // Document adjustment modal state
  adjustmentState: DocumentAdjustmentState | null;
  handleAdjustmentConfirm: (
    cropped: File,
    corners: Corner[],
    rotation: Rotation,
  ) => Promise<void>;
  handleAdjustmentSkip: () => Promise<void>;
  handleAdjustmentCancel: () => void;
  queueLength: number;

  // OpenCV reference (needed by DocumentAdjuster)
  opencvRef: unknown;
  detectQuadsInImage: (
    canvas: HTMLCanvasElement,
  ) => import("@/components/practice/useDocumentDetection").DetectQuadsInImageResult;

  // Photo editing
  handlePhotoEditConfirm: (
    photoId: string,
    croppedFile: File,
    corners: Corner[],
    rotation: Rotation,
  ) => Promise<void>;
}

/**
 * Hook for managing photo uploads, camera capture, and document adjustment
 *
 * Consolidates all photo-related state and callbacks from SummaryClient:
 * - Camera modal state
 * - Drag-and-drop file handling
 * - File input selection
 * - Upload progress and errors
 * - Photo deletion
 * - Document adjustment modal (OpenCV integration)
 */
export function usePhotoManagement({
  studentId,
  sessionId,
  onError,
}: UsePhotoManagementOptions): UsePhotoManagementReturn {
  const queryClient = useQueryClient();

  // Camera state
  const [showCamera, setShowCamera] = useState(false);

  // Drag-drop state
  const [dragOver, setDragOver] = useState(false);

  // Upload state
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Delete state
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // File input ref (non-null type to match OfflineWorkSection expectations)
  const fileInputRef = useRef<HTMLInputElement>(null);

  // File queue for document adjustment
  const [fileQueue, setFileQueue] = useState<File[]>([]);
  const [adjustmentState, setAdjustmentState] =
    useState<DocumentAdjustmentState | null>(null);

  // Document detection hook (lazy loads OpenCV)
  const {
    ensureOpenCVLoaded,
    detectQuadsInImage,
    loadImageToCanvas,
    cv: opencvRef,
  } = useDocumentDetection();

  // Report errors through callback or state
  const reportError = useCallback(
    (message: string) => {
      setUploadError(message);
      onError?.(message);
    },
    [onError],
  );

  // Upload photos with optional original preservation and corners
  const uploadPhotos = useCallback(
    async (
      photos: File[],
      originals?: File[],
      cornersData?: Array<Corner[] | null>,
      rotationData?: Rotation[],
    ) => {
      if (!sessionId || photos.length === 0) return;

      setIsUploading(true);
      setUploadError(null);

      try {
        const formData = new FormData();
        for (const file of photos) {
          formData.append("photos", file);
        }
        if (originals) {
          for (const file of originals) {
            formData.append("originals", file);
          }
        }
        if (cornersData) {
          for (const corners of cornersData) {
            formData.append("corners", corners ? JSON.stringify(corners) : "");
          }
        }
        if (rotationData) {
          for (const rotation of rotationData) {
            formData.append("rotation", rotation.toString());
          }
        }

        const response = await fetch(
          `/api/curriculum/${studentId}/sessions/${sessionId}/attachments`,
          { method: "POST", body: formData },
        );

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to upload photos");
        }

        // Refresh attachments
        queryClient.invalidateQueries({
          queryKey: attachmentKeys.session(studentId, sessionId),
        });
      } catch (err) {
        reportError(
          err instanceof Error ? err.message : "Failed to upload photos",
        );
      } finally {
        setIsUploading(false);
      }
    },
    [studentId, sessionId, queryClient, reportError],
  );

  // Process next file in queue - load, detect quads, show adjuster
  const processNextFile = useCallback(async () => {
    if (fileQueue.length === 0) {
      setAdjustmentState(null);
      return;
    }

    const nextFile = fileQueue[0];

    // Load file to canvas (doesn't require OpenCV)
    const canvas = await loadImageToCanvas(nextFile);
    if (!canvas) {
      console.warn("Failed to load image:", nextFile.name);
      // Skip this file and process next
      setFileQueue((prev) => prev.slice(1));
      return;
    }

    // Ensure OpenCV is loaded before detecting quads (lazy load)
    await ensureOpenCVLoaded();

    // Detect quads (or get fallback corners if OpenCV failed to load)
    const result = detectQuadsInImage(canvas);

    // Show adjustment UI
    setAdjustmentState({
      originalFile: nextFile,
      sourceCanvas: result.sourceCanvas,
      corners: result.corners,
    });
  }, [fileQueue, loadImageToCanvas, ensureOpenCVLoaded, detectQuadsInImage]);

  // Start processing queue when files are added
  useEffect(() => {
    if (fileQueue.length > 0 && !adjustmentState) {
      processNextFile();
    }
  }, [fileQueue, adjustmentState, processNextFile]);

  // Camera handlers
  const openCamera = useCallback(() => setShowCamera(true), []);
  const closeCamera = useCallback(() => setShowCamera(false), []);

  const handleCameraCapture = useCallback(
    (cropped: File, original: File, corners: Corner[], rotation: Rotation) => {
      setShowCamera(false);
      uploadPhotos([cropped], [original], [corners], [rotation]);
    },
    [uploadPhotos],
  );

  // Drag-drop handlers
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    const imageFiles = files.filter((f) => f.type.startsWith("image/"));
    if (imageFiles.length > 0) {
      setFileQueue((prev) => [...prev, ...imageFiles]);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  // File input handler
  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files ? Array.from(e.target.files) : [];
      const imageFiles = files.filter((f) => f.type.startsWith("image/"));
      if (imageFiles.length > 0) {
        setFileQueue((prev) => [...prev, ...imageFiles]);
      }
      e.target.value = "";
    },
    [],
  );

  // Delete photo
  const deletePhoto = useCallback(
    async (attachmentId: string) => {
      if (!sessionId) return;

      setDeletingId(attachmentId);
      try {
        const response = await fetch(
          `/api/curriculum/${studentId}/attachments/${attachmentId}`,
          {
            method: "DELETE",
          },
        );

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to delete photo");
        }

        // Refresh attachments
        queryClient.invalidateQueries({
          queryKey: attachmentKeys.session(studentId, sessionId),
        });
      } catch (err) {
        reportError(
          err instanceof Error ? err.message : "Failed to delete photo",
        );
      } finally {
        setDeletingId(null);
      }
    },
    [studentId, sessionId, queryClient, reportError],
  );

  // Document adjustment handlers
  const handleAdjustmentConfirm = useCallback(
    async (cropped: File, corners: Corner[], rotation: Rotation) => {
      if (!adjustmentState) return;

      // Upload both cropped and original, with corners and rotation for later re-editing
      await uploadPhotos(
        [cropped],
        [adjustmentState.originalFile],
        [corners],
        [rotation],
      );

      // Remove from queue and process next
      setFileQueue((prev) => prev.slice(1));
      setAdjustmentState(null);
    },
    [adjustmentState, uploadPhotos],
  );

  const handleAdjustmentSkip = useCallback(async () => {
    if (!adjustmentState) return;

    // Upload original only (no crop)
    await uploadPhotos([adjustmentState.originalFile]);

    // Remove from queue and process next
    setFileQueue((prev) => prev.slice(1));
    setAdjustmentState(null);
  }, [adjustmentState, uploadPhotos]);

  const handleAdjustmentCancel = useCallback(() => {
    setFileQueue([]);
    setAdjustmentState(null);
  }, []);

  // Photo edit confirm (from PhotoViewerEditor)
  const handlePhotoEditConfirm = useCallback(
    async (
      photoId: string,
      croppedFile: File,
      corners: Corner[],
      rotation: Rotation,
    ) => {
      try {
        setIsUploading(true);
        const formData = new FormData();
        formData.append("file", croppedFile);
        formData.append("corners", JSON.stringify(corners));
        formData.append("rotation", rotation.toString());

        const response = await fetch(
          `/api/curriculum/${studentId}/attachments/${photoId}`,
          {
            method: "PATCH",
            body: formData,
          },
        );

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to update photo");
        }

        // Refresh attachments
        if (sessionId) {
          queryClient.invalidateQueries({
            queryKey: attachmentKeys.session(studentId, sessionId),
          });
        }
      } catch (err) {
        reportError(
          err instanceof Error ? err.message : "Failed to update photo",
        );
      } finally {
        setIsUploading(false);
      }
    },
    [studentId, sessionId, queryClient, reportError],
  );

  return {
    // Camera
    showCamera,
    openCamera,
    closeCamera,
    handleCameraCapture,

    // Drag-drop
    dragOver,
    handleDrop,
    handleDragOver,
    handleDragLeave,

    // File input
    fileInputRef,
    handleFileSelect,

    // Upload
    isUploading,
    uploadError,

    // Delete
    deletingId,
    deletePhoto,

    // Document adjustment
    adjustmentState,
    handleAdjustmentConfirm,
    handleAdjustmentSkip,
    handleAdjustmentCancel,
    queueLength: fileQueue.length,

    // OpenCV
    opencvRef,
    detectQuadsInImage,

    // Photo editing
    handlePhotoEditConfirm,
  };
}

export default usePhotoManagement;
