/**
 * Magnifier Zoom Hook
 *
 * Manages zoom state, animation, and threshold-based capping for the magnifier.
 * Handles smooth zoom transitions, pausing at precision mode threshold, and
 * coordinating with pointer lock state.
 */

import { useSpring, useSpringRef } from '@react-spring/web'
import { type RefObject, useEffect, useRef, useState } from 'react'
import { getMagnifierDimensions } from '../utils/magnifierDimensions'
import {
  calculateMaxZoomAtThreshold,
  calculateScreenPixelRatio,
  isAboveThreshold,
} from '../utils/screenPixelRatio'

export interface UseMagnifierZoomOptions {
  /** The container element (for calculating dimensions) */
  containerRef: RefObject<HTMLDivElement>
  /** The SVG element (for calculating dimensions) */
  svgRef: RefObject<SVGSVGElement>
  /** The SVG viewBox string (e.g., "0 0 1000 500") */
  viewBox: string
  /** Precision mode threshold in px/px (e.g., 20) */
  threshold: number
  /** Whether pointer lock is currently active */
  pointerLocked: boolean
  /** Initial zoom level */
  initialZoom?: number
}

export interface UseMagnifierZoomReturn {
  /** Current target zoom level (may be capped) */
  targetZoom: number
  /** Set the target zoom level */
  setTargetZoom: (zoom: number) => void
  /** The animated spring value for zoom (spring object, not a number) */
  zoomSpring: any // Spring value that can be used with animated.div
  /** Get the current animated zoom value */
  getCurrentZoom: () => number
  /** Reference to the uncapped adaptive zoom (for pointer lock transitions) */
  uncappedAdaptiveZoomRef: React.MutableRefObject<number | null>
}

/**
 * Custom hook for managing magnifier zoom state and animation.
 *
 * This hook encapsulates:
 * - Zoom state management (target zoom, uncapped zoom ref)
 * - React Spring animation with configurable easing
 * - Automatic pause/resume at precision mode threshold
 * - Zoom capping when not in pointer lock mode
 * - Recalculation when pointer lock state changes
 *
 * @param options - Configuration options
 * @returns Zoom state and control methods
 */
export function useMagnifierZoom(options: UseMagnifierZoomOptions): UseMagnifierZoomReturn {
  const { containerRef, svgRef, viewBox, threshold, pointerLocked, initialZoom = 10 } = options

  const [targetZoom, setTargetZoom] = useState(initialZoom)
  const uncappedAdaptiveZoomRef = useRef<number | null>(null)

  // Set up React Spring animation for smooth zoom transitions
  const springRef = useSpringRef()
  const [magnifierSpring, magnifierApi] = useSpring(
    () => ({
      ref: springRef,
      zoom: targetZoom,
      config: {
        // Very slow, smooth animation for zoom
        // Lower tension + higher mass = longer, more gradual transitions
        tension: 30,
        friction: 30,
        mass: 4,
      },
    }),
    []
  )

  // Handle pointer lock state changes - recalculate zoom with capping
  useEffect(() => {
    // When pointer lock is released, cap zoom if it exceeds threshold
    if (!pointerLocked && uncappedAdaptiveZoomRef.current !== null) {
      const containerElement = containerRef.current
      const svgElement = svgRef.current

      if (!containerElement || !svgElement) {
        return
      }

      const containerRect = containerElement.getBoundingClientRect()
      const svgRect = svgElement.getBoundingClientRect()
      const { width: magnifierWidth } = getMagnifierDimensions(
        containerRect.width,
        containerRect.height
      )
      const viewBoxParts = viewBox.split(' ').map(Number)
      const viewBoxWidth = viewBoxParts[2]

      if (!viewBoxWidth || Number.isNaN(viewBoxWidth)) {
        return
      }

      const uncappedZoom = uncappedAdaptiveZoomRef.current
      const screenPixelRatio = calculateScreenPixelRatio({
        magnifierWidth,
        viewBoxWidth,
        svgWidth: svgRect.width,
        zoom: uncappedZoom,
      })

      // Cap zoom if it exceeds threshold
      if (isAboveThreshold(screenPixelRatio, threshold)) {
        const maxZoom = calculateMaxZoomAtThreshold(threshold, magnifierWidth, svgRect.width)
        const cappedZoom = Math.min(uncappedZoom, maxZoom)
        setTargetZoom(cappedZoom)
      }
    }

    // When pointer lock is acquired, update target zoom to uncapped value
    if (pointerLocked && uncappedAdaptiveZoomRef.current !== null) {
      setTargetZoom(uncappedAdaptiveZoomRef.current)
    }
  }, [pointerLocked, containerRef, svgRef, viewBox, threshold])

  // Handle pause/resume at threshold
  useEffect(() => {
    const currentZoom = magnifierSpring.zoom.get()
    const zoomIsAnimating = Math.abs(currentZoom - targetZoom) > 0.01

    // Check if CURRENT zoom is at/above threshold (zoom is capped)
    let currentScreenPixelRatio = 0
    const currentIsAtThreshold =
      !pointerLocked &&
      containerRef.current &&
      svgRef.current &&
      (() => {
        const containerRect = containerRef.current.getBoundingClientRect()
        const svgRect = svgRef.current.getBoundingClientRect()
        const { width: magnifierWidth } = getMagnifierDimensions(
          containerRect.width,
          containerRect.height
        )
        const viewBoxParts = viewBox.split(' ').map(Number)
        const viewBoxWidth = viewBoxParts[2]

        if (!viewBoxWidth || Number.isNaN(viewBoxWidth)) return false

        currentScreenPixelRatio = calculateScreenPixelRatio({
          magnifierWidth,
          viewBoxWidth,
          svgWidth: svgRect.width,
          zoom: currentZoom,
        })

        return isAboveThreshold(currentScreenPixelRatio, threshold)
      })()

    // Check if TARGET zoom is at/above threshold
    let targetScreenPixelRatio = 0
    const targetIsAtThreshold =
      !pointerLocked &&
      containerRef.current &&
      svgRef.current &&
      (() => {
        const containerRect = containerRef.current.getBoundingClientRect()
        const svgRect = svgRef.current.getBoundingClientRect()
        const { width: magnifierWidth } = getMagnifierDimensions(
          containerRect.width,
          containerRect.height
        )
        const viewBoxParts = viewBox.split(' ').map(Number)
        const viewBoxWidth = viewBoxParts[2]

        if (!viewBoxWidth || Number.isNaN(viewBoxWidth)) return false

        targetScreenPixelRatio = calculateScreenPixelRatio({
          magnifierWidth,
          viewBoxWidth,
          svgWidth: svgRect.width,
          zoom: targetZoom,
        })

        return isAboveThreshold(targetScreenPixelRatio, threshold)
      })()

    // Pause if:
    // - Currently at threshold AND
    // - Animating toward higher zoom AND
    // - Target is also at threshold
    const shouldPause = currentIsAtThreshold && zoomIsAnimating && targetIsAtThreshold

    if (shouldPause) {
      magnifierApi.pause()
    } else {
      // Resume/update animation
      // CRITICAL: Always resume first in case spring was paused
      magnifierApi.resume()
      magnifierApi.start({ zoom: targetZoom })
    }
  }, [
    targetZoom, // Effect runs when target zoom changes
    pointerLocked, // Effect runs when pointer lock state changes
    viewBox,
    threshold,
    containerRef,
    svgRef,
    magnifierApi,
    // NOTE: Do NOT include magnifierSpring.zoom here!
    // Spring values don't trigger React effects correctly.
    // We read spring.zoom.get() inside the effect, but don't depend on it.
  ])

  return {
    targetZoom,
    setTargetZoom,
    zoomSpring: magnifierSpring.zoom, // Return the spring object, not .get()
    getCurrentZoom: () => magnifierSpring.zoom.get(),
    uncappedAdaptiveZoomRef,
  }
}
