"use client";

/**
 * React hook for lazy-loading OpenCV.js
 *
 * Provides a simple interface to load OpenCV on demand and track loading state.
 * OpenCV.js is ~8MB so we only load it when actually needed.
 */

import { useCallback, useRef, useState } from "react";
import type { CV } from "@/lib/vision/opencv/types";
import {
  loadOpenCV as loadOpenCVCore,
  getOpenCV,
  isOpenCVReady,
} from "@/lib/vision/opencv/loader";

export interface UseOpenCVReturn {
  /** OpenCV instance (null if not loaded) */
  cv: CV | null;
  /** Whether OpenCV is currently loading */
  isLoading: boolean;
  /** Error message if loading failed */
  error: string | null;
  /** Whether OpenCV is ready to use */
  isReady: boolean;
  /**
   * Ensure OpenCV is loaded. Call this before using any OpenCV functionality.
   * Returns true if loaded successfully, false otherwise.
   * Safe to call multiple times - only loads once.
   */
  ensureLoaded: () => Promise<boolean>;
}

/**
 * Hook for lazy-loading OpenCV.js
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { cv, isLoading, isReady, ensureLoaded } = useOpenCV()
 *
 *   const handleClick = async () => {
 *     const loaded = await ensureLoaded()
 *     if (loaded && cv) {
 *       // Use cv here
 *     }
 *   }
 *
 *   return (
 *     <button onClick={handleClick} disabled={isLoading}>
 *       {isLoading ? 'Loading...' : 'Process Image'}
 *     </button>
 *   )
 * }
 * ```
 */
export function useOpenCV(): UseOpenCVReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cvRef = useRef<CV | null>(null);
  const loadPromiseRef = useRef<Promise<boolean> | null>(null);

  const ensureLoaded = useCallback(async (): Promise<boolean> => {
    // Already loaded
    if (cvRef.current) return true;

    // Check if loaded by another instance
    if (isOpenCVReady()) {
      cvRef.current = getOpenCV();
      return cvRef.current !== null;
    }

    // Already loading - wait for it
    if (loadPromiseRef.current) {
      return loadPromiseRef.current;
    }

    // Start loading
    setIsLoading(true);
    setError(null);

    loadPromiseRef.current = (async () => {
      try {
        await loadOpenCVCore();
        cvRef.current = getOpenCV();
        setIsLoading(false);
        return cvRef.current !== null;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to load OpenCV";
        setError(message);
        setIsLoading(false);
        return false;
      }
    })();

    return loadPromiseRef.current;
  }, []);

  return {
    cv: cvRef.current,
    isLoading,
    error,
    isReady: cvRef.current !== null,
    ensureLoaded,
  };
}

export default useOpenCV;
