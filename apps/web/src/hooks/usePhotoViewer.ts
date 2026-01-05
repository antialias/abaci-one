"use client";

import { useCallback, useState } from "react";

/**
 * Viewer mode for photos
 * - view: Read-only viewing
 * - edit: Editing (crop, rotate)
 * - review: Worksheet parsing review
 */
export type PhotoViewerMode = "view" | "edit" | "review";

/**
 * Return type for usePhotoViewer hook
 */
export interface UsePhotoViewerReturn {
  /** Whether the viewer is open */
  isOpen: boolean;
  /** Current photo index */
  index: number;
  /** Current viewer mode */
  mode: PhotoViewerMode;
  /** Open the viewer at a specific index and mode */
  open: (index: number, mode?: PhotoViewerMode) => void;
  /** Close the viewer */
  close: () => void;
  /** Change the viewer mode */
  setMode: (mode: PhotoViewerMode) => void;
  /** Change the current index */
  setIndex: (index: number) => void;
}

/**
 * Hook for managing photo viewer modal state
 *
 * Provides simple state management for:
 * - Open/close state
 * - Current photo index
 * - Viewer mode (view, edit, review)
 */
export function usePhotoViewer(): UsePhotoViewerReturn {
  const [isOpen, setIsOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [mode, setMode] = useState<PhotoViewerMode>("view");

  const open = useCallback((idx: number, m: PhotoViewerMode = "view") => {
    setIndex(idx);
    setMode(m);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  return {
    isOpen,
    index,
    mode,
    open,
    close,
    setMode,
    setIndex,
  };
}

export default usePhotoViewer;
