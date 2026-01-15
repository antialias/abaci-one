"use client";

import { useState } from "react";
import { css } from "../../../../styled-system/css";
import { loadOpenCVv2 } from "@/lib/vision/opencv/loaderV2";

export default function LoaderTestV2Page() {
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [error, setError] = useState<string | null>(null);
  const [time, setTime] = useState<number | null>(null);

  const handleTest = async () => {
    console.log("[LoaderTestV2] Button clicked");
    setStatus("loading");
    setError(null);
    const start = Date.now();

    try {
      console.log("[LoaderTestV2] Calling loadOpenCVv2...");
      const cv = await loadOpenCVv2();
      console.log("[LoaderTestV2] loadOpenCVv2 returned:", !!cv);
      setTime(Date.now() - start);
      setStatus(cv?.imread ? "success" : "error");
    } catch (err) {
      console.log("[LoaderTestV2] Error:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
      setStatus("error");
    }
  };

  return (
    <div
      data-component="loader-test-v2-page"
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
        Loader V2 Test
      </h1>
      <p className={css({ color: "gray.400", mb: 4 })}>
        Uses new loaderV2.ts with proven working pattern.
      </p>

      <button
        type="button"
        onClick={handleTest}
        disabled={status === "loading"}
        className={css({
          px: 6,
          py: 3,
          bg: "lime.600",
          color: "white",
          borderRadius: "lg",
          fontSize: "lg",
          fontWeight: "bold",
          border: "none",
          cursor: "pointer",
          _hover: { bg: "lime.500" },
          _disabled: { opacity: 0.5, cursor: "not-allowed" },
        })}
      >
        {status === "loading" ? "Loading..." : "Test Loader V2"}
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
