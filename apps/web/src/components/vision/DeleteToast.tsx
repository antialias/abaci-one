"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { css } from "../../../styled-system/css";

const UNDO_TIMEOUT = 5000; // 5 seconds to undo

export interface PendingDeletion {
  id: string;
  images: { digit: number; filename: string }[];
  message: string;
  createdAt: number;
}

export interface DeleteToastProps {
  /** Pending deletion to display */
  deletion: PendingDeletion;
  /** Called when undo is clicked */
  onUndo: (deletion: PendingDeletion) => void;
  /** Called when deletion should be finalized */
  onConfirm: (deletion: PendingDeletion) => void;
  /** Called when toast is dismissed (also triggers confirm) */
  onDismiss: (deletion: PendingDeletion) => void;
}

export function DeleteToast({
  deletion,
  onUndo,
  onConfirm,
  onDismiss,
}: DeleteToastProps) {
  const [progress, setProgress] = useState(100);
  const [isPaused, setIsPaused] = useState(false);
  const startTimeRef = useRef(Date.now());
  const remainingTimeRef = useRef(UNDO_TIMEOUT);

  // Handle the countdown
  useEffect(() => {
    if (isPaused) return;

    const tick = () => {
      const elapsed = Date.now() - startTimeRef.current;
      const remaining = Math.max(0, remainingTimeRef.current - elapsed);
      const progressPercent = (remaining / UNDO_TIMEOUT) * 100;

      setProgress(progressPercent);

      if (remaining <= 0) {
        onConfirm(deletion);
      }
    };

    const interval = setInterval(tick, 50);
    tick(); // Initial tick

    return () => clearInterval(interval);
  }, [deletion, isPaused, onConfirm]);

  // Pause on hover
  const handleMouseEnter = useCallback(() => {
    remainingTimeRef.current = (progress / 100) * UNDO_TIMEOUT;
    setIsPaused(true);
  }, [progress]);

  const handleMouseLeave = useCallback(() => {
    startTimeRef.current = Date.now();
    setIsPaused(false);
  }, []);

  const handleUndo = useCallback(() => {
    onUndo(deletion);
  }, [deletion, onUndo]);

  const handleDismiss = useCallback(() => {
    onDismiss(deletion);
  }, [deletion, onDismiss]);

  return (
    <div
      data-component="delete-toast"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={css({
        position: "relative",
        bg: "gray.800",
        borderRadius: "lg",
        p: 4,
        pr: 10,
        boxShadow: "0 10px 40px rgba(0,0,0,0.4)",
        border: "1px solid",
        borderColor: "gray.700",
        minWidth: "300px",
        maxWidth: "400px",
        overflow: "hidden",
      })}
    >
      {/* Progress bar */}
      <div
        className={css({
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: "3px",
          bg: "gray.700",
        })}
      >
        <div
          className={css({
            height: "100%",
            bg: "red.500",
            transition: isPaused ? "none" : "width 0.05s linear",
          })}
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Close button */}
      <button
        type="button"
        onClick={handleDismiss}
        className={css({
          position: "absolute",
          top: 2,
          right: 2,
          width: "24px",
          height: "24px",
          borderRadius: "full",
          border: "none",
          bg: "transparent",
          color: "gray.500",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "lg",
          _hover: { color: "gray.300", bg: "gray.700" },
        })}
      >
        ×
      </button>

      {/* Content */}
      <div className={css({ display: "flex", alignItems: "center", gap: 3 })}>
        <div className={css({ fontSize: "xl" })}>🗑️</div>
        <div className={css({ flex: 1 })}>
          <div
            className={css({ color: "gray.100", fontWeight: "medium", mb: 1 })}
          >
            {deletion.message}
          </div>
          <button
            type="button"
            onClick={handleUndo}
            className={css({
              px: 3,
              py: 1,
              bg: "blue.600",
              color: "white",
              borderRadius: "md",
              border: "none",
              cursor: "pointer",
              fontSize: "sm",
              fontWeight: "medium",
              _hover: { bg: "blue.500" },
            })}
          >
            Undo
          </button>
        </div>
      </div>
    </div>
  );
}

export interface DeleteToastContainerProps {
  deletions: PendingDeletion[];
  onUndo: (deletion: PendingDeletion) => void;
  onConfirm: (deletion: PendingDeletion) => void;
  onDismiss: (deletion: PendingDeletion) => void;
}

export function DeleteToastContainer({
  deletions,
  onUndo,
  onConfirm,
  onDismiss,
}: DeleteToastContainerProps) {
  if (deletions.length === 0) return null;

  return (
    <div
      data-component="delete-toast-container"
      className={css({
        position: "fixed",
        bottom: 4,
        right: 4,
        zIndex: 10000,
        display: "flex",
        flexDirection: "column",
        gap: 2,
      })}
    >
      {deletions.map((deletion) => (
        <DeleteToast
          key={deletion.id}
          deletion={deletion}
          onUndo={onUndo}
          onConfirm={onConfirm}
          onDismiss={onDismiss}
        />
      ))}
    </div>
  );
}
