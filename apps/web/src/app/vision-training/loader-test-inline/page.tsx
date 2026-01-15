"use client";

import { useCallback, useState } from "react";
import { css } from "../../../../styled-system/css";

// INLINE copy of the loader code - not imported from a module
function isOpenCVReady(): boolean {
  if (typeof window === "undefined") return false;
  const cv = (window as unknown as { cv?: { imread?: unknown } }).cv;
  return !!(cv && typeof cv.imread === "function");
}

/**
 * Minimal test page with loader code INLINE (not imported from module).
 * Testing if the module bundling is causing the issue.
 */
export default function LoaderTestInlinePage() {
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [error, setError] = useState<string | null>(null);
  const [time, setTime] = useState<number | null>(null);

  // Inline loader using useCallback - exactly like useDocumentDetection
  const loadOpenCVInline = useCallback(async (): Promise<boolean> => {
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
      return true;
    } catch (err) {
      console.error("Failed to load OpenCV:", err);
      throw err;
    }
  }, []);

  const handleTest = async () => {
    console.log("[LoaderTestInline] Button clicked");
    setStatus("loading");
    setError(null);
    const start = Date.now();

    try {
      console.log("[LoaderTestInline] Calling loadOpenCVInline...");
      const loaded = await loadOpenCVInline();
      console.log("[LoaderTestInline] loadOpenCVInline returned:", loaded);
      setTime(Date.now() - start);
      setStatus(loaded ? "success" : "error");
    } catch (err) {
      console.log("[LoaderTestInline] Error:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
      setStatus("error");
    }
  };

  return (
    <div
      data-component="loader-test-inline-page"
      className={css({
        minHeight: "100vh",
        bg: "gray.900",
        color: "gray.100",
        p: 8,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
      })}
    >
      <h1 className={css({ fontSize: "2xl", fontWeight: "bold" })}>
        Inline Loader Test
      </h1>
      <p className={css({ color: "gray.400", mb: 4 })}>
        Loader code is INLINE in this component (not imported from module).
      </p>

      <button
        type="button"
        onClick={handleTest}
        disabled={status === "loading"}
        className={css({
          px: 6,
          py: 3,
          bg: "purple.600",
          color: "white",
          borderRadius: "lg",
          fontSize: "lg",
          fontWeight: "bold",
          border: "none",
          cursor: "pointer",
          _hover: { bg: "purple.500" },
          _disabled: { opacity: 0.5, cursor: "not-allowed" },
        })}
      >
        {status === "loading" ? "Loading..." : "Test Inline Loader"}
      </button>

      <div className={css({ mt: 4, textAlign: "center" })}>
        <div className={css({ fontSize: "lg" })}>
          Status:{" "}
          <span
            className={css({
              color:
                status === "success"
                  ? "green.400"
                  : status === "error"
                    ? "red.400"
                    : "gray.400",
            })}
          >
            {status}
          </span>
        </div>
        {time !== null && <div>Loaded in {time}ms</div>}
        {error && <div className={css({ color: "red.400" })}>{error}</div>}
      </div>
    </div>
  );
}
