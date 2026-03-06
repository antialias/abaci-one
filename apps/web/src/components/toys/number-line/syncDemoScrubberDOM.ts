/**
 * Sync demo scrubber DOM elements with the current demo state.
 *
 * Called once per draw frame. Updates the scrubber track, fill, thumb, gap,
 * play/pause button, time display, segment ticks, and segment label
 * via direct DOM manipulation (bypasses React for 60fps).
 *
 * Extracted from NumberLine.tsx draw().
 */

import type { DemoNarrationConfig } from './constants/demos/useConstantDemoNarration'
import { NARRATION_CONFIGS } from './constants/demos/narrationConfigs'
import { convergenceGapAtProgress } from './constants/demos/goldenRatioDemo'

// Logarithmic scrubber mapping (mirrors NumberLine module-level functions)
let scrubberLogBase = 7
let scrubberLogDenom = Math.log(Math.max(1.01, scrubberLogBase))

export function progressToScrubber(p: number): number {
  if (scrubberLogBase <= 1.01) return p
  return (scrubberLogBase ** p - 1) / (scrubberLogBase - 1)
}

export function scrubberToProgress(s: number): number {
  if (scrubberLogBase <= 1.01) return s
  return Math.log(1 + s * (scrubberLogBase - 1)) / scrubberLogDenom
}

export function getScrubberLogBase(): number {
  return scrubberLogBase
}

export function setScrubberLogBase(base: number): void {
  scrubberLogBase = Math.max(1, base)
  scrubberLogDenom = Math.log(Math.max(1.01, scrubberLogBase))
}

export interface DemoScrubberRefs {
  scrubberTrackRef: React.RefObject<HTMLDivElement | null>
  scrubberFillRef: React.RefObject<HTMLDivElement | null>
  scrubberThumbRef: React.RefObject<HTMLDivElement | null>
  scrubberGapRef: React.RefObject<HTMLDivElement | null>
  playPauseBtnRef: React.RefObject<HTMLButtonElement | null>
  timeDisplayRef: React.RefObject<HTMLDivElement | null>
  segmentTicksRef: React.RefObject<HTMLDivElement | null>
  segmentLabelRef: React.RefObject<HTMLDivElement | null>
  lastTickConstantIdRef: React.MutableRefObject<string | null>
  isDraggingScrubberRef: React.MutableRefObject<boolean>
  scrubberHoverProgressRef: React.MutableRefObject<number | null>
}

export interface DemoScrubberState {
  phase: string
  constantId: string | null
  revealProgress: number
  opacity: number
}

export function syncDemoScrubberDOM(
  refs: DemoScrubberRefs,
  ds: DemoScrubberState,
  isNarrating: boolean,
  resolvedTheme: string
): void {
  const isActive = ds.phase !== 'idle'
  const scrubberPct = progressToScrubber(ds.revealProgress) * 100

  // Track
  if (refs.scrubberTrackRef.current) {
    refs.scrubberTrackRef.current.style.opacity = isActive ? String(ds.opacity) : '0'
    refs.scrubberTrackRef.current.style.pointerEvents =
      isActive && ds.opacity > 0.1 ? 'auto' : 'none'
    refs.scrubberTrackRef.current.setAttribute(
      'aria-valuenow',
      String(Math.round(ds.revealProgress * 100))
    )
    refs.scrubberTrackRef.current.setAttribute(
      'aria-valuetext',
      `${Math.round(ds.revealProgress * 100)}% convergence progress`
    )
  }

  // Fill
  if (refs.scrubberFillRef.current) {
    refs.scrubberFillRef.current.style.width = `${scrubberPct}%`
  }

  // Thumb
  if (refs.scrubberThumbRef.current) {
    refs.scrubberThumbRef.current.style.left = `${scrubberPct}%`
  }

  // Convergence gap indicator (phi only)
  if (refs.scrubberGapRef.current) {
    if (ds.constantId === 'phi') {
      const gap = convergenceGapAtProgress(ds.revealProgress)
      const maxWidth = 60
      refs.scrubberGapRef.current.style.width = `${gap * maxWidth}px`
      refs.scrubberGapRef.current.style.left = `calc(${scrubberPct}% - ${(gap * maxWidth) / 2}px)`
      const r = Math.round(220 * gap + 34 * (1 - gap))
      const g = Math.round(80 * gap + 197 * (1 - gap))
      const b = Math.round(40 * gap + 94 * (1 - gap))
      refs.scrubberGapRef.current.style.backgroundColor = `rgb(${r}, ${g}, ${b})`
      refs.scrubberGapRef.current.style.opacity = isActive && ds.opacity > 0.1 ? '1' : '0'
    } else {
      refs.scrubberGapRef.current.style.opacity = '0'
    }
  }

  // Play/pause button
  if (refs.playPauseBtnRef.current) {
    refs.playPauseBtnRef.current.style.opacity = isActive ? String(ds.opacity) : '0'
    refs.playPauseBtnRef.current.style.pointerEvents =
      isActive && ds.opacity > 0.1 ? 'auto' : 'none'
    const svgPath = refs.playPauseBtnRef.current.querySelector('path')
    if (svgPath) {
      const isFinished = ds.revealProgress >= 1 && !isNarrating
      svgPath.setAttribute(
        'd',
        isFinished
          ? 'M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z'
          : isNarrating
            ? 'M6 4h4v16H6zm8 0h4v16h-4z'
            : 'M8 5v14l11-7z'
      )
    }
  }

  // Time display
  if (refs.timeDisplayRef.current) {
    refs.timeDisplayRef.current.style.opacity = isActive ? String(ds.opacity) : '0'
    const cfg: DemoNarrationConfig | undefined = ds.constantId
      ? NARRATION_CONFIGS[ds.constantId]
      : undefined
    if (cfg && cfg.segments.length > 0) {
      let elapsedMs = 0
      let totalMs = 0
      for (const seg of cfg.segments) {
        const segSpan = seg.endProgress - seg.startProgress
        totalMs += seg.animationDurationMs
        if (ds.revealProgress >= seg.endProgress) {
          elapsedMs += seg.animationDurationMs
        } else if (ds.revealProgress > seg.startProgress) {
          const frac = segSpan > 0 ? (ds.revealProgress - seg.startProgress) / segSpan : 0
          elapsedMs += frac * seg.animationDurationMs
        }
      }
      const fmtTime = (ms: number) => {
        const s = Math.round(ms / 1000)
        const m = Math.floor(s / 60)
        const sec = s % 60
        return `${m}:${String(sec).padStart(2, '0')}`
      }
      refs.timeDisplayRef.current.textContent = `${fmtTime(elapsedMs)} / ${fmtTime(totalMs)}`
    } else {
      refs.timeDisplayRef.current.textContent = ''
    }
  }

  // Segment tick marks (rebuild only when constantId changes)
  if (refs.segmentTicksRef.current) {
    const cid = ds.constantId
    if (cid !== refs.lastTickConstantIdRef.current) {
      refs.lastTickConstantIdRef.current = cid
      const cfg = cid ? NARRATION_CONFIGS[cid] : undefined
      if (cfg && cfg.segments.length > 0) {
        const boundaries = new Set<number>()
        for (const seg of cfg.segments) {
          if (seg.startProgress > 0.001 && seg.startProgress < 0.999)
            boundaries.add(seg.startProgress)
          if (seg.endProgress > 0.001 && seg.endProgress < 0.999) boundaries.add(seg.endProgress)
        }
        const isDark = resolvedTheme === 'dark'
        const tickColor = isDark ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.18)'
        let html = ''
        for (const bp of boundaries) {
          const pct = progressToScrubber(bp) * 100
          html += `<div data-element="segment-tick" style="position:absolute;left:${pct.toFixed(3)}%;top:50%;width:1.5px;height:12px;transform:translateX(-50%) translateY(-50%);background:${tickColor};border-radius:0.75px;pointer-events:none"></div>`
        }
        refs.segmentTicksRef.current.innerHTML = html
      } else {
        refs.segmentTicksRef.current.innerHTML = ''
      }
    }
  }

  // Floating segment label (visible while scrubbing or hovering)
  if (refs.segmentLabelRef.current) {
    const labelProgress = refs.isDraggingScrubberRef.current
      ? ds.revealProgress
      : refs.scrubberHoverProgressRef.current
    if (labelProgress !== null && isActive && ds.constantId) {
      const cfg = NARRATION_CONFIGS[ds.constantId]
      const seg =
        cfg?.segments.find(
          (s) => labelProgress >= s.startProgress && labelProgress < s.endProgress
        ) ?? cfg?.segments[cfg.segments.length - 1]
      if (seg?.scrubberLabel) {
        const midProgress = (seg.startProgress + seg.endProgress) / 2
        const midPct = progressToScrubber(midProgress) * 100
        refs.segmentLabelRef.current.style.opacity = '1'
        refs.segmentLabelRef.current.style.left = `${midPct}%`
        refs.segmentLabelRef.current.textContent = seg.scrubberLabel
      } else {
        refs.segmentLabelRef.current.style.opacity = '0'
      }
    } else {
      refs.segmentLabelRef.current.style.opacity = '0'
    }
  }
}
