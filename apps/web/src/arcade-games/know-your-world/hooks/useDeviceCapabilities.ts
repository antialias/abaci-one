/**
 * Device Capabilities Hooks for Know Your World
 *
 * Re-exports shared hooks and adds game-specific hooks.
 *
 * @see src/hooks/useDeviceCapabilities.ts for shared implementations
 */

import { useEffect, useState } from "react";

// Re-export shared hooks for convenience
export {
  useHasAnyFinePointer,
  useIsTouchDevice,
} from "@/hooks/useDeviceCapabilities";

/**
 * Hook to detect if the device supports precision mode (pointer lock).
 * Returns true only if:
 * 1. The browser supports the Pointer Lock API
 * 2. The device has a fine pointer (mouse/trackpad)
 *
 * This is specific to Know Your World's precision guessing feature.
 *
 * Use cases:
 * - Showing/hiding precision mode UI
 * - Enabling/disabling zoom threshold capping
 * - Showing "click to activate precision mode" messages
 */
export function useCanUsePrecisionMode(): boolean {
  const [canUsePrecisionMode, setCanUsePrecisionMode] = useState(false);

  useEffect(() => {
    const checkPrecisionMode = () => {
      // Check if Pointer Lock API is supported
      const supportsPointerLock = "pointerLockElement" in document;

      // Check if device has a fine pointer (mouse/trackpad)
      const hasFinePointer = window.matchMedia("(pointer: fine)").matches;

      setCanUsePrecisionMode(supportsPointerLock && hasFinePointer);
    };

    checkPrecisionMode();

    // Re-check on resize (in case device mode changes)
    window.addEventListener("resize", checkPrecisionMode);
    return () => window.removeEventListener("resize", checkPrecisionMode);
  }, []);

  return canUsePrecisionMode;
}
