'use client'

import { useEffect, useRef } from 'react'
import { css } from '../../../styled-system/css'

const BAR_COUNT = 24
const BAR_GAP = 1
const BAR_WIDTH = 3
const BAR_HEIGHT = 18

/** Segment color: green → yellow → red */
function barColor(i: number, total: number): string {
  const pct = i / total
  if (pct < 0.55) return '#3fb950'
  if (pct < 0.8) return '#d29922'
  return '#f85149'
}

interface MicLevelMeterProps {
  stream: MediaStream | null
}

export function MicLevelMeter({ stream }: MicLevelMeterProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const ctxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !stream) {
      // Clear canvas when no stream
      if (canvas) {
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height)
          // Draw dim bars
          for (let i = 0; i < BAR_COUNT; i++) {
            const x = i * (BAR_WIDTH + BAR_GAP)
            ctx.fillStyle = '#21262d'
            ctx.fillRect(x, 0, BAR_WIDTH, BAR_HEIGHT)
          }
        }
      }
      return
    }

    const audioCtx = new AudioContext()
    ctxRef.current = audioCtx

    const analyser = audioCtx.createAnalyser()
    analyser.fftSize = 256
    analyser.smoothingTimeConstant = 0.7
    analyserRef.current = analyser

    const source = audioCtx.createMediaStreamSource(stream)
    source.connect(analyser)
    sourceRef.current = source

    const dataArray = new Uint8Array(analyser.frequencyBinCount)
    const ctx = canvas.getContext('2d')!
    const dpr = window.devicePixelRatio || 1

    // Scale canvas for high-DPI
    canvas.width = (BAR_COUNT * (BAR_WIDTH + BAR_GAP) - BAR_GAP) * dpr
    canvas.height = BAR_HEIGHT * dpr
    ctx.scale(dpr, dpr)

    function draw() {
      rafRef.current = requestAnimationFrame(draw)
      analyser.getByteFrequencyData(dataArray)

      // Compute RMS level (0-1)
      let sum = 0
      for (let i = 0; i < dataArray.length; i++) {
        const v = dataArray[i] / 255
        sum += v * v
      }
      const rms = Math.sqrt(sum / dataArray.length)
      // Map to bar count with some headroom boost
      const level = Math.min(1, rms * 3.5)
      const litBars = Math.round(level * BAR_COUNT)

      ctx.clearRect(0, 0, BAR_COUNT * (BAR_WIDTH + BAR_GAP), BAR_HEIGHT)

      for (let i = 0; i < BAR_COUNT; i++) {
        const x = i * (BAR_WIDTH + BAR_GAP)
        if (i < litBars) {
          ctx.fillStyle = barColor(i, BAR_COUNT)
          ctx.fillRect(x, 0, BAR_WIDTH, BAR_HEIGHT)
        } else {
          ctx.fillStyle = '#21262d'
          ctx.fillRect(x, 0, BAR_WIDTH, BAR_HEIGHT)
        }
      }
    }

    draw()

    return () => {
      cancelAnimationFrame(rafRef.current)
      source.disconnect()
      analyser.disconnect()
      audioCtx.close()
      ctxRef.current = null
      analyserRef.current = null
      sourceRef.current = null
    }
  }, [stream])

  const totalWidth = BAR_COUNT * (BAR_WIDTH + BAR_GAP) - BAR_GAP

  return (
    <canvas
      ref={canvasRef}
      data-element="mic-level-meter"
      className={css({ flexShrink: 0 })}
      style={{ width: `${totalWidth}px`, height: `${BAR_HEIGHT}px` }}
      title="Microphone input level"
    />
  )
}
