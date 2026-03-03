/**
 * Canvas rendering for the LCM Hopper experience.
 *
 * Pure function of revealProgress (0-1) — no mutable state.
 * Given any progress value, deterministically computes and draws
 * all hopper positions, landing marks, arcs, and celebration.
 *
 * Follows the same pattern as renderLn2Overlay, renderPiOverlay, etc.
 *
 * Progress phases:
 *   0.00–0.12  Intro — hoppers fade in at position 0
 *   0.12–0.50  Early hopping — first ~50% of hops
 *   0.50–0.70  Pattern hopping — remaining hops, partial overlaps visible
 *   0.70–0.80  Guess zone — slow down, prompt appears (DOM overlay)
 *   0.80–0.90  Reveal — accelerate toward LCM, all converge
 *   0.90–1.00  Celebration — burst, star, emojis grouped at LCM
 */

import type { NumberLineState } from '../types'
import type { ActiveCombo } from './lcmComboGenerator'
import { numberToScreenX } from '../numberLineTicks'

// ── Progress phase boundaries ──────────────────────────────────────────

const INTRO_END = 0.12
const EARLY_HOP_END = 0.5
const PATTERN_HOP_END = 0.7
const GUESS_END = 0.8
const REVEAL_END = 0.9
// 0.90–1.0 = celebration

// ── Module-level combo state (set before startDemo) ────────────────────

let activeCombo: ActiveCombo | null = null

export function setActiveCombo(combo: ActiveCombo | null): void {
  activeCombo = combo
}

export function getActiveCombo(): ActiveCombo | null {
  return activeCombo
}

// ── Guess state (module-level, set by NumberLine tap handler) ──────────

let guessPosition: number | null = null
let guessResult: 'correct' | 'close' | 'wrong' | null = null

export function setGuess(pos: number | null, result: 'correct' | 'close' | 'wrong' | null): void {
  guessPosition = pos
  guessResult = result
}

export function getGuessPosition(): number | null {
  return guessPosition
}

export function getGuessResult(): 'correct' | 'close' | 'wrong' | null {
  return guessResult
}

export function clearGuess(): void {
  guessPosition = null
  guessResult = null
}

// ── Helpers ────────────────────────────────────────────────────────────

function axisY(cssHeight: number): number {
  return cssHeight / 2
}

function mapRange(value: number, inMin: number, inMax: number): number {
  if (inMax <= inMin) return 1
  return Math.max(0, Math.min(1, (value - inMin) / (inMax - inMin)))
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2
}

function arcHeightFn(t: number, maxH: number): number {
  return 4 * t * (1 - t) * maxH
}

function toScreenX(value: number, state: NumberLineState, cssWidth: number): number {
  return numberToScreenX(value, state.center, state.pixelsPerUnit, cssWidth)
}

// ── Hopper state from progress ─────────────────────────────────────────

interface HopperSnapshot {
  emoji: string
  stride: number
  color: string
  /** Current number-line position (ground truth) */
  groundPos: number
  /** If mid-hop: from position */
  hopFrom: number
  /** If mid-hop: to position */
  hopTo: number
  /** 0-1 fraction within current hop (0 = on ground) */
  hopFrac: number
  /** Number of completed hops */
  hopsCompleted: number
  /** Total hops to reach LCM */
  totalHops: number
}

/**
 * Compute hopper states from progress. The hopping spans INTRO_END to REVEAL_END.
 * Within that range, each hopper's continuous hop count is mapped linearly,
 * so at any progress you can compute exactly which hop they're on and how
 * far through it.
 */
function computeHopperSnapshots(combo: ActiveCombo, progress: number): HopperSnapshot[] {
  // Hopping spans from INTRO_END to REVEAL_END
  const hopProgress = mapRange(progress, INTRO_END, REVEAL_END)

  return combo.strides.map((stride, i) => {
    const totalHops = combo.lcm / stride
    // Continuous hop count: 0 at start, totalHops at end
    const continuousHop = hopProgress * totalHops
    const hopsCompleted = Math.min(totalHops, Math.floor(continuousHop))
    const hopFrac = hopsCompleted >= totalHops ? 0 : continuousHop - hopsCompleted

    const groundPos = hopsCompleted * stride
    const hopFrom = groundPos
    const hopTo = Math.min((hopsCompleted + 1) * stride, combo.lcm)

    return {
      emoji: combo.emojis[i],
      stride,
      color: combo.colors[i],
      groundPos,
      hopFrom,
      hopTo,
      hopFrac: hopsCompleted >= totalHops ? 0 : hopFrac,
      hopsCompleted,
      totalHops,
    }
  })
}

/** Get all completed landing positions for the given hopper snapshots */
function computeMarks(
  snapshots: HopperSnapshot[]
): Array<{ position: number; hopperIndices: number[]; isShared: boolean }> {
  const map = new Map<number, number[]>()
  for (let i = 0; i < snapshots.length; i++) {
    const s = snapshots[i]
    for (let pos = s.stride; pos <= s.hopsCompleted * s.stride; pos += s.stride) {
      const arr = map.get(pos)
      if (arr) arr.push(i)
      else map.set(pos, [i])
    }
  }
  return [...map.entries()]
    .map(([position, hopperIndices]) => ({
      position,
      hopperIndices,
      isShared: hopperIndices.length > 1,
    }))
    .sort((a, b) => a.position - b.position)
}

// ── Drawing functions ──────────────────────────────────────────────────

function drawLandingMarks(
  ctx: CanvasRenderingContext2D,
  state: NumberLineState,
  cssWidth: number,
  cssHeight: number,
  marks: ReturnType<typeof computeMarks>,
  snapshots: HopperSnapshot[]
) {
  const y = axisY(cssHeight)

  for (const mark of marks) {
    const sx = toScreenX(mark.position, state, cssWidth)
    if (sx < -20 || sx > cssWidth + 20) continue

    if (mark.isShared) {
      const gradient = ctx.createRadialGradient(sx, y, 0, sx, y, 12)
      gradient.addColorStop(0, 'rgba(255, 215, 0, 0.6)')
      gradient.addColorStop(1, 'rgba(255, 215, 0, 0)')
      ctx.fillStyle = gradient
      ctx.beginPath()
      ctx.arc(sx, y, 12, 0, Math.PI * 2)
      ctx.fill()
    }

    for (const hIdx of mark.hopperIndices) {
      const s = snapshots[hIdx]
      ctx.fillStyle = s.color
      ctx.globalAlpha = mark.isShared ? 0.9 : 0.6
      ctx.beginPath()
      ctx.arc(sx, y - 2 + hIdx * 3, mark.isShared ? 4 : 3, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
  }
}

function drawHopArcs(
  ctx: CanvasRenderingContext2D,
  state: NumberLineState,
  cssWidth: number,
  cssHeight: number,
  snapshots: HopperSnapshot[]
) {
  const y = axisY(cssHeight)

  for (const s of snapshots) {
    if (s.hopFrac <= 0.01 || s.hopFrac >= 0.99) continue

    const fromX = toScreenX(s.hopFrom, state, cssWidth)
    const toX = toScreenX(s.hopTo, state, cssWidth)
    const midX = (fromX + toX) / 2
    const maxH = Math.min(120, Math.max(35, s.stride * 14))

    // Control point at 2*maxH so the Bezier peak reaches maxH
    // (quadratic Bezier peak = half the control point displacement)
    ctx.strokeStyle = s.color
    ctx.globalAlpha = 0.3
    ctx.lineWidth = 2
    ctx.setLineDash([4, 4])
    ctx.beginPath()
    ctx.moveTo(fromX, y)
    ctx.quadraticCurveTo(midX, y - 2 * maxH, toX, y)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.globalAlpha = 1
  }
}

function drawEmojis(
  ctx: CanvasRenderingContext2D,
  state: NumberLineState,
  cssWidth: number,
  cssHeight: number,
  snapshots: HopperSnapshot[],
  introFade: number
) {
  const y = axisY(cssHeight)
  ctx.font = '28px serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  for (const s of snapshots) {
    ctx.globalAlpha = introFade

    if (s.hopFrac > 0.01 && s.hopFrac < 0.99) {
      // In flight — use easeInOut for both x and y so the emoji
      // follows the drawn quadratic Bezier arc exactly
      const t = easeInOut(s.hopFrac)
      const interpPos = s.hopFrom + (s.hopTo - s.hopFrom) * t
      const sx = toScreenX(interpPos, state, cssWidth)
      const maxH = Math.min(120, Math.max(35, s.stride * 14))
      const ay = arcHeightFn(t, maxH)
      ctx.fillText(s.emoji, sx, y - ay - 4)
    } else {
      // On ground
      const sx = toScreenX(s.groundPos, state, cssWidth)
      ctx.fillText(s.emoji, sx, y - 4)
    }
  }
  ctx.globalAlpha = 1
}

function drawCelebration(
  ctx: CanvasRenderingContext2D,
  state: NumberLineState,
  cssWidth: number,
  cssHeight: number,
  combo: ActiveCombo,
  celebrationFrac: number
) {
  if (celebrationFrac <= 0) return

  const lcmVal = combo.lcm
  const sx = toScreenX(lcmVal, state, cssWidth)
  const y = axisY(cssHeight)
  const p = celebrationFrac

  // Expanding multi-colored radial burst
  const radius = p * 80
  const alpha = Math.max(0, 1 - p * 0.7)

  for (let i = 0; i < combo.strides.length; i++) {
    const color = combo.colors[i]
    const angle = (i / combo.strides.length) * Math.PI * 2 + p * Math.PI
    const ox = Math.cos(angle) * radius * 0.3
    const oy = Math.sin(angle) * radius * 0.3
    const gradient = ctx.createRadialGradient(sx + ox, y + oy, 0, sx + ox, y + oy, radius)
    gradient.addColorStop(0, color.replace(')', `, ${alpha * 0.5})`).replace('hsl(', 'hsla('))
    gradient.addColorStop(1, color.replace(')', ', 0)').replace('hsl(', 'hsla('))
    ctx.fillStyle = gradient
    ctx.beginPath()
    ctx.arc(sx + ox, y + oy, radius, 0, Math.PI * 2)
    ctx.fill()
  }

  // Gold glow
  const centerGrad = ctx.createRadialGradient(sx, y, 0, sx, y, radius * 0.5)
  centerGrad.addColorStop(0, `rgba(255, 215, 0, ${alpha * 0.8})`)
  centerGrad.addColorStop(1, 'rgba(255, 215, 0, 0)')
  ctx.fillStyle = centerGrad
  ctx.beginPath()
  ctx.arc(sx, y, radius * 0.5, 0, Math.PI * 2)
  ctx.fill()

  // Star emoji
  if (p > 0.1) {
    const scale = Math.min(1.5, 0.5 + p * 1.5)
    ctx.save()
    ctx.translate(sx, y - 40)
    ctx.scale(scale, scale)
    ctx.font = '32px serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('\u2B50', 0, 0)
    ctx.restore()
  }
}

function drawGuessMarker(
  ctx: CanvasRenderingContext2D,
  state: NumberLineState,
  cssWidth: number,
  cssHeight: number,
  isDark: boolean
) {
  if (guessPosition === null) return

  const sx = toScreenX(guessPosition, state, cssWidth)
  const y = axisY(cssHeight)

  ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)'
  ctx.lineWidth = 2
  ctx.setLineDash([6, 4])
  ctx.beginPath()
  ctx.moveTo(sx, y - 60)
  ctx.lineTo(sx, y + 30)
  ctx.stroke()
  ctx.setLineDash([])

  ctx.font = 'bold 18px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'bottom'
  ctx.fillStyle = isDark ? '#fbbf24' : '#d97706'
  ctx.fillText('?', sx, y - 62)

  ctx.font = '12px sans-serif'
  ctx.fillStyle = isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)'
  ctx.fillText(String(guessPosition), sx, y + 44)

  // Show result feedback
  if (guessResult === 'correct') {
    ctx.font = 'bold 14px sans-serif'
    ctx.fillStyle = '#22c55e'
    ctx.fillText('\u2714', sx + 14, y - 62)
  }
}

// ── Main render function ───────────────────────────────────────────────

/**
 * Pure renderer — same signature as all constant demo overlays.
 * Everything is derived from `revealProgress` + the module-level `activeCombo`.
 */
export function renderLcmHopperOverlay(
  ctx: CanvasRenderingContext2D,
  state: NumberLineState,
  cssWidth: number,
  cssHeight: number,
  isDark: boolean,
  revealProgress: number,
  opacity: number
): void {
  if (opacity <= 0 || !activeCombo) return

  const combo = activeCombo

  ctx.save()
  ctx.globalAlpha = opacity

  // Intro fade: emojis appear during intro phase
  const introFade = mapRange(revealProgress, 0, INTRO_END)

  // Compute hopper positions from progress
  const snapshots = computeHopperSnapshots(combo, revealProgress)
  const marks = computeMarks(snapshots)

  // Draw layers back to front
  if (revealProgress > INTRO_END) {
    drawLandingMarks(ctx, state, cssWidth, cssHeight, marks, snapshots)
    drawHopArcs(ctx, state, cssWidth, cssHeight, snapshots)
  }

  drawEmojis(ctx, state, cssWidth, cssHeight, snapshots, introFade)

  // Celebration burst (progress 0.90-1.0)
  const celebrationFrac = mapRange(revealProgress, REVEAL_END, 1.0)
  drawCelebration(ctx, state, cssWidth, cssHeight, combo, celebrationFrac)

  // Guess marker (visible from guess phase onward)
  if (revealProgress >= EARLY_HOP_END) {
    drawGuessMarker(ctx, state, cssWidth, cssHeight, isDark)
  }

  ctx.restore()
}

// Re-export phase boundaries for narration alignment
export { INTRO_END, EARLY_HOP_END, PATTERN_HOP_END, GUESS_END, REVEAL_END }
