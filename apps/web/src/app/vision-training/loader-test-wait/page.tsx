"use client";

import { useState } from "react";
import { css } from "../../../../styled-system/css";
import { addOpenCVScript } from "@/lib/vision/opencv/addScript";
import { waitForCv } from "@/lib/vision/opencv/waitForCv";

/**
 * Test waiting for cv with imported Promise function.
 */
export default function LoaderTestWaitPage() {
  const [status, setStatus] = useState<
    "idle" | "adding" | "waiting" | "success" | "error"
  >("idle");
  const [time, setTime] = useState<number | null>(null);

  const handleTest = async () => {
    console.log("[LoaderTestWait] Button clicked");
    setStatus("adding");
    const start = Date.now();

    // Step 1: Add script
    console.log("[LoaderTestWait] Adding script...");
    addOpenCVScript();

    // Step 2: Wait for cv to be ready
    setStatus("waiting");
    console.log("[LoaderTestWait] Waiting for cv...");
    const ready = await waitForCv(10000);
    console.log("[LoaderTestWait] waitForCv returned:", ready);

    setTime(Date.now() - start);
    setStatus(ready ? "success" : "error");
  };

  return (
    <div
      data-component="loader-test-wait-page"
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
        Wait Test (Imported Promise)
      </h1>
      <p className={css({ color: "gray.400", mb: 4 })}>
        Adds script tag then waits with imported Promise function.
      </p>

      <button
        type="button"
        onClick={handleTest}
        disabled={status === "adding" || status === "waiting"}
        className={css({
          px: 6,
          py: 3,
          bg: "violet.600",
          color: "white",
          borderRadius: "lg",
          fontSize: "lg",
          fontWeight: "bold",
          border: "none",
          cursor: "pointer",
          _hover: { bg: "violet.500" },
          _disabled: { opacity: 0.5, cursor: "not-allowed" },
        })}
      >
        {status === "adding" || status === "waiting"
          ? "Loading..."
          : "Test Add + Wait"}
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
        {time !== null && <div>Completed in {time}ms</div>}
      </div>
    </div>
  );
}
