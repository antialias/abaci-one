import type { NumberLineState } from '../types'
import { numberToScreenX } from '../numberLineTicks'
import { primeColorRgba } from './primeColors'
import { smallestPrimeFactor } from './sieve'

// --- Sieve phase timing ---

interface SievePhase {
  factor: number
  startMs: number
  durationMs: number
}

const SIEVE_PHASES: SievePhase[] = [
  { factor: 2, startMs: 4000, durationMs: 5000 }, // slow — kids see each skip
  { factor: 3, startMs: 10000, durationMs: 3000 }, // picking up speed
  { factor: 5, startMs: 14000, durationMs: 2000 }, // faster still
  { factor: 7, startMs: 16500, durationMs: 1500 }, // quick sweep
]

const CELEBRATION_START_MS = 18500

// --- Per-composite animation ---

/** Timing constants for each composite's animation after being marked */
const FLASH_DURATION = 300
const SHAKE_DURATION = 200 // 300–500ms after mark
const FALL_DURATION = 700 // 500–1200ms after mark
const ANIM_TOTAL = FLASH_DURATION + SHAKE_DURATION + FALL_DURATION // 1200ms

interface CompositeAnimState {
  factor: number // which prime factor marked it
  markTimeMs: number // exact dwellElapsedMs when sweep reached it
}

// --- Easing helpers ---

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x))
}

function easeInQuad(t: number): number {
  return t * t
}

function easeOutQuint(t: number): number {
  return 1 - (1 - t) ** 5
}

function decayingSin(t: number, freq: number, decay: number): number {
  return Math.sin(t * freq * Math.PI * 2) * Math.exp(-t * decay)
}

// --- Compute marked composites with exact mark times ---

function computeCompositeStates(
  maxN: number,
  dwellElapsedMs: number
): Map<number, CompositeAnimState> {
  const composites = new Map<number, CompositeAnimState>()

  for (const phase of SIEVE_PHASES) {
    if (dwellElapsedMs < phase.startMs) break
    const p = phase.factor
    const firstMultiple = p * 2
    const sweepRange = maxN - firstMultiple

    if (sweepRange <= 0) continue

    const phaseProgress = clamp01(
      (dwellElapsedMs - phase.startMs) / phase.durationMs
    )
    const maxMultipleReached = firstMultiple + sweepRange * phaseProgress

    for (let m = firstMultiple; m <= Math.min(maxN, maxMultipleReached); m += p) {
      if (composites.has(m)) continue // already marked by earlier factor

      // Compute exact time this composite was reached by the sweep
      const fractionAlongSweep = (m - firstMultiple) / sweepRange
      const markTimeMs = phase.startMs + fractionAlongSweep * phase.durationMs

      composites.set(m, { factor: p, markTimeMs })
    }
  }

  return composites
}

// --- Get active sweep info ---

function getActiveSweep(
  dwellElapsedMs: number,
  maxN: number
): { factor: number; sweepX: number } | null {
  for (let i = SIEVE_PHASES.length - 1; i >= 0; i--) {
    const phase = SIEVE_PHASES[i]
    if (dwellElapsedMs < phase.startMs) continue
    const progress = clamp01(
      (dwellElapsedMs - phase.startMs) / phase.durationMs
    )
    if (progress >= 1) continue
    const firstMultiple = phase.factor * 2
    const sweepValue = firstMultiple + (maxN - firstMultiple) * progress
    return { factor: phase.factor, sweepX: sweepValue }
  }
  return null
}

// --- Number label helper ---

function drawNumberLabel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  value: number,
  factor: number,
  alpha: number,
  scale: number,
  isDark: boolean
): void {
  if (alpha <= 0.01) return
  const fontSize = 10 * scale
  ctx.save()
  ctx.globalAlpha *= alpha
  ctx.font = `bold ${fontSize}px sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'bottom'
  ctx.fillStyle = primeColorRgba(factor, 1, isDark)
  ctx.fillText(String(value), x, y)
  ctx.restore()
}

// --- Main renderer ---

/**
 * Render the animated Sieve of Eratosthenes overlay with "shake out" animation.
 * Each composite flashes its number, shakes, then falls off the number line.
 * Called each frame during the "ancient-trick" prime tour stop.
 */
export function renderSieveOverlay(
  ctx: CanvasRenderingContext2D,
  state: NumberLineState,
  cssWidth: number,
  cssHeight: number,
  isDark: boolean,
  dwellElapsedMs: number,
  tourOpacity: number
): void {
  if (tourOpacity <= 0) return

  ctx.save()
  ctx.globalAlpha = tourOpacity

  const centerY = cssHeight / 2

  // Visible range in number-line units
  const halfRange = cssWidth / (2 * state.pixelsPerUnit)
  const leftValue = state.center - halfRange
  const rightValue = state.center + halfRange
  const minN = Math.max(2, Math.floor(leftValue))
  const maxN = Math.ceil(rightValue)

  // Compute all composite animation states
  const composites = computeCompositeStates(maxN, dwellElapsedMs)

  // --- Layer 0: Celebration axis wash (dims composites drawn by main renderer) ---
  if (dwellElapsedMs >= CELEBRATION_START_MS) {
    const celebrationElapsed = dwellElapsedMs - CELEBRATION_START_MS
    const washRamp = clamp01(celebrationElapsed / 800)
    const washAlpha = 0.4 * washRamp
    ctx.fillStyle = isDark
      ? `rgba(26, 26, 46, ${washAlpha})`
      : `rgba(248, 248, 248, ${washAlpha})`
    ctx.fillRect(0, 0, cssWidth, cssHeight)
  }

  // --- Layer 1: Falling composites (the main show) ---
  for (const [value, anim] of composites) {
    if (value < minN || value > maxN) continue

    const localTime = dwellElapsedMs - anim.markTimeMs
    if (localTime < 0 || localTime > ANIM_TOTAL) continue // not yet marked or already gone

    const baseX = numberToScreenX(value, state.center, state.pixelsPerUnit, cssWidth)
    const discRadius = 4
    const labelOffsetY = -10 // above axis

    // Determine animation phase
    if (localTime <= FLASH_DURATION) {
      // --- Flash phase: pop in ---
      const t = localTime / FLASH_DURATION
      const scale = 1 + 0.5 * easeOutQuint(t)
      const alpha = 0.5 + 0.3 * (1 - t) // brighter at start, settles

      // Colored disc
      ctx.beginPath()
      ctx.arc(baseX, centerY, discRadius * scale, 0, Math.PI * 2)
      ctx.fillStyle = primeColorRgba(anim.factor, alpha, isDark)
      ctx.fill()

      // Number label pops in above
      drawNumberLabel(
        ctx, baseX, centerY + labelOffsetY,
        value, anim.factor, alpha, scale, isDark
      )
    } else if (localTime <= FLASH_DURATION + SHAKE_DURATION) {
      // --- Shake phase: horizontal oscillation ---
      const shakeT = (localTime - FLASH_DURATION) / SHAKE_DURATION
      const shakeOffset = decayingSin(shakeT, 4, 2) * 3 // 3px amplitude, decaying

      const sx = baseX + shakeOffset
      const alpha = 0.6

      ctx.beginPath()
      ctx.arc(sx, centerY, discRadius, 0, Math.PI * 2)
      ctx.fillStyle = primeColorRgba(anim.factor, alpha, isDark)
      ctx.fill()

      drawNumberLabel(
        ctx, sx, centerY + labelOffsetY,
        value, anim.factor, alpha, 1, isDark
      )
    } else {
      // --- Fall phase: gravity drop ---
      const fallT = (localTime - FLASH_DURATION - SHAKE_DURATION) / FALL_DURATION
      const easedFall = easeInQuad(fallT)

      // Fall distance: drop below canvas
      const fallDistance = easedFall * (cssHeight * 0.8)
      const fallY = centerY + fallDistance

      // Horizontal drift: alternates direction based on value parity
      const driftDirection = value % 2 === 0 ? 1 : -1
      const driftX = baseX + driftDirection * easedFall * 8

      // Rotation
      const rotation = driftDirection * easedFall * 0.6 // ~35 degrees max

      // Fade out
      const alpha = 0.6 * (1 - fallT)

      if (alpha > 0.01) {
        ctx.save()
        ctx.translate(driftX, fallY)
        ctx.rotate(rotation)

        // Disc
        ctx.beginPath()
        ctx.arc(0, 0, discRadius, 0, Math.PI * 2)
        ctx.fillStyle = primeColorRgba(anim.factor, alpha, isDark)
        ctx.fill()

        // Label falls with disc
        drawNumberLabel(
          ctx, 0, labelOffsetY,
          value, anim.factor, alpha, 1 - fallT * 0.3, isDark
        )

        ctx.restore()
      }
    }
  }

  // --- Layer 2: Sweep line + factor spotlight ---
  const activeSweep = getActiveSweep(dwellElapsedMs, maxN)
  if (activeSweep) {
    const sweepScreenX = numberToScreenX(
      activeSweep.sweepX,
      state.center,
      state.pixelsPerUnit,
      cssWidth
    )

    // Sweep line (thicker)
    ctx.beginPath()
    ctx.moveTo(sweepScreenX, 0)
    ctx.lineTo(sweepScreenX, cssHeight)
    ctx.strokeStyle = primeColorRgba(activeSweep.factor, 0.3, isDark)
    ctx.lineWidth = 3
    ctx.stroke()
  }

  // Factor spotlight glow
  for (const phase of SIEVE_PHASES) {
    if (dwellElapsedMs < phase.startMs) break
    const phaseProgress = clamp01(
      (dwellElapsedMs - phase.startMs) / phase.durationMs
    )
    if (phaseProgress >= 1) continue

    const factorX = numberToScreenX(
      phase.factor,
      state.center,
      state.pixelsPerUnit,
      cssWidth
    )
    const glowRadius = 20
    const pulsePhase = (dwellElapsedMs / 300) % (Math.PI * 2)
    const pulseAlpha = 0.2 + 0.1 * Math.sin(pulsePhase)

    const gradient = ctx.createRadialGradient(
      factorX, centerY, 0,
      factorX, centerY, glowRadius
    )
    gradient.addColorStop(0, primeColorRgba(phase.factor, pulseAlpha, isDark))
    gradient.addColorStop(1, primeColorRgba(phase.factor, 0, isDark))

    ctx.beginPath()
    ctx.arc(factorX, centerY, glowRadius, 0, Math.PI * 2)
    ctx.fillStyle = gradient
    ctx.fill()
  }

  // --- Layer 3: Prime celebration (after all sweeps) ---
  if (dwellElapsedMs >= CELEBRATION_START_MS) {
    const celebrationElapsed = dwellElapsedMs - CELEBRATION_START_MS
    const celebrationRamp = clamp01(celebrationElapsed / 800)

    for (let n = minN; n <= maxN; n++) {
      if (n < 2) continue
      if (smallestPrimeFactor(n) !== n) continue // not a prime

      const sx = numberToScreenX(n, state.center, state.pixelsPerUnit, cssWidth)

      // Pulsing radial glow
      const glowRadius = 20
      const phaseOffset = n * 0.07
      const pulsePhase = (dwellElapsedMs / 400) + phaseOffset
      const pulseAlpha = (0.25 + 0.15 * Math.sin(pulsePhase)) * celebrationRamp

      const gradient = ctx.createRadialGradient(
        sx, centerY, 0,
        sx, centerY, glowRadius
      )
      gradient.addColorStop(0, primeColorRgba(n, pulseAlpha, isDark))
      gradient.addColorStop(1, primeColorRgba(n, 0, isDark))

      ctx.beginPath()
      ctx.arc(sx, centerY, glowRadius, 0, Math.PI * 2)
      ctx.fillStyle = gradient
      ctx.fill()

      // Prime number labels emerge with staggered entrance
      const staggerDelay = (n - minN) * 30 // 30ms per position
      const labelEntrance = clamp01((celebrationElapsed - staggerDelay) / 400)
      if (labelEntrance > 0) {
        const labelScale = easeOutQuint(labelEntrance)
        const labelAlpha = labelEntrance * celebrationRamp
        drawNumberLabel(
          ctx, sx, centerY - 12,
          n, n, labelAlpha, labelScale, isDark
        )
      }
    }
  }

  ctx.restore()
}
