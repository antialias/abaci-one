import type { NumberLineState } from '../../types'
import { renderRollingCircle } from './renderRollingCircle'
import { numberToScreenX } from '../../numberLineTicks'

const TAU = 2 * Math.PI

/**
 * Target viewport for the tau demo.
 * Unit circle (r=1) rolls one turn → covers τ. Shows τ = C/r.
 */
export function tauDemoViewport(cssWidth: number, cssHeight: number) {
  const center = TAU / 2
  // Fit horizontal range [-1, tau+1] = width tau+2
  // Vertical: circle is 2 units tall (r=1), needs to fit above the axis
  const ppu = Math.min(cssWidth * 0.85 / (TAU + 2), cssHeight * 0.22)
  return { center, pixelsPerUnit: ppu }
}

/**
 * Render the tau demo overlay: a unit circle (r=1) rolls one full turn
 * along the number line, its circumference unrolling onto the axis from 0 to τ.
 * Shows π at the halfway mark. Contrasts with pi demo's smaller d=1 circle.
 */
export function renderTauOverlay(
  ctx: CanvasRenderingContext2D,
  state: NumberLineState,
  cssWidth: number,
  cssHeight: number,
  isDark: boolean,
  revealProgress: number,
  opacity: number
): void {
  if (opacity <= 0) return

  // Animation phases
  const circleAlpha = Math.min(1, revealProgress / 0.1)
  const t = revealProgress <= 0.1 ? 0
    : revealProgress >= 0.9 ? 1
    : (revealProgress - 0.1) / 0.8
  const labelAlpha = revealProgress <= 0.9 ? 0
    : Math.min(1, (revealProgress - 0.9) / 0.1)

  const circumColor = isDark ? '#2dd4bf' : '#0d9488'  // teal

  ctx.save()
  ctx.globalAlpha = opacity

  // Rolling circle — unit circle (r=1), one full turn covers τ
  const pos = renderRollingCircle(ctx, state, cssWidth, cssHeight, {
    radius: 1,
    radiusSpoke: true,
    circumColor,
    spokeColor: isDark ? '#f87171' : '#dc2626',
    refColor: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.15)',
    accentColor: isDark ? '#fbbf24' : '#d97706',
    trailColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.12)',
    spokeLabel: '1 to edge',
  }, t, circleAlpha, opacity)

  const ppu = state.pixelsPerUnit
  const toX = (nlx: number) => numberToScreenX(nlx, state.center, ppu, cssWidth)

  // === Pi halfway mark (appears once rolling passes the midpoint) ===
  const piMarkAlpha = t >= 0.5 ? Math.min(1, (t - 0.5) * 5) : 0
  if (piMarkAlpha > 0) {
    ctx.globalAlpha = opacity * piMarkAlpha * 0.7
    const piSx = toX(Math.PI)
    const piColor = isDark ? 'rgba(96, 165, 250, 0.8)' : 'rgba(37, 99, 235, 0.7)'

    // Tick mark at pi
    ctx.beginPath()
    ctx.moveTo(piSx, pos.axisY - 6)
    ctx.lineTo(piSx, pos.axisY + 6)
    ctx.strokeStyle = piColor
    ctx.lineWidth = 1.5
    ctx.setLineDash([])
    ctx.stroke()

    // "pi" label
    const piFontSize = Math.max(11, Math.min(14, ppu * 0.14))
    ctx.font = `${piFontSize}px system-ui, sans-serif`
    ctx.fillStyle = piColor
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.fillText('\u03C0', piSx, pos.axisY + 8)

    // "half turn" annotation
    ctx.font = `${Math.max(9, piFontSize - 2)}px system-ui, sans-serif`
    ctx.fillText('half turn', piSx, pos.axisY + 8 + piFontSize + 2)
  }

  // === Labels (phase 3) ===
  if (labelAlpha > 0) {
    ctx.globalAlpha = opacity * labelAlpha

    // "tau" label at x = tau
    const tauSx = toX(TAU)
    const fontSize = Math.max(14, Math.min(20, ppu * 0.18))
    ctx.font = `bold ${fontSize}px system-ui, sans-serif`
    ctx.fillStyle = circumColor
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.fillText('\u03C4', tauSx, pos.axisY + 8)

    // Small tick at tau
    ctx.beginPath()
    ctx.moveTo(tauSx, pos.axisY - 4)
    ctx.lineTo(tauSx, pos.axisY + 4)
    ctx.strokeStyle = circumColor
    ctx.lineWidth = 2
    ctx.setLineDash([])
    ctx.stroke()

    // "one full turn" annotation under tau
    const annoFontSize = Math.max(10, Math.min(13, ppu * 0.12))
    ctx.font = `${annoFontSize}px system-ui, sans-serif`
    ctx.fillText('full turn', tauSx, pos.axisY + 8 + fontSize + 2)

    // "C = τr" formula above the circle
    const formulaFontSize = Math.max(13, Math.min(18, ppu * 0.16))
    ctx.font = `${formulaFontSize}px system-ui, sans-serif`
    ctx.fillStyle = isDark ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.8)'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'
    ctx.fillText('C = \u03C4r', pos.ccx, pos.ccy - pos.screenR - 8)

    // "trip around ÷ center to edge" subtitle
    const subFontSize = Math.max(10, Math.min(13, ppu * 0.11))
    ctx.font = `${subFontSize}px system-ui, sans-serif`
    ctx.fillStyle = isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)'
    ctx.fillText('trip around \u00F7 center to edge', pos.ccx, pos.ccy - pos.screenR - 8 - formulaFontSize - 2)
  }

  ctx.globalAlpha = 1
  ctx.setLineDash([])
  ctx.restore()
}
