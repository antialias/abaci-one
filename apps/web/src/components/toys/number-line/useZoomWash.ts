/**
 * useZoomWash — zoom velocity tracking + background color wash effect.
 *
 * Extracted from NumberLine.tsx. Owns the zoom velocity refs, the exponential
 * moving average display filter, the decay RAF loop, and the direct DOM
 * background color update.
 */

import { useRef, useCallback, useEffect } from 'react'

/** Time constant for the EMA low-pass filter (ms). */
const WASH_TAU = 150

export interface UseZoomWashOptions {
  resolvedTheme: string
  /** Ref to the latest draw() — called from the decay loop. */
  drawRef: React.MutableRefObject<() => void>
}

export interface UseZoomWashReturn {
  /** Current display-filtered velocity (read by renderNumberLine). */
  displayVelocityRef: React.MutableRefObject<number>
  /** Current display-filtered hue (read by renderNumberLine). */
  displayHueRef: React.MutableRefObject<number>
  /** Focal point as fraction of canvas width 0-1 (read by renderNumberLine). */
  zoomFocalXRef: React.MutableRefObject<number>
  /** Ref to the decay loop RAF handle (cancel on unmount). */
  decayRafRef: React.MutableRefObject<number>
  /** Ref to the wrapper div — attach to the outer wrapper element. */
  wrapperRef: React.MutableRefObject<HTMLDivElement | null>
  /** Ref to the page container — used for background wash + unmount cleanup. */
  pageRef: React.MutableRefObject<HTMLElement | null>
  /** Feed a zoom velocity sample (called from touch/wheel handler). */
  handleZoomVelocity: (velocity: number, focalX: number) => void
  /** Tick the display filter (call once per draw frame). */
  updateDisplayValues: () => void
}

export function useZoomWash({ resolvedTheme, drawRef }: UseZoomWashOptions): UseZoomWashReturn {
  // Raw values track instantaneous state; display values are slew-rate-limited
  const zoomVelocityRef = useRef(0)
  const zoomHueRef = useRef(0)
  const displayVelocityRef = useRef(0)
  const displayHueRef = useRef(0)
  const lastDisplayTimeRef = useRef(0)
  const zoomFocalXRef = useRef(0.5)
  const decayRafRef = useRef<number>(0)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const pageRef = useRef<HTMLElement | null>(null)

  // Find the page container on mount
  useEffect(() => {
    const wrapper = wrapperRef.current
    if (!wrapper) return
    pageRef.current = wrapper.closest('[data-component="number-line-page"]') as HTMLElement | null
  }, [])

  // EMA low-pass filter for display values
  const updateDisplayValues = useCallback(() => {
    const now = performance.now()
    const dt = Math.min(now - (lastDisplayTimeRef.current || now), 50)
    lastDisplayTimeRef.current = now
    if (dt <= 0) return

    const alpha = 1 - Math.exp(-dt / WASH_TAU)
    displayVelocityRef.current += (zoomVelocityRef.current - displayVelocityRef.current) * alpha
    displayHueRef.current += (zoomHueRef.current - displayHueRef.current) * alpha
  }, [])

  // Direct DOM style update (bypasses React for 60fps)
  const updateWrapperBg = useCallback(
    (velocity: number, hue: number) => {
      const page = pageRef.current
      if (!page) return
      if (Math.abs(velocity) < 0.001) {
        page.style.backgroundColor = ''
        return
      }
      const isDark = resolvedTheme === 'dark'
      const baseR = isDark ? 17 : 249
      const baseG = isDark ? 24 : 250
      const baseB = isDark ? 39 : 251
      const edgeIntensity = Math.min(Math.abs(velocity) * 1.5, 0.18)
      const lum = isDark ? 30 : 70
      const sat = 0.8
      const l = lum / 100
      const a = sat * Math.min(l, 1 - l)
      const f = (n: number) => {
        const k = (n + hue / 30) % 12
        return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))
      }
      const wR = f(0) * 255
      const wG = f(8) * 255
      const wB = f(4) * 255
      const r = Math.round(baseR * (1 - edgeIntensity) + wR * edgeIntensity)
      const g = Math.round(baseG * (1 - edgeIntensity) + wG * edgeIntensity)
      const b = Math.round(baseB * (1 - edgeIntensity) + wB * edgeIntensity)
      page.style.backgroundColor = `rgb(${r}, ${g}, ${b})`
    },
    [resolvedTheme]
  )

  // Decay loop — keeps redrawing until the wash fades out
  const startDecay = useCallback(() => {
    if (decayRafRef.current) return
    const tick = () => {
      zoomVelocityRef.current *= 0.88

      if (Math.abs(zoomVelocityRef.current) > 0.01) {
        const targetHue = zoomVelocityRef.current > 0 ? 220 : 25
        zoomHueRef.current += (targetHue - zoomHueRef.current) * 0.08
      }

      updateDisplayValues()
      updateWrapperBg(displayVelocityRef.current, displayHueRef.current)

      if (
        Math.abs(zoomVelocityRef.current) < 0.001 &&
        Math.abs(displayVelocityRef.current) < 0.001
      ) {
        zoomVelocityRef.current = 0
        displayVelocityRef.current = 0
        decayRafRef.current = 0
        drawRef.current()
        return
      }
      drawRef.current()
      decayRafRef.current = requestAnimationFrame(tick)
    }
    decayRafRef.current = requestAnimationFrame(tick)
  }, [drawRef, updateWrapperBg, updateDisplayValues])

  const handleZoomVelocity = useCallback(
    (velocity: number, focalX: number) => {
      zoomVelocityRef.current = zoomVelocityRef.current * 0.6 + velocity * 8
      zoomFocalXRef.current += (focalX - zoomFocalXRef.current) * 0.3
      const targetHue = zoomVelocityRef.current > 0 ? 220 : 25
      zoomHueRef.current += (targetHue - zoomHueRef.current) * 0.15
      startDecay()
    },
    [startDecay]
  )

  return {
    displayVelocityRef,
    displayHueRef,
    zoomFocalXRef,
    decayRafRef,
    wrapperRef,
    pageRef,
    handleZoomVelocity,
    updateDisplayValues,
  }
}
