import { useRef, useEffect, useState, useCallback } from 'react'
import type { Meta, StoryObj } from '@storybook/react'
import { renderSieveOverlay } from './renderSieveOverlay'
import { numberToScreenX } from '../numberLineTicks'
import { smallestPrimeFactor } from './sieve'
import { primeColorRgba } from './primeColors'
import type { NumberLineState } from '../types'

// Match the viewport from the updated ancient-trick tour stop
const SIEVE_STATE: NumberLineState = { center: 55, pixelsPerUnit: 5 }

const TOTAL_MS = 24000 // enough to see celebration phase

/**
 * Draw a minimal number line background so the sieve overlay has context.
 * Just an axis line + integer tick marks with labels, colored by SPF.
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
  const labelColor = isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)'

  // Clear
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
  const minN = Math.max(1, Math.floor(state.center - halfRange))
  const maxN = Math.ceil(state.center + halfRange)

  ctx.font = '9px sans-serif'
  ctx.textAlign = 'center'

  // At low ppu (e.g. 5), label every 5th or 10th number to avoid crowding
  const labelEvery = state.pixelsPerUnit < 15 ? 10 : state.pixelsPerUnit < 30 ? 5 : 1

  for (let n = minN; n <= maxN; n++) {
    const sx = numberToScreenX(n, state.center, state.pixelsPerUnit, cssWidth)

    // Tick line — skip minor ticks at very low ppu to avoid a solid bar
    if (state.pixelsPerUnit < 8 && n % 5 !== 0) continue

    const tickH = n % 5 === 0 ? 10 : 6
    ctx.beginPath()
    ctx.moveTo(sx, centerY - tickH)
    ctx.lineTo(sx, centerY + tickH)

    if (n >= 2) {
      const spf = smallestPrimeFactor(n)
      const isPrime = spf === n
      ctx.strokeStyle = isPrime
        ? primeColorRgba(n, isDark ? 0.9 : 0.8, isDark)
        : primeColorRgba(spf, isDark ? 0.5 : 0.4, isDark)
      ctx.lineWidth = isPrime ? 2 : 1
    } else {
      ctx.strokeStyle = axisColor
      ctx.lineWidth = 1
    }
    ctx.stroke()

    // Label — show primes + every Nth number
    const spf = n >= 2 ? smallestPrimeFactor(n) : 0
    const isPrime = n >= 2 && spf === n
    if (n >= 2 && (isPrime || n % labelEvery === 0)) {
      ctx.fillStyle = labelColor
      ctx.fillText(String(n), sx, centerY + tickH + 12)
    }
  }
}

// --- Storybook harness ---

interface HarnessProps {
  width: number
  height: number
  dark: boolean
  speed: number
  autoPlay: boolean
}

function SieveHarness({ width, height, dark, speed, autoPlay }: HarnessProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [playing, setPlaying] = useState(autoPlay)
  const playingRef = useRef(playing)
  const speedRef = useRef(speed)
  const lastFrameRef = useRef<number | null>(null)

  playingRef.current = playing
  speedRef.current = speed

  // Animation loop
  useEffect(() => {
    let raf = 0
    const tick = (now: number) => {
      if (playingRef.current) {
        const dt = lastFrameRef.current !== null ? now - lastFrameRef.current : 0
        setElapsedMs((prev) => Math.min(prev + dt * speedRef.current, TOTAL_MS))
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

    drawBackground(ctx, SIEVE_STATE, width, height, dark)
    renderSieveOverlay(ctx, SIEVE_STATE, width, height, dark, elapsedMs, 1)
  }, [width, height, dark, elapsedMs])

  const handleScrub = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const ms = Number(e.target.value)
    setElapsedMs(ms)
    setPlaying(false)
    lastFrameRef.current = null
  }, [])

  const togglePlay = useCallback(() => {
    setPlaying((p) => {
      if (!p) lastFrameRef.current = null // reset dt on resume
      return !p
    })
  }, [])

  const restart = useCallback(() => {
    setElapsedMs(0)
    setPlaying(true)
    lastFrameRef.current = null
  }, [])

  // Phase label
  const phase =
    elapsedMs < 4000
      ? 'Waiting (skip counting intro)'
      : elapsedMs < 9000
        ? 'Skip count by 2s (slow)'
        : elapsedMs < 10000
          ? 'Pause between 2 and 3'
          : elapsedMs < 13000
            ? 'Skip count by 3s (faster)'
            : elapsedMs < 14000
              ? 'Pause between 3 and 5'
              : elapsedMs < 16000
                ? 'Skip count by 5s (faster!)'
                : elapsedMs < 16500
                  ? 'Pause between 5 and 7'
                  : elapsedMs < 18000
                    ? 'Skip count by 7s (quick!)'
                    : 'Prime celebration!'

  return (
    <div data-component="sieve-story-harness">
      <canvas
        ref={canvasRef}
        data-element="sieve-canvas"
        style={{ borderRadius: 8, border: '1px solid #ccc' }}
      />
      <div
        data-element="controls"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          marginTop: 12,
          fontFamily: 'sans-serif',
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
            max={TOTAL_MS}
            step={50}
            value={elapsedMs}
            onChange={handleScrub}
            data-element="scrubber"
            style={{ flex: 1 }}
          />
          <span style={{ minWidth: 60, textAlign: 'right' }}>
            {(elapsedMs / 1000).toFixed(1)}s
          </span>
        </div>
        <div data-element="phase-label" style={{ opacity: 0.7 }}>
          Phase: <strong>{phase}</strong>
        </div>
      </div>
    </div>
  )
}

// --- Storybook meta ---

const meta: Meta<HarnessProps> = {
  title: 'Toys/NumberLine/SieveOverlay',
  component: SieveHarness,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Animated Sieve of Eratosthenes overlay for the "ancient-trick" prime tour stop. ' +
          'Factors 2, 3, 5, 7 sweep across the visible range marking composites, ' +
          'then primes celebrate as survivors.',
      },
    },
  },
  argTypes: {
    width: { control: { type: 'range', min: 400, max: 1200, step: 50 } },
    height: { control: { type: 'range', min: 80, max: 300, step: 10 } },
    dark: { control: 'boolean' },
    speed: { control: { type: 'range', min: 0.25, max: 4, step: 0.25 } },
    autoPlay: { control: 'boolean' },
  },
}

export default meta
type Story = StoryObj<HarnessProps>

export const Default: Story = {
  args: {
    width: 800,
    height: 150,
    dark: false,
    speed: 1,
    autoPlay: true,
  },
}

export const DarkMode: Story = {
  name: 'Dark Mode',
  args: {
    width: 800,
    height: 150,
    dark: true,
    speed: 1,
    autoPlay: true,
  },
}

export const Mobile: Story = {
  name: 'Mobile (400px)',
  args: {
    width: 400,
    height: 120,
    dark: false,
    speed: 1,
    autoPlay: true,
  },
}

export const Scrubbing: Story = {
  name: 'Paused (for scrubbing)',
  args: {
    width: 800,
    height: 150,
    dark: false,
    speed: 1,
    autoPlay: false,
  },
}
