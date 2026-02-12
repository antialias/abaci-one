import type { NumberLineState } from '../../types'
import { numberToScreenX } from '../../numberLineTicks'

/**
 * Target viewport for the pi demo.
 * Centers the view between 0 and pi+0.5 (circle radius at end),
 * with padding for the circle at start (-0.5).
 */
export function piDemoViewport(cssWidth: number, cssHeight: number) {
  const center = Math.PI / 2
  // Fit full horizontal range [-0.5, pi+0.5] = width pi+1
  const ppu = Math.min(cssWidth * 0.85 / (Math.PI + 1), cssHeight * 0.35)
  return { center, pixelsPerUnit: ppu }
}

/**
 * Render the pi demo overlay: a circle of diameter 1 rolls along the
 * number line, its circumference unrolling onto the axis from 0 to pi.
 *
 * NL coord convention (matching goldenRatioDemo): positive y = down on screen.
 * The circle sits ABOVE the axis, so its center is at negative y.
 *
 * Rolling mechanics: as the circle rolls rightward by distance d = t*pi,
 * it rotates by +2*pi*t in canvas angle (clockwise on screen with y-down).
 * The untouched arc shrinks from the contact point (bottom of circle).
 */
export function renderPiOverlay(
  ctx: CanvasRenderingContext2D,
  state: NumberLineState,
  cssWidth: number,
  cssHeight: number,
  isDark: boolean,
  revealProgress: number,
  opacity: number
): void {
  if (opacity <= 0) return

  const centerY = cssHeight / 2
  const ppu = state.pixelsPerUnit

  // NL coord helpers (positive y = down on screen, matching goldenRatioDemo)
  const toX = (nlx: number) => numberToScreenX(nlx, state.center, ppu, cssWidth)
  const toY = (nly: number) => centerY + nly * ppu

  // Colors
  const circumColor = isDark ? '#60a5fa' : '#2563eb'
  const diamColor = isDark ? '#f87171' : '#dc2626'
  const refColor = isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.15)'

  // Animation phases
  const circleAlpha = Math.min(1, revealProgress / 0.1)
  const t = revealProgress <= 0.1 ? 0
    : revealProgress >= 0.9 ? 1
    : (revealProgress - 0.1) / 0.8
  const labelAlpha = revealProgress <= 0.9 ? 0
    : Math.min(1, (revealProgress - 0.9) / 0.1)

  ctx.save()
  ctx.globalAlpha = opacity

  // --- Circle geometry ---
  // Radius 0.5, diameter 1. Circle sits above axis (bottom touching axis).
  // NL coords: center at (t*pi, -0.5), contact at (t*pi, 0).
  const r = 0.5
  const ccNLx = t * Math.PI        // circle center x (moves as it rolls)
  const ccNLy = -r                  // circle center y (above axis)
  const ccx = toX(ccNLx)
  const ccy = toY(ccNLy)
  const screenR = r * ppu

  // Canvas rotation: +2*pi*t (clockwise on screen = rightward rolling)
  const rotation = 2 * Math.PI * t

  // === Phase 1: Circle + diameter appear ===
  if (circleAlpha > 0) {
    ctx.globalAlpha = opacity * circleAlpha

    // Reference circle outline (thin, translucent)
    ctx.beginPath()
    ctx.arc(ccx, ccy, screenR, 0, Math.PI * 2)
    ctx.strokeStyle = refColor
    ctx.lineWidth = 1
    ctx.setLineDash([])
    ctx.stroke()

    // Full colored circumference at t=0 (before rolling starts)
    if (t === 0) {
      ctx.beginPath()
      ctx.arc(ccx, ccy, screenR, 0, Math.PI * 2)
      ctx.strokeStyle = circumColor
      ctx.lineWidth = 3
      ctx.stroke()
    }

    // Diameter spoke (rotates with the circle)
    // Initially vertical: bottom (pi/2) to top (3pi/2).
    // After rotation: angles shift by +rotation.
    const spoke1Angle = Math.PI / 2 + rotation
    const spoke2Angle = spoke1Angle + Math.PI
    const s1x = ccx + screenR * Math.cos(spoke1Angle)
    const s1y = ccy + screenR * Math.sin(spoke1Angle)
    const s2x = ccx + screenR * Math.cos(spoke2Angle)
    const s2y = ccy + screenR * Math.sin(spoke2Angle)

    ctx.beginPath()
    ctx.moveTo(s1x, s1y)
    ctx.lineTo(s2x, s2y)
    ctx.strokeStyle = diamColor
    ctx.lineWidth = 1.5
    ctx.setLineDash([])
    ctx.stroke()

    // "d = 1" label — prominent in phase 1, fades as rolling begins
    const diamLabelAlpha = t <= 0 ? 1 : Math.max(0, 1 - t * 3)
    if (diamLabelAlpha > 0) {
      ctx.globalAlpha = opacity * circleAlpha * diamLabelAlpha
      const fontSize = Math.max(12, Math.min(16, ppu * 0.15))
      ctx.font = `bold ${fontSize}px system-ui, sans-serif`
      ctx.fillStyle = diamColor
      ctx.textAlign = 'left'
      ctx.textBaseline = 'middle'
      ctx.fillText('d = 1', ccx + screenR + 8, ccy)
      ctx.globalAlpha = opacity * circleAlpha
    }
  }

  // === Phase 2: Rolling ===
  if (t > 0) {
    ctx.globalAlpha = opacity

    // Untouched (remaining) arc on the circle.
    // The untouched portion starts at the contact point (canvas angle pi/2)
    // and extends counterclockwise on screen (decreasing canvas angle),
    // spanning (1-t) of the circumference.
    //
    // Canvas arc call: draw clockwise from startAngle to endAngle (pi/2).
    //   startAngle = pi/2 - 2*pi*(1-t)
    if (t < 1) {
      const arcStart = Math.PI / 2 - 2 * Math.PI * (1 - t)
      ctx.beginPath()
      ctx.arc(ccx, ccy, screenR, arcStart, Math.PI / 2, false)
      ctx.strokeStyle = circumColor
      ctx.lineWidth = 3
      ctx.setLineDash([])
      ctx.stroke()
    }

    // Unrolled line on axis: x = 0 to x = t*pi
    ctx.beginPath()
    ctx.moveTo(toX(0), toY(0))
    ctx.lineTo(toX(t * Math.PI), toY(0))
    ctx.strokeStyle = circumColor
    ctx.lineWidth = 3
    ctx.setLineDash([])
    ctx.stroke()

    // Contact point marker (where circumference meets the axis)
    const contactSx = toX(t * Math.PI)
    const contactSy = toY(0)
    ctx.beginPath()
    ctx.arc(contactSx, contactSy, 4, 0, Math.PI * 2)
    ctx.fillStyle = circumColor
    ctx.fill()

    // Cycloid trail: path traced by the initial contact point.
    // Parametric (NL coords): x = r(theta - sin(theta)), y = -(r(1 - cos(theta)))
    // where theta goes from 0 to 2*pi*t.
    const trailSteps = Math.max(2, Math.ceil(t * 80))
    ctx.beginPath()
    for (let i = 0; i <= trailSteps; i++) {
      const frac = i / trailSteps
      const theta = 2 * Math.PI * t * frac
      const nlx = r * (theta - Math.sin(theta))
      const nly = -(r * (1 - Math.cos(theta)))  // negative = above axis
      const sx = toX(nlx)
      const sy = toY(nly)
      if (i === 0) ctx.moveTo(sx, sy)
      else ctx.lineTo(sx, sy)
    }
    ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.12)'
    ctx.lineWidth = 1
    ctx.setLineDash([3, 4])
    ctx.stroke()
    ctx.setLineDash([])

    // Marker dot on the circle rim at the initial contact point's current position.
    // Initial canvas angle: pi/2 (bottom). After rotation: pi/2 + rotation.
    const markerAngle = Math.PI / 2 + rotation
    const markerSx = ccx + screenR * Math.cos(markerAngle)
    const markerSy = ccy + screenR * Math.sin(markerAngle)
    ctx.beginPath()
    ctx.arc(markerSx, markerSy, 3.5, 0, Math.PI * 2)
    ctx.fillStyle = isDark ? '#fbbf24' : '#d97706'  // amber accent
    ctx.fill()
  }

  // === Phase 3: Labels ===
  if (labelAlpha > 0) {
    ctx.globalAlpha = opacity * labelAlpha

    // "pi" label at x = pi on the axis
    const piSx = toX(Math.PI)
    const piSy = toY(0)
    const fontSize = Math.max(14, Math.min(20, ppu * 0.18))
    ctx.font = `bold ${fontSize}px system-ui, sans-serif`
    ctx.fillStyle = circumColor
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.fillText('\u03C0', piSx, piSy + 8)

    // Small tick at pi
    ctx.beginPath()
    ctx.moveTo(piSx, piSy - 4)
    ctx.lineTo(piSx, piSy + 4)
    ctx.strokeStyle = circumColor
    ctx.lineWidth = 2
    ctx.setLineDash([])
    ctx.stroke()

    // "C = pid" formula above the circle
    const formulaFontSize = Math.max(13, Math.min(18, ppu * 0.16))
    ctx.font = `${formulaFontSize}px system-ui, sans-serif`
    ctx.fillStyle = isDark ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.8)'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'
    ctx.fillText('C = \u03C0d', ccx, ccy - screenR - 8)
  }

  ctx.globalAlpha = 1
  ctx.setLineDash([])
  ctx.restore()
}
