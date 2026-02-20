'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export interface TiltVector {
  x: number
  y: number
}

/**
 * Hook that provides device tilt data via a ref (no re-renders).
 * Uses DeviceOrientationEvent to detect phone tilt and converts
 * it to a force vector suitable for physics simulations.
 *
 * On iOS 13+, permission must be requested via a user gesture (handled by `toggle`).
 */
export function useDeviceTilt() {
  const tiltRef = useRef<TiltVector>({ x: 0, y: 0 })
  const [supported, setSupported] = useState(false)
  const [enabled, setEnabled] = useState(false)
  const [needsPermission, setNeedsPermission] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if ('DeviceOrientationEvent' in window) {
      setSupported(true)
      const DOE = DeviceOrientationEvent as unknown as {
        requestPermission?: () => Promise<string>
      }
      if (typeof DOE.requestPermission === 'function') {
        setNeedsPermission(true)
      }
    }
  }, [])

  const toggle = useCallback(async () => {
    if (enabled) {
      setEnabled(false)
      tiltRef.current = { x: 0, y: 0 }
      return
    }

    const DOE = DeviceOrientationEvent as unknown as {
      requestPermission?: () => Promise<string>
    }
    if (typeof DOE.requestPermission === 'function') {
      try {
        const result = await DOE.requestPermission()
        if (result !== 'granted') return
      } catch {
        return
      }
    }

    // Also request DeviceMotionEvent permission (needed for jolt detection).
    // On iOS this shares the same underlying permission dialog, so it should
    // succeed immediately if orientation was granted.
    const DME = DeviceMotionEvent as unknown as {
      requestPermission?: () => Promise<string>
    }
    if (typeof DME?.requestPermission === 'function') {
      try {
        await DME.requestPermission()
      } catch {
        // Non-fatal — jolt detection just won't work
      }
    }

    setEnabled(true)
    setNeedsPermission(false)
  }, [enabled])

  useEffect(() => {
    if (!enabled) return

    const SENSITIVITY = 0.12
    const MAX_TILT = 50
    const DEAD_ZONE = 2 // degrees - ignore tiny tilts
    const SMOOTHING = 0.3 // low-pass filter factor (0-1, lower = smoother)

    const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

    const handler = (e: DeviceOrientationEvent) => {
      const rawBeta = e.beta ?? 0 // front-back: -180..180, 0 = flat
      const rawGamma = e.gamma ?? 0 // left-right: -90..90, 0 = flat

      // Apply dead zone
      const beta = Math.abs(rawBeta) < DEAD_ZONE ? 0 : rawBeta
      const gamma = Math.abs(rawGamma) < DEAD_ZONE ? 0 : rawGamma

      // Convert to force: gamma > 0 = tilted right = force right (positive x)
      //                   beta > 0 = tilted forward = force down (positive y)
      const targetX = clamp(gamma, -MAX_TILT, MAX_TILT) * SENSITIVITY
      const targetY = clamp(beta, -MAX_TILT, MAX_TILT) * SENSITIVITY

      // Low-pass filter for smooth movement
      tiltRef.current = {
        x: tiltRef.current.x + (targetX - tiltRef.current.x) * SMOOTHING,
        y: tiltRef.current.y + (targetY - tiltRef.current.y) * SMOOTHING,
      }
    }

    window.addEventListener('deviceorientation', handler)
    return () => window.removeEventListener('deviceorientation', handler)
  }, [enabled])

  return { tiltRef, supported, enabled, needsPermission, toggle }
}
