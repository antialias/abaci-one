"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface UseGameBreakTimerOptions {
  maxDurationMinutes: number;
  onTimeout: () => void;
  enabled?: boolean;
}

export interface UseGameBreakTimerResult {
  startTime: number | null;
  elapsedMs: number;
  remainingMs: number;
  remainingMinutes: number;
  remainingSeconds: number;
  percentRemaining: number;
  isActive: boolean;
  start: () => void;
  stop: () => void;
  reset: () => void;
}

export function useGameBreakTimer({
  maxDurationMinutes,
  onTimeout,
  enabled = true,
}: UseGameBreakTimerOptions): UseGameBreakTimerResult {
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const animationFrameRef = useRef<number | null>(null);
  const hasTimedOutRef = useRef(false);

  const maxDurationMs = maxDurationMinutes * 60 * 1000;

  const start = useCallback(() => {
    if (!enabled) return;
    hasTimedOutRef.current = false;
    setStartTime(Date.now());
    setElapsedMs(0);
  }, [enabled]);

  const stop = useCallback(() => {
    setStartTime(null);
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    hasTimedOutRef.current = false;
    setStartTime(null);
    setElapsedMs(0);
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!startTime || !enabled) {
      return;
    }

    const updateTimer = () => {
      const now = Date.now();
      const elapsed = now - startTime;
      setElapsedMs(elapsed);

      if (elapsed >= maxDurationMs) {
        if (!hasTimedOutRef.current) {
          hasTimedOutRef.current = true;
          onTimeout();
        }
      } else {
        animationFrameRef.current = requestAnimationFrame(updateTimer);
      }
    };

    animationFrameRef.current = requestAnimationFrame(updateTimer);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [startTime, maxDurationMs, onTimeout, enabled]);

  const remainingMs = Math.max(0, maxDurationMs - elapsedMs);
  const remainingMinutes = Math.floor(remainingMs / 60000);
  const remainingSeconds = Math.floor((remainingMs % 60000) / 1000);
  const percentRemaining =
    maxDurationMs > 0 ? (remainingMs / maxDurationMs) * 100 : 100;

  return {
    startTime,
    elapsedMs,
    remainingMs,
    remainingMinutes,
    remainingSeconds,
    percentRemaining,
    isActive: startTime !== null && !hasTimedOutRef.current,
    start,
    stop,
    reset,
  };
}
