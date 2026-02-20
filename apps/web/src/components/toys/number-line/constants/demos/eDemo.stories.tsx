import { useRef, useEffect, useState, useCallback } from 'react'
import type { Meta, StoryObj } from '@storybook/react'
import { renderEOverlay, eDemoViewport } from './eDemo'
import { numberToScreenX } from '../../numberLineTicks'
import type { NumberLineState } from '../../types'

const TOTAL_DURATION_S = 15

function getPhaseLabel(p: number): string {
  if (p < 0.06) return 'Can the vine reach the star?'
  if (p < 0.14) return 'Day 1: One BIG leap! → 2 (Not quite!)'
  if (p < 0.4) return 'Day 2: Share the work! Hop → rest (bigger vine!) → bigger hop!'
  if (p < 0.47) return 'Day 3: More helpers! → 2.370'
  if (p < 0.53) return 'Day 4: Even more helpers! → 2.441'
  if (p < 0.57) return 'Day 5: More and more! → 2.488'
  if (p < 0.61) return 'Day 6: So many helpers! → 2.522'
  if (p < 0.64) return 'Day 7: A whole team! → 2.566'
  if (p < 0.67) return 'Day 8: A bigger team! → 2.613'
  if (p < 0.7) return 'Day 9: A huge team! → 2.653'
  if (p < 0.73) return 'Day 10: Everybody helps! → 2.692'
  if (p < 0.83) return 'The secret: everyone grows together!'
  if (p < 0.92) return 'Each day, the vine got closer...'
  return 'The perfect growth number: e ≈ 2.718'
}

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

  ctx.beginPath()
  ctx.moveTo(0, centerY)
  ctx.lineTo(cssWidth, centerY)
  ctx.strokeStyle = axisColor
  ctx.lineWidth = 1
  ctx.stroke()

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

    ctx.fillStyle = labelColor
    ctx.textBaseline = 'top'
    ctx.fillText(String(n), sx, centerY + tickH + 4)
  }
}

interface HarnessProps {
  width: number
  height: number
  dark: boolean
  speed: number
  autoPlay: boolean
}

function EDemoHarness({ width, height, dark, speed, autoPlay }: HarnessProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [revealProgress, setRevealProgress] = useState(0)
  const [playing, setPlaying] = useState(autoPlay)
  const playingRef = useRef(playing)
  const speedRef = useRef(speed)
  const lastFrameRef = useRef<number | null>(null)

  playingRef.current = playing
  speedRef.current = speed

  const viewport = eDemoViewport(width, height)
  const nlState: NumberLineState = {
    center: viewport.center,
    pixelsPerUnit: viewport.pixelsPerUnit,
  }

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
    renderEOverlay(ctx, nlState, width, height, dark, revealProgress, 1)
  }, [width, height, dark, revealProgress, nlState.center, nlState.pixelsPerUnit])

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

  return (
    <div data-component="e-demo-story-harness">
      <canvas
        ref={canvasRef}
        data-element="e-demo-canvas"
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
          Phase: <strong>{getPhaseLabel(revealProgress)}</strong>
        </div>
      </div>
    </div>
  )
}

const meta: Meta<HarnessProps> = {
  title: 'Toys/NumberLine/EulerDemo',
  component: EDemoHarness,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          "Euler's number (e) demo: a magic vine grows along the number line. " +
          'Each round, every leaf sprouts new baby leaves (compound growth). More rounds ' +
          "means more growth, but it never reaches past e ≈ 2.718 — nature's growth limit.",
      },
    },
  },
  argTypes: {
    width: { control: { type: 'range', min: 400, max: 1200, step: 50 } },
    height: { control: { type: 'range', min: 150, max: 500, step: 10 } },
    dark: { control: 'boolean' },
    speed: { control: { type: 'range', min: 0.25, max: 4, step: 0.25 } },
    autoPlay: { control: 'boolean' },
  },
}

export default meta
type Story = StoryObj<HarnessProps>

export const EDemo: Story = {
  name: 'Euler (magic vine)',
  args: {
    width: 700,
    height: 280,
    dark: false,
    speed: 1,
    autoPlay: true,
  },
}

export const EDemoDark: Story = {
  name: 'Euler – Dark Mode',
  args: {
    width: 700,
    height: 280,
    dark: true,
    speed: 1,
    autoPlay: true,
  },
}

export const Scrubbing: Story = {
  name: 'Paused (for scrubbing)',
  args: {
    width: 700,
    height: 280,
    dark: false,
    speed: 1,
    autoPlay: false,
  },
}
