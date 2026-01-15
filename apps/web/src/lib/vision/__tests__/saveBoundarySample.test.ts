/**
 * @vitest-environment node
 *
 * Tests for saveBoundarySample utility
 *
 * Tests corner normalization, data URL stripping, API calls, and BroadcastChannel notifications.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { QuadCorners } from '@/types/vision'

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

// Track all BroadcastChannel instances created
const broadcastChannelInstances: MockBroadcastChannel[] = []

class MockBroadcastChannel {
  name: string
  postMessage = vi.fn()
  close = vi.fn()
  addEventListener = vi.fn()
  removeEventListener = vi.fn()

  constructor(name: string) {
    this.name = name
    broadcastChannelInstances.push(this)
  }
}
global.BroadcastChannel = MockBroadcastChannel as unknown as typeof BroadcastChannel

import {
  normalizeCorners,
  stripDataUrlPrefix,
  saveBoundarySample,
  BOUNDARY_SAMPLE_CHANNEL,
} from '../saveBoundarySample'

describe('saveBoundarySample', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    broadcastChannelInstances.length = 0 // Clear tracked instances
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('normalizeCorners', () => {
    it('should normalize pixel coordinates to 0-1 range', () => {
      const corners: QuadCorners = {
        topLeft: { x: 100, y: 50 },
        topRight: { x: 900, y: 50 },
        bottomLeft: { x: 100, y: 450 },
        bottomRight: { x: 900, y: 450 },
      }

      const normalized = normalizeCorners(corners, 1000, 500)

      expect(normalized.topLeft).toEqual({ x: 0.1, y: 0.1 })
      expect(normalized.topRight).toEqual({ x: 0.9, y: 0.1 })
      expect(normalized.bottomLeft).toEqual({ x: 0.1, y: 0.9 })
      expect(normalized.bottomRight).toEqual({ x: 0.9, y: 0.9 })
    })

    it('should handle corners at edges (0 and max)', () => {
      const corners: QuadCorners = {
        topLeft: { x: 0, y: 0 },
        topRight: { x: 1920, y: 0 },
        bottomLeft: { x: 0, y: 1080 },
        bottomRight: { x: 1920, y: 1080 },
      }

      const normalized = normalizeCorners(corners, 1920, 1080)

      expect(normalized.topLeft).toEqual({ x: 0, y: 0 })
      expect(normalized.topRight).toEqual({ x: 1, y: 0 })
      expect(normalized.bottomLeft).toEqual({ x: 0, y: 1 })
      expect(normalized.bottomRight).toEqual({ x: 1, y: 1 })
    })

    it('should handle non-rectangular corners (perspective distortion)', () => {
      const corners: QuadCorners = {
        topLeft: { x: 150, y: 100 },
        topRight: { x: 850, y: 120 },
        bottomLeft: { x: 100, y: 880 },
        bottomRight: { x: 900, y: 860 },
      }

      const normalized = normalizeCorners(corners, 1000, 1000)

      expect(normalized.topLeft.x).toBeCloseTo(0.15)
      expect(normalized.topLeft.y).toBeCloseTo(0.1)
      expect(normalized.topRight.x).toBeCloseTo(0.85)
      expect(normalized.topRight.y).toBeCloseTo(0.12)
      expect(normalized.bottomLeft.x).toBeCloseTo(0.1)
      expect(normalized.bottomLeft.y).toBeCloseTo(0.88)
      expect(normalized.bottomRight.x).toBeCloseTo(0.9)
      expect(normalized.bottomRight.y).toBeCloseTo(0.86)
    })
  })

  describe('stripDataUrlPrefix', () => {
    it('should strip PNG data URL prefix', () => {
      const dataUrl =
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk'
      const result = stripDataUrlPrefix(dataUrl)
      expect(result).toBe('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk')
    })

    it('should strip JPEG data URL prefix', () => {
      const dataUrl = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD'
      const result = stripDataUrlPrefix(dataUrl)
      expect(result).toBe('/9j/4AAQSkZJRgABAQAAAQABAAD')
    })

    it('should return string unchanged if no data URL prefix', () => {
      const base64Only = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk'
      const result = stripDataUrlPrefix(base64Only)
      expect(result).toBe(base64Only)
    })

    it('should handle empty string', () => {
      expect(stripDataUrlPrefix('')).toBe('')
    })

    it('should handle malformed data URL (no comma)', () => {
      const malformed = 'data:image/png;base64'
      expect(stripDataUrlPrefix(malformed)).toBe(malformed)
    })
  })

  describe('saveBoundarySample', () => {
    const validCorners: QuadCorners = {
      topLeft: { x: 100, y: 100 },
      topRight: { x: 900, y: 100 },
      bottomLeft: { x: 100, y: 900 },
      bottomRight: { x: 900, y: 900 },
    }

    it('should call API with normalized corners and stripped image data', async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, savedTo: 'test_123' }),
      })

      const result = await saveBoundarySample({
        imageData: 'data:image/png;base64,iVBORw0KGgo',
        corners: validCorners,
        frameWidth: 1000,
        frameHeight: 1000,
        deviceId: 'test-device',
      })

      expect(result.success).toBe(true)
      expect(result.savedTo).toBe('test_123')

      // Verify API was called correctly
      expect(mockFetch).toHaveBeenCalledTimes(1)
      const [url, options] = mockFetch.mock.calls[0]
      expect(url).toBe('/api/vision-training/boundary-samples')
      expect(options.method).toBe('POST')

      const body = JSON.parse(options.body)
      // Image data should have prefix stripped
      expect(body.imageData).toBe('iVBORw0KGgo')
      // Corners should be normalized
      expect(body.corners.topLeft).toEqual({ x: 0.1, y: 0.1 })
      expect(body.corners.bottomRight).toEqual({ x: 0.9, y: 0.9 })
      expect(body.deviceId).toBe('test-device')
    })

    it('should broadcast via BroadcastChannel on success', async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, savedTo: 'broadcast_test' }),
      })

      await saveBoundarySample({
        imageData: 'iVBORw0KGgo',
        corners: validCorners,
        frameWidth: 1000,
        frameHeight: 1000,
        deviceId: 'broadcast-device',
      })

      // Find the BroadcastChannel instance that was created
      expect(broadcastChannelInstances.length).toBe(1)
      const channel = broadcastChannelInstances[0]

      // Verify it was created with correct channel name
      expect(channel.name).toBe(BOUNDARY_SAMPLE_CHANNEL)

      // Verify postMessage was called with expected data
      expect(channel.postMessage).toHaveBeenCalledTimes(1)
      const message = channel.postMessage.mock.calls[0][0]
      expect(message.type).toBe('sample-saved')
      expect(message.savedTo).toBe('broadcast_test')
      expect(message.deviceId).toBe('broadcast-device')
      expect(message.timestamp).toBeDefined()

      // Verify channel was closed
      expect(channel.close).toHaveBeenCalledTimes(1)
    })

    it('should not broadcast on API failure', async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ success: false, error: 'API error' }),
      })

      await saveBoundarySample({
        imageData: 'iVBORw0KGgo',
        corners: validCorners,
        frameWidth: 1000,
        frameHeight: 1000,
      })

      // No BroadcastChannel should be created on failure
      expect(broadcastChannelInstances.length).toBe(0)
    })

    it('should return error if corners are out of bounds after normalization', async () => {
      const outOfBoundsCorners: QuadCorners = {
        topLeft: { x: -100, y: 100 }, // Negative x
        topRight: { x: 900, y: 100 },
        bottomLeft: { x: 100, y: 900 },
        bottomRight: { x: 900, y: 900 },
      }

      const result = await saveBoundarySample({
        imageData: 'iVBORw0KGgo',
        corners: outOfBoundsCorners,
        frameWidth: 1000,
        frameHeight: 1000,
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('out of bounds')
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('should return error if corners exceed frame dimensions', async () => {
      const oversizedCorners: QuadCorners = {
        topLeft: { x: 100, y: 100 },
        topRight: { x: 1100, y: 100 }, // x > frameWidth
        bottomLeft: { x: 100, y: 900 },
        bottomRight: { x: 900, y: 900 },
      }

      const result = await saveBoundarySample({
        imageData: 'iVBORw0KGgo',
        corners: oversizedCorners,
        frameWidth: 1000,
        frameHeight: 1000,
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('out of bounds')
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('should return error on API failure response', async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ success: false, error: 'Storage full' }),
      })

      const result = await saveBoundarySample({
        imageData: 'iVBORw0KGgo',
        corners: validCorners,
        frameWidth: 1000,
        frameHeight: 1000,
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe('Storage full')
    })

    it('should return error on network failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const result = await saveBoundarySample({
        imageData: 'iVBORw0KGgo',
        corners: validCorners,
        frameWidth: 1000,
        frameHeight: 1000,
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe('Network error')
    })

    it('should use default deviceId if not provided', async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, savedTo: 'default_test' }),
      })

      await saveBoundarySample({
        imageData: 'iVBORw0KGgo',
        corners: validCorners,
        frameWidth: 1000,
        frameHeight: 1000,
        // deviceId not provided
      })

      const body = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(body.deviceId).toBeUndefined() // Let API use its default
    })
  })

  describe('BOUNDARY_SAMPLE_CHANNEL', () => {
    it('should be exported as a constant', () => {
      expect(BOUNDARY_SAMPLE_CHANNEL).toBe('boundary-sample-saved')
    })
  })
})
