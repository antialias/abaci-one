"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { css } from "../../../styled-system/css";

interface VisionDvrControlsProps {
  /** Session ID for DVR requests */
  sessionId: string;
  /** Whether DVR is available (buffer has data) */
  isAvailable: boolean;
  /** Available time range in ms from recording start */
  availableFromMs?: number;
  availableToMs?: number;
  /** Current problem start time in ms from recording start (for per-problem scrubbing) */
  currentProblemStartMs?: number | null;
  /** Current problem number (for display) */
  currentProblemNumber?: number | null;
  /** Callback to request a frame at offset */
  onScrub: (offsetMs: number) => void;
  /** Callback when returning to live */
  onGoLive: () => void;
  /** Whether currently showing live feed */
  isLive: boolean;
}

/**
 * DVR controls for live vision feed observation.
 *
 * Allows observers to:
 * - Scrub back within the current problem only
 * - Return to live feed
 * - See buffer availability for current problem
 */
export function VisionDvrControls({
  sessionId,
  isAvailable,
  availableFromMs = 0,
  availableToMs = 0,
  currentProblemStartMs,
  currentProblemNumber,
  onScrub,
  onGoLive,
  isLive,
}: VisionDvrControlsProps) {
  const [scrubPosition, setScrubPosition] = useState(100); // Percentage (100 = live)
  const [isDragging, setIsDragging] = useState(false);
  const sliderRef = useRef<HTMLDivElement>(null);

  // Use current problem start as the effective scrub start (if available)
  // This constrains scrubbing to the current problem only
  const effectiveFromMs =
    currentProblemStartMs != null
      ? Math.max(availableFromMs, currentProblemStartMs)
      : availableFromMs;

  // Duration available for scrubbing (within current problem)
  const bufferDuration = availableToMs - effectiveFromMs;
  const bufferSeconds = Math.floor(bufferDuration / 1000);

  // Handle slider interaction
  const handleSliderChange = useCallback(
    (clientX: number) => {
      if (!sliderRef.current || !isAvailable) return;

      const rect = sliderRef.current.getBoundingClientRect();
      const percentage = Math.max(
        0,
        Math.min(100, ((clientX - rect.left) / rect.width) * 100),
      );
      setScrubPosition(percentage);

      // Calculate offset from recording start (constrained to current problem)
      const offsetMs =
        effectiveFromMs +
        (percentage / 100) * (availableToMs - effectiveFromMs);
      onScrub(offsetMs);
    },
    [isAvailable, effectiveFromMs, availableToMs, onScrub],
  );

  // Mouse/touch handlers
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!isAvailable) return;
      setIsDragging(true);
      handleSliderChange(e.clientX);
    },
    [isAvailable, handleSliderChange],
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (isDragging) {
        handleSliderChange(e.clientX);
      }
    },
    [isDragging, handleSliderChange],
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Global mouse handlers for dragging
  useEffect(() => {
    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Go live handler
  const handleGoLive = useCallback(() => {
    setScrubPosition(100);
    onGoLive();
  }, [onGoLive]);

  // Format time for display
  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0
      ? `${mins}:${secs.toString().padStart(2, "0")}`
      : `${secs}s`;
  };

  // Calculate current offset for display (relative to current problem)
  const currentOffsetMs =
    effectiveFromMs + (scrubPosition / 100) * (availableToMs - effectiveFromMs);
  const secondsAgo = Math.floor((availableToMs - currentOffsetMs) / 1000);

  if (!isAvailable) {
    return (
      <div
        data-component="vision-dvr-controls"
        data-status="unavailable"
        className={css({
          display: "flex",
          alignItems: "center",
          gap: 2,
          px: 2,
          py: 1,
          bg: "rgba(0, 0, 0, 0.6)",
          borderRadius: "md",
          fontSize: "xs",
          color: "gray.500",
        })}
      >
        <span>DVR not available</span>
      </div>
    );
  }

  return (
    <div
      data-component="vision-dvr-controls"
      data-status={isLive ? "live" : "scrubbing"}
      className={css({
        display: "flex",
        flexDirection: "column",
        gap: 1,
        p: 2,
        bg: "rgba(0, 0, 0, 0.7)",
        backdropFilter: "blur(4px)",
        borderRadius: "md",
      })}
    >
      {/* Scrub slider */}
      <div
        ref={sliderRef}
        data-element="scrub-slider"
        className={css({
          position: "relative",
          height: "20px",
          cursor: "pointer",
          touchAction: "none",
        })}
        onMouseDown={handleMouseDown}
      >
        {/* Track */}
        <div
          className={css({
            position: "absolute",
            top: "50%",
            left: 0,
            right: 0,
            height: "4px",
            bg: "gray.700",
            borderRadius: "full",
            transform: "translateY(-50%)",
          })}
        />

        {/* Buffer fill */}
        <div
          className={css({
            position: "absolute",
            top: "50%",
            left: 0,
            height: "4px",
            bg: "cyan.600",
            borderRadius: "full",
            transform: "translateY(-50%)",
          })}
          style={{ width: `${scrubPosition}%` }}
        />

        {/* Thumb */}
        <div
          className={css({
            position: "absolute",
            top: "50%",
            width: "12px",
            height: "12px",
            bg: "white",
            borderRadius: "full",
            transform: "translate(-50%, -50%)",
            boxShadow: "md",
            transition: isDragging ? "none" : "left 0.1s",
          })}
          style={{ left: `${scrubPosition}%` }}
        />
      </div>

      {/* Controls row */}
      <div
        className={css({
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: "xs",
        })}
      >
        {/* Buffer info - shows time available for current problem */}
        <span className={css({ color: "gray.400" })}>
          {currentProblemNumber != null
            ? `Q${currentProblemNumber}: -${bufferSeconds}s`
            : `-${bufferSeconds}s available`}
        </span>

        {/* Current position / Live button */}
        {isLive ? (
          <div
            className={css({
              display: "flex",
              alignItems: "center",
              gap: 1,
              color: "green.400",
            })}
          >
            <div
              className={css({
                w: "6px",
                h: "6px",
                borderRadius: "full",
                bg: "green.500",
                animation: "pulse 2s infinite",
              })}
            />
            <span>LIVE</span>
          </div>
        ) : (
          <div
            className={css({
              display: "flex",
              alignItems: "center",
              gap: 2,
            })}
          >
            <span className={css({ color: "yellow.400" })}>
              -{secondsAgo}s ago
            </span>
            <button
              onClick={handleGoLive}
              className={css({
                px: 2,
                py: 0.5,
                bg: "green.600",
                color: "white",
                borderRadius: "md",
                fontSize: "xs",
                fontWeight: "medium",
                cursor: "pointer",
                _hover: { bg: "green.500" },
              })}
            >
              Go Live
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
