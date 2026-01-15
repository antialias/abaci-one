"use client";

import { useState } from "react";
import { css } from "../../../../styled-system/css";
import { loadOpenCVSimple } from "@/lib/vision/opencv/loaderSimple";

/**
 * Test simplified loader without module-level caching.
 */
export default function LoaderTestSimplePage() {
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [error, setError] = useState<string | null>(null);
  const [time, setTime] = useState<number | null>(null);

  const handleTest = async () => {
    console.log("[LoaderTestSimple] Button clicked");
    setStatus("loading");
    setError(null);
    const start = Date.now();

    try {
      console.log("[LoaderTestSimple] Calling loadOpenCVSimple...");
      const cv = await loadOpenCVSimple();
      console.log("[LoaderTestSimple] loadOpenCVSimple returned:", !!cv);
      setTime(Date.now() - start);
      setStatus(cv?.imread ? "success" : "error");
    } catch (err) {
      console.log("[LoaderTestSimple] Error:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
      setStatus("error");
    }
  };

  return (
    <div
      data-component="loader-test-simple-page"
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
        Simple Loader Test (No Caching)
      </h1>
      <p className={css({ color: "gray.400", mb: 4 })}>
        Uses simplified loader without module-level state variables.
      </p>

      <button
        type="button"
        onClick={handleTest}
        disabled={status === "loading"}
        className={css({
          px: 6,
          py: 3,
          bg: "pink.600",
          color: "white",
          borderRadius: "lg",
          fontSize: "lg",
          fontWeight: "bold",
          border: "none",
          cursor: "pointer",
          _hover: { bg: "pink.500" },
          _disabled: { opacity: 0.5, cursor: "not-allowed" },
        })}
      >
        {status === "loading" ? "Loading..." : "Test Simple Loader"}
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
