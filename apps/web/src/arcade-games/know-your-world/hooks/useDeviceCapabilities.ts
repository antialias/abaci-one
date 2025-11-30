/**
 * Device Capabilities Hooks
 *
 * Detect device input capabilities for adaptive UI behavior.
 * These hooks help distinguish between:
 * - Touch-only devices (phones, tablets without mouse)
 * - Pointer devices (desktops, laptops with mouse/trackpad)
 * - Hybrid devices (laptops with touchscreen, tablets with attached mouse)
 */

import { useEffect, useState } from 'react'

/**
 * Hook to detect if the device is primarily touch-based (mobile/tablet).
 * Returns true only for devices where touch is the primary input method.
 *
 * Use cases:
 * - Showing virtual keyboards
 * - Adjusting touch target sizes
 * - Showing mobile-specific UI
 */
export function useIsTouchDevice(): boolean {
  const [isTouchDevice, setIsTouchDevice] = useState(false)

  useEffect(() => {
    const checkTouchDevice = () => {
      // Check if device has touch capability
      const hasTouchCapability =
        'ontouchstart' in window ||
        navigator.maxTouchPoints > 0 ||
        // @ts-expect-error - msMaxTouchPoints is IE/Edge specific
        navigator.msMaxTouchPoints > 0

      // Check if the device has no fine pointer (mouse)
      // This helps distinguish touch-only devices from laptops with touchscreens
      const hasNoFinePointer = !window.matchMedia('(pointer: fine)').matches

      // Also check for coarse pointer (finger/touch)
      const hasCoarsePointer = window.matchMedia('(pointer: coarse)').matches

      setIsTouchDevice(hasTouchCapability && (hasNoFinePointer || hasCoarsePointer))
    }

    checkTouchDevice()

    // Re-check on resize (in case device mode changes, e.g., responsive testing)
    window.addEventListener('resize', checkTouchDevice)
    return () => window.removeEventListener('resize', checkTouchDevice)
  }, [])

  return isTouchDevice
}

/**
 * Hook to detect if the device supports precision mode (pointer lock).
 * Returns true only if:
 * 1. The browser supports the Pointer Lock API
 * 2. The device has a fine pointer (mouse/trackpad)
 *
 * Use cases:
 * - Showing/hiding precision mode UI
 * - Enabling/disabling zoom threshold capping
 * - Showing "click to activate precision mode" messages
 */
export function useCanUsePrecisionMode(): boolean {
  const [canUsePrecisionMode, setCanUsePrecisionMode] = useState(false)

  useEffect(() => {
    const checkPrecisionMode = () => {
      // Check if Pointer Lock API is supported
      const supportsPointerLock = 'pointerLockElement' in document

      // Check if device has a fine pointer (mouse/trackpad)
      const hasFinePointer = window.matchMedia('(pointer: fine)').matches

      setCanUsePrecisionMode(supportsPointerLock && hasFinePointer)
    }

    checkPrecisionMode()

    // Re-check on resize (in case device mode changes)
    window.addEventListener('resize', checkPrecisionMode)
    return () => window.removeEventListener('resize', checkPrecisionMode)
  }, [])

  return canUsePrecisionMode
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
 */
export function useHasAnyFinePointer(): boolean {
  const [hasAnyFinePointer, setHasAnyFinePointer] = useState(false)

  useEffect(() => {
    const checkFinePointer = () => {
      // any-pointer: fine matches if ANY available pointing device is fine
      // This is broader than pointer: fine which only checks the primary device
      setHasAnyFinePointer(window.matchMedia('(any-pointer: fine)').matches)
    }

    checkFinePointer()

    // Re-check on resize (in case device mode changes)
    window.addEventListener('resize', checkFinePointer)
    return () => window.removeEventListener('resize', checkFinePointer)
  }, [])

  return hasAnyFinePointer
}
