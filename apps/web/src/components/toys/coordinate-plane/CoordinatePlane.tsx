'use client'

import { useRef, useEffect, useCallback, useState } from 'react'
import { useTheme } from '../../../contexts/ThemeContext'
import type { CoordinatePlaneState, ZoomMode, CoordinatePlaneOverlay } from './types'
import type { CollisionFadeMap } from '../shared/collisionDetection'
import { renderCoordinatePlane } from './renderCoordinatePlane'
import { useCoordinatePlaneTouch } from './useCoordinatePlaneTouch'
import { ToyDebugPanel } from '../ToyDebugPanel'
import { KeyboardShortcutsOverlay } from '../shared/KeyboardShortcutsOverlay'
import type { ShortcutEntry } from '../shared/KeyboardShortcutsOverlay'
import { useVisualDebugSafe } from '@/contexts/VisualDebugContext'
import { screenToWorld2D, worldToScreen2D } from '../shared/coordinateConversions'
import type { RulerState, VisualRulerState, EquationProbeState, SlopeGuideState } from './ruler/types'
import { renderRuler, rulerToScreen } from './ruler/renderRuler'
import { useRulerInteraction } from './ruler/useRulerInteraction'
import { equationFromPoints } from './ruler/fractionMath'
import { RulerEquationLabel } from './ruler/RulerEquationLabel'
import type { EquationDisplayForm } from './ruler/RulerEquationLabel'
import { useEquationSlider } from './ruler/useEquationSlider'
import { useChallenge } from './challenge/useChallenge'
import type { ViewportAnimation } from './challenge/types'
import { WordProblemCard } from './challenge/WordProblemCard'
import { computeCardPlacement } from './challenge/quadrantPlacement'
import { computeViewportTarget } from './challenge/viewportAnimation'
import { renderChallengeAnnotations } from './challenge/renderChallengeAnnotations'
import type { DifficultyLevel } from './wordProblems/types'
import { smoothstep } from '../shared/tickMath'
const SHORTCUTS: ShortcutEntry[] = [
  { key: 'Drag', description: 'Pan' },
  { key: 'Scroll / Pinch', description: 'Zoom (uniform)' },
  { key: 'Z', description: 'Toggle uniform / independent zoom' },
  { key: 'Shift + Scroll', description: 'Zoom X only (independent mode)' },
  { key: 'Alt + Scroll', description: 'Zoom Y only (independent mode)' },
  { key: 'Drag handle', description: 'Move ruler endpoint (snaps to grid)' },
  { key: 'Drag ruler', description: 'Slide ruler (preserves slope)' },
  { key: 'R', description: 'Toggle ruler visibility' },
  { key: 'P', description: 'New word problem' },
  { key: '?', description: 'Toggle this help' },
]

interface CoordinatePlaneProps {
  overlays?: CoordinatePlaneOverlay[]
  challenge?: { enabled: boolean; difficulty?: DifficultyLevel; onComplete?: (problem: import('./wordProblems/types').WordProblem, attempts: number) => void }
}

export function CoordinatePlane({ overlays, challenge }: CoordinatePlaneProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const stateRef = useRef<CoordinatePlaneState>({
    center: { x: 0, y: 0 },
    pixelsPerUnit: { x: 60, y: 60 },
  })
  const zoomModeRef = useRef<ZoomMode>('uniform')
  const [zoomMode, setZoomMode] = useState<ZoomMode>('uniform')
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [showRuler, setShowRuler] = useState(true)
  const [equationForm, setEquationForm] = useState<EquationDisplayForm>('slope-intercept')

  const xCollisionFadeMapRef = useRef<CollisionFadeMap>(new Map())
  const yCollisionFadeMapRef = useRef<CollisionFadeMap>(new Map())

  // Ruler state
  const rulerRef = useRef<RulerState>({ ax: -3, ay: -1, bx: 3, by: 2 })
  const visualRulerRef = useRef<VisualRulerState>({ ax: -3, ay: -1, bx: 3, by: 2 })
  const lastFrameTimeRef = useRef(performance.now())
  const pointerCapturedRef = useRef(false)
  const [activeHandle, setActiveHandle] = useState<'handleA' | 'handleB' | 'body' | null>(null)
  const [rulerVersion, setRulerVersion] = useState(0)
  const equationProbeRef = useRef<EquationProbeState>({
    active: false,
    t: 0.5,
    worldX: 0,
    worldY: 0,
    nearX: null,
    nearY: null,
    solvedAtNearX: null,
    solvedAtNearY: null,
  })
  const slopeGuideRef = useRef<SlopeGuideState | null>(null)
  const [hideCursor, setHideCursor] = useState(false)
  const equationLabelRef = useRef<HTMLDivElement | null>(null)



  // Zoom velocity state (smoothed for visual wash)
  const zoomVelocityRef = useRef(0)
  const zoomHueRef = useRef(0)
  const zoomFocalRef = useRef({ x: 0.5, y: 0.5 })

  // Brief toast for zoom mode changes
  const [zoomToast, setZoomToast] = useState<string | null>(null)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Challenge system
  const viewportAnimRef = useRef<ViewportAnimation | null>(null)

  const rafRef = useRef<number>(0)
  const needsDrawRef = useRef(true)

  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const { isVisualDebugEnabled } = useVisualDebugSafe()

  // Debug state for display
  const [debugInfo, setDebugInfo] = useState({
    centerX: 0,
    centerY: 0,
    ppuX: 60,
    ppuY: 60,
    cursorWX: 0,
    cursorWY: 0,
  })

  const requestDraw = useCallback(() => {
    needsDrawRef.current = true
  }, [])

  const handleZoomVelocity = useCallback((velocity: number, focalX: number, focalY: number) => {
    zoomVelocityRef.current = velocity
    zoomHueRef.current = (zoomHueRef.current + velocity * 200 + 360) % 360
    zoomFocalRef.current = { x: focalX, y: focalY }
    requestDraw()
  }, [requestDraw])

  // Ruler interaction (must be called before pan/zoom so it can capture the pointer)
  const handleRulerChange = useCallback(() => {
    setRulerVersion(v => v + 1)
    requestDraw()
  }, [requestDraw])

  const toggleEquationForm = useCallback(() => {
    setEquationForm(f => f === 'slope-intercept' ? 'standard' : 'slope-intercept')
  }, [])

  const handleActiveHandleChange = useCallback((zone: 'handleA' | 'handleB' | 'body' | null) => {
    setActiveHandle(zone)
    requestDraw()
  }, [requestDraw])

  useRulerInteraction({
    rulerRef,
    stateRef,
    canvasRef,
    pointerCapturedRef,
    onRulerChange: handleRulerChange,
    onActiveHandleChange: handleActiveHandleChange,
    enabled: showRuler,
    slopeGuideRef,
  })

  useCoordinatePlaneTouch({
    stateRef,
    canvasRef,
    zoomModeRef,
    pointerCapturedRef,
    onStateChange: requestDraw,
    onZoomVelocity: handleZoomVelocity,
  })

  // Challenge system
  const challengeEnabled = challenge?.enabled ?? false

  const handleChallengeSummon = useCallback((problem: import('./wordProblems/types').WordProblem) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    const cw = canvas.width / dpr
    const ch = canvas.height / dpr
    const target = computeViewportTarget(problem, cw, ch, stateRef.current)

    // Switch to independent zoom so the different axis scales are preserved
    // during subsequent user interactions (scroll, pinch)
    zoomModeRef.current = 'independent'
    setZoomMode('independent')

    // Ensure ruler is visible (needed to solve the problem)
    setShowRuler(true)

    viewportAnimRef.current = {
      active: true,
      from: {
        cx: stateRef.current.center.x,
        cy: stateRef.current.center.y,
        ppuX: stateRef.current.pixelsPerUnit.x,
        ppuY: stateRef.current.pixelsPerUnit.y,
      },
      to: target,
      startTime: performance.now(),
      duration: 600,
    }
    needsDrawRef.current = true
  }, [])

  const {
    challengeRef: challengeStateRef,
    challengeVersion,
    summonProblem,
    dismissProblem,
    handleAnswerCorrect,
    phase: challengePhase,
    problem: challengeProblem,
  } = useChallenge({
    rulerRef,
    stateRef,
    rulerVersion,
    enabled: challengeEnabled,
    onComplete: challenge?.onComplete,
    onSummon: handleChallengeSummon,
  })

  // Toggle zoom mode
  const toggleZoomMode = useCallback(() => {
    const newMode = zoomModeRef.current === 'uniform' ? 'independent' : 'uniform'
    if (newMode === 'uniform') {
      const avg = (stateRef.current.pixelsPerUnit.x + stateRef.current.pixelsPerUnit.y) / 2
      stateRef.current.pixelsPerUnit.x = avg
      stateRef.current.pixelsPerUnit.y = avg
    }
    zoomModeRef.current = newMode
    setZoomMode(newMode)
    requestDraw()

    // Show toast
    const label = newMode === 'uniform' ? 'Uniform Zoom' : 'Independent Zoom'
    setZoomToast(label)
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    toastTimerRef.current = setTimeout(() => setZoomToast(null), 1500)
  }, [requestDraw])

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Don't capture when typing in inputs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      if (e.key === '?') {
        e.preventDefault()
        setShowShortcuts(prev => !prev)
      } else if (e.key === 'z' || e.key === 'Z') {
        if (!e.metaKey && !e.ctrlKey) {
          e.preventDefault()
          toggleZoomMode()
        }
      } else if (e.key === 'r' || e.key === 'R') {
        if (!e.metaKey && !e.ctrlKey) {
          e.preventDefault()
          setShowRuler(prev => {
            const next = !prev
            const label = next ? 'Ruler On' : 'Ruler Off'
            setZoomToast(label)
            if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
            toastTimerRef.current = setTimeout(() => setZoomToast(null), 1500)
            return next
          })
          requestDraw()
        }
      } else if (e.key === 'p' || e.key === 'P') {
        if (!e.metaKey && !e.ctrlKey) {
          e.preventDefault()
          summonProblem(challenge?.difficulty ?? 3)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [toggleZoomMode, requestDraw, summonProblem, challenge?.difficulty])

  // Forward wheel events from DOM overlays (e.g. equation card) to canvas for zoom
  useEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    if (!container || !canvas) return

    function handleWheel(e: WheelEvent) {
      // Only forward events that didn't originate from the canvas itself
      if (!canvas!.contains(e.target as Node)) {
        e.preventDefault()
        canvas!.dispatchEvent(new WheelEvent('wheel', {
          deltaX: e.deltaX,
          deltaY: e.deltaY,
          deltaZ: e.deltaZ,
          deltaMode: e.deltaMode,
          clientX: e.clientX,
          clientY: e.clientY,
          screenX: e.screenX,
          screenY: e.screenY,
          ctrlKey: e.ctrlKey,
          shiftKey: e.shiftKey,
          altKey: e.altKey,
          metaKey: e.metaKey,
          bubbles: false,
        }))
      }
    }

    container.addEventListener('wheel', handleWheel, { passive: false })
    return () => container.removeEventListener('wheel', handleWheel)
  }, [])

  // Canvas resize observer
  useEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    if (!container || !canvas) return

    const ro = new ResizeObserver(() => {
      const rect = container.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr
      canvas.style.width = `${rect.width}px`
      canvas.style.height = `${rect.height}px`
      requestDraw()
    })
    ro.observe(container)
    return () => ro.disconnect()
  }, [requestDraw])

  // Mousemove for debug cursor world coords
  useEffect(() => {
    if (!isVisualDebugEnabled) return
    const canvas = canvasRef.current
    if (!canvas) return

    function handleMove(e: MouseEvent) {
      const rect = canvas!.getBoundingClientRect()
      const sx = e.clientX - rect.left
      const sy = e.clientY - rect.top
      const s = stateRef.current
      const w = screenToWorld2D(sx, sy, s.center.x, s.center.y, s.pixelsPerUnit.x, s.pixelsPerUnit.y, rect.width, rect.height)
      setDebugInfo({
        centerX: s.center.x,
        centerY: s.center.y,
        ppuX: s.pixelsPerUnit.x,
        ppuY: s.pixelsPerUnit.y,
        cursorWX: w.x,
        cursorWY: w.y,
      })
    }

    canvas.addEventListener('mousemove', handleMove)
    return () => canvas.removeEventListener('mousemove', handleMove)
  }, [isVisualDebugEnabled])

  // RAF render loop
  useEffect(() => {
    let running = true
    const LERP_SPEED = 12

    function draw() {
      if (!running) return

      const canvas = canvasRef.current

      // ── Lerp visual ruler toward snapped target ──
      const now = performance.now()
      const dt = Math.min((now - lastFrameTimeRef.current) / 1000, 0.05) // cap at 50ms
      lastFrameTimeRef.current = now

      const target = rulerRef.current
      const vis = visualRulerRef.current
      const factor = 1 - Math.exp(-LERP_SPEED * dt)
      let stillAnimating = false

      for (const key of ['ax', 'ay', 'bx', 'by'] as const) {
        const diff = target[key] - vis[key]
        if (Math.abs(diff) < 0.001) {
          vis[key] = target[key]
        } else {
          vis[key] += diff * factor
          stillAnimating = true
        }
      }

      if (stillAnimating) {
        needsDrawRef.current = true
      }

      // ── Viewport animation (challenge auto-pan/zoom) ──
      const viewAnim = viewportAnimRef.current
      if (viewAnim?.active) {
        const elapsed = now - viewAnim.startTime
        const t = smoothstep(Math.min(1, elapsed / viewAnim.duration))
        stateRef.current.center.x = viewAnim.from.cx + (viewAnim.to.cx - viewAnim.from.cx) * t
        stateRef.current.center.y = viewAnim.from.cy + (viewAnim.to.cy - viewAnim.from.cy) * t
        // Interpolate PPU in log-space for perceptually smooth zoom
        stateRef.current.pixelsPerUnit.x = Math.exp(
          Math.log(viewAnim.from.ppuX) + (Math.log(viewAnim.to.ppuX) - Math.log(viewAnim.from.ppuX)) * t
        )
        stateRef.current.pixelsPerUnit.y = Math.exp(
          Math.log(viewAnim.from.ppuY) + (Math.log(viewAnim.to.ppuY) - Math.log(viewAnim.from.ppuY)) * t
        )
        needsDrawRef.current = true
        if (t >= 1) {
          viewAnim.active = false

          // ── Reposition off-screen ruler handles now that the viewport has settled ──
          if (canvas && showRuler) {
            const dpr = window.devicePixelRatio || 1
            const cw = canvas.width / dpr
            const ch = canvas.height / dpr
            const margin = 50
            const { center, pixelsPerUnit: ppu } = stateRef.current
            const r = rulerRef.current

            const isOnScreen = (wx: number, wy: number) => {
              const s = worldToScreen2D(wx, wy, center.x, center.y, ppu.x, ppu.y, cw, ch)
              return s.x >= margin && s.x <= cw - margin && s.y >= margin && s.y <= ch - margin
            }

            const aOk = isOnScreen(r.ax, r.ay)
            const bOk = isOnScreen(r.bx, r.by)

            if (!aOk || !bOk) {
              const cx = Math.round(center.x)
              const cy = Math.round(center.y)

              // Avoid placing on the challenge answer point
              const ans = challengeStateRef.current.problem?.answer
              const isAnswer = (x: number, y: number) =>
                ans != null && x === ans.x && y === ans.y

              // Search outward from center for a visible, non-answer integer point
              const findVisible = (avoidX: number, avoidY: number) => {
                for (let radius = 0; radius <= 5; radius++) {
                  for (let dx = -radius; dx <= radius; dx++) {
                    for (let dy = -radius; dy <= radius; dy++) {
                      if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue
                      const px = cx + dx, py = cy + dy
                      if (px === avoidX && py === avoidY) continue
                      if (isAnswer(px, py)) continue
                      if (isOnScreen(px, py)) return { x: px, y: py }
                    }
                  }
                }
                return { x: cx, y: cy }
              }

              let { ax, ay, bx, by } = r
              if (!aOk) { const p = findVisible(bx, by); ax = p.x; ay = p.y }
              if (!bOk) { const p = findVisible(ax, ay); bx = p.x; by = p.y }
              rulerRef.current = { ax, ay, bx, by }
            }
          }
        }
      }

      if (canvas && needsDrawRef.current) {
        needsDrawRef.current = false

        const dpr = window.devicePixelRatio || 1
        const cssWidth = canvas.width / dpr
        const cssHeight = canvas.height / dpr

        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.save()
          ctx.scale(dpr, dpr)

          const animatingPlane = renderCoordinatePlane(
            ctx,
            stateRef.current,
            cssWidth,
            cssHeight,
            isDark,
            zoomVelocityRef.current,
            zoomHueRef.current,
            zoomFocalRef.current.x,
            zoomFocalRef.current.y,
            xCollisionFadeMapRef.current,
            yCollisionFadeMapRef.current,
            overlays,
            showRuler ? equationProbeRef.current : undefined,
          )

          // Render ruler on top of everything (when visible)
          if (showRuler) {
            renderRuler(
              ctx,
              visualRulerRef.current,
              rulerRef.current,
              stateRef.current,
              cssWidth,
              cssHeight,
              isDark,
              activeHandle,
              equationProbeRef.current,
              slopeGuideRef.current,
            )
          }

          // Render challenge annotations (constraint line, reveal markers)
          const challengeState = challengeStateRef.current
          if (challengeState.problem && challengeState.phase !== 'idle') {
            renderChallengeAnnotations(
              ctx,
              challengeState,
              challengeState.problem,
              stateRef.current,
              cssWidth,
              cssHeight,
              isDark,
            )
          }

          ctx.restore()

          // ── Sync equation label DOM position with viewport ──
          const labelEl = equationLabelRef.current
          if (labelEl) {
            const labelInfo = rulerToScreen(visualRulerRef.current, stateRef.current, cssWidth, cssHeight)
            if (labelInfo.length >= 1) {
              const t = equationProbeRef.current.t
              const posX = labelInfo.ax + (labelInfo.bx - labelInfo.ax) * t
              const posY = labelInfo.ay + (labelInfo.by - labelInfo.ay) * t

              let displayAngle = labelInfo.angle
              while (displayAngle > Math.PI / 2) displayAngle -= Math.PI
              while (displayAngle < -Math.PI / 2) displayAngle += Math.PI

              const offsetPx = 18
              const perpX = -Math.sin(displayAngle) * offsetPx
              const perpY = Math.cos(displayAngle) * offsetPx

              const canvasOffsetLeft = canvas.offsetLeft || 0
              const canvasOffsetTop = canvas.offsetTop || 0

              labelEl.style.left = `${canvasOffsetLeft + posX + perpX}px`
              labelEl.style.top = `${canvasOffsetTop + posY + perpY}px`
              labelEl.style.transform = `translate(-50%, -50%) rotate(${displayAngle}rad)`
            }
          }

          if (animatingPlane) {
            needsDrawRef.current = true
          }
        }
      }

      // Decay zoom velocity
      zoomVelocityRef.current *= 0.9
      if (Math.abs(zoomVelocityRef.current) > 0.001) {
        needsDrawRef.current = true
      }

      rafRef.current = requestAnimationFrame(draw)
    }

    rafRef.current = requestAnimationFrame(draw)
    return () => {
      running = false
      cancelAnimationFrame(rafRef.current)
    }
  }, [isDark, overlays, activeHandle, showRuler, challengeVersion])

  return (
    <div
      ref={containerRef}
      data-component="coordinate-plane"
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        touchAction: 'none',
        overflow: 'hidden',
        cursor: hideCursor ? 'none' : undefined,
      }}
    >
      <canvas
        ref={canvasRef}
        data-element="coordinate-plane-canvas"
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
        }}
      />

      {/* Ruler equation label (DOM overlay) */}
      {showRuler && (
        <RulerEquationOverlay
          rulerRef={rulerRef}
          stateRef={stateRef}
          canvasRef={canvasRef}
          probeRef={equationProbeRef}
          pointerCapturedRef={pointerCapturedRef}
          requestDraw={requestDraw}
          isDark={isDark}
          rulerVersion={rulerVersion}
          onDragStateChange={setHideCursor}
          equationLabelRef={equationLabelRef}
          equationForm={equationForm}
          onClickLabel={toggleEquationForm}
        />
      )}

      {/* Word problem challenge card */}
      {challengeProblem && challengePhase !== 'idle' && (
        <WordProblemCard
          problem={challengeProblem}
          phase={challengePhase}
          placement={computeCardPlacement(
            challengeProblem.answer.x,
            challengeProblem.answer.y,
            stateRef.current,
            canvasRef.current ? canvasRef.current.width / (window.devicePixelRatio || 1) : 800,
            canvasRef.current ? canvasRef.current.height / (window.devicePixelRatio || 1) : 600,
          )}
          revealStep={challengeStateRef.current.revealStep}
          isDark={isDark}
          onNewProblem={() => summonProblem(challenge?.difficulty ?? 3)}
          onDismiss={dismissProblem}
          onAnswerCorrect={() => handleAnswerCorrect(challenge?.difficulty ?? 3)}
        />
      )}

      {/* Challenge annotations are now rendered directly on canvas via renderChallengeAnnotations */}

      {/* Subtle "?" hint in corner */}
      <div
        data-element="shortcuts-hint"
        style={{
          position: 'absolute',
          bottom: 12,
          left: 12,
          fontSize: 12,
          color: isDark ? 'rgba(148, 163, 184, 0.5)' : 'rgba(100, 116, 139, 0.5)',
          pointerEvents: 'none',
          userSelect: 'none',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        Press ? for shortcuts
      </div>

      {/* Zoom mode toast */}
      {zoomToast && (
        <div
          data-element="zoom-mode-toast"
          style={{
            position: 'absolute',
            top: 16,
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '6px 16px',
            borderRadius: 8,
            background: isDark
              ? 'rgba(30, 41, 59, 0.9)'
              : 'rgba(255, 255, 255, 0.92)',
            backdropFilter: 'blur(8px)',
            border: isDark
              ? '1px solid rgba(71, 85, 105, 0.5)'
              : '1px solid rgba(203, 213, 225, 0.8)',
            color: isDark ? '#e2e8f0' : '#334155',
            fontSize: 13,
            fontWeight: 500,
            fontFamily: 'system-ui, sans-serif',
            pointerEvents: 'none',
            zIndex: 10,
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          }}
        >
          {zoomToast}
        </div>
      )}

      {/* Keyboard shortcuts overlay */}
      {showShortcuts && (
        <KeyboardShortcutsOverlay
          shortcuts={SHORTCUTS}
          onClose={() => setShowShortcuts(false)}
          isDark={isDark}
        />
      )}

      {/* Debug panel */}
      {isVisualDebugEnabled && (
        <ToyDebugPanel title="Coordinate Plane">
          <div style={{ fontFamily: 'monospace', fontSize: 11, lineHeight: 1.6 }}>
            <div>center: ({debugInfo.centerX.toFixed(2)}, {debugInfo.centerY.toFixed(2)})</div>
            <div>ppu: ({debugInfo.ppuX.toFixed(1)}, {debugInfo.ppuY.toFixed(1)})</div>
            <div>cursor: ({debugInfo.cursorWX.toFixed(4)}, {debugInfo.cursorWY.toFixed(4)})</div>
            <div>mode: {zoomMode}</div>
          </div>
        </ToyDebugPanel>
      )}
    </div>
  )
}

// ── Ruler equation DOM overlay ─────────────────────────────────────

interface RulerEquationOverlayProps {
  rulerRef: React.MutableRefObject<RulerState>
  stateRef: React.MutableRefObject<CoordinatePlaneState>
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  probeRef: React.MutableRefObject<EquationProbeState>
  pointerCapturedRef: React.MutableRefObject<boolean>
  requestDraw: () => void
  isDark: boolean
  /** Incremented when ruler state changes, to trigger re-render */
  rulerVersion: number
  /** Called with true when dragging starts, false when dragging ends */
  onDragStateChange: (dragging: boolean) => void
  /** Ref to the label's outer DOM element for RAF position sync */
  equationLabelRef: React.RefObject<HTMLDivElement | null>
  /** Which equation form to display */
  equationForm: EquationDisplayForm
  /** Called when user clicks the label (no drag) */
  onClickLabel?: () => void
}

function RulerEquationOverlay({
  rulerRef,
  stateRef,
  canvasRef,
  probeRef,
  pointerCapturedRef,
  requestDraw,
  isDark,
  rulerVersion,
  onDragStateChange,
  equationLabelRef,
  equationForm,
  onClickLabel,
}: RulerEquationOverlayProps) {
  const {
    sliderT,
    isDragging,
    handlePointerDown,
  } = useEquationSlider({
    rulerRef,
    stateRef,
    canvasRef,
    probeRef,
    requestDraw,
    pointerCapturedRef,
    rulerVersion,
    onClickLabel,
  })

  // Notify parent about drag state for cursor hiding
  useEffect(() => {
    onDragStateChange(isDragging)
  }, [isDragging, onDragStateChange])

  const canvas = canvasRef.current
  if (!canvas) return null

  const dpr = window.devicePixelRatio || 1
  const cssWidth = canvas.width / dpr
  const cssHeight = canvas.height / dpr

  if (cssWidth === 0 || cssHeight === 0) return null

  const ruler = rulerRef.current
  const state = stateRef.current
  const equation = equationFromPoints(ruler.ax, ruler.ay, ruler.bx, ruler.by)
  const info = rulerToScreen(ruler, state, cssWidth, cssHeight)

  // Don't show equation label for degenerate ruler
  if (info.length < 1) return null

  // Position at sliderT along the ruler instead of always midpoint
  const posX = info.ax + (info.bx - info.ax) * sliderT
  const posY = info.ay + (info.by - info.ay) * sliderT

  const canvasOffsetLeft = canvas.offsetLeft || 0
  const canvasOffsetTop = canvas.offsetTop || 0

  return (
    <RulerEquationLabel
      containerRef={equationLabelRef}
      equation={equation}
      equationForm={equationForm}
      screenX={canvasOffsetLeft + posX}
      screenY={canvasOffsetTop + posY}
      angle={info.angle}
      isDark={isDark}
      isDragging={isDragging}
      onIndicatorPointerDown={handlePointerDown}
    />
  )
}

