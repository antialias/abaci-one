import type { NumberLineState } from '../../types'
import { renderRollingCircle } from './renderRollingCircle'
import { numberToScreenX } from '../../numberLineTicks'

/**
 * Target viewport for the pi demo.
 * Centers the view between 0 and pi, with padding for the circle radius.
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

  // Animation phases
  const circleAlpha = Math.min(1, revealProgress / 0.1)
  const t = revealProgress <= 0.1 ? 0
    : revealProgress >= 0.9 ? 1
    : (revealProgress - 0.1) / 0.8
  const labelAlpha = revealProgress <= 0.9 ? 0
    : Math.min(1, (revealProgress - 0.9) / 0.1)

  ctx.save()
  ctx.globalAlpha = opacity

  // Rolling circle (radius 0.5, diameter 1)
  const pos = renderRollingCircle(ctx, state, cssWidth, cssHeight, {
    radius: 0.5,
    circumColor: isDark ? '#60a5fa' : '#2563eb',
    spokeColor: isDark ? '#f87171' : '#dc2626',
    refColor: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.15)',
    accentColor: isDark ? '#fbbf24' : '#d97706',
    trailColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.12)',
    spokeLabel: '1 across',
  }, t, circleAlpha, opacity)

  // === Labels (phase 3) ===
  if (labelAlpha > 0) {
    ctx.globalAlpha = opacity * labelAlpha
    const circumColor = isDark ? '#60a5fa' : '#2563eb'
    const ppu = state.pixelsPerUnit
    const toX = (nlx: number) => numberToScreenX(nlx, state.center, ppu, cssWidth)

    // "pi" label at x = pi
    const piSx = toX(Math.PI)
    const fontSize = Math.max(14, Math.min(20, ppu * 0.18))
    ctx.font = `bold ${fontSize}px system-ui, sans-serif`
    ctx.fillStyle = circumColor
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.fillText('\u03C0', piSx, pos.axisY + 8)

    // "one turn" annotation under pi
    const annoFontSize = Math.max(10, Math.min(13, ppu * 0.12))
    ctx.font = `${annoFontSize}px system-ui, sans-serif`
    ctx.fillText('one turn', piSx, pos.axisY + 8 + fontSize + 2)

    // Small tick at pi
    ctx.beginPath()
    ctx.moveTo(piSx, pos.axisY - 4)
    ctx.lineTo(piSx, pos.axisY + 4)
    ctx.strokeStyle = circumColor
    ctx.lineWidth = 2
    ctx.setLineDash([])
    ctx.stroke()

    // "C = πd" formula above the circle
    const formulaFontSize = Math.max(13, Math.min(18, ppu * 0.16))
    ctx.font = `${formulaFontSize}px system-ui, sans-serif`
    ctx.fillStyle = isDark ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.8)'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'
    ctx.fillText('C = \u03C0d', pos.ccx, pos.ccy - pos.screenR - 8)

    // "trip around ÷ distance across" subtitle
    const subFontSize = Math.max(10, Math.min(13, ppu * 0.11))
    ctx.font = `${subFontSize}px system-ui, sans-serif`
    ctx.fillStyle = isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)'
    ctx.fillText('trip around \u00F7 distance across', pos.ccx, pos.ccy - pos.screenR - 8 - formulaFontSize - 2)
  }

  ctx.globalAlpha = 1
  ctx.setLineDash([])
  ctx.restore()
}
