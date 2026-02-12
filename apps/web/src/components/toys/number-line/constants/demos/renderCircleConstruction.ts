import type { NumberLineState } from '../../types'
import { numberToScreenX } from '../../numberLineTicks'

/** Map a value from [start, end] to [0, 1], clamped. */
export function mapRange(value: number, start: number, end: number): number {
  if (value <= start) return 0
  if (value >= end) return 1
  return (value - start) / (end - start)
}

/** Smoothstep easing: 3t² - 2t³ */
function easeInOut(t: number): number {
  const c = Math.max(0, Math.min(1, t))
  return c * c * (3 - 2 * c)
}

// Sub-phase boundaries within construction progress (0→1)
const HIGHLIGHT_END = 0.20
const PIVOT_END = 0.50
const SWEEP_END = 0.85

const NUM_TREADS = 24

/**
 * Render pi construction: highlight 1-unit segment on axis → pivot to vertical
 * diameter → sweep circle around diameter → sprout treads.
 */
export function renderPiConstruction(
  ctx: CanvasRenderingContext2D,
  state: NumberLineState,
  cssWidth: number,
  cssHeight: number,
  config: { circumColor: string; spokeColor: string; refColor: string },
  constructionProgress: number,
  opacity: number
): void {
  renderConstruction(ctx, state, cssWidth, cssHeight, {
    radius: 0.5,
    centerNLY: -0.5,
    radiusSpoke: false,
    ...config,
    spokeLabel: '1 across',
  }, constructionProgress, opacity)
}

/**
 * Render tau construction: highlight 1-unit segment on axis → pivot to vertical
 * radius → sweep circle around radius → sprout treads.
 */
export function renderTauConstruction(
  ctx: CanvasRenderingContext2D,
  state: NumberLineState,
  cssWidth: number,
  cssHeight: number,
  config: { circumColor: string; spokeColor: string; refColor: string },
  constructionProgress: number,
  opacity: number
): void {
  renderConstruction(ctx, state, cssWidth, cssHeight, {
    radius: 1,
    centerNLY: -1,
    radiusSpoke: true,
    ...config,
    spokeLabel: '1 to edge',
  }, constructionProgress, opacity)
}

interface ConstructionParams {
  radius: number
  centerNLY: number
  radiusSpoke: boolean
  circumColor: string
  spokeColor: string
  refColor: string
  spokeLabel: string
}

function renderConstruction(
  ctx: CanvasRenderingContext2D,
  state: NumberLineState,
  cssWidth: number,
  cssHeight: number,
  params: ConstructionParams,
  p: number,
  opacity: number
): void {
  if (p <= 0 || opacity <= 0) return

  const centerY = cssHeight / 2
  const ppu = state.pixelsPerUnit
  const toX = (nlx: number) => numberToScreenX(nlx, state.center, ppu, cssWidth)
  const toY = (nly: number) => centerY + nly * ppu

  const { radius, centerNLY, radiusSpoke, circumColor, spokeColor, refColor, spokeLabel } = params

  const highlightP = mapRange(p, 0, HIGHLIGHT_END)
  const pivotP = mapRange(p, HIGHLIGHT_END, PIVOT_END)
  const sweepP = mapRange(p, PIVOT_END, SWEEP_END)
  const treadP = mapRange(p, SWEEP_END, 1.0)

  const screenR = radius * ppu
  const ccx = toX(0)
  const ccy = toY(centerNLY)
  const axisY = toY(0)
  const treadLen = Math.max(3, Math.min(8, screenR * 0.14))

  ctx.save()
  ctx.setLineDash([])

  // ── Phase 1: Highlight unit segment on axis ──
  if (pivotP <= 0) {
    const alpha = easeInOut(highlightP)
    ctx.globalAlpha = opacity * alpha

    const x0 = toX(0)
    const x1 = toX(1)

    // Glowing segment
    ctx.save()
    ctx.shadowColor = spokeColor
    ctx.shadowBlur = 12
    ctx.beginPath()
    ctx.moveTo(x0, axisY)
    ctx.lineTo(x1, axisY)
    ctx.strokeStyle = spokeColor
    ctx.lineWidth = 4
    ctx.stroke()
    ctx.restore()

    // Label above midpoint
    const fontSize = Math.max(12, Math.min(16, ppu * 0.15))
    ctx.font = `bold ${fontSize}px system-ui, sans-serif`
    ctx.fillStyle = spokeColor
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'
    ctx.fillText(spokeLabel, (x0 + x1) / 2, axisY - 10)

    ctx.restore()
    return
  }

  // ── Phase 2: Pivot segment from horizontal to vertical ──
  if (sweepP <= 0) {
    const easedP = easeInOut(pivotP)
    const angle = easedP * Math.PI / 2

    // Segment endpoints: pivot at (0,0) on axis, tip arcs to (0,-1)
    const tipNLX = Math.cos(angle)
    const tipNLY = -Math.sin(angle)

    const sx0 = toX(0)
    const sy0 = axisY
    const sx1 = toX(tipNLX)
    const sy1 = toY(tipNLY)

    // Line width transitions from thick glow to spoke width
    const lw = 4 - easedP * 2.5
    // Glow fades out during pivot
    const glowAmount = 12 * (1 - easedP)

    ctx.globalAlpha = opacity
    ctx.save()
    if (glowAmount > 0.5) {
      ctx.shadowColor = spokeColor
      ctx.shadowBlur = glowAmount
    }
    ctx.beginPath()
    ctx.moveTo(sx0, sy0)
    ctx.lineTo(sx1, sy1)
    ctx.strokeStyle = spokeColor
    ctx.lineWidth = lw
    ctx.stroke()
    ctx.restore()

    // Label follows midpoint with perpendicular offset
    const midSx = (sx0 + sx1) / 2
    const midSy = (sy0 + sy1) / 2
    const dx = sx1 - sx0
    const dy = sy1 - sy0
    const segLen = Math.sqrt(dx * dx + dy * dy)
    if (segLen > 0) {
      const nx = -dy / segLen
      const ny = dx / segLen
      // Fade label out near end of pivot (reappears in sweep positioned differently)
      const labelAlpha = pivotP < 0.7 ? 1 : Math.max(0, 1 - (pivotP - 0.7) / 0.3)
      if (labelAlpha > 0) {
        ctx.globalAlpha = opacity * labelAlpha
        const fontSize = Math.max(12, Math.min(16, ppu * 0.15))
        ctx.font = `bold ${fontSize}px system-ui, sans-serif`
        ctx.fillStyle = spokeColor
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(spokeLabel, midSx + nx * 14, midSy + ny * 14)
      }
    }

    ctx.restore()
    return
  }

  // ── Phases 3 & 4: Sweep arc around segment + sprout treads ──
  ctx.globalAlpha = opacity

  // Spoke (vertical, matches renderRollingCircle at t=0)
  ctx.beginPath()
  if (radiusSpoke) {
    ctx.moveTo(ccx, ccy)
    ctx.lineTo(ccx, axisY)
  } else {
    ctx.moveTo(ccx, axisY)
    ctx.lineTo(ccx, toY(-1))
  }
  ctx.strokeStyle = spokeColor
  ctx.lineWidth = 1.5
  ctx.stroke()

  // Center dot for radius spoke (fades in at start of sweep)
  if (radiusSpoke) {
    const dotAlpha = sweepP < 0.1 ? sweepP / 0.1 : 1
    ctx.globalAlpha = opacity * dotAlpha
    ctx.beginPath()
    ctx.arc(ccx, ccy, 2.5, 0, Math.PI * 2)
    ctx.fillStyle = spokeColor
    ctx.fill()
    ctx.globalAlpha = opacity
  }

  // Arc sweeps counterclockwise from bottom contact point
  const arcExtent = (treadP > 0 ? 1 : sweepP) * 2 * Math.PI
  const leadingAngle = Math.PI / 2 - arcExtent
  if (arcExtent > 0) {
    ctx.beginPath()
    ctx.arc(ccx, ccy, screenR, leadingAngle, Math.PI / 2, false)
    ctx.strokeStyle = circumColor
    ctx.lineWidth = 3
    ctx.stroke()
  }

  // Compass arm: line from center to leading edge of arc (tau only, during sweep)
  if (radiusSpoke && sweepP > 0 && treadP <= 0) {
    const armX = ccx + screenR * Math.cos(leadingAngle)
    const armY = ccy + screenR * Math.sin(leadingAngle)
    ctx.beginPath()
    ctx.moveTo(ccx, ccy)
    ctx.lineTo(armX, armY)
    ctx.strokeStyle = spokeColor
    ctx.lineWidth = 1.5
    ctx.setLineDash([3, 3])
    ctx.stroke()
    ctx.setLineDash([])

    // Small dot at the leading edge
    ctx.beginPath()
    ctx.arc(armX, armY, 2.5, 0, Math.PI * 2)
    ctx.fillStyle = circumColor
    ctx.fill()
  }

  // Reference circle fades in during last 30% of sweep, then stays
  const refAlpha = treadP > 0 ? 1 : mapRange(sweepP, 0.7, 1.0)
  if (refAlpha > 0) {
    ctx.globalAlpha = opacity * refAlpha
    ctx.beginPath()
    ctx.arc(ccx, ccy, screenR, 0, Math.PI * 2)
    ctx.strokeStyle = refColor
    ctx.lineWidth = 1
    ctx.stroke()
    ctx.globalAlpha = opacity

    // Re-draw colored arc on top so ref circle doesn't obscure it
    if (arcExtent > 0) {
      ctx.beginPath()
      ctx.arc(ccx, ccy, screenR, Math.PI / 2 - arcExtent, Math.PI / 2, false)
      ctx.strokeStyle = circumColor
      ctx.lineWidth = 3
      ctx.stroke()
    }
  }

  // Spoke label (fades in at start of sweep, matches renderRollingCircle positioning)
  const spokeLabelAlpha = sweepP < 0.15 ? sweepP / 0.15 : 1
  ctx.globalAlpha = opacity * spokeLabelAlpha
  const fontSize = Math.max(12, Math.min(16, ppu * 0.15))
  ctx.font = `bold ${fontSize}px system-ui, sans-serif`
  ctx.fillStyle = spokeColor
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(spokeLabel, ccx + screenR + 8, ccy)
  ctx.globalAlpha = opacity

  // ── Phase 4: Treads sprout sequentially ──
  if (treadP > 0) {
    ctx.strokeStyle = circumColor
    ctx.lineWidth = 1.5
    for (let i = 0; i < NUM_TREADS; i++) {
      // Same angle formula as renderRollingCircle at t=0
      const angle = Math.PI / 2 - 2 * Math.PI * i / NUM_TREADS
      const treadAlpha = Math.max(0, Math.min(1, (treadP - i / NUM_TREADS) * NUM_TREADS))
      if (treadAlpha <= 0) continue

      ctx.globalAlpha = opacity * treadAlpha
      const ix = ccx + screenR * Math.cos(angle)
      const iy = ccy + screenR * Math.sin(angle)
      const ox = ccx + (screenR + treadLen) * Math.cos(angle)
      const oy = ccy + (screenR + treadLen) * Math.sin(angle)
      ctx.beginPath()
      ctx.moveTo(ix, iy)
      ctx.lineTo(ox, oy)
      ctx.stroke()
    }
  }

  ctx.restore()
}
