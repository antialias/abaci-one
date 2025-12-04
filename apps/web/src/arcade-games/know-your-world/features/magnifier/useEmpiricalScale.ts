/**
 * Empirical Scale Measurement for 1:1 Touch Tracking
 *
 * Instead of calculating the scale through all the transform layers,
 * this hook empirically measures the actual pixel-to-SVG ratio by
 * placing probe elements and comparing their screen positions.
 *
 * This approach is robust to any changes in the rendering pipeline
 * because it measures what's actually happening on screen.
 */

'use client'

import { useCallback, useRef } from 'react'

// ============================================================================
// Types
// ============================================================================

export interface EmpiricalScaleResult {
  /** Pixels per SVG unit (measured empirically) */
  pixelsPerSvgUnit: number
  /** Whether measurement was successful */
  isValid: boolean
  /** Debug info about the measurement */
  debug?: {
    probe1Screen: { x: number; y: number }
    probe2Screen: { x: number; y: number }
    pixelDistance: number
    svgDistance: number
  }
}

export interface UseEmpiricalScaleReturn {
  /** Ref for first probe element (circle at known SVG coords) */
  probe1Ref: React.RefObject<SVGCircleElement | null>
  /** Ref for second probe element (circle at known SVG coords) */
  probe2Ref: React.RefObject<SVGCircleElement | null>
  /** Measure the current scale empirically */
  measureScale: () => EmpiricalScaleResult
  /** The fixed SVG distance between probes (for reference) */
  probeSvgDistance: number
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Fixed distance between probes in SVG units.
 * This should be large enough to get accurate measurements
 * but small enough to fit within the magnifier view at all zoom levels.
 */
const PROBE_SVG_DISTANCE = 100

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Hook for empirically measuring the pixel-to-SVG scale in the magnifier.
 *
 * Usage:
 * 1. Render two probe circles inside the magnifier SVG using probe1Ref and probe2Ref
 * 2. Position them at (cursorSvgX - 50, cursorSvgY) and (cursorSvgX + 50, cursorSvgY)
 * 3. Call measureScale() during touch move to get the actual pixels-per-SVG-unit
 * 4. Use: touchMultiplier = 1 / pixelsPerSvgUnit
 *
 * @example
 * ```tsx
 * const { probe1Ref, probe2Ref, measureScale, probeSvgDistance } = useEmpiricalScale()
 *
 * // In magnifier SVG, at cursor position:
 * <circle ref={probe1Ref} cx={cursorSvgX - probeSvgDistance/2} cy={cursorSvgY} r={0.1} opacity={0} />
 * <circle ref={probe2Ref} cx={cursorSvgX + probeSvgDistance/2} cy={cursorSvgY} r={0.1} opacity={0} />
 *
 * // In touch handler:
 * const { pixelsPerSvgUnit, isValid } = measureScale()
 * if (isValid) {
 *   const touchMultiplier = 1 / pixelsPerSvgUnit
 *   // Apply to cursor movement...
 * }
 * ```
 */
export function useEmpiricalScale(): UseEmpiricalScaleReturn {
  const probe1Ref = useRef<SVGCircleElement | null>(null)
  const probe2Ref = useRef<SVGCircleElement | null>(null)

  const measureScale = useCallback((): EmpiricalScaleResult => {
    const probe1 = probe1Ref.current
    const probe2 = probe2Ref.current

    if (!probe1 || !probe2) {
      return { pixelsPerSvgUnit: 1, isValid: false }
    }

    // Get screen positions of the probes
    const rect1 = probe1.getBoundingClientRect()
    const rect2 = probe2.getBoundingClientRect()

    // Use center of each probe
    const screen1 = {
      x: rect1.left + rect1.width / 2,
      y: rect1.top + rect1.height / 2,
    }
    const screen2 = {
      x: rect2.left + rect2.width / 2,
      y: rect2.top + rect2.height / 2,
    }

    // Calculate pixel distance between probes
    const dx = screen2.x - screen1.x
    const dy = screen2.y - screen1.y
    const pixelDistance = Math.sqrt(dx * dx + dy * dy)

    // Guard against zero/invalid measurements
    if (pixelDistance < 1 || !Number.isFinite(pixelDistance)) {
      return { pixelsPerSvgUnit: 1, isValid: false }
    }

    // Calculate pixels per SVG unit
    const pixelsPerSvgUnit = pixelDistance / PROBE_SVG_DISTANCE

    return {
      pixelsPerSvgUnit,
      isValid: true,
      debug: {
        probe1Screen: screen1,
        probe2Screen: screen2,
        pixelDistance,
        svgDistance: PROBE_SVG_DISTANCE,
      },
    }
  }, [])

  return {
    probe1Ref,
    probe2Ref,
    measureScale,
    probeSvgDistance: PROBE_SVG_DISTANCE,
  }
}
