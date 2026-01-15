"use client";

import { useState } from "react";
import { css } from "../../../../styled-system/css";
import { loadOpenCVv5 } from "@/lib/vision/opencv/loaderV5";

export default function LoaderTestV5Page() {
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [time, setTime] = useState<number | null>(null);

  const handleTest = async () => {
    console.log("[LoaderTestV5] Button clicked");
    setStatus("loading");
    const start = Date.now();

    try {
      console.log("[LoaderTestV5] Calling loadOpenCVv5...");
      const cv = await loadOpenCVv5();
      console.log("[LoaderTestV5] loadOpenCVv5 returned:", !!cv);
      setTime(Date.now() - start);
      const hasImread =
        cv && typeof (cv as { imread?: unknown }).imread === "function";
      setStatus(hasImread ? "success" : "error");
    } catch (err) {
      console.log("[LoaderTestV5] Error:", err);
      setStatus("error");
    }
  };

  return (
    <div
      data-component="loader-test-v5-page"
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
        Loader V5 Test (No Internal Await)
      </h1>
      <p className={css({ color: "gray.400", mb: 4 })}>
        Returns Promise, consumer awaits it.
      </p>

      <button
        type="button"
        onClick={handleTest}
        disabled={status === "loading"}
        className={css({
          px: 6,
          py: 3,
          bg: "red.600",
          color: "white",
          borderRadius: "lg",
          fontSize: "lg",
          fontWeight: "bold",
          border: "none",
          cursor: "pointer",
          _hover: { bg: "red.500" },
          _disabled: { opacity: 0.5, cursor: "not-allowed" },
        })}
      >
        {status === "loading" ? "Loading..." : "Test Loader V5"}
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
      </div>
    </div>
  );
}
