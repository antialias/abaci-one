import type { NumberLineState } from '../../types'
import { numberToScreenX } from '../../numberLineTicks'

/**
 * e Demo: "The Magic Vine"
 *
 * A vine grows along the number line. Each growth round, every part of the
 * vine (including new growth!) sprouts its own new leaves. This is compound
 * growth: new leaves immediately start growing their own baby leaves.
 *
 * For n growth rounds, the vine reaches (1+1/n)^n. As n → ∞ the vine
 * grows continuously and reaches exactly e ≈ 2.718 — nature's growth limit.
 *
 * Visual: the vine stem lies on the number line axis. Each round, buds
 * pulse along the entire vine, then a tendril arcs upward from the vine's
 * tip and lands further along the line, extending the vine. A dashed amber
 * "growth boundary" line at e shows the limit the vine can never pass.
 */

// ── Utilities ──────────────────────────────────────────────────────────

function mapRange(v: number, s: number, e: number): number {
  if (v <= s) return 0
  if (v >= e) return 1
  return (v - s) / (e - s)
}

function smoothstep(t: number): number {
  const c = Math.max(0, Math.min(1, t))
  return c * c * (3 - 2 * c)
}

function easeOut(t: number): number {
  const c = Math.max(0, Math.min(1, t))
  return 1 - Math.pow(1 - c, 3)
}

// ── Viewport ───────────────────────────────────────────────────────────

export function eDemoViewport(cssWidth: number, cssHeight: number) {
  const center = Math.E / 2
  const ppu = Math.min(cssWidth * 0.85 / (Math.E + 0.8), cssHeight * 0.30)
  return { center, pixelsPerUnit: ppu }
}

// ── Compound growth ────────────────────────────────────────────────────

function compoundResult(n: number): number {
  return Math.pow(1 + 1 / n, n)
}

function compoundAfterSteps(n: number, steps: number): number {
  return Math.pow(1 + 1 / n, steps)
}

// ── Phase timing ───────────────────────────────────────────────────────

interface Level { n: number; startP: number; endP: number }

const LEVELS: Level[] = [
  { n: 1, startP: 0.06, endP: 0.19 },
  { n: 2, startP: 0.19, endP: 0.35 },
  { n: 3, startP: 0.35, endP: 0.45 },
  { n: 4, startP: 0.45, endP: 0.55 },
  { n: 8, startP: 0.55, endP: 0.64 },
  { n: 16, startP: 0.64, endP: 0.71 },
]

const SMOOTH_START = 0.71
const SMOOTH_END = 0.82
const CONVERGE_START = 0.82
const CONVERGE_END = 0.92
const LABELS_START = 0.92

// ── Colors ─────────────────────────────────────────────────────────────

function vineCol(isDark: boolean) { return isDark ? '#22c55e' : '#16a34a' }
function vineBright(isDark: boolean) { return isDark ? '#86efac' : '#4ade80' }
function budCol(isDark: boolean) { return isDark ? '#a3e635' : '#65a30d' }
function boundaryCol(isDark: boolean) { return isDark ? '#fbbf24' : '#d97706' }

// ── Labels ──────────────────────────────────────────────────────────────

/** Kid-friendly fraction string for 1/n */
function fractionStr(n: number): string {
  if (n === 1) return ''
  if (n === 2) return '½'
  if (n === 3) return '⅓'
  if (n === 4) return '¼'
  if (n === 8) return '⅛'
  return `1/${n}`
}

// ── Drawing helpers ────────────────────────────────────────────────────

/** Vine stem thickness scales with viewport */
function stemW(ppu: number): number {
  return Math.max(7, Math.min(13, ppu * 0.09))
}

/** Draw the vine stem from NL `start` to `end` on the axis. */
function drawStem(
  ctx: CanvasRenderingContext2D,
  toX: (v: number) => number,
  axisY: number,
  start: number,
  end: number,
  ppu: number,
  isDark: boolean,
  alpha: number,
  bright = false
) {
  const x0 = toX(start)
  const x1 = toX(end)
  if (x1 - x0 < 1) return

  ctx.beginPath()
  ctx.moveTo(x0, axisY)
  ctx.lineTo(x1, axisY)
  ctx.strokeStyle = bright ? vineBright(isDark) : vineCol(isDark)
  ctx.lineWidth = stemW(ppu)
  ctx.lineCap = 'round'
  ctx.globalAlpha = alpha
  ctx.stroke()
}

/** Draw small alternating leaves along the vine. */
function drawLeaves(
  ctx: CanvasRenderingContext2D,
  toX: (v: number) => number,
  axisY: number,
  start: number,
  end: number,
  ppu: number,
  isDark: boolean,
  alpha: number
) {
  const x0 = toX(start)
  const x1 = toX(end)
  const len = x1 - x0
  if (len < 20) return

  const sw = stemW(ppu)
  const spacing = Math.max(18, Math.min(35, len / 10))
  const leafLen = Math.max(5, Math.min(10, sw * 0.9))

  ctx.strokeStyle = vineCol(isDark)
  ctx.lineWidth = Math.max(1.2, sw * 0.18)
  ctx.lineCap = 'round'
  ctx.globalAlpha = alpha * 0.7

  let side = 1
  for (let x = x0 + spacing * 0.6; x < x1 - spacing * 0.3; x += spacing) {
    const base = axisY - side * sw * 0.45
    const tipX = x + leafLen * 0.5
    const tipY = base - side * leafLen

    ctx.beginPath()
    ctx.moveTo(x, base)
    ctx.quadraticCurveTo(x + leafLen * 0.12, tipY, tipX, tipY)
    ctx.stroke()

    // Tiny leaf blade fill
    ctx.beginPath()
    ctx.moveTo(x, base)
    ctx.quadraticCurveTo(x + leafLen * 0.12, tipY, tipX, tipY)
    ctx.quadraticCurveTo(x + leafLen * 0.35, base - side * leafLen * 0.3, x, base)
    ctx.fillStyle = vineCol(isDark)
    ctx.globalAlpha = alpha * 0.25
    ctx.fill()
    ctx.globalAlpha = alpha * 0.7

    side *= -1
  }
}

/**
 * Draw a tendril arc from startNL to endNL, curving upward like a vine
 * shoot unfurling. `progress` 0→1 controls how much is drawn.
 */
function drawTendril(
  ctx: CanvasRenderingContext2D,
  toX: (v: number) => number,
  axisY: number,
  startNL: number,
  endNL: number,
  progress: number,
  ppu: number,
  isDark: boolean,
  alpha: number
) {
  if (progress <= 0) return

  const sx = toX(startNL)
  const ex = toX(endNL)
  const w = ex - sx
  if (w < 2) return

  // Peak: proportional to width, capped
  const peakH = Math.min(45, Math.max(14, w * 0.55))
  // Control point — slightly past midpoint for an organic lean-forward
  const cpx = sx + w * 0.45
  const cpy = axisY - peakH

  const segments = 40
  const drawTo = Math.ceil(easeOut(progress) * segments)

  ctx.beginPath()
  for (let i = 0; i <= drawTo; i++) {
    const t = i / segments
    const mt = 1 - t
    const bx = mt * mt * sx + 2 * mt * t * cpx + t * t * ex
    const by = mt * mt * axisY + 2 * mt * t * cpy + t * t * axisY

    if (i === 0) ctx.moveTo(bx, by)
    else ctx.lineTo(bx, by)
  }

  ctx.strokeStyle = vineBright(isDark)
  ctx.lineWidth = stemW(ppu) * 0.65
  ctx.lineCap = 'round'
  ctx.globalAlpha = alpha
  ctx.stroke()

  // Growing tip bud
  if (progress > 0.05 && progress < 0.97) {
    const t = Math.min(1, drawTo / segments)
    const mt = 1 - t
    const tipX = mt * mt * sx + 2 * mt * t * cpx + t * t * ex
    const tipY = mt * mt * axisY + 2 * mt * t * cpy + t * t * axisY
    const r = Math.max(2.5, stemW(ppu) * 0.35)

    ctx.beginPath()
    ctx.arc(tipX, tipY, r, 0, Math.PI * 2)
    ctx.fillStyle = budCol(isDark)
    ctx.globalAlpha = alpha * 0.9
    ctx.fill()
  }
}

/** Draw buds pulsing along the vine (left-to-right ripple). */
function drawBuds(
  ctx: CanvasRenderingContext2D,
  toX: (v: number) => number,
  axisY: number,
  vineEnd: number,
  pulseP: number,
  ppu: number,
  isDark: boolean,
  alpha: number
) {
  if (pulseP <= 0 || pulseP >= 1) return

  const x0 = toX(0)
  const x1 = toX(vineEnd)
  const len = x1 - x0
  const count = Math.max(3, Math.min(14, Math.floor(len / 25)))
  const sw = stemW(ppu)
  const budR = Math.max(2, sw * 0.28)

  for (let i = 0; i <= count; i++) {
    const frac = i / count
    const bx = x0 + frac * len

    // Ripple delay: left buds appear first
    const delay = frac * 0.3
    const bp = mapRange(pulseP, delay, delay + 0.45)
    if (bp <= 0 || bp >= 1) continue

    const pulse = Math.sin(bp * Math.PI)
    const r = budR * pulse

    ctx.beginPath()
    ctx.arc(bx, axisY - sw * 0.5 - r - 2, r, 0, Math.PI * 2)
    ctx.fillStyle = budCol(isDark)
    ctx.globalAlpha = alpha * pulse * 0.85
    ctx.fill()
  }
}

/** Small tick mark for completed levels. */
function drawGhostTick(
  ctx: CanvasRenderingContext2D,
  sx: number,
  axisY: number,
  color: string,
  alpha: number,
  halfH = 7
) {
  ctx.beginPath()
  ctx.moveTo(sx, axisY - halfH)
  ctx.lineTo(sx, axisY + halfH)
  ctx.strokeStyle = color
  ctx.lineWidth = 1.5
  ctx.globalAlpha = alpha
  ctx.setLineDash([])
  ctx.stroke()
}

// ── Main render ────────────────────────────────────────────────────────

export function renderEOverlay(
  ctx: CanvasRenderingContext2D,
  state: NumberLineState,
  cssWidth: number,
  cssHeight: number,
  isDark: boolean,
  revealProgress: number,
  opacity: number
): void {
  if (opacity <= 0) return

  const ppu = state.pixelsPerUnit
  const axisY = cssHeight / 2
  const toX = (v: number) => numberToScreenX(v, state.center, ppu, cssWidth)

  const bc = boundaryCol(isDark)
  const vc = vineCol(isDark)
  const textColor = isDark ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.8)'
  const subtextColor = isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)'

  ctx.save()

  // ── Growth boundary: dashed amber line at e ──
  const bAlpha =
    mapRange(revealProgress, 0.10, 0.40) * 0.2 +
    mapRange(revealProgress, CONVERGE_START, CONVERGE_END) * 0.6
  if (bAlpha > 0) {
    const eSx = toX(Math.E)
    ctx.beginPath()
    ctx.moveTo(eSx, axisY - cssHeight * 0.3)
    ctx.lineTo(eSx, axisY + 10)
    ctx.strokeStyle = bc
    ctx.lineWidth = 1.5
    ctx.globalAlpha = opacity * bAlpha
    ctx.setLineDash([5, 4])
    ctx.stroke()
    ctx.setLineDash([])

    // "growth limit" label above the line
    if (revealProgress > 0.15 && revealProgress < LABELS_START) {
      const fs = Math.max(9, Math.min(11, ppu * 0.09))
      ctx.font = `${fs}px system-ui, sans-serif`
      ctx.fillStyle = bc
      ctx.textAlign = 'center'
      ctx.textBaseline = 'bottom'
      ctx.globalAlpha = opacity * bAlpha * 0.7
      ctx.fillText('growth limit', eSx, axisY - cssHeight * 0.3 - 3)
    }
  }

  // ── Ghost ticks from completed levels ──
  for (const level of LEVELS) {
    if (revealProgress < level.endP) break
    const val = compoundResult(level.n)
    const age = mapRange(revealProgress, level.endP, level.endP + 0.15)
    drawGhostTick(ctx, toX(val), axisY, vc, opacity * Math.max(0.3, 1 - age * 0.4))
  }

  // ── Phase 1: Seed vine at length 1 ──
  if (revealProgress < 0.08) {
    const fi = smoothstep(mapRange(revealProgress, 0, 0.04))
    drawStem(ctx, toX, axisY, 0, 1, ppu, isDark, opacity * fi)
    drawLeaves(ctx, toX, axisY, 0, 1, ppu, isDark, opacity * fi)

    // "start with length 1" label
    if (fi > 0.3) {
      const fs = Math.max(11, Math.min(14, ppu * 0.12))
      ctx.font = `${fs}px system-ui, sans-serif`
      ctx.fillStyle = textColor
      ctx.textAlign = 'center'
      ctx.textBaseline = 'bottom'
      ctx.globalAlpha = opacity * fi * 0.8
      ctx.fillText('start with length 1', (toX(0) + toX(1)) / 2, axisY - stemW(ppu) / 2 - 8)
    }
  }

  // ── Phase 2: Growth levels ──
  let activeLevel: Level | null = null
  let activeLevelIdx = -1
  for (let i = 0; i < LEVELS.length; i++) {
    const level = LEVELS[i]
    if (revealProgress >= level.startP && revealProgress < level.endP) {
      activeLevel = level
      activeLevelIdx = i
      break
    }
  }

  if (activeLevel) {
    const n = activeLevel.n
    const lp = mapRange(revealProgress, activeLevel.startP, activeLevel.endP)

    // Previous level's vine endpoint (for smooth retraction to 1)
    const prevEnd = activeLevelIdx > 0
      ? compoundResult(LEVELS[activeLevelIdx - 1].n)
      : 1
    const hasRetract = activeLevelIdx > 0

    // Sub-phases — retraction only after the first level
    //   0.00–0.15: vine retracts from previous result to 1
    //   0.08–0.22: intro label fades in ("N rounds: grow by 1/N each")
    //   0.18–0.82: n growth rounds (buds → tendril → settle)
    //   0.80–1.00: hold result
    const retractP = hasRetract ? mapRange(lp, 0, 0.15) : 1
    const introP = mapRange(lp, hasRetract ? 0.08 : 0, hasRetract ? 0.22 : 0.08)
    const growStart = hasRetract ? 0.18 : 0.05
    const growP = mapRange(lp, growStart, 0.82)
    const holdP = mapRange(lp, 0.80, 1.0)

    const finalVal = compoundResult(n)

    // Determine current vine endpoint across all sub-phases
    let currentVineEnd = 1

    // --- Retraction: vine smoothly shrinks from previous result to 1 ---
    if (hasRetract && retractP < 1) {
      currentVineEnd = prevEnd + (1 - prevEnd) * easeOut(retractP)
    } else if (growP > 0) {
      // --- Growth rounds ---
      const roundProg = growP * n // 0→n
      const curRound = Math.min(n - 1, Math.floor(roundProg))
      const roundFrac = growP >= 1 ? 1 : roundProg - curRound

      const vineBefore = compoundAfterSteps(n, curRound)
      const vineAfter = compoundAfterSteps(n, curRound + 1)

      const settleP = mapRange(roundFrac, 0.85, 1.0)
      currentVineEnd = growP >= 1
        ? finalVal
        : vineBefore + (vineAfter - vineBefore) * smoothstep(settleP)

      // Round sub-phases
      const budP = mapRange(roundFrac, 0, 0.28)
      const tendrilP = mapRange(roundFrac, 0.20, 0.88)

      // Buds pulsing before this round's tendril
      if (budP > 0 && growP < 1) {
        drawBuds(ctx, toX, axisY, vineBefore, budP, ppu, isDark, opacity)
      }

      // Tendril growing from vine tip
      if (tendrilP > 0 && settleP < 1 && growP < 1) {
        drawTendril(ctx, toX, axisY, vineBefore, vineAfter, tendrilP, ppu, isDark, opacity)
      }

      // Intermediate value labels at completed hop endpoints (n ≤ 4 only)
      if (n <= 4) {
        const valFs = Math.max(9, Math.min(11, ppu * 0.09))
        ctx.font = `${valFs}px system-ui, sans-serif`
        ctx.fillStyle = subtextColor
        ctx.textAlign = 'center'
        ctx.textBaseline = 'top'

        for (let r = 0; r <= curRound; r++) {
          if (r === curRound && roundFrac < 0.92) continue // not settled yet
          const val = compoundAfterSteps(n, r + 1)
          ctx.globalAlpha = opacity * 0.6
          ctx.fillText(val.toFixed(n <= 2 ? 2 : 3), toX(val), axisY + stemW(ppu) / 2 + 4)
        }
      }
    }

    // Always draw the vine at its current endpoint
    drawStem(ctx, toX, axisY, 0, currentVineEnd, ppu, isDark, opacity)
    drawLeaves(ctx, toX, axisY, 0, currentVineEnd, ppu, isDark, opacity)

    // --- Level intro label: explains the growth rule ---
    if (introP > 0) {
      // Fade out gradually during growth
      const fadeOut = holdP > 0.3
        ? 1 - smoothstep(mapRange(holdP, 0.3, 0.8))
        : growP > 0.6
          ? 1 - smoothstep(mapRange(growP, 0.6, 0.9))
          : 1
      const ia = smoothstep(introP) * fadeOut
      if (ia > 0.01) {
        const fs = Math.max(11, Math.min(14, ppu * 0.12))
        ctx.font = `${fs}px system-ui, sans-serif`
        ctx.fillStyle = textColor
        ctx.textAlign = 'center'
        ctx.textBaseline = 'bottom'
        ctx.globalAlpha = opacity * ia

        const header = n === 1
          ? '1 round: grow by the whole length!'
          : `${n} rounds: grow by ${fractionStr(n)} each time`
        const labelX = (toX(0) + toX(Math.E)) / 2
        ctx.fillText(header, labelX, axisY - stemW(ppu) / 2 - 14)
      }
    }

    // --- Result label ---
    if (holdP > 0) {
      const ra = smoothstep(holdP)
      const fs = Math.max(11, Math.min(14, ppu * 0.12))
      ctx.font = `${fs}px system-ui, sans-serif`
      ctx.fillStyle = vc
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ctx.globalAlpha = opacity * ra

      const valStr = finalVal.toFixed(n <= 3 ? 2 : 3)
      const label = n === 1
        ? `→ ${valStr}`
        : n === 2
          ? `→ ${valStr}  — new leaves grew leaves!`
          : `→ ${valStr}`
      ctx.fillText(label, toX(finalVal / 2 + 0.5), axisY + stemW(ppu) / 2 + 4)
    }
  }

  // ── Phase 3: Smooth growth (n → ∞) ──
  const smoothP = mapRange(revealProgress, SMOOTH_START, SMOOTH_END)
  if (smoothP > 0) {
    const ep = smoothstep(smoothP)
    const curEnd = 1 + ep * (Math.E - 1)

    drawStem(ctx, toX, axisY, 0, curEnd, ppu, isDark, opacity)
    drawLeaves(ctx, toX, axisY, 0, curEnd, ppu, isDark, opacity)

    // Continuous buds shimmer along the growing vine
    if (smoothP < 0.9) {
      // Use a cycling pulse based on smoothP for continuous feel
      const cyclePulse = (smoothP * 5) % 1
      drawBuds(ctx, toX, axisY, curEnd, cyclePulse, ppu, isDark, opacity * 0.6)
    }

    if (smoothP > 0.35) {
      const la = smoothstep(mapRange(smoothP, 0.35, 0.6))
      const fs = Math.max(11, Math.min(14, ppu * 0.12))
      ctx.font = `${fs}px system-ui, sans-serif`
      ctx.fillStyle = vc
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ctx.globalAlpha = opacity * la
      ctx.fillText('every leaf growing at once → e', toX(Math.E / 2 + 0.5), axisY + 12)
    }
  }

  // ── Phase 4: Convergence ──
  const convergeP = mapRange(revealProgress, CONVERGE_START, CONVERGE_END)
  if (convergeP > 0) {
    const ca = smoothstep(convergeP)

    drawStem(ctx, toX, axisY, 0, Math.E, ppu, isDark, opacity * ca)
    drawLeaves(ctx, toX, axisY, 0, Math.E, ppu, isDark, opacity * ca)

    // Show all ghost ticks with n-labels
    for (const level of LEVELS) {
      const val = compoundResult(level.n)
      drawGhostTick(ctx, toX(val), axisY, vc, opacity * ca, 9)

      const fs = Math.max(8, Math.min(10, ppu * 0.08))
      ctx.font = `${fs}px system-ui, sans-serif`
      ctx.fillStyle = subtextColor
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ctx.globalAlpha = opacity * ca * 0.7
      ctx.fillText(`${level.n}`, toX(val), axisY + 10)
    }

    // Bold e tick
    drawGhostTick(ctx, toX(Math.E), axisY, bc, opacity * ca, 11)

    // Strengthen boundary
    const eSx = toX(Math.E)
    ctx.beginPath()
    ctx.moveTo(eSx, axisY - cssHeight * 0.3)
    ctx.lineTo(eSx, axisY + 10)
    ctx.strokeStyle = bc
    ctx.lineWidth = 2
    ctx.globalAlpha = opacity * ca * 0.7
    ctx.setLineDash([5, 4])
    ctx.stroke()
    ctx.setLineDash([])
  }

  // ── Phase 5: Labels ──
  const labelP = mapRange(revealProgress, LABELS_START, 1.0)
  if (labelP > 0) {
    const la = smoothstep(labelP)
    const eSx = toX(Math.E)

    drawStem(ctx, toX, axisY, 0, Math.E, ppu, isDark, opacity * la)
    drawLeaves(ctx, toX, axisY, 0, Math.E, ppu, isDark, opacity * la)

    // "e" symbol
    const eFs = Math.max(16, Math.min(22, ppu * 0.18))
    ctx.font = `bold ${eFs}px system-ui, sans-serif`
    ctx.fillStyle = bc
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.globalAlpha = opacity * la
    ctx.fillText('e', eSx, axisY + 10)

    // "≈ 2.718"
    const vFs = Math.max(10, Math.min(14, ppu * 0.12))
    ctx.font = `${vFs}px system-ui, sans-serif`
    ctx.fillStyle = textColor
    ctx.globalAlpha = opacity * la * 0.8
    ctx.fillText('≈ 2.718', eSx, axisY + 10 + eFs + 3)

    // Formula above the vine
    const fFs = Math.max(13, Math.min(17, ppu * 0.15))
    ctx.font = `${fFs}px system-ui, sans-serif`
    ctx.fillStyle = textColor
    ctx.textBaseline = 'bottom'
    ctx.globalAlpha = opacity * la
    const formulaX = (toX(0) + eSx) / 2
    const formulaY = axisY - stemW(ppu) / 2 - 25
    ctx.fillText('lim (1 + 1/n)\u207F = e', formulaX, formulaY)

    // Kid subtitle
    const sFs = Math.max(10, Math.min(13, ppu * 0.11))
    ctx.font = `${sFs}px system-ui, sans-serif`
    ctx.fillStyle = subtextColor
    ctx.globalAlpha = opacity * la * 0.9
    ctx.fillText(
      'nature\u2019s limit for non-stop growth',
      formulaX,
      formulaY - fFs - 4
    )
  }

  ctx.globalAlpha = 1
  ctx.setLineDash([])
  ctx.restore()
}
