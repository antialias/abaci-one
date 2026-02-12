import type { NumberLineState } from '../types'
import { numberToScreenX } from '../numberLineTicks'
import { primeColorRgba } from './primeColors'
import { smallestPrimeFactor } from './sieve'

// --- Sieve phase timing ---

export interface SievePhase {
  factor: number
  startMs: number
  durationMs: number
}

export const SIEVE_PHASES: SievePhase[] = [
  { factor: 2, startMs: 4000, durationMs: 5000 },     // seg 1: sweep 4000–9000, tail 9000–10200
  { factor: 3, startMs: 10200, durationMs: 3000 },    // seg 2: sweep 10200–13200, tail 13200–14400
  { factor: 5, startMs: 14400, durationMs: 1800 },    // seg 3a: sweep 14400–16200
  { factor: 7, startMs: 16600, durationMs: 1300 },    // seg 3b: sweep 16600–17900, tail 17900–19100
]

export const CELEBRATION_START_MS = 19100

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

/** Per-factor sweep easing: slow start → fast finish */
function sweepEase(t: number, factor: number): number {
  // Factors 2, 3: ease-in quad (t²) — 50% of time covers first 25% of range
  // Factors 5, 7: gentler t^1.5 — fewer composites to show
  const power = factor <= 3 ? 2 : 1.5
  return Math.pow(t, power)
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3)
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
    // Sweep starts from the factor itself (skip counting: 2, 4, 6, 8...)
    // but only marks composites at p*2 and beyond (p itself is prime).
    const sweepStart = p
    const firstMultiple = p * 2
    const sweepRange = maxN - sweepStart

    if (sweepRange <= 0) continue

    const linearProgress = clamp01(
      (dwellElapsedMs - phase.startMs) / phase.durationMs
    )
    const phaseProgress = sweepEase(linearProgress, p)
    const maxReached = sweepStart + sweepRange * phaseProgress

    for (let m = firstMultiple; m <= Math.min(maxN, maxReached); m += p) {
      if (composites.has(m)) continue // already marked by earlier factor

      // Compute exact time this composite was reached by the sweep
      // Invert the easing: find the linear t such that sweepEase(t) = fraction
      const fractionAlongSweep = (m - sweepStart) / sweepRange
      // Invert power easing: t = fraction^(1/power)
      const power = p <= 3 ? 2 : 1.5
      const linearFraction = Math.pow(fractionAlongSweep, 1 / power)
      const markTimeMs = phase.startMs + linearFraction * phase.durationMs

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
    const linearProgress = clamp01(
      (dwellElapsedMs - phase.startMs) / phase.durationMs
    )
    if (linearProgress >= 1) continue
    const progress = sweepEase(linearProgress, phase.factor)
    const sweepStart = phase.factor
    const sweepValue = sweepStart + (maxN - sweepStart) * progress
    return { factor: phase.factor, sweepX: sweepValue }
  }
  return null
}

// --- Viewport keyframes for dynamic zoom/pan ---

export interface SieveViewport {
  center: number
  pixelsPerUnit: number
}

export interface SievePhaseViewports {
  factor: number
  start: SieveViewport  // zoomed-in: first ~10 new composites visible
  end: SieveViewport    // zoomed-out: ~40 new composites visible
}

/**
 * Pre-compute per-factor viewport keyframes based on the distribution of
 * newly eliminated composites. For each factor:
 * - `start`: zoomed in so the first ~10 new composites fill the screen
 * - `end`: zoomed out so ~40 new composites are visible
 */
export function computeSieveViewports(
  cssWidth: number,
  maxN: number
): SievePhaseViewports[] {
  // Run the actual sieve to find which composites are NEW for each factor
  const alreadyMarked = new Set<number>()
  const result: SievePhaseViewports[] = []

  for (const phase of SIEVE_PHASES) {
    const p = phase.factor
    const newComposites: number[] = []

    for (let m = p * 2; m <= maxN; m += p) {
      if (!alreadyMarked.has(m)) {
        newComposites.push(m)
        alreadyMarked.add(m)
      }
    }

    if (newComposites.length === 0) {
      // Fallback: shouldn't happen for factors 2,3,5,7 with maxN=120
      result.push({
        factor: p,
        start: { center: p * 5, pixelsPerUnit: cssWidth / (p * 10 * 1.4) },
        end: { center: 55, pixelsPerUnit: 5 },
      })
      continue
    }

    // 10th new composite → zoomed-in range
    const nthZoomedIn = Math.min(10, newComposites.length) - 1
    const zoomedInLast = newComposites[nthZoomedIn]
    const zoomedInRange = zoomedInLast - p
    const zoomedInCenter = p + zoomedInRange / 2
    const zoomedInPpu = cssWidth / (zoomedInRange * 1.4)

    // 40th new composite (or last) → zoomed-out range
    const nthZoomedOut = Math.min(40, newComposites.length) - 1
    const zoomedOutLast = newComposites[nthZoomedOut]
    const zoomedOutRange = zoomedOutLast - p
    const zoomedOutCenter = p + zoomedOutRange / 2
    const zoomedOutPpu = cssWidth / (zoomedOutRange * 1.4)

    result.push({
      factor: p,
      start: { center: zoomedInCenter, pixelsPerUnit: zoomedInPpu },
      end: { center: zoomedOutCenter, pixelsPerUnit: zoomedOutPpu },
    })
  }

  return result
}

/** Logarithmic interpolation for smooth zoom transitions */
function lerpLog(a: number, b: number, t: number): number {
  const logA = Math.log(a)
  const logB = Math.log(b)
  return Math.exp(logA + (logB - logA) * t)
}

/** Linear interpolation */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/** Interpolate between two viewports using linear center + logarithmic ppu */
function lerpViewport(a: SieveViewport, b: SieveViewport, t: number): SieveViewport {
  return {
    center: lerp(a.center, b.center, t),
    pixelsPerUnit: lerpLog(a.pixelsPerUnit, b.pixelsPerUnit, t),
  }
}

/**
 * Map virtual dwell time → interpolated viewport for the sieve animation.
 *
 * During each sweep phase: interpolate start → end using eased progress
 * (same easing as the sweep itself, so slow sweep = zoomed in).
 * During gaps/tails between phases: quick zoom-in to next start.
 * During celebration: zoom out to wide view.
 */
export function getSieveViewportState(
  virtualDwellMs: number,
  keyframes: SievePhaseViewports[],
  celebrationVp: SieveViewport
): SieveViewport | null {
  if (keyframes.length === 0) return null

  // Before first phase: hold at factor 2's start viewport
  const firstPhase = SIEVE_PHASES[0]
  if (virtualDwellMs < firstPhase.startMs) {
    return keyframes[0].start
  }

  // During celebration: interpolate last end → celebration viewport
  const lastPhase = SIEVE_PHASES[SIEVE_PHASES.length - 1]
  const lastPhaseEnd = lastPhase.startMs + lastPhase.durationMs
  if (virtualDwellMs >= CELEBRATION_START_MS) {
    const celebDuration = 1500
    const celebT = clamp01((virtualDwellMs - CELEBRATION_START_MS) / celebDuration)
    const eased = easeOutCubic(celebT)
    const lastKf = keyframes[keyframes.length - 1]
    return lerpViewport(lastKf.end, celebrationVp, eased)
  }

  // Find which phase or gap we're in
  for (let i = 0; i < SIEVE_PHASES.length; i++) {
    const phase = SIEVE_PHASES[i]
    const kf = keyframes[i]
    const phaseEnd = phase.startMs + phase.durationMs

    // During this sweep phase
    if (virtualDwellMs >= phase.startMs && virtualDwellMs < phaseEnd) {
      const linearT = clamp01((virtualDwellMs - phase.startMs) / phase.durationMs)
      const easedT = sweepEase(linearT, phase.factor)
      return lerpViewport(kf.start, kf.end, easedT)
    }

    // In a gap/tail after this phase but before the next
    const nextPhase = SIEVE_PHASES[i + 1]
    if (nextPhase && virtualDwellMs >= phaseEnd && virtualDwellMs < nextPhase.startMs) {
      const gapDuration = nextPhase.startMs - phaseEnd
      const gapT = clamp01((virtualDwellMs - phaseEnd) / gapDuration)
      const eased = easeOutCubic(gapT)
      const nextKf = keyframes[i + 1]
      return lerpViewport(kf.end, nextKf.start, eased)
    }
  }

  // After last phase but before celebration: hold at last end, zoom toward celebration
  if (virtualDwellMs >= lastPhaseEnd && virtualDwellMs < CELEBRATION_START_MS) {
    const tailDuration = CELEBRATION_START_MS - lastPhaseEnd
    const tailT = clamp01((virtualDwellMs - lastPhaseEnd) / tailDuration)
    const eased = easeOutCubic(tailT)
    const lastKf = keyframes[keyframes.length - 1]
    return lerpViewport(lastKf.end, celebrationVp, eased)
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

  // Visible range in number-line units (with buffer so the sweep covers
  // composites at the very edge — avoids a frozen margin where ticks are
  // rendered by the main number line but the sieve sweep hasn't reached).
  const EDGE_BUFFER = 5
  const halfRange = cssWidth / (2 * state.pixelsPerUnit)
  const leftValue = state.center - halfRange
  const rightValue = state.center + halfRange
  const minN = Math.max(2, Math.floor(leftValue) - EDGE_BUFFER)
  const maxN = Math.ceil(rightValue) + EDGE_BUFFER

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

  // --- Layer 0.5: Static numbers already on the line ---
  // All integers >= 2 not yet eliminated by the sweep are rendered as
  // colored discs + labels. Numbers feel "present" from the start —
  // the sweep shakes them out, and primes are the invincible survivors.
  {
    // Fade out during celebration (celebration layer takes over for primes)
    const staticFade = dwellElapsedMs >= CELEBRATION_START_MS
      ? Math.max(0, 1 - (dwellElapsedMs - CELEBRATION_START_MS) / 800)
      : 1

    if (staticFade > 0.01) {
      const showLabels = state.pixelsPerUnit >= 20

      for (let n = Math.max(2, minN); n <= maxN; n++) {
        // Skip numbers being animated or already eliminated
        if (composites.has(n)) continue

        const sx = numberToScreenX(n, state.center, state.pixelsPerUnit, cssWidth)
        if (sx < -10 || sx > cssWidth + 10) continue

        const spf = smallestPrimeFactor(n)
        const isPrime = spf === n
        const colorFactor = isPrime ? n : spf
        const alpha = 0.5 * staticFade

        // Disc on axis
        ctx.beginPath()
        ctx.arc(sx, centerY, 3, 0, Math.PI * 2)
        ctx.fillStyle = primeColorRgba(colorFactor, alpha, isDark)
        ctx.fill()

        // Label above axis (only when zoomed in enough to read)
        if (showLabels) {
          drawNumberLabel(ctx, sx, centerY - 10, n, colorFactor, alpha, 1, isDark)
        }
      }
    }
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
