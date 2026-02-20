import type { NumberLineState } from '../../types'
import { numberToScreenX } from '../../numberLineTicks'

/**
 * Configuration for a rolling circle demo.
 * Shared by pi (d=1 circle, diameter spoke) and tau (r=1 circle, radius spoke).
 */
export interface RollingCircleConfig {
  radius: number
  /** How many full revolutions the circle makes over t=0→1. Default 1. */
  revolutions?: number
  /** Draw a radius spoke (center→edge) instead of a full diameter spoke. Default false. */
  radiusSpoke?: boolean
  circumColor: string
  spokeColor: string
  refColor: string
  accentColor: string // cycloid marker dot
  trailColor: string // cycloid trail
  spokeLabel: string // e.g. "d = 1"
}

/** Screen coordinates of the rolling circle, returned for label positioning. */
export interface RollingCirclePos {
  ccx: number // circle center screen x
  ccy: number // circle center screen y
  screenR: number // circle radius in pixels
  axisY: number // axis screen y
}

/**
 * Render a rolling circle that unrolls its circumference onto the number line.
 *
 * NL coord convention: positive y = down on screen (matching goldenRatioDemo).
 * The circle sits above the axis with its bottom touching at y=0.
 *
 * @param t Rolling progress 0-1 (0 = stationary, 1 = all revolutions complete)
 * @param circleAlpha Fade-in alpha for phase 1
 * @param opacity Overall overlay opacity
 * @returns Screen coordinates of the circle for label positioning
 */
export function renderRollingCircle(
  ctx: CanvasRenderingContext2D,
  state: NumberLineState,
  cssWidth: number,
  cssHeight: number,
  config: RollingCircleConfig,
  t: number,
  circleAlpha: number,
  opacity: number
): RollingCirclePos {
  const centerY = cssHeight / 2
  const ppu = state.pixelsPerUnit

  const toX = (nlx: number) => numberToScreenX(nlx, state.center, ppu, cssWidth)
  const toY = (nly: number) => centerY + nly * ppu

  const {
    radius: r,
    circumColor,
    spokeColor,
    refColor,
    accentColor,
    trailColor,
    spokeLabel,
  } = config
  const revolutions = config.revolutions ?? 1
  const radiusSpoke = config.radiusSpoke ?? false
  const circumference = 2 * Math.PI * r

  // Total revolutions completed at progress t
  const totalRevs = t * revolutions
  // Fraction within the current revolution (0-1)
  const revFrac = totalRevs % 1
  // Total distance rolled on the axis
  const totalDist = totalRevs * circumference
  // Total rotation angle
  const totalRotation = totalRevs * 2 * Math.PI

  // Circle center in NL coords
  const ccx = toX(totalDist)
  const ccy = toY(-r)
  const screenR = r * ppu
  const axisY = toY(0)

  // --- Tread marks (tire texture) ---
  const NUM_TREADS = 24
  const treadLen = Math.max(3, Math.min(8, screenR * 0.14))

  function drawTreads(alpha: number) {
    ctx.globalAlpha = alpha
    ctx.strokeStyle = circumColor
    ctx.lineWidth = 1.5
    ctx.setLineDash([])

    const completedRevs = Math.floor(totalRevs)

    // Treads from completed revolutions — all on the ground
    for (let rev = 0; rev < completedRevs; rev++) {
      for (let i = 0; i < NUM_TREADS; i++) {
        const groundX = toX((rev + i / NUM_TREADS) * circumference)
        ctx.beginPath()
        ctx.moveTo(groundX, axisY - treadLen)
        ctx.lineTo(groundX, axisY + treadLen)
        ctx.stroke()
      }
    }

    // Treads from the current partial revolution
    for (let i = 0; i < NUM_TREADS; i++) {
      const s = i / NUM_TREADS

      if (s < revFrac) {
        // Touched down this revolution — on the ground
        const groundX = toX((completedRevs + s) * circumference)
        ctx.beginPath()
        ctx.moveTo(groundX, axisY - treadLen)
        ctx.lineTo(groundX, axisY + treadLen)
        ctx.stroke()
      } else {
        // Still on circle — radial hash extending outward
        const angle = Math.PI / 2 + 2 * Math.PI * (revFrac - s)
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
  }

  // === Phase 1: Circle + spoke appear ===
  if (circleAlpha > 0) {
    ctx.globalAlpha = opacity * circleAlpha

    // Reference circle outline (thin, translucent)
    ctx.beginPath()
    ctx.arc(ccx, ccy, screenR, 0, Math.PI * 2)
    ctx.strokeStyle = refColor
    ctx.lineWidth = 1
    ctx.setLineDash([])
    ctx.stroke()

    // Full colored circumference at t=0
    if (t === 0) {
      ctx.beginPath()
      ctx.arc(ccx, ccy, screenR, 0, Math.PI * 2)
      ctx.strokeStyle = circumColor
      ctx.lineWidth = 3
      ctx.stroke()

      drawTreads(opacity * circleAlpha)
    }

    // Spoke (rotates with the circle) — radius or diameter
    const spoke1Angle = Math.PI / 2 + totalRotation
    const s1x = ccx + screenR * Math.cos(spoke1Angle)
    const s1y = ccy + screenR * Math.sin(spoke1Angle)

    ctx.beginPath()
    if (radiusSpoke) {
      // Radius: center → edge
      ctx.moveTo(ccx, ccy)
      ctx.lineTo(s1x, s1y)
    } else {
      // Full diameter: edge → edge through center
      const spoke2Angle = spoke1Angle + Math.PI
      const s2x = ccx + screenR * Math.cos(spoke2Angle)
      const s2y = ccy + screenR * Math.sin(spoke2Angle)
      ctx.moveTo(s1x, s1y)
      ctx.lineTo(s2x, s2y)
    }
    ctx.strokeStyle = spokeColor
    ctx.lineWidth = 1.5
    ctx.setLineDash([])
    ctx.stroke()

    // Center dot for radius spoke
    if (radiusSpoke) {
      ctx.beginPath()
      ctx.arc(ccx, ccy, 2.5, 0, Math.PI * 2)
      ctx.fillStyle = spokeColor
      ctx.fill()
    }

    // Spoke label — prominent at start, fades as rolling begins
    const labelAlpha = t <= 0 ? 1 : Math.max(0, 1 - t * revolutions * 3)
    if (labelAlpha > 0) {
      ctx.globalAlpha = opacity * circleAlpha * labelAlpha
      const fontSize = Math.max(12, Math.min(16, ppu * 0.15))
      ctx.font = `bold ${fontSize}px system-ui, sans-serif`
      ctx.fillStyle = spokeColor
      ctx.textAlign = 'left'
      ctx.textBaseline = 'middle'
      ctx.fillText(spokeLabel, ccx + screenR + 8, ccy)
      ctx.globalAlpha = opacity * circleAlpha
    }
  }

  // === Phase 2: Rolling ===
  if (t > 0) {
    ctx.globalAlpha = opacity

    // Untouched (remaining) arc for the current revolution
    // revFrac=0 at start of each revolution (full circle), revFrac→1 (empty)
    const effectiveFrac = totalRevs >= revolutions ? 1 : revFrac
    if (effectiveFrac > 0 && effectiveFrac < 1) {
      const arcStart = Math.PI / 2 - 2 * Math.PI * (1 - effectiveFrac)
      ctx.beginPath()
      ctx.arc(ccx, ccy, screenR, arcStart, Math.PI / 2, false)
      ctx.strokeStyle = circumColor
      ctx.lineWidth = 3
      ctx.setLineDash([])
      ctx.stroke()
    } else if (effectiveFrac === 0 && totalRevs > 0) {
      // Exactly at a revolution boundary — full circle colored
      ctx.beginPath()
      ctx.arc(ccx, ccy, screenR, 0, Math.PI * 2)
      ctx.strokeStyle = circumColor
      ctx.lineWidth = 3
      ctx.setLineDash([])
      ctx.stroke()
    }

    // Unrolled line on axis: x = 0 to x = totalDist
    ctx.beginPath()
    ctx.moveTo(toX(0), axisY)
    ctx.lineTo(toX(totalDist), axisY)
    ctx.strokeStyle = circumColor
    ctx.lineWidth = 3
    ctx.setLineDash([])
    ctx.stroke()

    // Treads — split between circle and ground
    drawTreads(opacity)

    // Contact point marker
    ctx.beginPath()
    ctx.arc(toX(totalDist), axisY, 4, 0, Math.PI * 2)
    ctx.fillStyle = circumColor
    ctx.fill()

    // Cycloid trail (repeats each revolution — multi-arch cycloid)
    const trailSteps = Math.max(2, Math.ceil(totalRevs * 80))
    ctx.beginPath()
    for (let i = 0; i <= trailSteps; i++) {
      const frac = i / trailSteps
      const theta = 2 * Math.PI * totalRevs * frac
      const nlx = r * (theta - Math.sin(theta))
      const nly = -(r * (1 - Math.cos(theta)))
      const sx = toX(nlx)
      const sy = toY(nly)
      if (i === 0) ctx.moveTo(sx, sy)
      else ctx.lineTo(sx, sy)
    }
    ctx.strokeStyle = trailColor
    ctx.lineWidth = 1
    ctx.setLineDash([3, 4])
    ctx.stroke()
    ctx.setLineDash([])

    // Marker dot on rim at initial contact point's current position
    const markerAngle = Math.PI / 2 + totalRotation
    const markerSx = ccx + screenR * Math.cos(markerAngle)
    const markerSy = ccy + screenR * Math.sin(markerAngle)
    ctx.beginPath()
    ctx.arc(markerSx, markerSy, 3.5, 0, Math.PI * 2)
    ctx.fillStyle = accentColor
    ctx.fill()
  }

  return { ccx, ccy, screenR, axisY }
}
