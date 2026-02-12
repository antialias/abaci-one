import { useRef, useEffect, useState, useCallback } from 'react'
import type { Meta, StoryObj } from '@storybook/react'
import { renderPiOverlay, piDemoViewport } from './piDemo'
import { renderTauOverlay, tauDemoViewport } from './tauDemo'
import { numberToScreenX } from '../../numberLineTicks'
import type { NumberLineState } from '../../types'

const TOTAL_DURATION_S = 15 // matches useConstantDemo reveal duration

/**
 * Phase subtitle based on revealProgress.
 *
 * Construction sub-phases (revealProgress 0→0.30, constructionP 0→1):
 *   constructionP 0.00→0.20 = Highlight (revealProgress 0→0.06)
 *   constructionP 0.20→0.50 = Pivot     (revealProgress 0.06→0.15)
 *   constructionP 0.50→0.85 = Sweep     (revealProgress 0.15→0.255)
 *   constructionP 0.85→1.00 = Treads    (revealProgress 0.255→0.30)
 */
function getPhaseLabel(revealProgress: number, demo: 'pi' | 'tau'): string {
  if (revealProgress < 0.06) return 'Highlight: 1-unit segment glows on axis'
  if (revealProgress < 0.15) return 'Pivot: segment lifts and rotates vertical'
  if (revealProgress < 0.255) {
    return demo === 'pi'
      ? 'Sweep: circle drawn around diameter'
      : 'Sweep: circle drawn around radius (compass arm)'
  }
  if (revealProgress < 0.30) return 'Treads: sprouting around circumference'
  if (revealProgress < 0.92) {
    const t = (revealProgress - 0.30) / (0.92 - 0.30)
    const pct = Math.round(t * 100)
    return demo === 'pi'
      ? `Rolling: circle unrolls toward π (${pct}%)`
      : `Rolling: circle unrolls toward τ (${pct}%)`
  }
  return 'Labels: formula and annotations fade in'
}

/**
 * Draw a simple number line background: axis + integer ticks.
 */
function drawBackground(
  ctx: CanvasRenderingContext2D,
  state: NumberLineState,
  cssWidth: number,
  cssHeight: number,
  isDark: boolean
) {
  const bg = isDark ? '#1a1a2e' : '#f8f8f8'
  const axisColor = isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)'
  const labelColor = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)'

  ctx.fillStyle = bg
  ctx.fillRect(0, 0, cssWidth, cssHeight)

  const centerY = cssHeight / 2

  // Axis line
  ctx.beginPath()
  ctx.moveTo(0, centerY)
  ctx.lineTo(cssWidth, centerY)
  ctx.strokeStyle = axisColor
  ctx.lineWidth = 1
  ctx.stroke()

  // Integer ticks
  const halfRange = cssWidth / (2 * state.pixelsPerUnit)
  const minN = Math.floor(state.center - halfRange) - 1
  const maxN = Math.ceil(state.center + halfRange) + 1

  ctx.font = '10px system-ui, sans-serif'
  ctx.textAlign = 'center'

  for (let n = minN; n <= maxN; n++) {
    const sx = numberToScreenX(n, state.center, state.pixelsPerUnit, cssWidth)
    const tickH = n === 0 ? 10 : 5

    ctx.beginPath()
    ctx.moveTo(sx, centerY - tickH)
    ctx.lineTo(sx, centerY + tickH)
    ctx.strokeStyle = axisColor
    ctx.lineWidth = n === 0 ? 1.5 : 1
    ctx.stroke()

    // Label integers
    ctx.fillStyle = labelColor
    ctx.textBaseline = 'top'
    ctx.fillText(String(n), sx, centerY + tickH + 4)
  }
}

// --- Harness component ---

interface HarnessProps {
  width: number
  height: number
  dark: boolean
  speed: number
  autoPlay: boolean
  demo: 'pi' | 'tau'
}

function CircleConstructionHarness({ width, height, dark, speed, autoPlay, demo }: HarnessProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [revealProgress, setRevealProgress] = useState(0)
  const [playing, setPlaying] = useState(autoPlay)
  const playingRef = useRef(playing)
  const speedRef = useRef(speed)
  const lastFrameRef = useRef<number | null>(null)

  playingRef.current = playing
  speedRef.current = speed

  // Compute viewport state for this demo
  const viewport = demo === 'pi'
    ? piDemoViewport(width, height)
    : tauDemoViewport(width, height)
  const nlState: NumberLineState = {
    center: viewport.center,
    pixelsPerUnit: viewport.pixelsPerUnit,
  }

  // Animation loop
  useEffect(() => {
    let raf = 0
    const tick = (now: number) => {
      if (playingRef.current) {
        const dt = lastFrameRef.current !== null ? now - lastFrameRef.current : 0
        const progressPerMs = 1 / (TOTAL_DURATION_S * 1000)
        setRevealProgress((prev) => Math.min(1, prev + dt * progressPerMs * speedRef.current))
      }
      lastFrameRef.current = now
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  // Render
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = width * dpr
    canvas.height = height * dpr
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`

    const ctx = canvas.getContext('2d')!
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    drawBackground(ctx, nlState, width, height, dark)

    if (demo === 'pi') {
      renderPiOverlay(ctx, nlState, width, height, dark, revealProgress, 1)
    } else {
      renderTauOverlay(ctx, nlState, width, height, dark, revealProgress, 1)
    }
  }, [width, height, dark, revealProgress, demo, nlState.center, nlState.pixelsPerUnit])

  const handleScrub = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setRevealProgress(Number(e.target.value) / 1000)
    setPlaying(false)
    lastFrameRef.current = null
  }, [])

  const togglePlay = useCallback(() => {
    setPlaying((p) => {
      if (!p) lastFrameRef.current = null
      return !p
    })
  }, [])

  const restart = useCallback(() => {
    setRevealProgress(0)
    setPlaying(true)
    lastFrameRef.current = null
  }, [])

  const phaseLabel = getPhaseLabel(revealProgress, demo)

  return (
    <div data-component="circle-construction-story-harness">
      <canvas
        ref={canvasRef}
        data-element="construction-canvas"
        style={{ borderRadius: 8, border: '1px solid #ccc' }}
      />
      <div
        data-element="controls"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          marginTop: 12,
          fontFamily: 'system-ui, sans-serif',
          fontSize: 13,
          color: dark ? '#ccc' : '#333',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={togglePlay} data-action="toggle-play" style={{ width: 60 }}>
            {playing ? 'Pause' : 'Play'}
          </button>
          <button onClick={restart} data-action="restart">
            Restart
          </button>
          <input
            type="range"
            min={0}
            max={1000}
            step={1}
            value={Math.round(revealProgress * 1000)}
            onChange={handleScrub}
            data-element="scrubber"
            style={{ flex: 1 }}
          />
          <span style={{ minWidth: 50, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
            {(revealProgress * 100).toFixed(1)}%
          </span>
        </div>
        <div data-element="phase-label" style={{ opacity: 0.7 }}>
          Phase: <strong>{phaseLabel}</strong>
        </div>
      </div>
    </div>
  )
}

// --- Storybook meta ---

const meta: Meta<HarnessProps> = {
  title: 'Toys/NumberLine/CircleConstruction',
  component: CircleConstructionHarness,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Circle construction animation for the pi and tau demos. ' +
          'Shows the circle being built from a 1-unit segment on the number line: ' +
          'highlight → pivot → sweep → treads → roll.',
      },
    },
  },
  argTypes: {
    width: { control: { type: 'range', min: 400, max: 1200, step: 50 } },
    height: { control: { type: 'range', min: 150, max: 500, step: 10 } },
    dark: { control: 'boolean' },
    speed: { control: { type: 'range', min: 0.25, max: 4, step: 0.25 } },
    autoPlay: { control: 'boolean' },
    demo: { control: 'radio', options: ['pi', 'tau'] },
  },
}

export default meta
type Story = StoryObj<HarnessProps>

export const PiDemo: Story = {
  name: 'Pi (diameter → circle)',
  args: {
    width: 700,
    height: 250,
    dark: false,
    speed: 1,
    autoPlay: true,
    demo: 'pi',
  },
}

export const PiDemoDark: Story = {
  name: 'Pi – Dark Mode',
  args: {
    width: 700,
    height: 250,
    dark: true,
    speed: 1,
    autoPlay: true,
    demo: 'pi',
  },
}

export const TauDemo: Story = {
  name: 'Tau (radius → circle)',
  args: {
    width: 800,
    height: 300,
    dark: false,
    speed: 1,
    autoPlay: true,
    demo: 'tau',
  },
}

export const TauDemoDark: Story = {
  name: 'Tau – Dark Mode',
  args: {
    width: 800,
    height: 300,
    dark: true,
    speed: 1,
    autoPlay: true,
    demo: 'tau',
  },
}

export const Scrubbing: Story = {
  name: 'Paused (for scrubbing)',
  args: {
    width: 700,
    height: 250,
    dark: false,
    speed: 1,
    autoPlay: false,
    demo: 'pi',
  },
}
