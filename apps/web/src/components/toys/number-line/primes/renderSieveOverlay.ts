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

// --- Per-tick transforms for main renderer ---

export interface SieveTickTransform {
  opacity: number    // 0 = hidden, 1 = normal
  offsetX: number    // horizontal shake (px)
  offsetY: number    // vertical fall (px)
  rotation: number   // radians
}

/**
 * Compute per-tick transforms for the main renderer during the sieve animation.
 * Composites shake and fall off; primes are unaffected (not in the map).
 */
export function computeSieveTickTransforms(
  maxN: number,
  dwellElapsedMs: number,
  cssHeight: number
): Map<number, SieveTickTransform> {
  const composites = computeCompositeStates(maxN, dwellElapsedMs)
  const transforms = new Map<number, SieveTickTransform>()

  for (const [value, anim] of composites) {
    const localTime = dwellElapsedMs - anim.markTimeMs
    if (localTime < 0) continue // not yet marked

    let opacity = 1
    let offsetX = 0
    let offsetY = 0
    let rotation = 0

    if (localTime <= FLASH_DURATION) {
      // Flash phase: tick stays put, overlay draws glow ring
      opacity = 1
    } else if (localTime <= FLASH_DURATION + SHAKE_DURATION) {
      // Shake phase: horizontal oscillation
      const shakeT = (localTime - FLASH_DURATION) / SHAKE_DURATION
      offsetX = decayingSin(shakeT, 4, 2) * 3
    } else if (localTime <= ANIM_TOTAL) {
      // Fall phase: gravity drop
      const fallT = (localTime - FLASH_DURATION - SHAKE_DURATION) / FALL_DURATION
      const easedFall = easeInQuad(fallT)
      const driftDirection = value % 2 === 0 ? 1 : -1
      offsetX = driftDirection * easedFall * 8
      offsetY = easedFall * (cssHeight * 0.8)
      rotation = driftDirection * easedFall * 0.6
      opacity = 0.6 * (1 - fallT)
    } else {
      // After fall: fully hidden
      opacity = 0
    }

    transforms.set(value, { opacity, offsetX, offsetY, rotation })
  }

  return transforms
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

  // --- Layer 1: Flash glow ring on composites as sweep reaches them ---
  // The main renderer handles tick+label transforms (shake, fall, hide).
  // The overlay only draws the glow marking effect during the flash phase.
  for (const [value, anim] of composites) {
    if (value < minN || value > maxN) continue

    const localTime = dwellElapsedMs - anim.markTimeMs
    if (localTime < 0 || localTime > FLASH_DURATION) continue

    const baseX = numberToScreenX(value, state.center, state.pixelsPerUnit, cssWidth)
    const t = localTime / FLASH_DURATION
    const glowRadius = 12 + 8 * easeOutQuint(t)
    const glowAlpha = (0.5 + 0.3 * (1 - t))

    const gradient = ctx.createRadialGradient(
      baseX, centerY, 0,
      baseX, centerY, glowRadius
    )
    gradient.addColorStop(0, primeColorRgba(anim.factor, glowAlpha, isDark))
    gradient.addColorStop(1, primeColorRgba(anim.factor, 0, isDark))

    ctx.beginPath()
    ctx.arc(baseX, centerY, glowRadius, 0, Math.PI * 2)
    ctx.fillStyle = gradient
    ctx.fill()
  }

  // --- Layer 2: Skip-counting hopper + factor spotlight ---
  // A dot arcs between multiples of the current factor, visualizing skip
  // counting. When it lands on a composite, the flash/shake/fall triggers.
  {
    let hopperPhase: SievePhase | null = null
    for (let i = SIEVE_PHASES.length - 1; i >= 0; i--) {
      const phase = SIEVE_PHASES[i]
      if (dwellElapsedMs < phase.startMs) continue
      const lp = clamp01((dwellElapsedMs - phase.startMs) / phase.durationMs)
      if (lp >= 1) continue
      hopperPhase = phase
      break
    }

    if (hopperPhase) {
      const p = hopperPhase.factor
      const linearProgress = clamp01(
        (dwellElapsedMs - hopperPhase.startMs) / hopperPhase.durationMs
      )
      const progress = sweepEase(linearProgress, p)
      const sweepStart = p
      const sweepRange = maxN - sweepStart
      const sweepValue = sweepStart + sweepRange * progress

      // Which two multiples of p are we between?
      const fromMultiple = Math.max(p, Math.floor(sweepValue / p) * p)
      const toMultiple = fromMultiple + p
      const hopT = clamp01((sweepValue - fromMultiple) / p)

      // Convert to screen space
      const fromSX = numberToScreenX(fromMultiple, state.center, state.pixelsPerUnit, cssWidth)
      const toSX = numberToScreenX(toMultiple, state.center, state.pixelsPerUnit, cssWidth)
      const screenDist = toSX - fromSX

      // Arc height scales with screen distance of the hop
      const peakHeight = Math.min(40, Math.max(12, Math.abs(screenDist) * 0.4))
      const arcHeight = Math.sin(Math.PI * hopT) * peakHeight

      // Hopper screen position
      const hopperSX = fromSX + hopT * screenDist
      const hopperY = centerY - arcHeight

      // Draw fading trail arcs for recent completed hops
      const currentHopIndex = Math.floor(sweepValue / p)
      for (let k = Math.max(1, currentHopIndex - 3); k < currentHopIndex; k++) {
        const tFrom = k * p
        const tTo = (k + 1) * p
        const age = currentHopIndex - k
        const trailAlpha = 0.12 * (1 - age / 4)
        if (trailAlpha <= 0.01) continue

        const tFromSX = numberToScreenX(tFrom, state.center, state.pixelsPerUnit, cssWidth)
        const tToSX = numberToScreenX(tTo, state.center, state.pixelsPerUnit, cssWidth)
        const tDist = tToSX - tFromSX
        if (Math.abs(tDist) < 3) continue

        const tPeak = Math.min(40, Math.max(12, Math.abs(tDist) * 0.4))
        ctx.beginPath()
        ctx.moveTo(tFromSX, centerY)
        ctx.quadraticCurveTo((tFromSX + tToSX) / 2, centerY - tPeak, tToSX, centerY)
        ctx.strokeStyle = primeColorRgba(p, trailAlpha, isDark)
        ctx.lineWidth = 1
        ctx.stroke()
      }

      // Dotted arc showing current hop path
      if (Math.abs(screenDist) > 3) {
        ctx.beginPath()
        ctx.moveTo(fromSX, centerY)
        ctx.quadraticCurveTo((fromSX + toSX) / 2, centerY - peakHeight, toSX, centerY)
        ctx.strokeStyle = primeColorRgba(p, 0.2, isDark)
        ctx.lineWidth = 1.5
        ctx.setLineDash([4, 4])
        ctx.stroke()
        ctx.setLineDash([])
      }

      // Hopper dot
      const dotRadius = 6
      ctx.beginPath()
      ctx.arc(hopperSX, hopperY, dotRadius, 0, Math.PI * 2)
      ctx.fillStyle = primeColorRgba(p, 0.9, isDark)
      ctx.fill()

      // Glow around hopper
      const glowRadius = dotRadius * 2.5
      const glow = ctx.createRadialGradient(
        hopperSX, hopperY, 0, hopperSX, hopperY, glowRadius
      )
      glow.addColorStop(0, primeColorRgba(p, 0.35, isDark))
      glow.addColorStop(1, primeColorRgba(p, 0, isDark))
      ctx.beginPath()
      ctx.arc(hopperSX, hopperY, glowRadius, 0, Math.PI * 2)
      ctx.fillStyle = glow
      ctx.fill()
    }
  }

  // Factor spotlight glow (pulsing highlight on the prime factor being used)
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

      // Prime labels are drawn by the main renderer — no overlay labels needed
    }
  }

  ctx.restore()
}
