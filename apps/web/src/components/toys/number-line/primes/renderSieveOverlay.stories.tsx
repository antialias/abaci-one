import { useRef, useEffect, useState, useCallback } from 'react'
import type { Meta, StoryObj } from '@storybook/react'
import { renderSieveOverlay, computeSieveViewports, getSieveViewportState, computeSieveTickTransforms, SWEEP_MAX_N, COMPOSITION_START_MS } from './renderSieveOverlay'
import { renderNumberLine } from '../renderNumberLine'
import { computeTickMarks } from '../numberLineTicks'
import { computePrimeInfos } from './sieve'
import { DEFAULT_TICK_THRESHOLDS } from '../types'
import type { NumberLineState } from '../types'

// Initial viewport matches the zoomed-in ancient-trick start
const SIEVE_INITIAL_STATE: NumberLineState = { center: 13, pixelsPerUnit: 50 }
const CELEBRATION_VP = { center: 55, pixelsPerUnit: 5 }

const TOTAL_MS = 36000 // enough to see celebration + composition reveal

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

  // Cache sieve viewports once (depends on width)
  const sieveViewportsRef = useRef(computeSieveViewports(width, 120))
  useEffect(() => {
    sieveViewportsRef.current = computeSieveViewports(width, 120)
  }, [width])

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

    // Compute dynamic viewport from sieve animation keyframes
    const vpState = getSieveViewportState(
      elapsedMs,
      sieveViewportsRef.current,
      CELEBRATION_VP,
      width,
      120
    )
    const state: NumberLineState = vpState
      ? { center: vpState.center, pixelsPerUnit: vpState.pixelsPerUnit }
      : SIEVE_INITIAL_STATE

    // Compute sieve tick transforms + prime infos for the real number line
    const storyViewportRight = state.center + width / (2 * state.pixelsPerUnit)
    const sieveTransforms = computeSieveTickTransforms(SWEEP_MAX_N, elapsedMs, height, storyViewportRight)
    const ticks = computeTickMarks(state, width, DEFAULT_TICK_THRESHOLDS)
    const primeInfos = computePrimeInfos(ticks)
    // Smooth ramp: ease-out quad over first 2s
    const rawT = Math.min(1, elapsedMs / 2000)
    const sieveUniformity = rawT * (2 - rawT)

    // Render the real number line with sieve transforms applied
    renderNumberLine(
      ctx, state, width, height, dark, DEFAULT_TICK_THRESHOLDS,
      0, 0, 0.5,
      undefined, undefined, undefined,
      primeInfos, undefined, undefined, undefined,
      undefined, undefined, sieveTransforms, sieveUniformity
    )
    renderSieveOverlay(ctx, state, width, height, dark, elapsedMs, 1)
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

  // Phase label (matches virtual timeline with fall-animation tails between sweeps)
  const phase =
    elapsedMs < 4000
      ? 'Waiting (skip counting intro)'
      : elapsedMs < 9000
        ? 'Skip count by 2s (slow)'
        : elapsedMs < 10200
          ? 'Composites falling...'
          : elapsedMs < 13200
            ? 'Skip count by 3s (faster)'
            : elapsedMs < 14400
              ? 'Composites falling...'
              : elapsedMs < 16200
                ? 'Skip count by 5s (faster!)'
                : elapsedMs < 16600
                  ? 'Composites falling / zoom transition'
                  : elapsedMs < 17900
                    ? 'Skip count by 7s (quick!)'
                    : elapsedMs < 18300
                      ? 'Composites falling...'
                      : elapsedMs < 19100
                        ? 'Skip count by 11s (lightning!)'
                        : elapsedMs < 20300
                          ? 'Composites falling...'
                          : elapsedMs < COMPOSITION_START_MS
                            ? 'Prime celebration!'
                            : 'Composition reveal (2×2×3 = 12)'

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
