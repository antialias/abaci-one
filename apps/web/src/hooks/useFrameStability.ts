"use client";

import { useCallback, useRef, useState } from "react";
import type { FrameStabilityConfig } from "@/types/vision";
import { DEFAULT_STABILITY_CONFIG } from "@/types/vision";

export interface UseFrameStabilityReturn {
  /** Current stable value (null if not stable) */
  stableValue: number | null;
  /** How many consecutive frames have shown current value */
  consecutiveFrames: number;
  /** Is currently detecting hand movement */
  isHandDetected: boolean;
  /** Current unstable/in-progress value */
  currentValue: number | null;
  /** Current average confidence */
  currentConfidence: number;

  /** Feed new detection result */
  pushFrame: (value: number, confidence: number) => void;
  /** Feed frame data for motion detection */
  pushFrameData: (frameData: ImageData) => void;
  /** Reset stability tracking */
  reset: () => void;
}

/**
 * Hook for debouncing frame-by-frame detection results
 *
 * Tracks consecutive frames showing the same value and only
 * outputs a "stable" value once the threshold is met.
 * Also detects large frame-to-frame changes indicating hand motion.
 */
export function useFrameStability(
  config: Partial<FrameStabilityConfig> = {},
): UseFrameStabilityReturn {
  const mergedConfig = { ...DEFAULT_STABILITY_CONFIG, ...config };

  const [stableValue, setStableValue] = useState<number | null>(null);
  const [consecutiveFrames, setConsecutiveFrames] = useState(0);
  const [isHandDetected, setIsHandDetected] = useState(false);
  const [currentValue, setCurrentValue] = useState<number | null>(null);
  const [currentConfidence, setCurrentConfidence] = useState(0);

  // Track last detected value for comparison
  const lastValueRef = useRef<number | null>(null);
  const confidenceHistoryRef = useRef<number[]>([]);

  // Track previous frame for motion detection
  const previousFrameRef = useRef<ImageData | null>(null);

  /**
   * Push a new detection result
   */
  const pushFrame = useCallback(
    (value: number, confidence: number) => {
      // Skip if confidence too low
      if (confidence < mergedConfig.minConfidence) {
        return;
      }

      setCurrentValue(value);
      setCurrentConfidence(confidence);

      // Track confidence history (last 10 frames)
      confidenceHistoryRef.current.push(confidence);
      if (confidenceHistoryRef.current.length > 10) {
        confidenceHistoryRef.current.shift();
      }

      // Check if value matches previous
      if (value === lastValueRef.current) {
        setConsecutiveFrames((prev) => {
          const next = prev + 1;
          // Check if we've reached stability threshold
          if (next >= mergedConfig.minConsecutiveFrames) {
            setStableValue(value);
          }
          return next;
        });
      } else {
        // Value changed, reset counter
        lastValueRef.current = value;
        setConsecutiveFrames(1);
        // Clear stable value since we're seeing a new value
        setStableValue(null);
      }
    },
    [mergedConfig.minConfidence, mergedConfig.minConsecutiveFrames],
  );

  /**
   * Push frame data for motion detection
   */
  const pushFrameData = useCallback(
    (frameData: ImageData) => {
      const prevFrame = previousFrameRef.current;
      if (!prevFrame) {
        previousFrameRef.current = frameData;
        setIsHandDetected(false);
        return;
      }

      // Compare frames for motion
      let changedPixels = 0;
      const totalPixels = frameData.width * frameData.height;
      const threshold = 30; // Pixel value difference threshold

      // Sample every 4th pixel for performance
      for (let i = 0; i < frameData.data.length; i += 16) {
        const diff = Math.abs(frameData.data[i] - prevFrame.data[i]);
        if (diff > threshold) {
          changedPixels++;
        }
      }

      // Adjust for sampling rate
      const sampledPixels = totalPixels / 4;
      const changeRatio = changedPixels / sampledPixels;

      // Update hand detection state
      const handDetected = changeRatio > mergedConfig.handMotionThreshold;
      setIsHandDetected(handDetected);

      // If hand detected, reset stability
      if (handDetected) {
        setStableValue(null);
        setConsecutiveFrames(0);
        lastValueRef.current = null;
      }

      // Store current frame for next comparison
      previousFrameRef.current = frameData;
    },
    [mergedConfig.handMotionThreshold],
  );

  /**
   * Reset all stability tracking
   */
  const reset = useCallback(() => {
    setStableValue(null);
    setConsecutiveFrames(0);
    setIsHandDetected(false);
    setCurrentValue(null);
    setCurrentConfidence(0);
    lastValueRef.current = null;
    confidenceHistoryRef.current = [];
    previousFrameRef.current = null;
  }, []);

  return {
    stableValue,
    consecutiveFrames,
    isHandDetected,
    currentValue,
    currentConfidence,
    pushFrame,
    pushFrameData,
    reset,
  };
}
