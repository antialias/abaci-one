/**
 * Pointer Lock Hook
 *
 * Manages pointer lock state and event listeners for precision mode.
 * When pointer lock is active, the cursor is hidden and mouse movements
 * are captured as relative deltas instead of absolute positions.
 */

import { useState, useEffect, useRef, type RefObject } from "react";

export interface UsePointerLockOptions {
  /** The container element to lock the pointer to */
  containerRef: RefObject<HTMLDivElement>;
  /** Whether precision mode is available on this device */
  canUsePrecisionMode: boolean;
  /** Callback when pointer lock is acquired */
  onLockAcquired?: () => void;
  /** Callback when pointer lock is released */
  onLockReleased?: () => void;
}

export interface UsePointerLockReturn {
  /** Whether pointer lock is currently active */
  pointerLocked: boolean;
  /** Request pointer lock (activate precision mode) */
  requestPointerLock: () => void;
  /** Exit pointer lock (deactivate precision mode) */
  exitPointerLock: () => void;
}

/**
 * Custom hook for managing pointer lock state.
 *
 * Handles pointer lock events and provides methods to request/exit
 * pointer lock mode. The pointer lock API is used for precision mode
 * in the magnifier, allowing fine-grained cursor control.
 *
 * @param options - Configuration options
 * @returns Pointer lock state and control methods
 */
export function usePointerLock(
  options: UsePointerLockOptions,
): UsePointerLockReturn {
  const { containerRef, canUsePrecisionMode, onLockAcquired, onLockReleased } =
    options;
  const [pointerLocked, setPointerLocked] = useState(false);

  // Track previous lock state for detecting transitions
  const prevLockedRef = useRef(false);

  // Auto-exit pointer lock when precision mode becomes unavailable
  // (e.g., when switching to mobile device toolbar in Chrome DevTools)
  useEffect(() => {
    if (!canUsePrecisionMode && document.pointerLockElement) {
      console.log(
        "[usePointerLock] Precision mode unavailable - exiting pointer lock",
      );
      document.exitPointerLock();
    }
  }, [canUsePrecisionMode]);

  // Set up pointer lock event listeners
  useEffect(() => {
    const handlePointerLockChange = () => {
      const isLocked = document.pointerLockElement === containerRef.current;

      console.log("[usePointerLock] Pointer lock change event:", {
        isLocked,
        pointerLockElement: document.pointerLockElement,
        containerElement: containerRef.current,
        elementsMatch: document.pointerLockElement === containerRef.current,
      });

      setPointerLocked(isLocked);

      // Call callbacks on state transitions
      const wasLocked = prevLockedRef.current;
      if (isLocked && !wasLocked) {
        console.log("[usePointerLock] 🔒 Pointer lock ACQUIRED");
        onLockAcquired?.();
      } else if (!isLocked && wasLocked) {
        console.log("[usePointerLock] 🔓 Pointer lock RELEASED");
        onLockReleased?.();
      }

      prevLockedRef.current = isLocked;
    };

    const handlePointerLockError = () => {
      console.error("[usePointerLock] ❌ Failed to acquire pointer lock");
      setPointerLocked(false);
    };

    document.addEventListener("pointerlockchange", handlePointerLockChange);
    document.addEventListener("pointerlockerror", handlePointerLockError);

    console.log("[usePointerLock] Event listeners attached");

    return () => {
      document.removeEventListener(
        "pointerlockchange",
        handlePointerLockChange,
      );
      document.removeEventListener("pointerlockerror", handlePointerLockError);
      console.log("[usePointerLock] Event listeners removed");
    };
  }, [containerRef, onLockAcquired, onLockReleased]);

  // Release pointer lock when component unmounts
  useEffect(() => {
    return () => {
      if (document.pointerLockElement) {
        console.log(
          "[usePointerLock] Component unmounting - releasing pointer lock",
        );
        document.exitPointerLock();
      }
    };
  }, []);

  const requestPointerLock = () => {
    // Don't request pointer lock if precision mode is not available
    if (!canUsePrecisionMode) {
      console.log(
        "[usePointerLock] Precision mode not available - skipping pointer lock request",
      );
      return;
    }
    if (containerRef.current && !pointerLocked) {
      console.log("[usePointerLock] Requesting pointer lock");
      containerRef.current.requestPointerLock();
    }
  };

  const exitPointerLock = () => {
    if (pointerLocked) {
      console.log("[usePointerLock] Exiting pointer lock");
      document.exitPointerLock();
    }
  };

  return {
    pointerLocked,
    requestPointerLock,
    exitPointerLock,
  };
}
