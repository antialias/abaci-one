"use client";

/**
 * Device Capabilities Hooks
 *
 * Detect device input capabilities for adaptive UI behavior.
 * These hooks help distinguish between:
 * - Touch-only devices (phones, tablets without mouse)
 * - Pointer devices (desktops, laptops with mouse/trackpad)
 * - Hybrid devices (laptops with touchscreen, tablets with attached mouse)
 *
 * @see useMediaQuery for viewport-based breakpoints (useIsMobile, useIsDesktop, etc.)
 */

import { useEffect, useState } from "react";

/**
 * Hook to detect if the device is primarily touch-based (mobile/tablet).
 * Returns true only for devices where touch is the primary input method.
 *
 * Use cases:
 * - Showing virtual keyboards
 * - Adjusting touch target sizes
 * - Showing mobile-specific UI
 *
 * Note: Returns false during SSR (before hydration)
 */
export function useIsTouchDevice(): boolean {
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  useEffect(() => {
    const checkTouchDevice = () => {
      // Check if device has touch capability
      const hasTouchCapability =
        "ontouchstart" in window ||
        navigator.maxTouchPoints > 0 ||
        // @ts-expect-error - msMaxTouchPoints is IE/Edge specific
        navigator.msMaxTouchPoints > 0;

      // Check if the device has no fine pointer (mouse)
      // This helps distinguish touch-only devices from laptops with touchscreens
      const hasNoFinePointer = !window.matchMedia("(pointer: fine)").matches;

      // Also check for coarse pointer (finger/touch)
      const hasCoarsePointer = window.matchMedia("(pointer: coarse)").matches;

      setIsTouchDevice(
        hasTouchCapability && (hasNoFinePointer || hasCoarsePointer),
      );
    };

    checkTouchDevice();

    // Re-check on resize (in case device mode changes, e.g., responsive testing)
    window.addEventListener("resize", checkTouchDevice);
    return () => window.removeEventListener("resize", checkTouchDevice);
  }, []);

  return isTouchDevice;
}

/**
 * Hook to detect if any pointing device on this device is "fine" (mouse-like).
 * Returns true for:
 * - Desktops/laptops with mouse
 * - Tablets with attached mouse/trackpad
 * - Laptops with touchscreen (primary may be touch, but mouse is available)
 *
 * Use cases:
 * - Showing hover-based UI hints (hot/cold feedback)
 * - Enabling mouse-specific interactions
 *
 * Note: Returns false during SSR (before hydration)
 */
export function useHasAnyFinePointer(): boolean {
  const [hasAnyFinePointer, setHasAnyFinePointer] = useState(false);

  useEffect(() => {
    const checkFinePointer = () => {
      // any-pointer: fine matches if ANY available pointing device is fine
      // This is broader than pointer: fine which only checks the primary device
      setHasAnyFinePointer(window.matchMedia("(any-pointer: fine)").matches);
    };

    checkFinePointer();

    // Re-check on resize (in case device mode changes)
    window.addEventListener("resize", checkFinePointer);
    return () => window.removeEventListener("resize", checkFinePointer);
  }, []);

  return hasAnyFinePointer;
}

/**
 * Hook to detect if device has a physical keyboard available.
 * Uses a combination of:
 * 1. Actual keyboard input detection (most reliable)
 * 2. Heuristic fallback (pointer type, user agent, viewport)
 *
 * Returns:
 * - null: Still detecting (initial state)
 * - true: Physical keyboard detected or likely available
 * - false: No physical keyboard, show on-screen keyboard
 *
 * Use cases:
 * - Showing/hiding on-screen number pads
 * - Choosing between keyboard vs touch input modes
 */
export function useHasPhysicalKeyboard(): boolean | null {
  const [hasKeyboard, setHasKeyboard] = useState<boolean | null>(null);

  useEffect(() => {
    let keyboardDetected = false;
    let detectionTimeout: NodeJS.Timeout | null = null;

    const handleKeyPress = (e: KeyboardEvent) => {
      // Any number key press confirms physical keyboard
      if (/^[0-9]$/.test(e.key)) {
        keyboardDetected = true;
        setHasKeyboard(true);
        cleanup();
      }
    };

    const detectFromHeuristics = () => {
      // Method 1: Check if device supports keyboard via media queries
      const hasKeyboardSupport =
        window.matchMedia("(pointer: fine)").matches &&
        window.matchMedia("(hover: hover)").matches;

      // Method 2: Check if device is likely touch-only
      const isTouchDevice =
        "ontouchstart" in window ||
        navigator.maxTouchPoints > 0 ||
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
          navigator.userAgent,
        );

      // Method 3: Check viewport characteristics for mobile devices
      const isMobileViewport = window.innerWidth <= 768;

      // Combined heuristic: likely has keyboard if:
      // - Desktop-like pointer AND not mobile user agent AND not mobile viewport
      const likelyHasKeyboard =
        hasKeyboardSupport && !isTouchDevice && !isMobileViewport;

      // Alternative: assume no keyboard if touch device + mobile viewport + no precise pointer
      const likelyNoKeyboard =
        isTouchDevice && isMobileViewport && !hasKeyboardSupport;

      if (!keyboardDetected) {
        // If clearly no keyboard, set false; if clearly has keyboard, set true; otherwise uncertain -> true (allow keyboard input)
        setHasKeyboard(
          likelyNoKeyboard ? false : likelyHasKeyboard || !isTouchDevice,
        );
      }
    };

    const cleanup = () => {
      document.removeEventListener("keypress", handleKeyPress);
      if (detectionTimeout) clearTimeout(detectionTimeout);
    };

    // Listen for keyboard input
    document.addEventListener("keypress", handleKeyPress);

    // Fallback to heuristic after 2 seconds
    detectionTimeout = setTimeout(() => {
      if (!keyboardDetected) {
        detectFromHeuristics();
      }
    }, 2000);

    // Initial heuristic (will be overridden by actual keypress)
    setTimeout(detectFromHeuristics, 100);

    return cleanup;
  }, []);

  return hasKeyboard;
}
