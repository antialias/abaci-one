/**
 * @vitest-environment node
 *
 * Tests for Training Capture Rate Limiting Logic
 *
 * This tests the rate limiting pattern used in:
 * - Phone-side training capture (remote-camera page)
 * - Desktop-side passive capture (usePassiveBoundaryCapture hook)
 *
 * The key behavior being tested:
 * - Captures only happen when markers ARE detected AND cooldown has passed
 * - No buffering of frames or stale corner data
 * - Rate limiting is a minimum gap, not a fixed sample rate
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

/**
 * Simulates the rate limiting logic used in training capture.
 * This mirrors the pattern in remote-camera/[sessionId]/page.tsx
 *
 * Note: In the real code, lastCaptureTime starts at 0 and performance.now()
 * returns time since page load (always a large value). So the first capture
 * always passes because `largeValue - 0 >= intervalMs` is true.
 *
 * For testing, we simulate this by using realistic timestamps starting
 * at a large value (like 10000ms after "page load").
 */
class TrainingCaptureRateLimiter {
  private lastCaptureTime: number = 0
  private readonly intervalMs: number

  constructor(intervalMs: number) {
    this.intervalMs = intervalMs
  }

  /**
   * Attempt to capture. Returns true if capture should proceed.
   * Only called when markers are detected (caller's responsibility).
   */
  shouldCapture(currentTime: number): boolean {
    if (currentTime - this.lastCaptureTime >= this.intervalMs) {
      this.lastCaptureTime = currentTime
      return true
    }
    return false
  }

  getLastCaptureTime(): number {
    return this.lastCaptureTime
  }

  reset(): void {
    this.lastCaptureTime = 0
  }
}

describe('Training Capture Rate Limiting', () => {
  describe('TrainingCaptureRateLimiter', () => {
    const INTERVAL_MS = 200 // 5fps
    // Use realistic timestamps - performance.now() returns time since page load
    const BASE_TIME = 10000 // Simulating 10 seconds after page load

    it('should allow first capture immediately', () => {
      const limiter = new TrainingCaptureRateLimiter(INTERVAL_MS)

      // First capture always passes because BASE_TIME - 0 >= INTERVAL_MS
      expect(limiter.shouldCapture(BASE_TIME)).toBe(true)
      expect(limiter.getLastCaptureTime()).toBe(BASE_TIME)
    })

    it('should block captures within cooldown period', () => {
      const limiter = new TrainingCaptureRateLimiter(INTERVAL_MS)

      limiter.shouldCapture(BASE_TIME) // First capture

      // All these should be blocked (within 200ms of BASE_TIME)
      expect(limiter.shouldCapture(BASE_TIME + 50)).toBe(false)
      expect(limiter.shouldCapture(BASE_TIME + 100)).toBe(false)
      expect(limiter.shouldCapture(BASE_TIME + 150)).toBe(false)
      expect(limiter.shouldCapture(BASE_TIME + 199)).toBe(false)

      // Last capture time should still be BASE_TIME
      expect(limiter.getLastCaptureTime()).toBe(BASE_TIME)
    })

    it('should allow capture exactly at cooldown boundary', () => {
      const limiter = new TrainingCaptureRateLimiter(INTERVAL_MS)

      limiter.shouldCapture(BASE_TIME) // First capture
      expect(limiter.shouldCapture(BASE_TIME + 200)).toBe(true) // Exactly at boundary
      expect(limiter.getLastCaptureTime()).toBe(BASE_TIME + 200)
    })

    it('should allow capture after cooldown has passed', () => {
      const limiter = new TrainingCaptureRateLimiter(INTERVAL_MS)

      limiter.shouldCapture(BASE_TIME)
      expect(limiter.shouldCapture(BASE_TIME + 250)).toBe(true) // 250ms later
      expect(limiter.getLastCaptureTime()).toBe(BASE_TIME + 250)
    })

    it('should reset cooldown from each successful capture', () => {
      const limiter = new TrainingCaptureRateLimiter(INTERVAL_MS)

      // Capture at BASE_TIME
      expect(limiter.shouldCapture(BASE_TIME)).toBe(true)

      // Capture at BASE_TIME + 200
      expect(limiter.shouldCapture(BASE_TIME + 200)).toBe(true)
      expect(limiter.getLastCaptureTime()).toBe(BASE_TIME + 200)

      // Block at BASE_TIME + 350 (only 150ms since last)
      expect(limiter.shouldCapture(BASE_TIME + 350)).toBe(false)

      // Allow at BASE_TIME + 400 (200ms since last)
      expect(limiter.shouldCapture(BASE_TIME + 400)).toBe(true)
      expect(limiter.getLastCaptureTime()).toBe(BASE_TIME + 400)
    })

    it('should handle gaps where no capture is attempted', () => {
      const limiter = new TrainingCaptureRateLimiter(INTERVAL_MS)

      // Capture at BASE_TIME
      expect(limiter.shouldCapture(BASE_TIME)).toBe(true)

      // Long gap - no capture attempts (markers not visible)
      // Then capture at BASE_TIME + 5000
      expect(limiter.shouldCapture(BASE_TIME + 5000)).toBe(true)
      expect(limiter.getLastCaptureTime()).toBe(BASE_TIME + 5000)

      // Immediately after, still blocked
      expect(limiter.shouldCapture(BASE_TIME + 5050)).toBe(false)
    })
  })

  describe('Marker Detection + Rate Limiting Interaction', () => {
    // Use realistic timestamps - performance.now() returns time since page load
    const BASE_TIME = 10000 // Simulating 10 seconds after page load

    /**
     * Simulates a detection loop frame where we check:
     * 1. Are markers detected? (external input)
     * 2. Has cooldown passed? (rate limiter)
     *
     * Only if BOTH are true do we capture.
     */
    interface DetectionFrame {
      time: number
      markersDetected: boolean
    }

    function simulateDetectionLoop(
      frames: DetectionFrame[],
      intervalMs: number
    ): { time: number; captured: boolean }[] {
      const limiter = new TrainingCaptureRateLimiter(intervalMs)
      const results: { time: number; captured: boolean }[] = []

      for (const frame of frames) {
        let captured = false

        // This mirrors the logic in remote-camera page:
        // if (markersDetected && limiter.shouldCapture(time)) { capture }
        if (frame.markersDetected && limiter.shouldCapture(frame.time)) {
          captured = true
        }

        results.push({ time: frame.time, captured })
      }

      return results
    }

    it('should only capture when markers detected AND cooldown passed', () => {
      const frames: DetectionFrame[] = [
        { time: BASE_TIME, markersDetected: true }, // Should capture
        { time: BASE_TIME + 50, markersDetected: true }, // Blocked (cooldown)
        { time: BASE_TIME + 100, markersDetected: false }, // Blocked (no markers)
        { time: BASE_TIME + 150, markersDetected: true }, // Blocked (cooldown)
        { time: BASE_TIME + 200, markersDetected: true }, // Should capture
        { time: BASE_TIME + 250, markersDetected: false }, // Blocked (no markers)
        { time: BASE_TIME + 400, markersDetected: true }, // Should capture
      ]

      const results = simulateDetectionLoop(frames, 200)

      expect(results[0].captured).toBe(true) // BASE_TIME
      expect(results[1].captured).toBe(false) // +50
      expect(results[2].captured).toBe(false) // +100
      expect(results[3].captured).toBe(false) // +150
      expect(results[4].captured).toBe(true) // +200
      expect(results[5].captured).toBe(false) // +250
      expect(results[6].captured).toBe(true) // +400
    })

    it('should not capture if markers missing at cooldown boundary', () => {
      const frames: DetectionFrame[] = [
        { time: BASE_TIME, markersDetected: true }, // Capture
        { time: BASE_TIME + 200, markersDetected: false }, // Miss! Markers not visible
        { time: BASE_TIME + 216, markersDetected: false }, // Still no markers
        { time: BASE_TIME + 233, markersDetected: true }, // Markers back - should capture
      ]

      const results = simulateDetectionLoop(frames, 200)

      expect(results[0].captured).toBe(true)
      expect(results[1].captured).toBe(false) // Cooldown passed but no markers
      expect(results[2].captured).toBe(false) // Still no markers
      expect(results[3].captured).toBe(true) // Markers visible, cooldown already passed
    })

    it('should never use stale data - capture is atomic to current frame', () => {
      // This test documents the key invariant:
      // We ONLY capture when the current frame has markers detected.
      // We never buffer or use previous frame data.

      const frames: DetectionFrame[] = [
        { time: BASE_TIME, markersDetected: true }, // Capture this frame's data
        { time: BASE_TIME + 200, markersDetected: false }, // DON'T capture old data
        { time: BASE_TIME + 300, markersDetected: true }, // Capture this frame's data
      ]

      const results = simulateDetectionLoop(frames, 200)

      // At +200, even though cooldown passed, we don't capture
      // because markers aren't detected in THIS frame
      expect(results[1].captured).toBe(false)

      // At +300, we capture THIS frame's data (not BASE_TIME's data)
      expect(results[2].captured).toBe(true)
    })

    it('should achieve approximately 5fps when markers consistently visible', () => {
      // Generate frames at 60fps (every ~16.67ms) with markers always visible
      const frames: DetectionFrame[] = []
      for (let t = 0; t < 1000; t += 16.67) {
        frames.push({ time: BASE_TIME + t, markersDetected: true })
      }

      const results = simulateDetectionLoop(frames, 200)
      const captureCount = results.filter((r) => r.captured).length

      // In 1000ms at 5fps, we expect 5-6 captures
      // First capture happens immediately, then every 200ms
      expect(captureCount).toBeGreaterThanOrEqual(5)
      expect(captureCount).toBeLessThanOrEqual(6)
    })

    it('should capture less frequently when markers intermittently visible', () => {
      // Markers visible every other "frame window"
      const frames: DetectionFrame[] = []
      for (let t = 0; t < 1000; t += 50) {
        // Markers visible for 50ms, then not visible for 50ms
        const visible = Math.floor(t / 50) % 2 === 0
        frames.push({ time: BASE_TIME + t, markersDetected: visible })
      }

      const results = simulateDetectionLoop(frames, 200)
      const captureCount = results.filter((r) => r.captured).length

      // With intermittent visibility, we get fewer captures
      // But we still capture when possible
      expect(captureCount).toBeGreaterThanOrEqual(2)
      expect(captureCount).toBeLessThanOrEqual(5)
    })
  })
})

// Export for potential reuse in integration tests
export { TrainingCaptureRateLimiter }
