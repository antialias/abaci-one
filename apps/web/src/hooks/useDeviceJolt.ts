'use client'

import { useEffect, useRef, useState } from 'react'

export interface JoltEvent {
  directionX: number // normalized screen direction (-1 to 1)
  directionY: number // normalized screen direction (-1 to 1)
  magnitude: number // jerk magnitude (m/s^3)
  timestamp: number // performance.now()
}

export interface JoltConfig {
  joltThreshold: number // m/s^3, minimum jerk for a tip
  wobbleThreshold: number // m/s^3, minimum jerk for a visible wobble
  cooldownMs: number // minimum ms between jolt events
  tumbleThreshold: number // m/s^3, above this → chain 2 tips
  heavyTumbleThreshold: number // m/s^3, above this → chain 3 tips
}

export const DEFAULT_JOLT_CONFIG: JoltConfig = {
  joltThreshold: 25,
  wobbleThreshold: 12,
  cooldownMs: 200,
  tumbleThreshold: 50,
  heavyTumbleThreshold: 80,
}

/**
 * Detects sudden acceleration changes (jolts) via DeviceMotionEvent.
 *
 * Uses accelerationIncludingGravity to compute jerk (rate of change of acceleration).
 * When jerk exceeds the threshold and cooldown has elapsed, writes a JoltEvent to the ref.
 * Consumer reads from the ref each animation frame and clears it.
 */
export function useDeviceJolt(
  active: boolean,
  configOverrides?: Partial<JoltConfig>
) {
  const joltRef = useRef<JoltEvent | null>(null)
  const [supported, setSupported] = useState(false)

  // Merge config with defaults — keep in a ref so the event handler always sees current values
  const configRef = useRef<JoltConfig>({ ...DEFAULT_JOLT_CONFIG, ...configOverrides })
  configRef.current = { ...DEFAULT_JOLT_CONFIG, ...configOverrides }

  useEffect(() => {
    if (typeof window !== 'undefined' && 'DeviceMotionEvent' in window) {
      setSupported(true)
    }
  }, [])

  useEffect(() => {
    if (!active || typeof window === 'undefined') return

    const FILTER_ALPHA = 0.5

    let prevFiltered = { x: 0, y: 0, z: 0 }
    let filtered = { x: 0, y: 0, z: 0 }
    let prevTime = 0
    let lastJoltTime = 0
    let initialized = false

    const handler = (e: DeviceMotionEvent) => {
      const accel = e.accelerationIncludingGravity
      if (!accel || accel.x == null || accel.y == null || accel.z == null) return

      const now = performance.now()
      const raw = { x: accel.x, y: accel.y, z: accel.z }

      // Low-pass filter
      const newFiltered = {
        x: filtered.x + (raw.x - filtered.x) * FILTER_ALPHA,
        y: filtered.y + (raw.y - filtered.y) * FILTER_ALPHA,
        z: filtered.z + (raw.z - filtered.z) * FILTER_ALPHA,
      }

      if (!initialized) {
        // Need at least 2 samples to compute jerk
        filtered = newFiltered
        prevFiltered = newFiltered
        prevTime = now
        initialized = true
        return
      }

      const dt = (now - prevTime) / 1000 // seconds
      if (dt <= 0) return

      // Jerk = d(acceleration)/dt
      const jerk = {
        x: (newFiltered.x - prevFiltered.x) / dt,
        y: (newFiltered.y - prevFiltered.y) / dt,
        z: (newFiltered.z - prevFiltered.z) / dt,
      }

      const magnitude = Math.sqrt(jerk.x * jerk.x + jerk.y * jerk.y + jerk.z * jerk.z)

      prevFiltered = filtered
      filtered = newFiltered
      prevTime = now

      const config = configRef.current

      // Check thresholds
      if (magnitude < config.wobbleThreshold) return
      if (now - lastJoltTime < config.cooldownMs) return

      // Project jerk onto screen plane:
      //   Device x → screen x (positive = right)
      //   Device y → screen y (but flip: device forward = negative screen y = up)
      const screenX = jerk.x
      const screenY = -jerk.y
      const screenMag = Math.sqrt(screenX * screenX + screenY * screenY)

      if (screenMag < 0.01) return

      lastJoltTime = now
      joltRef.current = {
        directionX: screenX / screenMag,
        directionY: screenY / screenMag,
        magnitude,
        timestamp: now,
      }

      // Auto-clear stale jolts after 50ms so consumers don't re-read
      setTimeout(() => {
        if (joltRef.current?.timestamp === now) {
          joltRef.current = null
        }
      }, 50)
    }

    window.addEventListener('devicemotion', handler)
    return () => window.removeEventListener('devicemotion', handler)
  }, [active])

  return { joltRef, supported }
}
