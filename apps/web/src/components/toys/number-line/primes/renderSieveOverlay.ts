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
  { factor: 7, startMs: 16600, durationMs: 1300 },    // seg 3b: sweep 16600–17900
  { factor: 11, startMs: 18300, durationMs: 800 },    // seg 3c: sweep 18300–19100, tail 19100–20300
]

export const CELEBRATION_START_MS = 20300

/**
 * Fixed maximum N for sweep calculations. All sweep progress, composite mark
 * timing, and hopper position use this constant so they stay in sync with the
 * viewport tracking in getSieveViewportState. Viewport-dependent bounds are
 * only used for visibility culling (deciding which composites to draw).
 */
export const SWEEP_MAX_N = 130

// --- Per-composite animation ---

/** Timing constants for each composite's animation after being marked */
const FLASH_DURATION = 120
const SHAKE_DURATION = 130 // 120–250ms after mark
const FALL_DURATION = 350  // 250–600ms after mark
const ANIM_TOTAL = FLASH_DURATION + SHAKE_DURATION + FALL_DURATION // 600ms

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

// --- Sieve debug tuning (module-level, same pattern as goldenRatioDemo) ---

let sieveTrackingRange = 20
let sieveFollowHops = 15

export function getSieveTrackingRange(): number { return sieveTrackingRange }
export function setSieveTrackingRange(v: number): void { sieveTrackingRange = Math.max(5, v) }
export function getSieveFollowHops(): number { return sieveFollowHops }
export function setSieveFollowHops(v: number): void { sieveFollowHops = Math.max(1, Math.round(v)) }

// --- Compute marked composites with exact mark times ---

function computeCompositeStates(
  maxN: number,
  dwellElapsedMs: number,
  viewportRight?: number
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

    // Once the hopper has left the viewport, mark ALL remaining multiples
    // of this factor as already fallen. This prevents un-eliminated composites
    // from being visible when the viewport zooms out.
    if (viewportRight !== undefined && maxReached > viewportRight) {
      for (let m = firstMultiple; m <= maxN; m += p) {
        if (composites.has(m)) continue
        composites.set(m, { factor: p, markTimeMs: dwellElapsedMs - ANIM_TOTAL - 1 })
      }
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
 * Clamp a sieve viewport so the visible range stays within bounds.
 * Left edge gets a 10% margin so the origin isn't flush with the screen edge.
 * Right edge stays at SWEEP_MAX_N to avoid showing un-sieved composites.
 */
function clampSieveViewport(vp: SieveViewport, cssWidth: number): SieveViewport {
  const halfRange = cssWidth / (2 * vp.pixelsPerUnit)
  let { center, pixelsPerUnit } = vp

  // 10% of visible width as left margin (origin isn't pinned to screen edge)
  const leftMargin = halfRange * 0.2  // 10% of full width = 20% of halfRange

  // If the viewport is wider than the usable range, zoom in to fit
  const usableRange = SWEEP_MAX_N + leftMargin
  if (2 * halfRange > usableRange) {
    pixelsPerUnit = cssWidth / usableRange
    const newHalf = cssWidth / (2 * pixelsPerUnit)
    center = -leftMargin + newHalf
    return { center, pixelsPerUnit }
  }

  // Shift center so edges don't exceed boundaries
  if (center + halfRange > SWEEP_MAX_N) center = SWEEP_MAX_N - halfRange
  if (center - halfRange < -leftMargin) center = -leftMargin + halfRange

  return { center, pixelsPerUnit }
}

/**
 * Map virtual dwell time → interpolated viewport for the sieve animation.
 *
 * During each sweep phase: interpolate start → end using eased progress
 * (same easing as the sweep itself, so slow sweep = zoomed in).
 * During gaps/tails between phases: quick zoom-in to next start.
 * During celebration: zoom out to wide view.
 *
 * All returned viewports are clamped so the visible range stays within
 * [0, SWEEP_MAX_N], preventing un-sieved composites from appearing.
 */
export function getSieveViewportState(
  virtualDwellMs: number,
  keyframes: SievePhaseViewports[],
  celebrationVp: SieveViewport,
  cssWidth = 800,
  maxN = 120
): SieveViewport | null {
  if (keyframes.length === 0) return null

  // --- Factor 2 hopper-tracking ---
  // Follow the hopper closely for the first N hops, showing M integers
  // around it so kids can see skip counting clearly. Tunable via debug panel.
  const followUntilValue = 2 + sieveFollowHops * 2
  const trackingPpu = cssWidth / (sieveTrackingRange * 1.4)

  // Before first phase: hold at factor 2's tracking start (centered on 2)
  const firstPhase = SIEVE_PHASES[0]
  if (virtualDwellMs < firstPhase.startMs) {
    return clampSieveViewport({ center: firstPhase.factor, pixelsPerUnit: trackingPpu }, cssWidth)
  }

  // During celebration: interpolate last end → celebration viewport
  const lastPhase = SIEVE_PHASES[SIEVE_PHASES.length - 1]
  const lastPhaseEnd = lastPhase.startMs + lastPhase.durationMs
  if (virtualDwellMs >= CELEBRATION_START_MS) {
    const celebDuration = 1500
    const celebT = clamp01((virtualDwellMs - CELEBRATION_START_MS) / celebDuration)
    const eased = easeOutCubic(celebT)
    const lastKf = keyframes[keyframes.length - 1]
    return clampSieveViewport(lerpViewport(lastKf.end, celebrationVp, eased), cssWidth)
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

      // Factor 2: track the hopper for the first 15 hops
      if (phase.factor === 2) {
        const sweepValue = phase.factor + (maxN - phase.factor) * easedT
        const followEndEasedT = (followUntilValue - phase.factor) / (maxN - phase.factor)

        if (easedT <= followEndEasedT) {
          // Pure tracking: center on hopper, tight zoom
          return clampSieveViewport({ center: sweepValue, pixelsPerUnit: trackingPpu }, cssWidth)
        }

        // Transition from tracking to regular keyframe viewport
        const transitionRange = 0.15
        const transitionT = clamp01((easedT - followEndEasedT) / transitionRange)
        const eased = easeOutCubic(transitionT)
        const trackVp: SieveViewport = { center: sweepValue, pixelsPerUnit: trackingPpu }
        const regularVp = lerpViewport(kf.start, kf.end, easedT)
        return clampSieveViewport(lerpViewport(trackVp, regularVp, eased), cssWidth)
      }

      return clampSieveViewport(lerpViewport(kf.start, kf.end, easedT), cssWidth)
    }

    // In a gap/tail after this phase but before the next
    const nextPhase = SIEVE_PHASES[i + 1]
    if (nextPhase && virtualDwellMs >= phaseEnd && virtualDwellMs < nextPhase.startMs) {
      const gapDuration = nextPhase.startMs - phaseEnd
      const gapT = clamp01((virtualDwellMs - phaseEnd) / gapDuration)
      const eased = easeOutCubic(gapT)
      const nextKf = keyframes[i + 1]

      // By end of any phase (including factor 2's tracking), the viewport
      // has fully blended to kf.end, so the gap transition is uniform.
      return clampSieveViewport(lerpViewport(kf.end, nextKf.start, eased), cssWidth)
    }
  }

  // After last phase but before celebration: hold at last end, zoom toward celebration
  if (virtualDwellMs >= lastPhaseEnd && virtualDwellMs < CELEBRATION_START_MS) {
    const tailDuration = CELEBRATION_START_MS - lastPhaseEnd
    const tailT = clamp01((virtualDwellMs - lastPhaseEnd) / tailDuration)
    const eased = easeOutCubic(tailT)
    const lastKf = keyframes[keyframes.length - 1]
    return clampSieveViewport(lerpViewport(lastKf.end, celebrationVp, eased), cssWidth)
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
 *
 * Animation is POSITION-BASED, not timestamp-based: progress is derived
 * directly from how far the hopper has traveled past each composite
 * (`hopsPast = (sweepValue - m) / factor`). This guarantees zero latency
 * between the hopper landing on a number and its shake/fall starting,
 * because they share the exact same sweepValue.
 */
export function computeSieveTickTransforms(
  maxN: number,
  dwellElapsedMs: number,
  cssHeight: number,
  viewportRight?: number
): Map<number, SieveTickTransform> {
  const transforms = new Map<number, SieveTickTransform>()
  const alreadyMarked = new Set<number>()

  // Animation thresholds in "hops past" units
  const SHAKE_HOPS = 0.3
  const FALL_HOPS = 0.7
  const TOTAL_HOPS = SHAKE_HOPS + FALL_HOPS // 1.0 hop to fully disappear

  for (const phase of SIEVE_PHASES) {
    if (dwellElapsedMs < phase.startMs) break
    const p = phase.factor
    const firstMultiple = p * 2
    const sweepStart = p
    const sweepRange = SWEEP_MAX_N - sweepStart
    if (sweepRange <= 0) continue

    const linearProgress = clamp01(
      (dwellElapsedMs - phase.startMs) / phase.durationMs
    )
    const sweepValue = sweepStart + sweepRange * sweepEase(linearProgress, p)

    // Once hopper leaves viewport, all remaining multiples are instantly gone
    const hopperOffScreen = viewportRight !== undefined && sweepValue > viewportRight

    for (let m = firstMultiple; m <= maxN; m += p) {
      if (alreadyMarked.has(m)) continue

      // Hopper hasn't reached this composite yet
      if (!hopperOffScreen && sweepValue < m) break // multiples are ascending

      alreadyMarked.add(m)

      // Off-screen bulk elimination: instantly hidden
      if (hopperOffScreen && sweepValue < m) {
        transforms.set(m, { opacity: 0, offsetX: 0, offsetY: 0, rotation: 0 })
        continue
      }

      // How many hops past this composite the hopper has traveled
      const hopsPast = (sweepValue - m) / p

      let opacity = 1
      let offsetX = 0
      let offsetY = 0
      let rotation = 0

      if (hopsPast <= SHAKE_HOPS) {
        // Shake: starts the instant the hopper lands
        const shakeT = hopsPast / SHAKE_HOPS
        offsetX = decayingSin(shakeT, 4, 2) * 3
      } else if (hopsPast <= TOTAL_HOPS) {
        // Fall: gravity drop
        const fallT = (hopsPast - SHAKE_HOPS) / FALL_HOPS
        const easedFall = easeInQuad(fallT)
        const driftDirection = m % 2 === 0 ? 1 : -1
        offsetX = driftDirection * easedFall * 8
        offsetY = easedFall * (cssHeight * 0.8)
        rotation = driftDirection * easedFall * 0.6
        opacity = 0.6 * (1 - fallT)
      } else {
        // Fully hidden
        opacity = 0
      }

      transforms.set(m, { opacity, offsetX, offsetY, rotation })
    }

    // Once this factor's sweep is complete, hide ALL its multiples up to maxN
    // (covers composites beyond SWEEP_MAX_N visible when viewport zooms out)
    if (linearProgress >= 1) {
      for (let m = firstMultiple; m <= maxN; m += p) {
        if (alreadyMarked.has(m)) continue
        alreadyMarked.add(m)
        transforms.set(m, { opacity: 0, offsetX: 0, offsetY: 0, rotation: 0 })
      }
    }
  }

  // Safety net: once all sweeps are complete, hide ANY remaining composite
  // not caught by factors 2,3,5,7 (e.g. 121=11², 169=13²)
  const lastPhase = SIEVE_PHASES[SIEVE_PHASES.length - 1]
  const allSweepsComplete = dwellElapsedMs >= lastPhase.startMs + lastPhase.durationMs
  if (allSweepsComplete) {
    for (let n = 4; n <= maxN; n++) {
      if (transforms.has(n)) continue
      if (smallestPrimeFactor(n) === n) continue // prime — leave alone
      transforms.set(n, { opacity: 0, offsetX: 0, offsetY: 0, rotation: 0 })
    }
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

  // Visible range in number-line units (used only for visibility culling)
  const EDGE_BUFFER = 5
  const halfRange = cssWidth / (2 * state.pixelsPerUnit)
  const leftValue = state.center - halfRange
  const rightValue = state.center + halfRange
  const visibleMin = Math.max(2, Math.floor(leftValue) - EDGE_BUFFER)
  const visibleMax = Math.ceil(rightValue) + EDGE_BUFFER

  // Compute all composite animation states using fixed sweep range
  // (SWEEP_MAX_N keeps timing in sync with viewport tracking)
  const composites = computeCompositeStates(SWEEP_MAX_N, dwellElapsedMs, rightValue)

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
    if (value < visibleMin || value > visibleMax) continue

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

  // --- Layer 2a: Viewport-wide skip arcs ---
  // Repeating arcs across the visible range at the current skip distance.
  // During transitions between factors the skip distance morphs smoothly.
  {
    let skipDist: number | null = null
    let arcColorFactor = 2
    let arcAlpha = 1

    // Determine effective skip distance + color for the current time
    for (let i = 0; i < SIEVE_PHASES.length; i++) {
      const phase = SIEVE_PHASES[i]
      const phaseEnd = phase.startMs + phase.durationMs

      // During a sweep phase
      if (dwellElapsedMs >= phase.startMs && dwellElapsedMs < phaseEnd) {
        skipDist = phase.factor
        arcColorFactor = phase.factor
        break
      }

      // In a gap/tail between phases: morph skip distance
      const nextPhase = SIEVE_PHASES[i + 1]
      if (nextPhase && dwellElapsedMs >= phaseEnd && dwellElapsedMs < nextPhase.startMs) {
        const gapT = clamp01((dwellElapsedMs - phaseEnd) / (nextPhase.startMs - phaseEnd))
        const eased = easeOutCubic(gapT)
        skipDist = lerp(phase.factor, nextPhase.factor, eased)
        arcColorFactor = gapT < 0.5 ? phase.factor : nextPhase.factor
        break
      }
    }

    // Before first phase: fade in arcs at factor 2 spacing
    if (skipDist === null && dwellElapsedMs < SIEVE_PHASES[0].startMs) {
      skipDist = SIEVE_PHASES[0].factor
      arcColorFactor = SIEVE_PHASES[0].factor
      arcAlpha = clamp01(dwellElapsedMs / 1500) // fade in over 1.5s
    }

    // After last phase: fade out during celebration
    if (skipDist === null && dwellElapsedMs >= CELEBRATION_START_MS) {
      arcAlpha = 0
    }
    // Between last phase end and celebration: hold last factor, start fading
    const lastP = SIEVE_PHASES[SIEVE_PHASES.length - 1]
    const lastEnd = lastP.startMs + lastP.durationMs
    if (skipDist === null && dwellElapsedMs >= lastEnd && dwellElapsedMs < CELEBRATION_START_MS) {
      skipDist = lastP.factor
      arcColorFactor = lastP.factor
      arcAlpha = 1 - clamp01((dwellElapsedMs - lastEnd) / (CELEBRATION_START_MS - lastEnd))
    }

    // Draw the repeating arcs
    if (skipDist !== null && arcAlpha > 0.01) {
      const screenSkip = skipDist * state.pixelsPerUnit
      const arcPeak = Math.min(30, Math.max(8, screenSkip * 0.35))

      // Start from the leftmost visible skip boundary
      const startN = Math.floor(leftValue / skipDist) * skipDist
      const endN = rightValue + skipDist

      for (let n = startN; n < endN; n += skipDist) {
        const aFromSX = numberToScreenX(n, state.center, state.pixelsPerUnit, cssWidth)
        const aToSX = numberToScreenX(n + skipDist, state.center, state.pixelsPerUnit, cssWidth)
        if (aToSX < -50 || aFromSX > cssWidth + 50) continue

        ctx.beginPath()
        ctx.moveTo(aFromSX, centerY)
        ctx.quadraticCurveTo((aFromSX + aToSX) / 2, centerY - arcPeak, aToSX, centerY)
        ctx.strokeStyle = primeColorRgba(arcColorFactor, 0.15 * arcAlpha, isDark)
        ctx.lineWidth = 1.5
        ctx.stroke()
      }
    }
  }

  // --- Layer 2b: Skip-counting hopper ---
  // A dot that hops between multiples of the current factor.
  // The hopper "stomps" new composites (full arc) and "skims" already-gone ones (low arc).
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
      const sweepRange = SWEEP_MAX_N - sweepStart
      const sweepValue = sweepStart + sweepRange * progress

      // Which two multiples of p are we between?
      const fromMultiple = Math.max(p, Math.floor(sweepValue / p) * p)
      const toMultiple = fromMultiple + p
      const hopT = clamp01((sweepValue - fromMultiple) / p)

      // Skim vs. stomp: is the landing target already eliminated by an earlier factor?
      const targetAlreadyGone = toMultiple > p && smallestPrimeFactor(toMultiple) < p
      const skimScale = targetAlreadyGone ? 0.12 : 1

      // Convert to screen space
      const fromSX = numberToScreenX(fromMultiple, state.center, state.pixelsPerUnit, cssWidth)
      const toSX = numberToScreenX(toMultiple, state.center, state.pixelsPerUnit, cssWidth)
      const screenDist = toSX - fromSX

      // Arc height: full stomp or low skim
      const fullPeakHeight = Math.min(40, Math.max(12, Math.abs(screenDist) * 0.4))
      const peakHeight = fullPeakHeight * skimScale
      const arcHeight = Math.sin(Math.PI * hopT) * peakHeight

      // Hopper screen position
      const hopperSX = fromSX + hopT * screenDist
      const hopperY = centerY - arcHeight

      // Ghost label for already-gone composites: brief fade-in/out near landing
      if (targetAlreadyGone && hopT > 0.4) {
        const ghostAlpha = Math.sin(Math.PI * clamp01((hopT - 0.4) / 0.6)) * 0.55
        if (ghostAlpha > 0.01) {
          ctx.save()
          ctx.globalAlpha = ghostAlpha * tourOpacity
          ctx.font = 'bold 13px system-ui, sans-serif'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'top'
          ctx.fillStyle = isDark ? '#888' : '#999'
          ctx.fillText(String(toMultiple), toSX, centerY + 5)
          const textWidth = ctx.measureText(String(toMultiple)).width
          ctx.beginPath()
          ctx.moveTo(toSX - textWidth / 2 - 2, centerY + 12)
          ctx.lineTo(toSX + textWidth / 2 + 2, centerY + 12)
          ctx.strokeStyle = isDark ? '#888' : '#999'
          ctx.lineWidth = 1.5
          ctx.stroke()
          ctx.restore()
        }
      }

      // Hopper dot (smaller + translucent for skims)
      const dotRadius = targetAlreadyGone ? 3.5 : 6
      const dotAlpha = targetAlreadyGone ? 0.35 : 0.9
      ctx.beginPath()
      ctx.arc(hopperSX, hopperY, dotRadius, 0, Math.PI * 2)
      ctx.fillStyle = primeColorRgba(p, dotAlpha, isDark)
      ctx.fill()

      // Glow around hopper
      const glowRadius = dotRadius * 2.5
      const glow = ctx.createRadialGradient(
        hopperSX, hopperY, 0, hopperSX, hopperY, glowRadius
      )
      glow.addColorStop(0, primeColorRgba(p, targetAlreadyGone ? 0.2 : 0.35, isDark))
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

    for (let n = visibleMin; n <= visibleMax; n++) {
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
