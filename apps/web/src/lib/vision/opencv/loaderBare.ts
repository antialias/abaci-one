"use client";

/**
 * Bare minimum loader - NO imports at all, completely self-contained.
 */

function isOpenCVReady(): boolean {
  if (typeof window === "undefined") return false;
  const cv = (window as unknown as { cv?: { imread?: unknown } }).cv;
  return !!(cv && typeof cv.imread === "function");
}

// Using 'unknown' instead of importing CV type
export async function loadOpenCVBare(): Promise<unknown> {
  // If already loaded on window, return it
  if (isOpenCVReady()) {
    return (window as unknown as { cv: unknown }).cv;
  }

  // Load the script
  if (typeof window !== "undefined") {
    const existingScript = document.querySelector('script[src="/opencv.js"]');

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

        script.onerror = () => reject(new Error("Failed to load OpenCV.js"));
        document.head.appendChild(script);
      });
    } else {
      // Script exists, wait for it to be ready
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

  return (window as unknown as { cv: unknown }).cv;
}
