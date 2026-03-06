import { useEffect, useState, useRef } from 'react'
import type { MutableRefObject } from 'react'

// Playback speed steps (YouTube-style)
const SPEED_STEPS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] as const

interface DemoState {
  phase: string
  constantId: string | null
  revealProgress: number
}

interface Narration {
  isNarrating: MutableRefObject<boolean>
  playbackSpeedRef: MutableRefObject<number>
  stop: () => void
  resume: (constantId: string) => void
}

interface UseDemoKeyboardShortcutsOptions {
  demoStateRef: MutableRefObject<DemoState>
  narration: Narration
  setRevealProgress: (p: number) => void
  handlePlayPauseClick: () => void
  audioManager: { configure: (opts: { playbackRate: number }) => void }
  refineMode: boolean
  refineTaskActive: boolean
  setRefineMode: (v: boolean | ((prev: boolean) => boolean)) => void
  setRefineRange: (v: { start: number; end: number } | null) => void
  refineStartRef: MutableRefObject<number | null>
  isVisualDebugEnabled: boolean
  isDevelopment: boolean
}

export function useDemoKeyboardShortcuts({
  demoStateRef,
  narration,
  setRevealProgress,
  handlePlayPauseClick,
  audioManager,
  refineMode,
  refineTaskActive,
  setRefineMode,
  setRefineRange,
  refineStartRef,
  isVisualDebugEnabled,
  isDevelopment,
}: UseDemoKeyboardShortcutsOptions) {
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [displaySpeed, setDisplaySpeed] = useState(1)
  const speedFadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [showSpeedBadge, setShowSpeedBadge] = useState(false)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Escape: close shortcuts, or exit refine mode
      if (e.key === 'Escape') {
        if (refineMode) {
          if (refineTaskActive) return
          setRefineMode(false)
          setRefineRange(null)
          refineStartRef.current = null
          return
        }
        setShowShortcuts(false)
        return
      }

      const ds = demoStateRef.current
      if (ds.phase === 'idle') return
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      // 'r' toggles refine mode (dev-only)
      if ((e.key === 'r' || e.key === 'R') && isDevelopment && isVisualDebugEnabled) {
        if (refineTaskActive) return
        setRefineMode((prev: boolean) => {
          if (!prev) {
            narration.stop()
            return true
          } else {
            setRefineRange(null)
            refineStartRef.current = null
            return false
          }
        })
        return
      }

      // ? toggles shortcuts overlay
      if (e.key === '?') {
        setShowShortcuts((prev) => !prev)
        return
      }

      // < / > adjust playback speed
      if (e.key === '<' || e.key === '>') {
        e.preventDefault()
        const current = narration.playbackSpeedRef.current
        const idx = SPEED_STEPS.findIndex((s) => s >= current)
        const newIdx =
          e.key === '>'
            ? Math.min(SPEED_STEPS.length - 1, (idx === -1 ? SPEED_STEPS.length - 1 : idx) + 1)
            : Math.max(0, (idx === -1 ? 0 : idx) - 1)
        const newSpeed = SPEED_STEPS[newIdx]
        narration.playbackSpeedRef.current = newSpeed
        audioManager.configure({ playbackRate: newSpeed })
        setDisplaySpeed(newSpeed)
        setShowSpeedBadge(true)
        if (speedFadeTimerRef.current) clearTimeout(speedFadeTimerRef.current)
        speedFadeTimerRef.current = setTimeout(() => setShowSpeedBadge(false), 1500)
        return
      }

      setShowShortcuts(false)

      if (e.key === ' ') {
        e.preventDefault()
        handlePlayPauseClick()
        return
      }

      let delta = 0
      switch (e.key) {
        case 'ArrowRight':
          delta = e.shiftKey ? 0.02 : 0.05
          break
        case 'ArrowLeft':
          delta = e.shiftKey ? -0.02 : -0.05
          break
        case 'l':
        case 'L':
          delta = 0.1
          break
        case 'j':
        case 'J':
          delta = -0.1
          break
        case 'Home':
          delta = -Infinity
          break
        case 'End':
          delta = Infinity
          break
        default:
          return
      }

      e.preventDefault()
      const wasPlaying = narration.isNarrating.current
      narration.stop()
      const target =
        delta === -Infinity
          ? 0
          : delta === Infinity
            ? 1
            : Math.max(0, Math.min(1, ds.revealProgress + delta))
      setRevealProgress(target)
      if (wasPlaying && ds.constantId && target < 1) {
        requestAnimationFrame(() => narration.resume(ds.constantId!))
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [
    demoStateRef,
    handlePlayPauseClick,
    narration,
    setRevealProgress,
    audioManager,
    refineMode,
    refineTaskActive,
    setRefineMode,
    setRefineRange,
    refineStartRef,
    isVisualDebugEnabled,
    isDevelopment,
  ])

  return {
    showShortcuts,
    setShowShortcuts,
    displaySpeed,
    setDisplaySpeed,
    showSpeedBadge,
    setShowSpeedBadge,
    speedFadeTimerRef,
  }
}
