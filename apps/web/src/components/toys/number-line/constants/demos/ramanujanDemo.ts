import type { NumberLineState } from '../../types'
import { numberToScreenX } from '../../numberLineTicks'

/**
 * Ramanujan Demo: "The Detective Mystery of −1/12"
 *
 * Visualises the Ramanujan summation 1+2+3+4+… = −1/12 through
 * the actual derivation chain:
 *
 *   Phase 0: S = 1+2+3+… diverges (dot accelerates off-screen)
 *   Phase 1: Grandi's series c₁ = 1−1+1−1+… = ½ (bouncing dot)
 *   Phase 2: Alternating series c₂ = 1−2+3−4+… = ¼ (staggered addition trick)
 *   Phase 3: Column subtraction S−c₂ = 4S (collision/merge animations)
 *   Phase 4: Revelation — S = −1/12 (algebra + starburst)
 *
 * Framed as a detective mystery for a young audience.
 */

// ── Utilities ────────────────────────────────────────────────────────

function mapRange(v: number, s: number, e: number): number {
  if (v <= s) return 0
  if (v >= e) return 1
  return (v - s) / (e - s)
}

function smoothstep(t: number): number {
  const c = Math.max(0, Math.min(1, t))
  return c * c * (3 - 2 * c)
}

function easeInOut(t: number): number {
  const c = Math.max(0, Math.min(1, t))
  return c < 0.5 ? 2 * c * c : 1 - Math.pow(-2 * c + 2, 2) / 2
}

// ── Colors ───────────────────────────────────────────────────────────

/** S (marching series) — amber */
function sCol(isDark: boolean) { return isDark ? '#fbbf24' : '#d97706' }
/** Grandi c₁ — blue */
function c1Col(isDark: boolean) { return isDark ? '#60a5fa' : '#2563eb' }
/** Alternating c₂ — purple */
function c2Col(isDark: boolean) { return isDark ? '#a78bfa' : '#7c3aed' }
/** Result — green */
function resultCol(isDark: boolean) { return isDark ? '#34d399' : '#059669' }
function textColor(isDark: boolean) { return isDark ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.8)' }
function subtextColor(isDark: boolean) { return isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)' }

// ── Phase timing ─────────────────────────────────────────────────────
//
// Segment boundaries must match ramanujanDemoNarration.ts exactly.

const PHASE = {
  // Phase 0: S diverges
  divergeStart: 0.00,
  divergeEnd: 0.10,

  // Phase 1: Grandi's series
  grandiStart: 0.10,
  grandiMid: 0.18,
  grandiEnd: 0.25,

  // Phase 2: Alternating series
  altStart: 0.25,
  altMid1: 0.33,    // wobbly introduced
  altMid2: 0.40,    // shifted addition trick
  altEnd: 0.45,     // c₂ = ¼ revealed

  // Phase 3: Subtraction
  subStart: 0.45,
  subMid1: 0.55,    // line them up
  subMid2: 0.63,    // poof results
  subEnd: 0.70,     // 4S conclusion

  // Phase 4: Revelation
  revealStart: 0.70,
  revealMid1: 0.80, // cognitive dissonance
  revealMid2: 0.90, // negative!
  revealEnd: 1.00,  // −1/12 starburst
} as const

// ── Viewport ─────────────────────────────────────────────────────────

/**
 * Target viewport for the Ramanujan demo.
 * Phase 0 needs [0,15] for divergence; Phases 1-3 shift to [−3,5]
 * for derivation work; Phase 4 zooms to [−0.5,0.5] for the reveal.
 * Viewport keyframes in useConstantDemo.ts handle the transitions.
 */
export function ramanujanDemoViewport(cssWidth: number, _cssHeight: number) {
  const center = 7.5
  const pixelsPerUnit = cssWidth * 0.85 / 15
  return { center, pixelsPerUnit }
}

// ── Drawing helpers ──────────────────────────────────────────────────

/** Draw a glowing dot at a screen position */
function drawDot(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  color: string,
  alpha: number,
  glow = true
) {
  if (alpha <= 0) return
  if (glow) {
    ctx.beginPath()
    ctx.arc(x, y, r * 2.5, 0, Math.PI * 2)
    ctx.fillStyle = color
    ctx.globalAlpha = alpha * 0.15
    ctx.fill()
  }
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fillStyle = color
  ctx.globalAlpha = alpha
  ctx.fill()
}

/** Draw a number chip (rounded rect with text) */
function drawChip(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  text: string,
  color: string,
  alpha: number,
  fontSize: number,
  highlight = false
) {
  if (alpha <= 0.01) return
  const pad = fontSize * 0.5
  ctx.font = `bold ${fontSize}px system-ui, sans-serif`
  const tw = ctx.measureText(text).width
  const w = tw + pad * 2
  const h = fontSize * 1.5

  // Background
  const rx = x - w / 2
  const ry = y - h / 2
  const rad = 4
  ctx.beginPath()
  ctx.moveTo(rx + rad, ry)
  ctx.lineTo(rx + w - rad, ry)
  ctx.quadraticCurveTo(rx + w, ry, rx + w, ry + rad)
  ctx.lineTo(rx + w, ry + h - rad)
  ctx.quadraticCurveTo(rx + w, ry + h, rx + w - rad, ry + h)
  ctx.lineTo(rx + rad, ry + h)
  ctx.quadraticCurveTo(rx, ry + h, rx, ry + h - rad)
  ctx.lineTo(rx, ry + rad)
  ctx.quadraticCurveTo(rx, ry, rx + rad, ry)
  ctx.closePath()

  ctx.fillStyle = color
  ctx.globalAlpha = alpha * (highlight ? 0.35 : 0.2)
  ctx.fill()
  ctx.strokeStyle = color
  ctx.lineWidth = highlight ? 2 : 1
  ctx.globalAlpha = alpha * (highlight ? 0.9 : 0.6)
  ctx.stroke()

  // Text
  ctx.fillStyle = color
  ctx.globalAlpha = alpha
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, x, y)
}

/** Draw a ½ or ¼ marker on the number line */
function drawValueMarker(
  ctx: CanvasRenderingContext2D,
  toX: (v: number) => number,
  axisY: number,
  value: number,
  label: string,
  color: string,
  alpha: number,
  ppu: number
) {
  if (alpha <= 0.01) return
  const sx = toX(value)
  const markerH = Math.max(12, Math.min(24, ppu * 0.15))

  // Vertical line
  ctx.beginPath()
  ctx.moveTo(sx, axisY - markerH)
  ctx.lineTo(sx, axisY + markerH)
  ctx.strokeStyle = color
  ctx.lineWidth = 2
  ctx.globalAlpha = alpha * 0.8
  ctx.stroke()

  // Glow dot
  drawDot(ctx, sx, axisY, 4, color, alpha * 0.9)

  // Label above
  const fs = Math.max(14, Math.min(20, ppu * 0.15))
  ctx.font = `bold ${fs}px system-ui, sans-serif`
  ctx.fillStyle = color
  ctx.textAlign = 'center'
  ctx.textBaseline = 'bottom'
  ctx.globalAlpha = alpha
  ctx.fillText(label, sx, axisY - markerH - 4)
}

/** Draw a starburst at a screen position */
function drawStarburst(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  color: string,
  alpha: number,
  time: number
) {
  if (alpha <= 0.01) return
  const numRays = 12

  // Outer glow
  ctx.beginPath()
  ctx.arc(cx, cy, r * 2, 0, Math.PI * 2)
  ctx.fillStyle = color
  ctx.globalAlpha = alpha * 0.1
  ctx.fill()

  // Rays
  for (let i = 0; i < numRays; i++) {
    const angle = (i / numRays) * Math.PI * 2 + time * 0.5
    const outerR = r * (1.2 + 0.3 * Math.sin(time * 3 + i))
    const innerR = r * 0.4

    ctx.beginPath()
    ctx.moveTo(
      cx + Math.cos(angle - 0.08) * innerR,
      cy + Math.sin(angle - 0.08) * innerR
    )
    ctx.lineTo(cx + Math.cos(angle) * outerR, cy + Math.sin(angle) * outerR)
    ctx.lineTo(
      cx + Math.cos(angle + 0.08) * innerR,
      cy + Math.sin(angle + 0.08) * innerR
    )
    ctx.closePath()
    ctx.fillStyle = color
    ctx.globalAlpha = alpha * 0.6
    ctx.fill()
  }

  // Center dot
  ctx.beginPath()
  ctx.arc(cx, cy, r * 0.5, 0, Math.PI * 2)
  ctx.fillStyle = color
  ctx.globalAlpha = alpha
  ctx.fill()
}

/** Draw a trail of fading dots */
function drawTrail(
  ctx: CanvasRenderingContext2D,
  points: { x: number; y: number }[],
  color: string,
  alpha: number,
  dotR: number
) {
  if (alpha <= 0.01 || points.length === 0) return
  for (let i = 0; i < points.length; i++) {
    const fade = (i + 1) / points.length
    ctx.beginPath()
    ctx.arc(points[i].x, points[i].y, dotR * fade, 0, Math.PI * 2)
    ctx.fillStyle = color
    ctx.globalAlpha = alpha * fade * 0.5
    ctx.fill()
  }
}

// ── Main render ──────────────────────────────────────────────────────

export function renderRamanujanOverlay(
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
  const dotR = Math.max(4, Math.min(8, ppu * 0.05))
  const chipFs = Math.max(11, Math.min(15, ppu * 0.12))

  ctx.save()

  // ================================================================
  // PHASE 0: S = 1+2+3+… diverges
  // ================================================================
  if (revealProgress >= PHASE.divergeStart && revealProgress < PHASE.grandiEnd) {
    const p = mapRange(revealProgress, PHASE.divergeStart, PHASE.divergeEnd)
    const fadeOut = 1 - smoothstep(mapRange(revealProgress, PHASE.grandiStart, PHASE.grandiStart + 0.03))

    // Partial sums: 1, 3, 6, 10, 15
    const partialSums = [1, 3, 6, 10, 15]
    const trailPts: { x: number; y: number }[] = []

    // How many terms are visible depends on progress
    const numVisible = Math.min(partialSums.length, Math.floor(p * (partialSums.length + 1)))

    for (let i = 0; i < numVisible; i++) {
      const val = partialSums[i]
      const sx = toX(val)
      const entryT = mapRange(p, i / (partialSums.length + 1), (i + 0.8) / (partialSums.length + 1))
      const dotAlpha = smoothstep(entryT) * opacity * fadeOut
      trailPts.push({ x: sx, y: axisY })
      drawDot(ctx, sx, axisY, dotR * (i === numVisible - 1 ? 1.3 : 0.8), sCol(isDark), dotAlpha)

      // Label partial sum
      if (dotAlpha > 0.3 && i === numVisible - 1) {
        const fs = Math.max(10, Math.min(13, ppu * 0.1))
        ctx.font = `${fs}px system-ui, sans-serif`
        ctx.fillStyle = sCol(isDark)
        ctx.textAlign = 'center'
        ctx.textBaseline = 'bottom'
        ctx.globalAlpha = dotAlpha * 0.8
        ctx.fillText(`${val}`, sx, axisY - dotR * 2 - 4)
      }
    }

    // Trail
    drawTrail(ctx, trailPts, sCol(isDark), opacity * fadeOut * 0.7, dotR * 0.6)

    // "S" label and description
    if (p > 0.3 && fadeOut > 0.01) {
      const labelAlpha = smoothstep(mapRange(p, 0.3, 0.6)) * opacity * fadeOut
      const fs = Math.max(12, Math.min(16, ppu * 0.12))
      ctx.font = `bold ${fs}px system-ui, sans-serif`
      ctx.fillStyle = sCol(isDark)
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ctx.globalAlpha = labelAlpha
      ctx.fillText('S = 1 + 2 + 3 + 4 + ...', toX(7.5), axisY + dotR + 12)
    }

    // Infinity symbol at the end
    if (p > 0.8 && fadeOut > 0.01) {
      const infAlpha = smoothstep(mapRange(p, 0.8, 1)) * opacity * fadeOut
      const fs = Math.max(18, Math.min(28, ppu * 0.2))
      ctx.font = `bold ${fs}px system-ui, sans-serif`
      ctx.fillStyle = sCol(isDark)
      ctx.textAlign = 'left'
      ctx.textBaseline = 'middle'
      ctx.globalAlpha = infAlpha
      ctx.fillText('→ ∞!', toX(15) + 8, axisY)
    }
  }

  // ================================================================
  // PHASE 1: Grandi's series — bouncing dot between 0 and 1
  // ================================================================
  if (revealProgress >= PHASE.grandiStart && revealProgress < PHASE.altEnd) {
    const entryP = smoothstep(mapRange(revealProgress, PHASE.grandiStart, PHASE.grandiStart + 0.03))
    const exitP = 1 - smoothstep(mapRange(revealProgress, PHASE.altStart, PHASE.altStart + 0.03))
    const phaseAlpha = entryP * exitP * opacity

    if (phaseAlpha > 0.01) {
      // Bouncing dot: oscillates between partial sums 0 and 1
      const bounceP = mapRange(revealProgress, PHASE.grandiStart, PHASE.grandiEnd)
      const bounceCount = 6
      const bounceT = (bounceP * bounceCount) % 1
      const bounceIdx = Math.floor(bounceP * bounceCount)
      // Even indices: moving from current position to 1; odd: moving to 0
      const from = bounceIdx % 2 === 0 ? 0 : 1
      const to = bounceIdx % 2 === 0 ? 1 : 0
      const eased = easeInOut(bounceT)
      const dotVal = from + (to - from) * eased

      // Trail of previous positions
      const trailPts: { x: number; y: number }[] = []
      for (let i = 0; i < Math.min(bounceIdx, 4); i++) {
        const v = i % 2 === 0 ? 1 : 0
        trailPts.push({ x: toX(v), y: axisY })
      }
      drawTrail(ctx, trailPts, c1Col(isDark), phaseAlpha * 0.5, dotR * 0.5)

      // Active bouncing dot
      drawDot(ctx, toX(dotVal), axisY, dotR * 1.2, c1Col(isDark), phaseAlpha)

      // Series label
      const labelAlpha = smoothstep(mapRange(bounceP, 0.05, 0.2)) * phaseAlpha
      if (labelAlpha > 0.01) {
        const fs = Math.max(11, Math.min(14, ppu * 0.11))
        ctx.font = `${fs}px system-ui, sans-serif`
        ctx.fillStyle = c1Col(isDark)
        ctx.textAlign = 'center'
        ctx.textBaseline = 'top'
        ctx.globalAlpha = labelAlpha
        ctx.fillText('c\u2081 = 1 \u2212 1 + 1 \u2212 1 + ...', toX(0.5), axisY + dotR + 16)
      }

      // Phase 1b: ½ marker appears
      if (revealProgress >= PHASE.grandiMid) {
        const halfP = smoothstep(mapRange(revealProgress, PHASE.grandiMid, PHASE.grandiMid + 0.03))
        drawValueMarker(ctx, toX, axisY, 0.5, '\u00BD', c1Col(isDark), halfP * phaseAlpha, ppu)

        // "Clue #1" label
        if (halfP > 0.5) {
          const clueAlpha = smoothstep(mapRange(halfP, 0.5, 1)) * phaseAlpha
          const fs = Math.max(10, Math.min(13, ppu * 0.1))
          ctx.font = `italic ${fs}px system-ui, sans-serif`
          ctx.fillStyle = c1Col(isDark)
          ctx.textAlign = 'center'
          ctx.textBaseline = 'top'
          ctx.globalAlpha = clueAlpha * 0.8
          ctx.fillText('Clue #1: c\u2081 = \u00BD', toX(0.5), axisY + dotR + 36)
        }
      }
    }
  }

  // ================================================================
  // PHASE 2: Alternating series c₂ = 1−2+3−4+… = ¼
  // ================================================================
  if (revealProgress >= PHASE.altStart && revealProgress < PHASE.subEnd) {
    const entryP = smoothstep(mapRange(revealProgress, PHASE.altStart, PHASE.altStart + 0.03))
    const exitP = 1 - smoothstep(mapRange(revealProgress, PHASE.subStart, PHASE.subStart + 0.03))
    const phaseAlpha = entryP * exitP * opacity

    if (phaseAlpha > 0.01) {
      // Phase 2a: Wobbly bouncing dot (partial sums 1, -1, 2, -2, 3, -3)
      if (revealProgress < PHASE.altMid1) {
        const wobbleP = mapRange(revealProgress, PHASE.altStart, PHASE.altMid1)
        const wobblyPartials = [1, -1, 2, -2, 3, -3]
        const numShown = Math.min(wobblyPartials.length, Math.floor(wobbleP * (wobblyPartials.length + 1)))

        const trailPts: { x: number; y: number }[] = []
        for (let i = 0; i < numShown; i++) {
          const val = wobblyPartials[i]
          const sx = toX(val)
          trailPts.push({ x: sx, y: axisY })
          const isLast = i === numShown - 1
          drawDot(ctx, sx, axisY, dotR * (isLast ? 1.2 : 0.7), c2Col(isDark), phaseAlpha * (isLast ? 1 : 0.4))
        }
        drawTrail(ctx, trailPts, c2Col(isDark), phaseAlpha * 0.4, dotR * 0.4)

        // Label
        const labelAlpha = smoothstep(mapRange(wobbleP, 0.1, 0.3)) * phaseAlpha
        if (labelAlpha > 0.01) {
          const fs = Math.max(11, Math.min(14, ppu * 0.11))
          ctx.font = `${fs}px system-ui, sans-serif`
          ctx.fillStyle = c2Col(isDark)
          ctx.textAlign = 'center'
          ctx.textBaseline = 'top'
          ctx.globalAlpha = labelAlpha
          ctx.fillText('c\u2082 = 1 \u2212 2 + 3 \u2212 4 + ...', toX(0.5), axisY + dotR + 16)
        }
      }

      // Phase 2b: Staggered addition trick — two rows of chips
      if (revealProgress >= PHASE.altMid1 && revealProgress < PHASE.altEnd) {
        const trickP = mapRange(revealProgress, PHASE.altMid1, PHASE.altMid2)
        const resultP = mapRange(revealProgress, PHASE.altMid2, PHASE.altEnd)
        const rowY1 = axisY - 40
        const rowY2 = axisY - 15
        const rowYResult = axisY + 20

        // First copy of c₂: +1, −2, +3, −4
        const terms1 = ['+1', '\u22122', '+3', '\u22124']
        // Second copy (shifted): gap, +1, −2, +3
        const terms2 = ['', '+1', '\u22122', '+3']
        // Sum (Bouncy): +1, −1, +1, −1
        const sums = ['+1', '\u22121', '+1', '\u22121']

        const spacing = Math.max(35, Math.min(55, ppu * 0.4))
        const startX = toX(-1)

        for (let i = 0; i < 4; i++) {
          const chipX = startX + i * spacing
          const showT = smoothstep(mapRange(trickP, i * 0.15, i * 0.15 + 0.3))

          // Row 1
          if (terms1[i]) {
            drawChip(ctx, chipX, rowY1, terms1[i], c2Col(isDark), phaseAlpha * showT, chipFs)
          }

          // Row 2 (shifted)
          if (terms2[i]) {
            drawChip(ctx, chipX, rowY2, terms2[i], c2Col(isDark), phaseAlpha * showT * 0.8, chipFs)
          }

          // Result row (Bouncy Team)
          if (resultP > 0) {
            const resT = smoothstep(mapRange(resultP, i * 0.15, i * 0.15 + 0.3))
            drawChip(ctx, chipX, rowYResult, sums[i], c1Col(isDark), phaseAlpha * resT, chipFs, true)
          }
        }

        // Labels for rows
        if (trickP > 0.1) {
          const fs = Math.max(9, Math.min(12, ppu * 0.09))
          ctx.font = `${fs}px system-ui, sans-serif`
          ctx.textAlign = 'right'
          ctx.textBaseline = 'middle'
          ctx.fillStyle = c2Col(isDark)
          ctx.globalAlpha = phaseAlpha * smoothstep(mapRange(trickP, 0.1, 0.3))
          ctx.fillText('c\u2082:', startX - 12, rowY1)
          ctx.fillText('c\u2082:', startX - 12, rowY2)
        }
        if (resultP > 0.3) {
          const fs = Math.max(9, Math.min(12, ppu * 0.09))
          ctx.font = `${fs}px system-ui, sans-serif`
          ctx.textAlign = 'right'
          ctx.textBaseline = 'middle'
          ctx.fillStyle = c1Col(isDark)
          ctx.globalAlpha = phaseAlpha * smoothstep(mapRange(resultP, 0.3, 0.6))
          ctx.fillText('2c\u2082 = c\u2081', startX - 12, rowYResult)
        }

        // Phase 2c: c₂ = ¼ marker
        if (revealProgress >= PHASE.altMid2) {
          const quarterP = smoothstep(mapRange(revealProgress, PHASE.altMid2 + 0.02, PHASE.altEnd))
          drawValueMarker(ctx, toX, axisY, 0.25, '\u00BC', c2Col(isDark), quarterP * phaseAlpha, ppu)

          if (quarterP > 0.5) {
            const clueAlpha = smoothstep(mapRange(quarterP, 0.5, 1)) * phaseAlpha
            const fs = Math.max(10, Math.min(13, ppu * 0.1))
            ctx.font = `italic ${fs}px system-ui, sans-serif`
            ctx.fillStyle = c2Col(isDark)
            ctx.textAlign = 'center'
            ctx.textBaseline = 'top'
            ctx.globalAlpha = clueAlpha * 0.8
            ctx.fillText('Clue #2: c\u2082 = \u00BC', toX(0.25), axisY + dotR + 36)
          }
        }
      }
    }
  }

  // ================================================================
  // PHASE 3: Subtraction S − c₂ = 4S
  // ================================================================
  if (revealProgress >= PHASE.subStart && revealProgress < PHASE.revealEnd) {
    const entryP = smoothstep(mapRange(revealProgress, PHASE.subStart, PHASE.subStart + 0.03))
    const exitP = 1 - smoothstep(mapRange(revealProgress, PHASE.revealStart, PHASE.revealStart + 0.03))
    const phaseAlpha = entryP * exitP * opacity

    if (phaseAlpha > 0.01) {
      const spacing = Math.max(35, Math.min(55, ppu * 0.4))
      const startX = toX(-1.5)
      const rowYS = axisY - 50
      const rowYC2 = axisY - 25
      const rowYResult = axisY + 10

      // S terms: 1, 2, 3, 4, 5, 6
      const sTerms = ['1', '2', '3', '4', '5', '6']
      // c₂ terms: 1, −2, 3, −4, 5, −6
      const c2Terms = ['1', '\u22122', '3', '\u22124', '5', '\u22126']
      // Result: S − c₂ = 0, 4, 0, 8, 0, 12
      const resultTerms = ['0', '4', '0', '8', '0', '12']

      // Phase 3a: Line up the rows
      const lineupP = mapRange(revealProgress, PHASE.subStart, PHASE.subMid1)

      for (let i = 0; i < 6; i++) {
        const chipX = startX + i * spacing
        const showT = smoothstep(mapRange(lineupP, i * 0.1, i * 0.1 + 0.25))

        // S row
        drawChip(ctx, chipX, rowYS, sTerms[i], sCol(isDark), phaseAlpha * showT, chipFs)

        // c₂ row
        drawChip(ctx, chipX, rowYC2, c2Terms[i], c2Col(isDark), phaseAlpha * showT * 0.9, chipFs)
      }

      // Labels
      if (lineupP > 0.1) {
        const fs = Math.max(9, Math.min(12, ppu * 0.09))
        ctx.font = `${fs}px system-ui, sans-serif`
        ctx.textAlign = 'right'
        ctx.textBaseline = 'middle'
        ctx.globalAlpha = phaseAlpha * smoothstep(mapRange(lineupP, 0.1, 0.3))
        ctx.fillStyle = sCol(isDark)
        ctx.fillText('S:', startX - 12, rowYS)
        ctx.fillStyle = c2Col(isDark)
        ctx.fillText('\u2212c\u2082:', startX - 12, rowYC2)
      }

      // Minus sign between rows
      if (lineupP > 0.4) {
        const minusAlpha = smoothstep(mapRange(lineupP, 0.4, 0.7)) * phaseAlpha
        const fs = Math.max(14, Math.min(20, ppu * 0.15))
        ctx.font = `bold ${fs}px system-ui, sans-serif`
        ctx.fillStyle = textColor(isDark)
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.globalAlpha = minusAlpha
        // Horizontal line between S and c₂ rows
        const lineStartX = startX - 8
        const lineEndX = startX + 5.5 * spacing + 8
        ctx.beginPath()
        ctx.moveTo(lineStartX, (rowYS + rowYC2) / 2 + 3)
        ctx.lineTo(lineEndX, (rowYS + rowYC2) / 2 + 3)
        ctx.strokeStyle = textColor(isDark)
        ctx.lineWidth = 1.5
        ctx.globalAlpha = minusAlpha * 0.5
        ctx.stroke()
      }

      // Phase 3b: Results appear with "poof" effect
      if (revealProgress >= PHASE.subMid1) {
        const resultP = mapRange(revealProgress, PHASE.subMid1, PHASE.subMid2)

        for (let i = 0; i < 6; i++) {
          const chipX = startX + i * spacing
          const resT = smoothstep(mapRange(resultP, i * 0.12, i * 0.12 + 0.2))

          if (resT > 0.01) {
            const isZero = resultTerms[i] === '0'
            const resultColor = isZero ? subtextColor(isDark) : resultCol(isDark)

            // "Poof" flash for non-zero results
            if (!isZero && resT < 0.8) {
              const flashR = dotR * 3 * (1 - resT)
              ctx.beginPath()
              ctx.arc(chipX, rowYResult, flashR, 0, Math.PI * 2)
              ctx.fillStyle = resultCol(isDark)
              ctx.globalAlpha = phaseAlpha * (1 - resT) * 0.3
              ctx.fill()
            }

            drawChip(ctx, chipX, rowYResult, resultTerms[i], resultColor, phaseAlpha * resT, chipFs, !isZero)
          }
        }

        // Result label
        if (resultP > 0.5) {
          const fs = Math.max(9, Math.min(12, ppu * 0.09))
          ctx.font = `${fs}px system-ui, sans-serif`
          ctx.textAlign = 'right'
          ctx.textBaseline = 'middle'
          ctx.fillStyle = resultCol(isDark)
          ctx.globalAlpha = phaseAlpha * smoothstep(mapRange(resultP, 0.5, 0.8))
          ctx.fillText('S\u2212c\u2082:', startX - 12, rowYResult)
        }
      }

      // Phase 3c: "= 4S" conclusion
      if (revealProgress >= PHASE.subMid2) {
        const concP = smoothstep(mapRange(revealProgress, PHASE.subMid2, PHASE.subEnd))
        const fs = Math.max(14, Math.min(20, ppu * 0.15))

        // "0, 4, 0, 8, 0, 12  =  4 × (1+2+3+...) = 4S"
        ctx.font = `bold ${fs}px system-ui, sans-serif`
        ctx.fillStyle = resultCol(isDark)
        ctx.textAlign = 'center'
        ctx.textBaseline = 'top'
        ctx.globalAlpha = phaseAlpha * concP
        ctx.fillText('S \u2212 \u00BC = 4S', toX(0.5), axisY + 40)

        if (concP > 0.5) {
          const subFs = Math.max(10, Math.min(13, ppu * 0.1))
          ctx.font = `italic ${subFs}px system-ui, sans-serif`
          ctx.fillStyle = subtextColor(isDark)
          ctx.textAlign = 'center'
          ctx.textBaseline = 'top'
          ctx.globalAlpha = phaseAlpha * smoothstep(mapRange(concP, 0.5, 1)) * 0.8
          ctx.fillText('(because 0+4+0+8+0+12+... = 4S)', toX(0.5), axisY + 40 + fs + 4)
        }
      }
    }
  }

  // ================================================================
  // PHASE 4: Revelation — S = −1/12
  // ================================================================
  if (revealProgress >= PHASE.revealStart) {
    const revealP = mapRange(revealProgress, PHASE.revealStart, PHASE.revealEnd)

    // Phase 4a: Cognitive dissonance — "?"
    if (revealProgress < PHASE.revealMid2) {
      const questionP = smoothstep(mapRange(revealProgress, PHASE.revealStart, PHASE.revealMid1))
      const questionFade = 1 - smoothstep(mapRange(revealProgress, PHASE.revealMid1 + 0.02, PHASE.revealMid2))
      const qAlpha = questionP * questionFade * opacity

      if (qAlpha > 0.01) {
        const fs = Math.max(20, Math.min(32, ppu * 0.25))
        ctx.font = `bold ${fs}px system-ui, sans-serif`
        ctx.fillStyle = sCol(isDark)
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.globalAlpha = qAlpha
        const wobble = Math.sin(revealP * 20) * 3
        ctx.fillText('S \u2212 \u00BC = 4S  ???', toX(0), axisY + wobble)
      }
    }

    // Phase 4b: Algebra — "−¼ = 3S → S = −1/12"
    if (revealProgress >= PHASE.revealMid1) {
      const algP = smoothstep(mapRange(revealProgress, PHASE.revealMid1, PHASE.revealMid2))
      const algFade = revealProgress < PHASE.revealMid2
        ? 1
        : 1 - smoothstep(mapRange(revealProgress, PHASE.revealMid2 + 0.03, PHASE.revealEnd - 0.03))
      const algAlpha = algP * Math.max(0.3, algFade) * opacity

      if (algAlpha > 0.01) {
        // Step 1: −¼ = 3S
        const fs1 = Math.max(16, Math.min(24, ppu * 0.2))
        ctx.font = `bold ${fs1}px system-ui, sans-serif`
        ctx.fillStyle = resultCol(isDark)
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.globalAlpha = algAlpha
        ctx.fillText('\u2212\u00BC = 3S', toX(0), axisY - 20)

        // Step 2: S = −1/12
        if (algP > 0.5) {
          const step2P = smoothstep(mapRange(algP, 0.5, 1))
          const fs2 = Math.max(18, Math.min(28, ppu * 0.22))
          ctx.font = `bold ${fs2}px system-ui, sans-serif`
          ctx.fillStyle = resultCol(isDark)
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.globalAlpha = algAlpha * step2P
          ctx.fillText('S = \u22121/12', toX(0), axisY + 15)
        }
      }
    }

    // Phase 4c: Starburst at −1/12
    if (revealProgress >= PHASE.revealMid2) {
      const starP = smoothstep(mapRange(revealProgress, PHASE.revealMid2, PHASE.revealEnd))
      const starAlpha = starP * opacity

      const targetVal = -1 / 12
      const sx = toX(targetVal)

      // Starburst
      const burstR = Math.max(15, Math.min(35, ppu * 0.25)) * starP
      drawStarburst(ctx, sx, axisY, burstR, resultCol(isDark), starAlpha, revealP * Math.PI * 4)

      // Value marker on number line
      drawValueMarker(ctx, toX, axisY, targetVal, '\u22121/12', resultCol(isDark), starAlpha, ppu)

      // Big label
      if (starP > 0.3) {
        const labelP = smoothstep(mapRange(starP, 0.3, 0.7))
        const fs = Math.max(22, Math.min(34, ppu * 0.28))
        ctx.font = `bold ${fs}px system-ui, sans-serif`
        ctx.fillStyle = resultCol(isDark)
        ctx.textAlign = 'center'
        ctx.textBaseline = 'bottom'
        ctx.globalAlpha = opacity * labelP
        const targetY = axisY - Math.max(12, Math.min(24, ppu * 0.15)) - burstR - 8
        ctx.fillText('\u22121/12', sx, targetY)
      }

      // Subtitle
      if (starP > 0.6) {
        const subP = smoothstep(mapRange(starP, 0.6, 1))
        const fs = Math.max(10, Math.min(14, ppu * 0.11))
        ctx.font = `${fs}px system-ui, sans-serif`
        ctx.fillStyle = subtextColor(isDark)
        ctx.textAlign = 'center'
        ctx.textBaseline = 'top'
        ctx.globalAlpha = opacity * subP * 0.8
        ctx.fillText('1 + 2 + 3 + 4 + ... = \u22121/12', sx, axisY + burstR + 12)
      }

      // Formula
      if (starP > 0.8) {
        const formulaP = smoothstep(mapRange(starP, 0.8, 1))
        const fs = Math.max(9, Math.min(11, ppu * 0.09))
        ctx.font = `${fs}px system-ui, sans-serif`
        ctx.fillStyle = subtextColor(isDark)
        ctx.textAlign = 'center'
        ctx.textBaseline = 'top'
        ctx.globalAlpha = opacity * formulaP * 0.5
        ctx.fillText('Ramanujan summation (1913)', sx, axisY + burstR + 30)
      }
    }
  }

  ctx.globalAlpha = 1
  ctx.setLineDash([])
  ctx.restore()
}
