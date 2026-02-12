import type { NumberLineState } from '../../types'
import { numberToScreenX } from '../../numberLineTicks'

/**
 * √2 Demo: "The Magic Shortcut"
 *
 * Visualises √2 ≈ 1.414 as the diagonal of a unit square.
 *
 * A 1×1 square sits on the number line with its base from 0 to 1.
 * The diagonal — the "shortcut" — is highlighted, then rotated down
 * (compass-arm style) to lie on the number line, landing at √2.
 *
 * The demo also shows why the shortcut is this length: the two
 * side-squares (area 1 each) combine to fill the diagonal-square
 * (area 2), planting the Pythagorean theorem seed visually.
 *
 * Finally we zoom in to show that √2's decimal expansion never
 * terminates, building intuition for irrational numbers.
 */

// ── Constants ────────────────────────────────────────────────────────

const SQRT2 = Math.SQRT2 // 1.4142135623730951

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

// ── Phase timing ─────────────────────────────────────────────────────
// Must align with sqrt2DemoNarration.ts segment boundaries.

const PHASE = {
  // Seg 1: journey starts
  startBegin: 0.00,
  startEnd: 0.10,
  // Seg 2: long path (draw square + highlight two sides)
  longPathBegin: 0.10,
  longPathEnd: 0.25,
  // Seg 3: shortcut diagonal appears
  shortcutBegin: 0.25,
  shortcutEnd: 0.35,
  // Seg 4: compass rotation
  rotateBegin: 0.35,
  rotateEnd: 0.50,
  // Seg 5: mystery spot
  mysteryBegin: 0.50,
  mysteryEnd: 0.60,
  // Seg 6: area proof (box squares)
  proofBegin: 0.60,
  proofEnd: 0.80,
  // Seg 7: zoom in on decimals
  zoomBegin: 0.80,
  zoomEnd: 0.92,
  // Seg 8: final reveal
  revealBegin: 0.92,
  revealEnd: 1.00,
} as const

// ── Colors ───────────────────────────────────────────────────────────

function squareCol(isDark: boolean) { return isDark ? '#60a5fa' : '#3b82f6' }     // blue
function pathCol(isDark: boolean) { return isDark ? '#fb923c' : '#ea580c' }        // orange
function diagCol(isDark: boolean) { return isDark ? '#34d399' : '#059669' }        // green
function diagColBright(isDark: boolean) { return isDark ? '#6ee7b7' : '#10b981' }
function proofColA(isDark: boolean) { return isDark ? '#f87171' : '#dc2626' }      // red
function proofColB(isDark: boolean) { return isDark ? '#a78bfa' : '#7c3aed' }      // purple
function textCol(isDark: boolean) { return isDark ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.8)' }
function subtextCol(isDark: boolean) { return isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)' }

// ── Viewport ─────────────────────────────────────────────────────────

export function sqrt2DemoViewport(cssWidth: number, cssHeight: number) {
  // Center on [0, √2] with some padding; square is above axis up to height ~ppu
  const center = SQRT2 / 2 + 0.1
  const ppu = Math.min(cssWidth * 0.65 / (SQRT2 + 0.8), cssHeight * 0.28)
  return { center, pixelsPerUnit: ppu }
}

// ── Drawing helpers ──────────────────────────────────────────────────

/** Convert a number-line value to screen x */
type ToX = (v: number) => number

/** Convert a height in NL units to screen pixels */
function hPx(val: number, ppu: number): number {
  return val * ppu
}

/** Draw the unit square outline above the axis */
function drawSquare(
  ctx: CanvasRenderingContext2D,
  toX: ToX,
  axisY: number,
  ppu: number,
  isDark: boolean,
  alpha: number,
  fillAlpha = 0.08
) {
  const x0 = toX(0)
  const x1 = toX(1)
  const h = hPx(1, ppu)
  const y0 = axisY
  const y1 = axisY - h

  // Fill
  ctx.fillStyle = squareCol(isDark)
  ctx.globalAlpha = alpha * fillAlpha
  ctx.fillRect(x0, y1, x1 - x0, h)

  // Outline
  ctx.strokeStyle = squareCol(isDark)
  ctx.lineWidth = 2
  ctx.globalAlpha = alpha * 0.7
  ctx.strokeRect(x0, y1, x1 - x0, h)
}

/** Draw the "long path" — bottom + right edge of square, highlighted */
function drawLongPath(
  ctx: CanvasRenderingContext2D,
  toX: ToX,
  axisY: number,
  ppu: number,
  isDark: boolean,
  alpha: number,
  /** 0-1: how much of the path is drawn (0=none, 0.5=bottom done, 1=bottom+right) */
  progress: number
) {
  if (progress <= 0 || alpha <= 0) return

  const x0 = toX(0)
  const x1 = toX(1)
  const h = hPx(1, ppu)

  ctx.strokeStyle = pathCol(isDark)
  ctx.lineWidth = 3.5
  ctx.lineCap = 'round'
  ctx.globalAlpha = alpha

  ctx.beginPath()
  ctx.moveTo(x0, axisY)

  if (progress <= 0.5) {
    // Drawing the bottom edge
    const bp = progress / 0.5
    ctx.lineTo(x0 + (x1 - x0) * bp, axisY)
  } else {
    // Bottom edge complete, drawing right edge
    ctx.lineTo(x1, axisY)
    const rp = (progress - 0.5) / 0.5
    ctx.lineTo(x1, axisY - h * rp)
  }

  ctx.stroke()
}

/** Draw the diagonal line at a given rotation angle (0 = pointing up to (1,1), π/4 = flat on axis) */
function drawDiagonal(
  ctx: CanvasRenderingContext2D,
  toX: ToX,
  axisY: number,
  ppu: number,
  isDark: boolean,
  alpha: number,
  /** Angle from vertical: 0 = diagonal in square, π/4 = flat on number line */
  angle: number,
  bright = false
) {
  if (alpha <= 0) return

  const ox = toX(0)
  const length = hPx(SQRT2, ppu)

  // The diagonal at angle=0 goes from (0,0) to (1,1) in NL coords.
  // Angle is measured from the original diagonal direction.
  // At angle=0: endpoint is at (1, 1) → screen (toX(1), axisY - hPx(1,ppu))
  // At angle=π/4: endpoint is at (√2, 0) → screen (toX(√2), axisY)
  //
  // Original angle of the diagonal above horizontal = atan(1/1) = π/4
  // Rotating from original position by `angle` radians clockwise
  const baseAngle = Math.PI / 4  // 45° above horizontal
  const currentAngle = baseAngle - angle  // decreasing toward 0 (horizontal)

  const endX = ox + length * Math.cos(currentAngle)
  const endY = axisY - length * Math.sin(currentAngle)

  ctx.beginPath()
  ctx.moveTo(ox, axisY)
  ctx.lineTo(endX, endY)
  ctx.strokeStyle = bright ? diagColBright(isDark) : diagCol(isDark)
  ctx.lineWidth = 3.5
  ctx.lineCap = 'round'
  ctx.globalAlpha = alpha
  ctx.stroke()

  // Endpoint dot
  ctx.beginPath()
  ctx.arc(endX, endY, 4, 0, Math.PI * 2)
  ctx.fillStyle = bright ? diagColBright(isDark) : diagCol(isDark)
  ctx.globalAlpha = alpha * 0.9
  ctx.fill()
}

/** Draw the compass arc (trace of diagonal tip during rotation) */
function drawArc(
  ctx: CanvasRenderingContext2D,
  toX: ToX,
  axisY: number,
  ppu: number,
  isDark: boolean,
  alpha: number,
  /** 0-1: how much of the arc is drawn */
  progress: number
) {
  if (progress <= 0 || alpha <= 0) return

  const ox = toX(0)
  const radius = hPx(SQRT2, ppu)

  // Arc from 45° above horizontal to 0° (horizontal)
  const startAngle = -Math.PI / 4  // canvas angles: negative = above x-axis
  const endAngle = 0
  const arcEnd = startAngle + (endAngle - startAngle) * progress

  ctx.beginPath()
  ctx.arc(ox, axisY, radius, startAngle, arcEnd)
  ctx.strokeStyle = diagCol(isDark)
  ctx.lineWidth = 1.5
  ctx.setLineDash([4, 3])
  ctx.globalAlpha = alpha * 0.5
  ctx.stroke()
  ctx.setLineDash([])
}

/** Draw a side-square (for the Pythagorean proof) */
function drawProofSquare(
  ctx: CanvasRenderingContext2D,
  /** Top-left x, top-left y, width, height in screen coords */
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  color: string,
  alpha: number,
  fillAlpha = 0.35
) {
  ctx.fillStyle = color
  ctx.globalAlpha = alpha * fillAlpha
  ctx.fillRect(sx, sy, sw, sh)

  ctx.strokeStyle = color
  ctx.lineWidth = 1.5
  ctx.globalAlpha = alpha * 0.8
  ctx.strokeRect(sx, sy, sw, sh)
}

/** Draw the tilted square on the diagonal (area = 2) */
function drawTiltedSquare(
  ctx: CanvasRenderingContext2D,
  toX: ToX,
  axisY: number,
  ppu: number,
  color: string,
  alpha: number,
  fillAlpha = 0.2
) {
  // The tilted square has the diagonal as one side.
  // Vertices: (0,0), (1,1), (0,2), (-1,1) in NL coords
  // (rotated 45° square with side = √2, centered at (0,1))
  const points = [
    [0, 0], [1, 1], [0, 2], [-1, 1],
  ]

  ctx.beginPath()
  for (let i = 0; i < points.length; i++) {
    const sx = toX(points[i][0])
    const sy = axisY - hPx(points[i][1], ppu)
    if (i === 0) ctx.moveTo(sx, sy)
    else ctx.lineTo(sx, sy)
  }
  ctx.closePath()

  ctx.fillStyle = color
  ctx.globalAlpha = alpha * fillAlpha
  ctx.fill()

  ctx.strokeStyle = color
  ctx.lineWidth = 1.5
  ctx.globalAlpha = alpha * 0.7
  ctx.stroke()
}

/** Draw a 5-pointed star */
function drawStar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  color: string,
  alpha: number
) {
  ctx.beginPath()
  for (let i = 0; i < 10; i++) {
    const angle = -Math.PI / 2 + (i * Math.PI) / 5
    const rad = i % 2 === 0 ? r : r * 0.4
    const px = cx + rad * Math.cos(angle)
    const py = cy + rad * Math.sin(angle)
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.closePath()
  ctx.fillStyle = color
  ctx.globalAlpha = alpha
  ctx.fill()
}

// ── Main render ──────────────────────────────────────────────────────

export function renderSqrt2Overlay(
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

  ctx.save()

  // ── Seg 1: The journey starts — dot at zero ──
  if (revealProgress >= PHASE.startBegin) {
    const dotP = smoothstep(mapRange(revealProgress, PHASE.startBegin, PHASE.startBegin + 0.04))
    if (dotP > 0) {
      const ox = toX(0)
      ctx.beginPath()
      ctx.arc(ox, axisY, 5 * dotP, 0, Math.PI * 2)
      ctx.fillStyle = diagCol(isDark)
      ctx.globalAlpha = opacity * dotP
      ctx.fill()
    }

    // "Start here!" label
    if (revealProgress < PHASE.longPathBegin) {
      const labelA = smoothstep(mapRange(revealProgress, 0.03, 0.06)) *
        (1 - smoothstep(mapRange(revealProgress, PHASE.startEnd - 0.02, PHASE.startEnd)))
      if (labelA > 0.01) {
        const fs = Math.max(11, Math.min(14, ppu * 0.12))
        ctx.font = `${fs}px system-ui, sans-serif`
        ctx.fillStyle = textCol(isDark)
        ctx.textAlign = 'center'
        ctx.textBaseline = 'top'
        ctx.globalAlpha = opacity * labelA
        ctx.fillText('Start here!', toX(0), axisY + 10)
      }
    }
  }

  // ── Seg 2: The long path — draw square + path ──
  const squareVisible = revealProgress >= PHASE.longPathBegin
  if (squareVisible) {
    const squareP = smoothstep(mapRange(revealProgress, PHASE.longPathBegin, PHASE.longPathBegin + 0.05))
    // Square should persist until the proof phase and then during reveal
    const squareFade = revealProgress >= PHASE.zoomBegin && revealProgress < PHASE.revealBegin
      ? 1 - smoothstep(mapRange(revealProgress, PHASE.zoomBegin, PHASE.zoomBegin + 0.03))
      : revealProgress >= PHASE.revealBegin
        ? smoothstep(mapRange(revealProgress, PHASE.revealBegin, PHASE.revealBegin + 0.03))
        : 1

    if (squareP > 0 && squareFade > 0) {
      drawSquare(ctx, toX, axisY, ppu, isDark, opacity * squareP * squareFade)
    }

    // Long path animation
    if (revealProgress < PHASE.shortcutEnd) {
      const pathP = easeInOut(mapRange(revealProgress, PHASE.longPathBegin + 0.03, PHASE.longPathEnd - 0.02))
      const pathFade = 1 - smoothstep(mapRange(revealProgress, PHASE.shortcutBegin + 0.03, PHASE.shortcutEnd))
      drawLongPath(ctx, toX, axisY, ppu, isDark, opacity * pathFade, pathP)

      // "1 step over" label on bottom, "1 step up" label on right
      if (pathP > 0.3 && pathP < 0.55) {
        const la = smoothstep(mapRange(pathP, 0.3, 0.5))
        const fs = Math.max(10, Math.min(13, ppu * 0.11))
        ctx.font = `${fs}px system-ui, sans-serif`
        ctx.fillStyle = pathCol(isDark)
        ctx.textAlign = 'center'
        ctx.textBaseline = 'top'
        ctx.globalAlpha = opacity * la * pathFade
        ctx.fillText('1 step →', (toX(0) + toX(1)) / 2, axisY + 8)
      }
      if (pathP > 0.7) {
        const la = smoothstep(mapRange(pathP, 0.7, 0.9))
        const fadeOut = 1 - smoothstep(mapRange(revealProgress, PHASE.shortcutBegin, PHASE.shortcutBegin + 0.05))
        const fs = Math.max(10, Math.min(13, ppu * 0.11))
        ctx.font = `${fs}px system-ui, sans-serif`
        ctx.fillStyle = pathCol(isDark)
        ctx.textAlign = 'left'
        ctx.textBaseline = 'middle'
        ctx.globalAlpha = opacity * la * fadeOut
        ctx.fillText('1 step ↑', toX(1) + 8, axisY - hPx(0.5, ppu))
      }
    }
  }

  // ── Seg 3: The shortcut — diagonal appears in the square ──
  const diagVisible = revealProgress >= PHASE.shortcutBegin
  if (diagVisible) {
    // Before rotation, diagonal is at angle=0 (pointing to (1,1))
    // During rotation, angle goes from 0 to π/4
    // After rotation, it stays at π/4 (flat on number line)
    const diagAppearP = smoothstep(mapRange(revealProgress, PHASE.shortcutBegin, PHASE.shortcutBegin + 0.05))
    const rotateP = easeInOut(mapRange(revealProgress, PHASE.rotateBegin + 0.02, PHASE.rotateEnd - 0.02))
    const angle = rotateP * (Math.PI / 4)

    // During zoom phase, fade out diagonal in square position; during reveal, show on number line
    const diagFade = revealProgress >= PHASE.zoomBegin && revealProgress < PHASE.revealBegin
      ? 1 - smoothstep(mapRange(revealProgress, PHASE.zoomBegin, PHASE.zoomBegin + 0.03))
      : revealProgress >= PHASE.revealBegin
        ? smoothstep(mapRange(revealProgress, PHASE.revealBegin, PHASE.revealBegin + 0.03))
        : 1

    // Draw the arc during rotation
    if (revealProgress >= PHASE.rotateBegin && revealProgress < PHASE.mysteryEnd) {
      drawArc(ctx, toX, axisY, ppu, isDark, opacity * diagFade, rotateP)
    }

    // Draw the diagonal itself
    drawDiagonal(ctx, toX, axisY, ppu, isDark, opacity * diagAppearP * diagFade, angle, rotateP >= 1)

    // "The shortcut!" label
    if (revealProgress >= PHASE.shortcutBegin && revealProgress < PHASE.rotateBegin) {
      const la = smoothstep(mapRange(revealProgress, PHASE.shortcutBegin + 0.02, PHASE.shortcutBegin + 0.05)) *
        (1 - smoothstep(mapRange(revealProgress, PHASE.shortcutEnd - 0.02, PHASE.shortcutEnd)))
      if (la > 0.01) {
        const fs = Math.max(11, Math.min(14, ppu * 0.12))
        ctx.font = `${fs}px system-ui, sans-serif`
        ctx.fillStyle = diagCol(isDark)
        ctx.textAlign = 'center'
        ctx.textBaseline = 'bottom'
        ctx.globalAlpha = opacity * la
        // Position label near middle of diagonal
        const midX = (toX(0) + toX(1)) / 2 - 10
        const midY = axisY - hPx(0.5, ppu) - 6
        ctx.fillText('The shortcut!', midX, midY)
      }
    }
  }

  // ── Seg 5: Mystery spot — question mark ──
  if (revealProgress >= PHASE.mysteryBegin && revealProgress < PHASE.proofBegin) {
    const qP = smoothstep(mapRange(revealProgress, PHASE.mysteryBegin + 0.02, PHASE.mysteryBegin + 0.06))
    const qFade = 1 - smoothstep(mapRange(revealProgress, PHASE.mysteryEnd - 0.02, PHASE.mysteryEnd))
    const qAlpha = qP * qFade

    if (qAlpha > 0.01) {
      const sqrt2X = toX(SQRT2)

      // Question mark
      const fs = Math.max(16, Math.min(24, ppu * 0.2))
      ctx.font = `bold ${fs}px system-ui, sans-serif`
      ctx.fillStyle = diagCol(isDark)
      ctx.textAlign = 'center'
      ctx.textBaseline = 'bottom'
      ctx.globalAlpha = opacity * qAlpha
      ctx.fillText('?', sqrt2X, axisY - 14)

      // "Between 1 and 2" label
      const lfs = Math.max(10, Math.min(13, ppu * 0.11))
      ctx.font = `${lfs}px system-ui, sans-serif`
      ctx.fillStyle = textCol(isDark)
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ctx.globalAlpha = opacity * qAlpha * 0.8
      ctx.fillText('More than 1, less than 2...', (toX(1) + toX(SQRT2)) / 2 + 10, axisY + 10)
    }
  }

  // ── Seg 6: Area proof — side squares + diagonal square ──
  if (revealProgress >= PHASE.proofBegin && revealProgress < PHASE.zoomBegin) {
    const proofP = mapRange(revealProgress, PHASE.proofBegin, PHASE.proofEnd)
    const proofFade = 1 - smoothstep(mapRange(revealProgress, PHASE.proofEnd - 0.02, PHASE.proofEnd))

    // Phase 1: Side squares appear (0-0.35 of proof)
    const sideP = smoothstep(mapRange(proofP, 0, 0.35))

    // Side square A: below the base (from x=0 to x=1, below axis)
    if (sideP > 0) {
      const x0 = toX(0)
      const x1 = toX(1)
      const h = hPx(1, ppu)
      drawProofSquare(ctx, x0, axisY, x1 - x0, h, proofColA(isDark), opacity * sideP * proofFade)

      // "Area = 1" label
      const fs = Math.max(10, Math.min(12, ppu * 0.1))
      ctx.font = `bold ${fs}px system-ui, sans-serif`
      ctx.fillStyle = proofColA(isDark)
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.globalAlpha = opacity * sideP * proofFade * 0.9
      ctx.fillText('Area = 1', (x0 + x1) / 2, axisY + h / 2)
    }

    // Side square B: to the left of the left edge
    if (sideP > 0) {
      const x0 = toX(-1)
      const x1 = toX(0)
      const h = hPx(1, ppu)
      const y1 = axisY - h
      drawProofSquare(ctx, x0, y1, x1 - x0, h, proofColB(isDark), opacity * sideP * proofFade)

      const fs = Math.max(10, Math.min(12, ppu * 0.1))
      ctx.font = `bold ${fs}px system-ui, sans-serif`
      ctx.fillStyle = proofColB(isDark)
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.globalAlpha = opacity * sideP * proofFade * 0.9
      ctx.fillText('Area = 1', (x0 + x1) / 2, y1 + h / 2)
    }

    // Phase 2: Tilted diagonal square appears (0.35-0.65 of proof)
    const tiltP = smoothstep(mapRange(proofP, 0.35, 0.65))
    if (tiltP > 0) {
      drawTiltedSquare(ctx, toX, axisY, ppu, diagCol(isDark), opacity * tiltP * proofFade, 0.25)

      // "Area = 2" label
      const fs = Math.max(11, Math.min(14, ppu * 0.12))
      ctx.font = `bold ${fs}px system-ui, sans-serif`
      ctx.fillStyle = diagCol(isDark)
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.globalAlpha = opacity * tiltP * proofFade
      ctx.fillText('Area = 2', toX(0), axisY - hPx(1, ppu))
    }

    // Phase 3: "1 + 1 = 2" equation (0.65-1.0 of proof)
    const eqP = smoothstep(mapRange(proofP, 0.65, 0.85))
    if (eqP > 0) {
      const fs = Math.max(12, Math.min(16, ppu * 0.14))
      ctx.font = `bold ${fs}px system-ui, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ctx.globalAlpha = opacity * eqP * proofFade

      // Color-coded equation
      const eqX = toX(0.5)
      const eqY = axisY + hPx(1, ppu) + 12

      // "1" in red
      ctx.fillStyle = proofColA(isDark)
      ctx.textAlign = 'right'
      ctx.fillText('1', eqX - 16, eqY)

      // "+" in text color
      ctx.fillStyle = textCol(isDark)
      ctx.textAlign = 'center'
      ctx.fillText('+', eqX - 8, eqY)

      // "1" in purple
      ctx.fillStyle = proofColB(isDark)
      ctx.textAlign = 'left'
      ctx.fillText('1', eqX, eqY)

      // "=" in text color
      ctx.fillStyle = textCol(isDark)
      ctx.textAlign = 'center'
      ctx.fillText('=', eqX + 16, eqY)

      // "2" in green
      ctx.fillStyle = diagCol(isDark)
      ctx.textAlign = 'left'
      ctx.fillText('2', eqX + 24, eqY)
    }
  }

  // ── Seg 7: Zoom in on decimals ──
  // The actual number-line viewport zoom is driven by useConstantDemo.
  // Here we just overlay a floating decimal expansion at the top of the screen.
  if (revealProgress >= PHASE.zoomBegin && revealProgress < PHASE.revealBegin) {
    const zoomP = mapRange(revealProgress, PHASE.zoomBegin, PHASE.zoomEnd)
    const fadeIn = smoothstep(Math.min(1, zoomP * 4))

    // Decimal expansion typing out
    const decimalStr = '1.41421356\u2026'
    const charsToShow = Math.min(
      decimalStr.length,
      Math.floor(1 + zoomP * (decimalStr.length - 1))
    )
    const displayText = '\u221A2 = ' + decimalStr.substring(0, charsToShow)

    const fs = Math.max(16, Math.min(24, cssWidth * 0.03))
    ctx.font = `bold ${fs}px system-ui, monospace`
    ctx.fillStyle = diagCol(isDark)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.globalAlpha = opacity * fadeIn
    ctx.fillText(displayText, cssWidth / 2, 20)

    // Subtitle
    if (zoomP > 0.7) {
      const neverP = smoothstep(mapRange(zoomP, 0.7, 0.9))
      const subFs = Math.max(11, Math.min(15, cssWidth * 0.02))
      ctx.font = `italic ${subFs}px system-ui, sans-serif`
      ctx.fillStyle = subtextCol(isDark)
      ctx.textAlign = 'center'
      ctx.globalAlpha = opacity * neverP * 0.8
      ctx.fillText('The digits never stop!', cssWidth / 2, 20 + fs + 6)
    }
  }

  // ── Seg 8: Final reveal ──
  if (revealProgress >= PHASE.revealBegin) {
    const revealP = smoothstep(mapRange(revealProgress, PHASE.revealBegin, PHASE.revealEnd))

    // Diagonal on the number line
    drawDiagonal(ctx, toX, axisY, ppu, isDark, opacity * revealP, Math.PI / 4, true)

    // Star at √2
    const sqrt2X = toX(SQRT2)
    const starY = axisY - 20
    const starR = Math.max(6, Math.min(10, ppu * 0.06))
    const starPulse = 1 + 0.1 * Math.sin(revealProgress * Math.PI * 8)
    drawStar(ctx, sqrt2X, starY, starR * starPulse * revealP, diagCol(isDark), opacity * revealP)

    // "√2" label
    if (revealP > 0.3) {
      const labelP = smoothstep(mapRange(revealP, 0.3, 0.7))
      const fs = Math.max(18, Math.min(26, ppu * 0.22))
      ctx.font = `bold ${fs}px system-ui, sans-serif`
      ctx.fillStyle = diagCol(isDark)
      ctx.textAlign = 'center'
      ctx.textBaseline = 'bottom'
      ctx.globalAlpha = opacity * labelP
      ctx.fillText('√2', sqrt2X, starY - starR - 4)
    }

    // "≈ 1.414" value
    if (revealP > 0.5) {
      const valP = smoothstep(mapRange(revealP, 0.5, 0.85))
      const fs = Math.max(14, Math.min(18, ppu * 0.16))
      ctx.font = `bold ${fs}px system-ui, sans-serif`
      ctx.fillStyle = diagCol(isDark)
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ctx.globalAlpha = opacity * valP
      ctx.fillText('≈ 1.414', sqrt2X, axisY + 6)
    }

    // Subtitle
    if (revealP > 0.7) {
      const subP = smoothstep(mapRange(revealP, 0.7, 1.0))
      const fs = Math.max(10, Math.min(13, ppu * 0.11))
      ctx.font = `${fs}px system-ui, sans-serif`
      ctx.fillStyle = subtextCol(isDark)
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ctx.globalAlpha = opacity * subP * 0.7
      ctx.fillText('The magic shortcut', sqrt2X, axisY + 26)
    }

    // Formula for curious kids
    if (revealP > 0.85) {
      const formulaP = smoothstep(mapRange(revealP, 0.85, 1.0))
      const fs = Math.max(9, Math.min(11, ppu * 0.09))
      ctx.font = `${fs}px system-ui, sans-serif`
      ctx.fillStyle = subtextCol(isDark)
      ctx.textAlign = 'center'
      ctx.textBaseline = 'bottom'
      ctx.globalAlpha = opacity * formulaP * 0.5
      ctx.fillText('1² + 1² = (√2)²', sqrt2X, starY - starR - fs - 10)
    }
  }

  ctx.globalAlpha = 1
  ctx.setLineDash([])
  ctx.restore()
}
