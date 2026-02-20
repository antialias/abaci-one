import type { NumberLineState } from '../../types'
import { renderRollingCircle } from './renderRollingCircle'
import { renderPiConstruction, mapRange } from './renderCircleConstruction'

/**
 * Target viewport for the pi demo.
 * Centers the view between 0 and pi, with padding for the circle radius.
 */
export function piDemoViewport(cssWidth: number, cssHeight: number) {
  const center = Math.PI / 2
  // Fit full horizontal range [-0.5, pi+0.5] = width pi+1
  const ppu = Math.min((cssWidth * 0.85) / (Math.PI + 1), cssHeight * 0.35)
  return { center, pixelsPerUnit: ppu }
}

// Phase boundaries within revealProgress
const CONSTRUCTION_END = 0.3
const ROLLING_END = 0.82
const ZOOM_BEGIN = 0.9

/**
 * Render the pi demo overlay: constructs a circle of diameter 1 from
 * the number line, then rolls it along the axis from 0 to pi.
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

  const constructionP = mapRange(revealProgress, 0, CONSTRUCTION_END)
  const t = mapRange(revealProgress, CONSTRUCTION_END, ROLLING_END)
  const labelAlpha = mapRange(revealProgress, ROLLING_END, ZOOM_BEGIN)
  const zoomP = mapRange(revealProgress, ZOOM_BEGIN, 1.0)

  const circumColor = isDark ? '#60a5fa' : '#2563eb'
  const spokeColor = isDark ? '#f87171' : '#dc2626'
  const refColor = isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.15)'

  ctx.save()
  ctx.globalAlpha = opacity

  if (constructionP < 1) {
    // Construction phases: highlight → pivot → sweep → treads
    renderPiConstruction(
      ctx,
      state,
      cssWidth,
      cssHeight,
      {
        circumColor,
        spokeColor,
        refColor,
      },
      constructionP,
      opacity
    )
  } else {
    // Fade out rolling circle and labels as zoom kicks in
    const zoomFade = zoomP > 0 ? Math.max(0, 1 - zoomP * 3) : 1

    if (zoomFade > 0.01) {
      // Rolling phase: circle rolls from 0 to pi
      const pos = renderRollingCircle(
        ctx,
        state,
        cssWidth,
        cssHeight,
        {
          radius: 0.5,
          circumColor,
          spokeColor,
          refColor,
          accentColor: isDark ? '#fbbf24' : '#d97706',
          trailColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.12)',
          spokeLabel: '1 across',
        },
        t,
        1,
        opacity * zoomFade
      )

      // === Labels ===
      if (labelAlpha > 0) {
        ctx.globalAlpha = opacity * labelAlpha * zoomFade
        const ppu = state.pixelsPerUnit
        const toX = (nlx: number) => nlx * ppu - state.center * ppu + cssWidth / 2

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
        ctx.fillText(
          'trip around \u00F7 distance across',
          pos.ccx,
          pos.ccy - pos.screenR - 8 - formulaFontSize - 2
        )
      }
    }
  }

  // === Irrationality zoom (final phase) ===
  // The actual number-line viewport zoom is driven by useConstantDemo.
  // Here we just overlay a floating decimal expansion at the top of the screen.
  if (zoomP > 0) {
    const fadeIn = zoomP < 0.25 ? zoomP * 4 : 1
    const smoothFadeIn = fadeIn * fadeIn * (3 - 2 * fadeIn)

    // Decimal expansion typing out
    const decimalStr = '3.14159265358\u2026'
    const charsToShow = Math.min(decimalStr.length, Math.floor(1 + zoomP * (decimalStr.length - 1)))
    const displayText = '\u03C0 = ' + decimalStr.substring(0, charsToShow)

    const fs = Math.max(16, Math.min(24, cssWidth * 0.03))
    ctx.font = `bold ${fs}px system-ui, monospace`
    ctx.fillStyle = circumColor
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.globalAlpha = opacity * smoothFadeIn
    ctx.fillText(displayText, cssWidth / 2, 20)

    // Subtitle
    if (zoomP > 0.7) {
      const neverP = zoomP < 0.9 ? (zoomP - 0.7) / 0.2 : 1
      const smoothNP = neverP * neverP * (3 - 2 * neverP)
      const subFs = Math.max(11, Math.min(15, cssWidth * 0.02))
      ctx.font = `italic ${subFs}px system-ui, sans-serif`
      ctx.fillStyle = isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ctx.globalAlpha = opacity * smoothNP * 0.8
      ctx.fillText('The digits never end!', cssWidth / 2, 20 + fs + 6)
    }
  }

  ctx.globalAlpha = 1
  ctx.setLineDash([])
  ctx.restore()
}
