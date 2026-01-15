"use client";

import { useCallback, useRef } from "react";

/**
 * Hook for loading OpenCV - mimics useDocumentDetection structure.
 */
export function useOpenCV() {
  const cvRef = useRef<unknown>(null);
  const loadPromiseRef = useRef<Promise<void> | null>(null);

  const isOpenCVReady = useCallback((): boolean => {
    if (typeof window === "undefined") return false;
    const cv = (window as unknown as { cv?: { imread?: unknown } }).cv;
    return !!(cv && typeof cv.imread === "function");
  }, []);

  const loadOpenCV = useCallback(async (): Promise<unknown> => {
    // Already loaded
    if (cvRef.current) return cvRef.current;

    // Already loading - wait for it
    if (loadPromiseRef.current) {
      await loadPromiseRef.current;
      return cvRef.current;
    }

    // Start loading
    loadPromiseRef.current = (async () => {
      try {
        if (typeof window !== "undefined") {
          if (!isOpenCVReady()) {
            const existingScript = document.querySelector(
              'script[src="/opencv.js"]',
            );

            if (!existingScript) {
              await new Promise<void>((resolve, reject) => {
                const script = document.createElement("script");
                script.src = "/opencv.js";
                script.async = true;

                script.onload = () => {
                  const checkReady = () => {
                    if (isOpenCVReady()) {
                      resolve();
                    } else {
                      const cv = (
                        window as unknown as {
                          cv?: { onRuntimeInitialized?: () => void };
                        }
                      ).cv;
                      if (cv) {
                        const previousCallback = cv.onRuntimeInitialized;
                        cv.onRuntimeInitialized = () => {
                          previousCallback?.();
                          resolve();
                        };
                      } else {
                        reject(new Error("OpenCV.js loaded but cv not found"));
                      }
                    }
                  };
                  checkReady();
                };

                script.onerror = () =>
                  reject(new Error("Failed to load OpenCV.js"));
                document.head.appendChild(script);
              });
            } else {
              await new Promise<void>((resolve, reject) => {
                const maxWait = 30000;
                const startTime = Date.now();

                const checkReady = () => {
                  if (isOpenCVReady()) {
                    resolve();
                  } else if (Date.now() - startTime > maxWait) {
                    reject(new Error("OpenCV.js loading timed out"));
                  } else {
                    const cv = (
                      window as unknown as {
                        cv?: { onRuntimeInitialized?: () => void };
                      }
                    ).cv;
                    if (cv) {
                      const previousCallback = cv.onRuntimeInitialized;
                      cv.onRuntimeInitialized = () => {
                        previousCallback?.();
                        resolve();
                      };
                    } else {
                      setTimeout(checkReady, 100);
                    }
                  }
                };
                checkReady();
              });
            }
          }
        }

        // Store OpenCV reference
        cvRef.current = (window as unknown as { cv: unknown }).cv;
      } catch (err) {
        console.error("Failed to load OpenCV:", err);
        throw err;
      }
    })();

    await loadPromiseRef.current;
    return cvRef.current;
  }, [isOpenCVReady]);

  return { loadOpenCV, isOpenCVReady };
}
