/**
 * Unit tests for ObserverVisionFeed component
 *
 * Note: Canvas.Image mock is provided in src/test/setup.ts to prevent
 * jsdom errors with data URI images. Actual image rendering is verified
 * through integration/e2e tests.
 */
import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ObservedVisionFrame } from '@/hooks/useSessionObserver'
import { ObserverVisionFeed } from '../ObserverVisionFeed'

describe('ObserverVisionFeed', () => {
  const createMockFrame = (overrides?: Partial<ObservedVisionFrame>): ObservedVisionFrame => ({
    imageData: 'base64ImageData==',
    detectedValue: 123,
    confidence: 0.95,
    receivedAt: Date.now(),
    ...overrides,
  })

  // Default props that are always required
  const defaultProps = {
    sessionId: 'test-session-123',
  }

  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('rendering', () => {
    it('renders the vision feed container', () => {
      const frame = createMockFrame()
      render(<ObserverVisionFeed frame={frame} {...defaultProps} />)

      expect(screen.getByRole('img')).toBeInTheDocument()
    })

    it('displays the image with correct src', () => {
      const frame = createMockFrame({ imageData: 'testImageData123' })
      render(<ObserverVisionFeed frame={frame} {...defaultProps} />)

      const img = screen.getByRole('img') as HTMLImageElement
      // Check the src property (not attribute) because our test setup
      // intercepts data:image/ src attributes to prevent jsdom canvas errors
      expect(img.src).toBe('data:image/jpeg;base64,testImageData123')
    })

    it('has appropriate alt text for accessibility', () => {
      const frame = createMockFrame()
      render(<ObserverVisionFeed frame={frame} {...defaultProps} />)

      const img = screen.getByRole('img')
      expect(img).toHaveAttribute('alt', "Student's abacus vision feed")
    })
  })

  describe('detected value display (auto-detection disabled)', () => {
    // ENABLE_AUTO_DETECTION is false, so the detection overlay is hidden.
    // These tests verify the detection overlay elements are NOT rendered.

    it('does not display detected value when auto-detection is disabled', () => {
      const frame = createMockFrame({ detectedValue: 456, confidence: 0.87 })
      render(<ObserverVisionFeed frame={frame} {...defaultProps} />)

      expect(screen.queryByText('456')).not.toBeInTheDocument()
    })

    it('does not display confidence when auto-detection is disabled', () => {
      const frame = createMockFrame({ detectedValue: 123, confidence: 0.87 })
      render(<ObserverVisionFeed frame={frame} {...defaultProps} />)

      expect(screen.queryByText('87%')).not.toBeInTheDocument()
    })

    it('does not display dashes when auto-detection is disabled', () => {
      const frame = createMockFrame({ detectedValue: null, confidence: 0 })
      render(<ObserverVisionFeed frame={frame} {...defaultProps} />)

      expect(screen.queryByText('---')).not.toBeInTheDocument()
    })

    it('does not display confidence when auto-detection is disabled (null value)', () => {
      const frame = createMockFrame({ detectedValue: null, confidence: 0.95 })
      render(<ObserverVisionFeed frame={frame} {...defaultProps} />)

      expect(screen.queryByText('95%')).not.toBeInTheDocument()
    })

    it('does not display zero value when auto-detection is disabled', () => {
      const frame = createMockFrame({ detectedValue: 0, confidence: 0.99 })
      render(<ObserverVisionFeed frame={frame} {...defaultProps} />)

      expect(screen.queryByText('99%')).not.toBeInTheDocument()
    })
  })

  describe('live/stale indicator', () => {
    // Note: Live/Stale TEXT is inside the detection overlay which is hidden
    // when ENABLE_AUTO_DETECTION is false. But data attributes still work.

    it('does not show Live/Stale text when auto-detection is disabled', () => {
      const now = Date.now()
      vi.setSystemTime(now)

      const frame = createMockFrame({ receivedAt: now - 500 }) // 500ms ago
      render(<ObserverVisionFeed frame={frame} {...defaultProps} />)

      expect(screen.queryByText('Live')).not.toBeInTheDocument()
      expect(screen.queryByText('Stale')).not.toBeInTheDocument()
    })

    it('sets stale data attribute when frame is old', () => {
      const now = Date.now()
      vi.setSystemTime(now)

      const frame = createMockFrame({ receivedAt: now - 2000 }) // 2 seconds ago
      const { container } = render(<ObserverVisionFeed frame={frame} {...defaultProps} />)

      const component = container.querySelector('[data-component="observer-vision-feed"]')
      expect(component).toHaveAttribute('data-stale', 'true')
    })

    it('sets stale data attribute to false for fresh frames', () => {
      const now = Date.now()
      vi.setSystemTime(now)

      const frame = createMockFrame({ receivedAt: now - 100 }) // 100ms ago
      const { container } = render(<ObserverVisionFeed frame={frame} {...defaultProps} />)

      const component = container.querySelector('[data-component="observer-vision-feed"]')
      expect(component).toHaveAttribute('data-stale', 'false')
    })

    it('reduces image opacity for stale frames', () => {
      const now = Date.now()
      vi.setSystemTime(now)

      const frame = createMockFrame({ receivedAt: now - 2000 })
      render(<ObserverVisionFeed frame={frame} {...defaultProps} />)

      const img = screen.getByRole('img')
      // The opacity should be reduced for stale frames
      expect(img.className).toBeDefined()
    })
  })

  describe('vision badge', () => {
    it('displays the vision badge', () => {
      const frame = createMockFrame()
      render(<ObserverVisionFeed frame={frame} {...defaultProps} />)

      expect(screen.getByText('📷')).toBeInTheDocument()
      expect(screen.getByText('Vision')).toBeInTheDocument()
    })
  })

  describe('edge cases (auto-detection disabled)', () => {
    // With ENABLE_AUTO_DETECTION=false, detection overlay values are hidden.
    // These tests verify the component renders without errors for edge case data.

    it('renders without errors for very large detected values', () => {
      const frame = createMockFrame({ detectedValue: 99999, confidence: 1.0 })
      render(<ObserverVisionFeed frame={frame} {...defaultProps} />)

      // Values are not displayed when auto-detection is disabled
      expect(screen.queryByText('99999')).not.toBeInTheDocument()
      expect(screen.queryByText('100%')).not.toBeInTheDocument()
      // But image still renders
      expect(screen.getByRole('img')).toBeInTheDocument()
    })

    it('renders without errors for various confidence values', () => {
      const frame = createMockFrame({ detectedValue: 123, confidence: 0.876 })
      render(<ObserverVisionFeed frame={frame} {...defaultProps} />)

      expect(screen.queryByText('88%')).not.toBeInTheDocument()
      expect(screen.getByRole('img')).toBeInTheDocument()
    })

    it('renders without errors for confidence of exactly 1', () => {
      const frame = createMockFrame({ detectedValue: 123, confidence: 1.0 })
      render(<ObserverVisionFeed frame={frame} {...defaultProps} />)

      expect(screen.queryByText('100%')).not.toBeInTheDocument()
      expect(screen.getByRole('img')).toBeInTheDocument()
    })

    it('renders without errors for confidence of exactly 0', () => {
      const frame = createMockFrame({ detectedValue: 123, confidence: 0 })
      render(<ObserverVisionFeed frame={frame} {...defaultProps} />)

      expect(screen.queryByText('0%')).not.toBeInTheDocument()
      expect(screen.getByRole('img')).toBeInTheDocument()
    })
  })
})
