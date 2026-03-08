import { useCallback, useRef, useState, useMemo } from 'react'
import type { MutableRefObject } from 'react'
import { NARRATION_CONFIGS } from './constants/demos/narrationConfigs'
import { progressToScrubber, scrubberToProgress } from './syncDemoScrubberDOM'
import { DemoRefinePanel } from './DemoRefinePanel'

interface DemoState {
  phase: string
  constantId: string | null
  revealProgress: number
}

interface Narration {
  isNarrating: MutableRefObject<boolean>
  stop: () => void
  resume: (constantId: string) => void
  reset: () => void
}

interface DemoScrubberControlsProps {
  demoStateRef: MutableRefObject<DemoState>
  narration: Narration
  setRevealProgress: (p: number) => void
  startDemo: (id: string) => void
  resolvedTheme: string
  restoredFromUrl: boolean
  setRestoredFromUrl: (v: boolean) => void
  isDevelopment: boolean
  onCaptureScreenshot: () => string | null
  // Forwarded refs for syncDemoScrubberDOM
  scrubberTrackRef: MutableRefObject<HTMLDivElement | null>
  scrubberFillRef: MutableRefObject<HTMLDivElement | null>
  scrubberThumbRef: MutableRefObject<HTMLDivElement | null>
  scrubberGapRef: MutableRefObject<HTMLDivElement | null>
  playPauseBtnRef: MutableRefObject<HTMLButtonElement | null>
  timeDisplayRef: MutableRefObject<HTMLDivElement | null>
  segmentTicksRef: MutableRefObject<HTMLDivElement | null>
  segmentLabelRef: MutableRefObject<HTMLDivElement | null>
  isDraggingScrubberRef: MutableRefObject<boolean>
  scrubberHoverProgressRef: MutableRefObject<number | null>
  // Refine mode state (owned by parent, shared with keyboard hook)
  refineMode: boolean
  refineRange: { start: number; end: number } | null
  setRefineRange: (v: { start: number; end: number } | null) => void
  refineStartRef: MutableRefObject<number | null>
  refineTaskActive: boolean
  setRefineTaskActive: (v: boolean) => void
  setRefineMode: (v: boolean) => void
  // Speed display (owned by keyboard hook, passed through)
  displaySpeed: number
  setDisplaySpeed: (v: number) => void
  showSpeedBadge: boolean
  setShowSpeedBadge: (v: boolean) => void
  // Play/pause handler (shared with keyboard hook)
  handlePlayPauseClick: () => void
}

export function DemoScrubberControls({
  demoStateRef,
  narration,
  setRevealProgress,
  resolvedTheme,
  restoredFromUrl,
  setRestoredFromUrl,
  isDevelopment,
  onCaptureScreenshot,
  scrubberTrackRef,
  scrubberFillRef,
  scrubberThumbRef,
  scrubberGapRef,
  playPauseBtnRef,
  timeDisplayRef,
  segmentTicksRef,
  segmentLabelRef,
  isDraggingScrubberRef,
  scrubberHoverProgressRef,
  refineMode,
  refineRange,
  setRefineRange,
  refineStartRef,
  refineTaskActive,
  setRefineTaskActive,
  setRefineMode,
  displaySpeed,
  showSpeedBadge,
  handlePlayPauseClick,
}: DemoScrubberControlsProps) {
  const scrubberThumbVisualRef = useRef<HTMLDivElement>(null)
  const refineTrackRef = useRef<HTMLDivElement>(null)

  // --- Share button ---
  const [shareFeedback, setShareFeedback] = useState(false)
  const [shareAtCurrentTime, setShareAtCurrentTime] = useState(false)

  const handleShare = useCallback(async () => {
    const ds = demoStateRef.current
    const url = new URL(window.location.href)
    if (ds.constantId && ds.phase !== 'idle') {
      url.searchParams.set('demo', ds.constantId)
      if (shareAtCurrentTime && ds.revealProgress > 0) {
        url.searchParams.set('p', ds.revealProgress.toFixed(3))
      } else {
        url.searchParams.delete('p')
      }
    }
    const shareUrl = url.href

    if (navigator.share) {
      try {
        await navigator.share({ url: shareUrl })
      } catch {
        /* user cancelled */
      }
    } else {
      await navigator.clipboard.writeText(shareUrl)
      setShareFeedback(true)
      setTimeout(() => setShareFeedback(false), 2000)
    }
  }, [demoStateRef, shareAtCurrentTime])

  // --- Scrubber handlers ---
  const snapToSegmentBoundary = useCallback(
    (rawProgress: number, clientX: number): number => {
      const track = scrubberTrackRef.current
      const cid = demoStateRef.current.constantId
      if (!track || !cid) return rawProgress
      const cfg = NARRATION_CONFIGS[cid]
      if (!cfg) return rawProgress

      const rect = track.getBoundingClientRect()
      const boundaries: number[] = []
      for (const seg of cfg.segments) {
        boundaries.push(seg.startProgress, seg.endProgress)
      }
      const unique = [...new Set(boundaries)]

      let bestProgress = rawProgress
      let bestDist = 20
      for (const bp of unique) {
        const screenX = rect.left + progressToScrubber(bp) * rect.width
        const dist = Math.abs(clientX - screenX)
        if (dist < bestDist) {
          bestDist = dist
          bestProgress = bp
        }
      }
      return bestProgress
    },
    [demoStateRef, scrubberTrackRef]
  )

  const scrubberProgressFromPointer = useCallback(
    (clientX: number, snap = false) => {
      const track = scrubberTrackRef.current
      if (!track) return 0
      const rect = track.getBoundingClientRect()
      const linearPos = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
      const progress = scrubberToProgress(linearPos)
      return snap ? snapToSegmentBoundary(progress, clientX) : progress
    },
    [snapToSegmentBoundary, scrubberTrackRef]
  )

  const handleScrubberPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault()
      e.stopPropagation()

      setRestoredFromUrl(false)
      narration.stop()
      isDraggingScrubberRef.current = true
      const progress = scrubberProgressFromPointer(e.clientX, true)
      setRevealProgress(progress)
      scrubberTrackRef.current?.setPointerCapture(e.pointerId)
      if (scrubberThumbVisualRef.current) {
        scrubberThumbVisualRef.current.style.transform = 'scale(1.4)'
        const cid = demoStateRef.current.constantId
        const glowColor =
          cid === 'pi'
            ? 'rgba(96, 165, 250, 0.6)'
            : cid === 'tau'
              ? 'rgba(45, 212, 191, 0.6)'
              : 'rgba(168, 85, 247, 0.6)'
        scrubberThumbVisualRef.current.style.boxShadow = `0 0 12px ${glowColor}`
      }
    },
    [
      scrubberProgressFromPointer,
      setRevealProgress,
      narration,
      setRestoredFromUrl,
      isDraggingScrubberRef,
      scrubberTrackRef,
      demoStateRef,
    ]
  )

  const handleScrubberPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (isDraggingScrubberRef.current) {
        e.preventDefault()
        const progress = scrubberProgressFromPointer(e.clientX, true)
        setRevealProgress(progress)
      } else {
        scrubberHoverProgressRef.current = scrubberProgressFromPointer(e.clientX)
      }
    },
    [
      scrubberProgressFromPointer,
      setRevealProgress,
      isDraggingScrubberRef,
      scrubberHoverProgressRef,
    ]
  )

  const handleScrubberPointerLeave = useCallback(() => {
    scrubberHoverProgressRef.current = null
  }, [scrubberHoverProgressRef])

  const handleScrubberPointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!isDraggingScrubberRef.current) return
      isDraggingScrubberRef.current = false
      scrubberTrackRef.current?.releasePointerCapture(e.pointerId)
      if (scrubberThumbVisualRef.current) {
        scrubberThumbVisualRef.current.style.transform = 'scale(1)'
        scrubberThumbVisualRef.current.style.boxShadow = '0 1px 3px rgba(0,0,0,0.3)'
      }
      const ds = demoStateRef.current
      if (ds.constantId && ds.revealProgress < 1) {
        narration.resume(ds.constantId)
      }
    },
    [demoStateRef, narration, isDraggingScrubberRef, scrubberTrackRef]
  )

  const handleScrubberKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const ds = demoStateRef.current
      if (ds.phase === 'idle') return

      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        if (narration.isNarrating.current) {
          narration.stop()
        } else if (ds.constantId && ds.revealProgress < 1) {
          narration.resume(ds.constantId)
        }
        return
      }

      const wasPlaying = narration.isNarrating.current
      narration.stop()
      let progress = ds.revealProgress
      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowUp':
          e.preventDefault()
          progress = Math.min(1, progress + 0.02)
          break
        case 'ArrowLeft':
        case 'ArrowDown':
          e.preventDefault()
          progress = Math.max(0, progress - 0.02)
          break
        case 'Home':
          e.preventDefault()
          progress = 0
          break
        case 'End':
          e.preventDefault()
          progress = 1
          break
        default:
          return
      }
      setRevealProgress(progress)
      if (wasPlaying && ds.constantId && progress < 1) {
        requestAnimationFrame(() => narration.resume(ds.constantId!))
      }
    },
    [demoStateRef, setRevealProgress, narration]
  )

  const handleScrubberFocus = useCallback(() => {
    if (scrubberTrackRef.current) {
      scrubberTrackRef.current.style.outline = '2px solid rgba(168, 85, 247, 0.7)'
      scrubberTrackRef.current.style.outlineOffset = '2px'
    }
  }, [scrubberTrackRef])

  const handleScrubberBlur = useCallback(() => {
    if (scrubberTrackRef.current) {
      scrubberTrackRef.current.style.outline = 'none'
    }
  }, [scrubberTrackRef])

  const handleResumeFromUrl = useCallback(() => {
    setRestoredFromUrl(false)
    const ds = demoStateRef.current
    if (ds.constantId && ds.revealProgress < 1) {
      narration.resume(ds.constantId)
    }
  }, [demoStateRef, narration, setRestoredFromUrl])

  // --- Refine range track handlers ---
  const refineProgressFromPointer = useCallback(
    (clientX: number) => {
      const track = scrubberTrackRef.current
      if (!track) return 0
      const rect = track.getBoundingClientRect()
      const linearPos = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
      const progress = scrubberToProgress(linearPos)
      return snapToSegmentBoundary(progress, clientX)
    },
    [snapToSegmentBoundary, scrubberTrackRef]
  )

  const handleRefineTrackPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (refineTaskActive) return
      e.preventDefault()
      e.stopPropagation()
      const progress = refineProgressFromPointer(e.clientX)
      refineStartRef.current = progress
      setRefineRange({ start: progress, end: progress })
      refineTrackRef.current?.setPointerCapture(e.pointerId)
    },
    [refineProgressFromPointer, refineTaskActive, refineStartRef, setRefineRange]
  )

  const handleRefineTrackPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (refineStartRef.current === null || refineTaskActive) return
      e.preventDefault()
      const progress = refineProgressFromPointer(e.clientX)
      const start = refineStartRef.current
      setRefineRange({
        start: Math.min(start, progress),
        end: Math.max(start, progress),
      })
    },
    [refineProgressFromPointer, refineTaskActive, refineStartRef, setRefineRange]
  )

  const handleRefineTrackPointerUp = useCallback(
    (e: React.PointerEvent) => {
      refineStartRef.current = null
      refineTrackRef.current?.releasePointerCapture(e.pointerId)
    },
    [refineStartRef]
  )

  // Colors for scrubber (adapts to active demo)
  const activeDemoId = demoStateRef.current.constantId
  const scrubberTrackColor =
    activeDemoId === 'pi'
      ? resolvedTheme === 'dark'
        ? 'rgba(96, 165, 250, 0.3)'
        : 'rgba(37, 99, 235, 0.3)'
      : activeDemoId === 'tau'
        ? resolvedTheme === 'dark'
          ? 'rgba(45, 212, 191, 0.3)'
          : 'rgba(13, 148, 136, 0.3)'
        : resolvedTheme === 'dark'
          ? 'rgba(245, 158, 11, 0.3)'
          : 'rgba(109, 40, 217, 0.3)'
  const scrubberFillColor =
    activeDemoId === 'pi'
      ? resolvedTheme === 'dark'
        ? '#60a5fa'
        : '#2563eb'
      : activeDemoId === 'tau'
        ? resolvedTheme === 'dark'
          ? '#2dd4bf'
          : '#0d9488'
        : resolvedTheme === 'dark'
          ? '#fbbf24'
          : '#a855f7'

  // Compute segments overlapping the refine range
  const refineSelectedSegments = useMemo(() => {
    if (!refineMode || !refineRange || refineRange.end <= refineRange.start) return []
    const cid = demoStateRef.current.constantId
    if (!cid) return []
    const cfg = NARRATION_CONFIGS[cid]
    if (!cfg) return []
    return cfg.segments
      .map((seg, i) => ({ ...seg, index: i }))
      .filter((seg) => seg.startProgress < refineRange.end && seg.endProgress > refineRange.start)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refineMode, refineRange])

  const isDev = isDevelopment

  return (
    <>
      {restoredFromUrl && (
        <button
          data-action="demo-resume-from-url"
          onClick={handleResumeFromUrl}
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            minHeight: 56,
            minWidth: 56,
            padding: '14px 32px',
            fontSize: 16,
            fontWeight: 600,
            fontFamily: 'system-ui, sans-serif',
            color: '#fff',
            backgroundColor: scrubberFillColor,
            border: 'none',
            borderRadius: 28,
            cursor: 'pointer',
            boxShadow: `0 4px 20px ${scrubberFillColor}66`,
            zIndex: 20,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            transition: 'transform 0.15s, box-shadow 0.15s',
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="#fff">
            <path d="M8 5v14l11-7z" />
          </svg>
          Resume
        </button>
      )}
      <div
        data-element="demo-share-group"
        style={{
          position: 'absolute',
          top: 10,
          right: 10,
          zIndex: 10,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: 4,
        }}
      >
        <button
          data-action="demo-share"
          aria-label={shareAtCurrentTime ? 'Share demo at current time' : 'Share demo from start'}
          onClick={handleShare}
          style={{
            minHeight: 44,
            minWidth: 44,
            padding: '10px 12px',
            fontSize: 12,
            fontWeight: 600,
            fontFamily: 'system-ui, sans-serif',
            color: resolvedTheme === 'dark' ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.55)',
            backgroundColor:
              resolvedTheme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
            border: `1px solid ${resolvedTheme === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)'}`,
            borderRadius: 10,
            cursor: 'pointer',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            transition: 'opacity 0.15s',
          }}
        >
          {shareFeedback ? (
            <>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Copied!
            </>
          ) : (
            <>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                <polyline points="16 6 12 2 8 6" />
                <line x1="12" y1="2" x2="12" y2="15" />
              </svg>
              Share
            </>
          )}
        </button>
        {demoStateRef.current.revealProgress > 0 && (
          <label
            data-element="demo-share-timestamp-toggle"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              fontSize: 11,
              fontFamily: 'system-ui, sans-serif',
              color: resolvedTheme === 'dark' ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)',
              cursor: 'pointer',
              padding: '2px 4px',
              userSelect: 'none',
            }}
          >
            <input
              type="checkbox"
              checked={shareAtCurrentTime}
              onChange={(e) => setShareAtCurrentTime(e.target.checked)}
              style={{ margin: 0, accentColor: scrubberFillColor }}
            />
            at current time
          </label>
        )}
      </div>
      <button
        ref={playPauseBtnRef}
        data-action="demo-play-pause"
        aria-label="Play or pause demo"
        onClick={handlePlayPauseClick}
        style={{
          position: 'absolute',
          bottom: 'max(16px, env(safe-area-inset-bottom, 0px))',
          left: 16,
          width: 44,
          height: 44,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: 0,
          opacity: 0,
          pointerEvents: 'none',
          transition: 'opacity 0.15s',
          zIndex: 1,
        }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill={scrubberFillColor}>
          <path d="M6 4h4v16H6zm8 0h4v16h-4z" />
        </svg>
      </button>
      <div
        ref={timeDisplayRef}
        data-element="demo-time-display"
        aria-live="off"
        style={{
          position: 'absolute',
          bottom: 'max(16px, env(safe-area-inset-bottom, 0px))',
          right: 12,
          height: 48,
          display: 'flex',
          alignItems: 'center',
          fontSize: 11,
          fontVariantNumeric: 'tabular-nums',
          fontFamily: 'system-ui, sans-serif',
          color: resolvedTheme === 'dark' ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)',
          pointerEvents: 'none',
          opacity: 0,
          transition: 'opacity 0.15s',
          whiteSpace: 'nowrap',
          letterSpacing: '0.02em',
        }}
      />
      {/* Refine range selection track */}
      {refineMode && (
        <div
          ref={refineTrackRef}
          data-element="demo-refine-track"
          onPointerDown={handleRefineTrackPointerDown}
          onPointerMove={handleRefineTrackPointerMove}
          onPointerUp={handleRefineTrackPointerUp}
          onPointerCancel={handleRefineTrackPointerUp}
          style={{
            position: 'absolute',
            bottom: `calc(max(16px, env(safe-area-inset-bottom, 0px)) + 48px + 4px)`,
            left: 68,
            right: 80,
            height: 24,
            display: 'flex',
            alignItems: 'center',
            cursor: refineTaskActive ? 'default' : 'crosshair',
            touchAction: 'none',
            zIndex: 1,
          }}
        >
          <div
            data-element="demo-refine-track-bg"
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              height: 4,
              borderRadius: 2,
              backgroundColor:
                resolvedTheme === 'dark' ? 'rgba(96, 165, 250, 0.15)' : 'rgba(96, 165, 250, 0.12)',
              border: `1px solid ${
                resolvedTheme === 'dark' ? 'rgba(96, 165, 250, 0.25)' : 'rgba(96, 165, 250, 0.2)'
              }`,
              boxSizing: 'border-box',
            }}
          />
          {refineRange && refineRange.end > refineRange.start && (
            <div
              data-element="demo-refine-range"
              style={{
                position: 'absolute',
                left: `${progressToScrubber(refineRange.start) * 100}%`,
                width: `${(progressToScrubber(refineRange.end) - progressToScrubber(refineRange.start)) * 100}%`,
                height: 4,
                borderRadius: 2,
                backgroundColor: 'rgba(96, 165, 250, 0.6)',
                border: '1px solid rgba(96, 165, 250, 0.9)',
                boxSizing: 'border-box',
                pointerEvents: 'none',
              }}
            />
          )}
          <div
            style={{
              position: 'absolute',
              right: -75,
              width: 70,
              fontSize: 9,
              fontWeight: 600,
              fontFamily: 'system-ui, sans-serif',
              color: 'rgba(96, 165, 250, 0.8)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              textAlign: 'right',
              pointerEvents: 'none',
              userSelect: 'none',
            }}
          >
            {refineRange && refineRange.end > refineRange.start
              ? `${Math.round(refineRange.start * 100)}–${Math.round(refineRange.end * 100)}%`
              : 'drag range'}
          </div>
        </div>
      )}
      <div
        ref={scrubberTrackRef}
        data-element="demo-scrubber"
        role="slider"
        aria-label={
          demoStateRef.current.constantId === 'pi'
            ? 'Pi unrolling progress'
            : demoStateRef.current.constantId === 'tau'
              ? 'Tau unrolling progress'
              : 'Golden ratio convergence progress'
        }
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={0}
        tabIndex={0}
        onPointerDown={handleScrubberPointerDown}
        onPointerMove={handleScrubberPointerMove}
        onPointerUp={handleScrubberPointerUp}
        onPointerCancel={handleScrubberPointerUp}
        onPointerLeave={handleScrubberPointerLeave}
        onKeyDown={handleScrubberKeyDown}
        onFocus={handleScrubberFocus}
        onBlur={handleScrubberBlur}
        style={{
          position: 'absolute',
          bottom: 'max(16px, env(safe-area-inset-bottom, 0px))',
          left: 68,
          right: 80,
          height: 48,
          display: 'flex',
          alignItems: 'center',
          cursor: 'pointer',
          touchAction: 'none',
          opacity: 0,
          pointerEvents: 'none',
          transition: 'opacity 0.15s',
          outline: 'none',
        }}
      >
        <div
          data-element="demo-scrubber-track-bg"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            height: 6,
            borderRadius: 3,
            backgroundColor: scrubberTrackColor,
          }}
        />
        <div
          ref={segmentTicksRef}
          data-element="demo-scrubber-segment-ticks"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            height: '100%',
            pointerEvents: 'none',
          }}
        />
        <div
          ref={segmentLabelRef}
          data-element="demo-scrubber-segment-label"
          style={{
            position: 'absolute',
            bottom: '100%',
            marginBottom: 6,
            transform: 'translateX(-50%)',
            fontSize: 11,
            fontWeight: 500,
            fontFamily: 'system-ui, sans-serif',
            color: resolvedTheme === 'dark' ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.7)',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            opacity: 0,
            transition: 'opacity 0.12s',
            textShadow:
              resolvedTheme === 'dark'
                ? '0 1px 4px rgba(0,0,0,0.8)'
                : '0 1px 3px rgba(255,255,255,0.9)',
          }}
        />
        <div
          ref={scrubberFillRef}
          data-element="demo-scrubber-fill"
          style={{
            position: 'absolute',
            left: 0,
            height: 6,
            borderRadius: 3,
            backgroundColor: scrubberFillColor,
            width: '0%',
          }}
        />
        <div
          ref={scrubberGapRef}
          data-element="demo-scrubber-gap"
          style={{
            position: 'absolute',
            top: 0,
            height: 4,
            borderRadius: 2,
            opacity: 0,
            transition: 'width 0.1s, background-color 0.15s, opacity 0.15s',
            pointerEvents: 'none',
          }}
        />
        <div
          ref={scrubberThumbRef}
          data-element="demo-scrubber-thumb"
          style={{
            position: 'absolute',
            left: '0%',
            width: 44,
            height: 44,
            transform: 'translateX(-50%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            ref={scrubberThumbVisualRef}
            data-element="demo-scrubber-thumb-visual"
            style={{
              width: 22,
              height: 22,
              borderRadius: '50%',
              backgroundColor: scrubberFillColor,
              border: '3px solid white',
              boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
              transition: 'transform 0.15s, box-shadow 0.15s',
              pointerEvents: 'none',
            }}
          />
        </div>
      </div>

      {/* Playback speed badge */}
      {showSpeedBadge && demoStateRef.current.phase !== 'idle' && (
        <div
          data-element="speed-badge"
          style={{
            position: 'absolute',
            top: 16,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 190,
            backgroundColor: 'rgba(0,0,0,0.75)',
            color: '#fff',
            borderRadius: 8,
            padding: '6px 16px',
            fontFamily: 'system-ui, sans-serif',
            fontSize: 15,
            fontWeight: 600,
            pointerEvents: 'none',
            transition: 'opacity 0.3s',
          }}
        >
          {displaySpeed}x
        </div>
      )}

      {/* REFINE MODE badge (dev-only) */}
      {isDev && refineMode && (
        <div
          data-element="refine-mode-badge"
          style={{
            position: 'absolute',
            top: 10,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 190,
            padding: '4px 14px',
            borderRadius: 6,
            backgroundColor: 'rgba(96, 165, 250, 0.2)',
            border: '1px solid rgba(96, 165, 250, 0.5)',
            color: resolvedTheme === 'dark' ? '#93c5fd' : '#2563eb',
            fontSize: 11,
            fontWeight: 700,
            fontFamily: 'system-ui, sans-serif',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            pointerEvents: 'none',
            userSelect: 'none',
          }}
        >
          Refine Mode
        </div>
      )}

      {/* Demo Refine Panel (dev-only) */}
      {isDev &&
        refineMode &&
        demoStateRef.current.constantId &&
        (refineTaskActive || (refineRange && refineRange.end > refineRange.start)) && (
          <DemoRefinePanel
            constantId={demoStateRef.current.constantId}
            startProgress={refineRange?.start ?? 0}
            endProgress={refineRange?.end ?? 1}
            segments={refineSelectedSegments}
            isDark={resolvedTheme === 'dark'}
            onCaptureScreenshot={onCaptureScreenshot}
            onClose={() => {
              setRefineMode(false)
              setRefineRange(null)
              refineStartRef.current = null
              setRefineTaskActive(false)
              try {
                sessionStorage.removeItem('refine-active-task')
              } catch {}
            }}
            onComplete={() => {
              window.location.reload()
            }}
            onTaskStart={() => setRefineTaskActive(true)}
            onTaskEnd={() => setRefineTaskActive(false)}
          />
        )}
    </>
  )
}
