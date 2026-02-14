import type { NumberLineState } from '../../types'
import { numberToScreenX } from '../../numberLineTicks'

/**
 * √3 Demo: "The Tallest Triangle"
 *
 * Visualises √3 ≈ 1.732 as the height of an equilateral triangle.
 *
 * An equilateral triangle with base from −1 to 1 (side length 2)
 * is constructed on the number line. The height — from apex (0, √3)
 * to the midpoint (0, 0) — is highlighted, then rotated down
 * (compass-arm style) to lie on the number line, landing at √3.
 *
 * The demo also shows WHY the height is this length: splitting the
 * triangle into two right triangles and applying the Pythagorean theorem:
 * 1² + h² = 2², so h² = 3 → h = √3.
 *
 * Finally we zoom in to show that √3's decimal expansion never
 * terminates, building intuition for irrational numbers.
 */

// ── Constants ────────────────────────────────────────────────────────

const SQRT3 = Math.sqrt(3) // 1.7320508075688772

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
// Must align with sqrt3DemoNarration.ts segment boundaries.

const PHASE = {
  // Seg 0: base — highlight segment from −1 to 1
  baseBegin: 0.00,
  baseEnd: 0.10,
  // Seg 1: build — equilateral triangle sides grow
  buildBegin: 0.10,
  buildEnd: 0.25,
  // Seg 2: height — dashed altitude drops from apex
  heightBegin: 0.25,
  heightEnd: 0.40,
  // Seg 3: rotate — compass swings height to number line
  rotateBegin: 0.40,
  rotateEnd: 0.55,
  // Seg 4: mystery — question mark at landing spot
  mysteryBegin: 0.55,
  mysteryEnd: 0.65,
  // Seg 5: proof — split triangle, Pythagorean theorem
  proofBegin: 0.65,
  proofEnd: 0.80,
  // Seg 6: zoom — irrationality zoom
  zoomBegin: 0.80,
  zoomEnd: 0.92,
  // Seg 7: reveal — star, label, formula
  revealBegin: 0.92,
  revealEnd: 1.00,
} as const

// ── Colors ───────────────────────────────────────────────────────────

function triCol(isDark: boolean) { return isDark ? '#60a5fa' : '#3b82f6' }         // blue (triangle)
function heightCol(isDark: boolean) { return isDark ? '#fb923c' : '#ea580c' }      // orange (height)
function heightColBright(isDark: boolean) { return isDark ? '#fdba74' : '#f97316' }
function proofCol(isDark: boolean) { return isDark ? '#a78bfa' : '#7c3aed' }       // purple (proof)
function resultCol(isDark: boolean) { return isDark ? '#34d399' : '#059669' }      // green (√3)
function textCol(isDark: boolean) { return isDark ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.8)' }
function subtextCol(isDark: boolean) { return isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)' }

// ── Viewport ─────────────────────────────────────────────────────────

export function sqrt3DemoViewport(cssWidth: number, cssHeight: number) {
  // Center on [−1, √3] with some padding; triangle reaches √3 ≈ 1.732 above axis
  const center = (SQRT3 - 1) / 2 + 0.1 // ≈ 0.466
  const ppu = Math.min(cssWidth * 0.65 / (SQRT3 + 1.5), cssHeight * 0.25)
  return { center, pixelsPerUnit: ppu }
}

// ── Drawing helpers ──────────────────────────────────────────────────

type ToX = (v: number) => number

function hPx(val: number, ppu: number): number {
  return val * ppu
}

/** Draw the base segment from −1 to 1 highlighted on the number line */
function drawBase(
  ctx: CanvasRenderingContext2D,
  toX: ToX,
  axisY: number,
  isDark: boolean,
  alpha: number,
  progress: number
) {
  if (progress <= 0 || alpha <= 0) return

  const x0 = toX(-1)
  const x1 = toX(1)
  const currentX = x0 + (x1 - x0) * progress

  ctx.beginPath()
  ctx.moveTo(x0, axisY)
  ctx.lineTo(currentX, axisY)
  ctx.strokeStyle = triCol(isDark)
  ctx.lineWidth = 4
  ctx.lineCap = 'round'
  ctx.globalAlpha = alpha
  ctx.stroke()

  // Endpoint dots
  ctx.beginPath()
  ctx.arc(x0, axisY, 4, 0, Math.PI * 2)
  ctx.fillStyle = triCol(isDark)
  ctx.globalAlpha = alpha * 0.9
  ctx.fill()

  if (progress > 0.05) {
    ctx.beginPath()
    ctx.arc(currentX, axisY, 4, 0, Math.PI * 2)
    ctx.fill()
  }
}

/** Draw the equilateral triangle above the axis */
function drawTriangle(
  ctx: CanvasRenderingContext2D,
  toX: ToX,
  axisY: number,
  ppu: number,
  isDark: boolean,
  alpha: number,
  /** 0-1: how much of the two sides are drawn (0=none, 1=complete) */
  sideProgress: number,
  fillAlpha = 0.08
) {
  if (alpha <= 0) return

  const x0 = toX(-1)
  const x1 = toX(1)
  const apexX = toX(0)
  const apexY = axisY - hPx(SQRT3, ppu)

  // Fill (only when sides complete)
  if (sideProgress >= 1) {
    ctx.beginPath()
    ctx.moveTo(x0, axisY)
    ctx.lineTo(x1, axisY)
    ctx.lineTo(apexX, apexY)
    ctx.closePath()
    ctx.fillStyle = triCol(isDark)
    ctx.globalAlpha = alpha * fillAlpha
    ctx.fill()
  }

  // Draw sides growing up to the apex
  ctx.strokeStyle = triCol(isDark)
  ctx.lineWidth = 2.5
  ctx.lineCap = 'round'
  ctx.globalAlpha = alpha * 0.8

  if (sideProgress > 0) {
    // Left side: from (-1, 0) toward (0, √3)
    const lp = Math.min(1, sideProgress * 2) // left side completes in first half
    const lx = x0 + (apexX - x0) * lp
    const ly = axisY + (apexY - axisY) * lp
    ctx.beginPath()
    ctx.moveTo(x0, axisY)
    ctx.lineTo(lx, ly)
    ctx.stroke()

    // Right side: from (1, 0) toward (0, √3) — starts at 0.5
    if (sideProgress > 0.5) {
      const rp = (sideProgress - 0.5) / 0.5
      const rx = x1 + (apexX - x1) * rp
      const ry = axisY + (apexY - axisY) * rp
      ctx.beginPath()
      ctx.moveTo(x1, axisY)
      ctx.lineTo(rx, ry)
      ctx.stroke()
    }
  }
}

/** Draw the height (altitude) line from apex to midpoint */
function drawHeight(
  ctx: CanvasRenderingContext2D,
  toX: ToX,
  axisY: number,
  ppu: number,
  isDark: boolean,
  alpha: number,
  /** 0-1: how much of the height line is drawn (from apex down) */
  progress: number,
  bright = false
) {
  if (progress <= 0 || alpha <= 0) return

  const midX = toX(0)
  const apexY = axisY - hPx(SQRT3, ppu)
  const currentY = apexY + (axisY - apexY) * progress

  ctx.beginPath()
  ctx.moveTo(midX, apexY)
  ctx.lineTo(midX, currentY)
  ctx.strokeStyle = bright ? heightColBright(isDark) : heightCol(isDark)
  ctx.lineWidth = 3
  ctx.lineCap = 'round'
  ctx.setLineDash([6, 4])
  ctx.globalAlpha = alpha
  ctx.stroke()
  ctx.setLineDash([])

  // Endpoint dot at bottom
  if (progress > 0.9) {
    ctx.beginPath()
    ctx.arc(midX, currentY, 4, 0, Math.PI * 2)
    ctx.fillStyle = bright ? heightColBright(isDark) : heightCol(isDark)
    ctx.globalAlpha = alpha * 0.9
    ctx.fill()
  }
}

/** Draw the height line at a rotation angle during compass swing */
function drawRotatingHeight(
  ctx: CanvasRenderingContext2D,
  toX: ToX,
  axisY: number,
  ppu: number,
  isDark: boolean,
  alpha: number,
  /** Angle from vertical: 0 = straight up (height in triangle), π/2 = flat on number line */
  angle: number,
  bright = false
) {
  if (alpha <= 0) return

  const ox = toX(0)
  const length = hPx(SQRT3, ppu)

  // At angle=0: endpoint is at (0, √3) → screen (toX(0), axisY - hPx(√3, ppu))
  // At angle=π/2: endpoint is at (√3, 0) → screen (toX(√3), axisY)
  // Rotating clockwise from π/2 (up) toward 0 (right) in canvas coords
  const currentAngle = Math.PI / 2 - angle
  const endX = ox + length * Math.cos(currentAngle)
  const endY = axisY - length * Math.sin(currentAngle)

  ctx.beginPath()
  ctx.moveTo(ox, axisY)
  ctx.lineTo(endX, endY)
  ctx.strokeStyle = bright ? heightColBright(isDark) : heightCol(isDark)
  ctx.lineWidth = 3.5
  ctx.lineCap = 'round'
  ctx.globalAlpha = alpha
  ctx.stroke()

  // Endpoint dot
  ctx.beginPath()
  ctx.arc(endX, endY, 4, 0, Math.PI * 2)
  ctx.fillStyle = bright ? heightColBright(isDark) : heightCol(isDark)
  ctx.globalAlpha = alpha * 0.9
  ctx.fill()
}

/** Draw the compass arc (trace of height tip during rotation) */
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
  const radius = hPx(SQRT3, ppu)

  // Arc from π/2 (straight up) to 0 (horizontal right)
  // Canvas: negative angles are above x-axis
  const startAngle = -Math.PI / 2 // straight up in canvas coords
  const endAngle = 0              // horizontal right
  const arcEnd = startAngle + (endAngle - startAngle) * progress

  ctx.beginPath()
  ctx.arc(ox, axisY, radius, startAngle, arcEnd)
  ctx.strokeStyle = heightCol(isDark)
  ctx.lineWidth = 1.5
  ctx.setLineDash([4, 3])
  ctx.globalAlpha = alpha * 0.5
  ctx.stroke()
  ctx.setLineDash([])
}

/** Draw the right triangle for the Pythagorean proof */
function drawRightTriangle(
  ctx: CanvasRenderingContext2D,
  toX: ToX,
  axisY: number,
  ppu: number,
  isDark: boolean,
  alpha: number,
  fillAlpha = 0.15
) {
  if (alpha <= 0) return

  // Right triangle: (0,0), (1,0), (0,√3)
  const x0 = toX(0)
  const x1 = toX(1)
  const topY = axisY - hPx(SQRT3, ppu)

  ctx.beginPath()
  ctx.moveTo(x0, axisY)
  ctx.lineTo(x1, axisY)
  ctx.lineTo(x0, topY)
  ctx.closePath()

  ctx.fillStyle = proofCol(isDark)
  ctx.globalAlpha = alpha * fillAlpha
  ctx.fill()

  ctx.strokeStyle = proofCol(isDark)
  ctx.lineWidth = 2
  ctx.globalAlpha = alpha * 0.7
  ctx.stroke()

  // Right angle mark at (0,0)
  const markSize = Math.min(12, ppu * 0.08)
  ctx.beginPath()
  ctx.moveTo(x0 + markSize, axisY)
  ctx.lineTo(x0 + markSize, axisY - markSize)
  ctx.lineTo(x0, axisY - markSize)
  ctx.strokeStyle = proofCol(isDark)
  ctx.lineWidth = 1.5
  ctx.globalAlpha = alpha * 0.6
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

export function renderSqrt3Overlay(
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

  // ── Seg 0: Base — highlight segment from −1 to 1 ──
  if (revealProgress >= PHASE.baseBegin) {
    const baseP = easeInOut(mapRange(revealProgress, PHASE.baseBegin, PHASE.baseEnd - 0.02))
    const baseFade = revealProgress >= PHASE.zoomBegin && revealProgress < PHASE.revealBegin
      ? 1 - smoothstep(mapRange(revealProgress, PHASE.zoomBegin, PHASE.zoomBegin + 0.03))
      : revealProgress >= PHASE.revealBegin
        ? smoothstep(mapRange(revealProgress, PHASE.revealBegin, PHASE.revealBegin + 0.03))
        : 1

    if (baseP > 0 && baseFade > 0) {
      drawBase(ctx, toX, axisY, isDark, opacity * baseFade, baseP)
    }

    // "-1" and "1" labels
    if (revealProgress < PHASE.buildBegin + 0.05) {
      const labelA = smoothstep(mapRange(revealProgress, 0.03, 0.06)) *
        (1 - smoothstep(mapRange(revealProgress, PHASE.baseEnd - 0.02, PHASE.baseEnd + 0.03)))
      if (labelA > 0.01) {
        const fs = Math.max(11, Math.min(14, ppu * 0.12))
        ctx.font = `${fs}px system-ui, sans-serif`
        ctx.fillStyle = triCol(isDark)
        ctx.textAlign = 'center'
        ctx.textBaseline = 'top'
        ctx.globalAlpha = opacity * labelA
        ctx.fillText('−1', toX(-1), axisY + 10)
        ctx.fillText('1', toX(1), axisY + 10)

        // "2 units" label in center
        ctx.fillStyle = textCol(isDark)
        ctx.globalAlpha = opacity * labelA * 0.8
        ctx.fillText('2 units', toX(0), axisY + 10)
      }
    }
  }

  // ── Seg 1: Build — equilateral triangle sides grow ──
  const triVisible = revealProgress >= PHASE.buildBegin
  if (triVisible) {
    const sideP = easeInOut(mapRange(revealProgress, PHASE.buildBegin + 0.02, PHASE.buildEnd - 0.02))
    const triFade = revealProgress >= PHASE.zoomBegin && revealProgress < PHASE.revealBegin
      ? 1 - smoothstep(mapRange(revealProgress, PHASE.zoomBegin, PHASE.zoomBegin + 0.03))
      : revealProgress >= PHASE.revealBegin
        ? smoothstep(mapRange(revealProgress, PHASE.revealBegin, PHASE.revealBegin + 0.03))
        : 1

    if (sideP > 0 && triFade > 0) {
      drawTriangle(ctx, toX, axisY, ppu, isDark, opacity * triFade, sideP)
    }

    // "Perfect triangle!" label
    if (revealProgress >= PHASE.buildBegin + 0.08 && revealProgress < PHASE.heightBegin) {
      const la = smoothstep(mapRange(revealProgress, PHASE.buildBegin + 0.08, PHASE.buildEnd - 0.04)) *
        (1 - smoothstep(mapRange(revealProgress, PHASE.buildEnd - 0.02, PHASE.buildEnd)))
      if (la > 0.01) {
        const fs = Math.max(11, Math.min(14, ppu * 0.12))
        ctx.font = `${fs}px system-ui, sans-serif`
        ctx.fillStyle = triCol(isDark)
        ctx.textAlign = 'center'
        ctx.textBaseline = 'bottom'
        ctx.globalAlpha = opacity * la
        const apexY2 = axisY - hPx(SQRT3, ppu)
        ctx.fillText('Perfect triangle!', toX(0), apexY2 - 8)
      }
    }
  }

  // ── Seg 2: Height — dashed altitude drops from apex ──
  const heightVisible = revealProgress >= PHASE.heightBegin
  if (heightVisible) {
    const heightP = easeInOut(mapRange(revealProgress, PHASE.heightBegin + 0.02, PHASE.heightEnd - 0.04))

    // Height should fade during zoom, reappear during reveal
    const heightFade = revealProgress >= PHASE.zoomBegin && revealProgress < PHASE.revealBegin
      ? 1 - smoothstep(mapRange(revealProgress, PHASE.zoomBegin, PHASE.zoomBegin + 0.03))
      : revealProgress >= PHASE.revealBegin
        ? smoothstep(mapRange(revealProgress, PHASE.revealBegin, PHASE.revealBegin + 0.03))
        : 1

    // Before rotation, draw the vertical height
    if (revealProgress < PHASE.rotateBegin && heightP > 0 && heightFade > 0) {
      drawHeight(ctx, toX, axisY, ppu, isDark, opacity * heightFade, heightP)
    }

    // "How tall?" label
    if (revealProgress >= PHASE.heightBegin + 0.04 && revealProgress < PHASE.rotateBegin) {
      const la = smoothstep(mapRange(revealProgress, PHASE.heightBegin + 0.04, PHASE.heightBegin + 0.08)) *
        (1 - smoothstep(mapRange(revealProgress, PHASE.heightEnd - 0.03, PHASE.heightEnd)))
      if (la > 0.01) {
        const fs = Math.max(11, Math.min(14, ppu * 0.12))
        ctx.font = `${fs}px system-ui, sans-serif`
        ctx.fillStyle = heightCol(isDark)
        ctx.textAlign = 'left'
        ctx.textBaseline = 'middle'
        ctx.globalAlpha = opacity * la
        const midHeight = axisY - hPx(SQRT3 / 2, ppu)
        ctx.fillText('How tall?', toX(0) + 10, midHeight)
      }
    }
  }

  // ── Seg 3: Rotate — compass swings height to number line ──
  const rotateVisible = revealProgress >= PHASE.rotateBegin
  if (rotateVisible) {
    const rotateP = easeInOut(mapRange(revealProgress, PHASE.rotateBegin + 0.02, PHASE.rotateEnd - 0.02))
    const angle = rotateP * (Math.PI / 2) // from 0 (vertical) to π/2 (horizontal)

    const rotateFade = revealProgress >= PHASE.zoomBegin && revealProgress < PHASE.revealBegin
      ? 1 - smoothstep(mapRange(revealProgress, PHASE.zoomBegin, PHASE.zoomBegin + 0.03))
      : revealProgress >= PHASE.revealBegin
        ? smoothstep(mapRange(revealProgress, PHASE.revealBegin, PHASE.revealBegin + 0.03))
        : 1

    // Draw the arc during rotation
    if (revealProgress >= PHASE.rotateBegin && revealProgress < PHASE.mysteryEnd) {
      drawArc(ctx, toX, axisY, ppu, isDark, opacity * rotateFade, rotateP)
    }

    // Draw the rotating height line
    if (rotateFade > 0) {
      drawRotatingHeight(ctx, toX, axisY, ppu, isDark, opacity * rotateFade, angle, rotateP >= 1)
    }
  }

  // ── Seg 4: Mystery — question mark at landing spot ──
  if (revealProgress >= PHASE.mysteryBegin && revealProgress < PHASE.proofBegin) {
    const qP = smoothstep(mapRange(revealProgress, PHASE.mysteryBegin + 0.02, PHASE.mysteryBegin + 0.06))
    const qFade = 1 - smoothstep(mapRange(revealProgress, PHASE.mysteryEnd - 0.02, PHASE.mysteryEnd))
    const qAlpha = qP * qFade

    if (qAlpha > 0.01) {
      const sqrt3X = toX(SQRT3)

      // Question mark
      const fs = Math.max(16, Math.min(24, ppu * 0.2))
      ctx.font = `bold ${fs}px system-ui, sans-serif`
      ctx.fillStyle = heightCol(isDark)
      ctx.textAlign = 'center'
      ctx.textBaseline = 'bottom'
      ctx.globalAlpha = opacity * qAlpha
      ctx.fillText('?', sqrt3X, axisY - 14)

      // "Past 1, not quite 2" label
      const lfs = Math.max(10, Math.min(13, ppu * 0.11))
      ctx.font = `${lfs}px system-ui, sans-serif`
      ctx.fillStyle = textCol(isDark)
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ctx.globalAlpha = opacity * qAlpha * 0.8
      ctx.fillText('Past 1, not quite 2...', (toX(1) + toX(SQRT3)) / 2 + 10, axisY + 10)
    }
  }

  // ── Seg 5: Proof — split triangle, Pythagorean theorem ──
  if (revealProgress >= PHASE.proofBegin && revealProgress < PHASE.zoomBegin) {
    const proofP = mapRange(revealProgress, PHASE.proofBegin, PHASE.proofEnd)
    const proofFade = 1 - smoothstep(mapRange(revealProgress, PHASE.proofEnd - 0.02, PHASE.proofEnd))

    // Phase 1: Right triangle appears (0-0.35 of proof)
    const triP = smoothstep(mapRange(proofP, 0, 0.35))
    if (triP > 0) {
      drawRightTriangle(ctx, toX, axisY, ppu, isDark, opacity * triP * proofFade)
    }

    // Phase 2: Labels appear on sides (0.25-0.55 of proof)
    const labelP = smoothstep(mapRange(proofP, 0.25, 0.55))
    if (labelP > 0) {
      const fs = Math.max(11, Math.min(14, ppu * 0.12))
      ctx.font = `bold ${fs}px system-ui, sans-serif`
      ctx.globalAlpha = opacity * labelP * proofFade

      // Bottom label: "1"
      ctx.fillStyle = proofCol(isDark)
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ctx.fillText('1', (toX(0) + toX(1)) / 2, axisY + 6)

      // Hypotenuse label: "2"
      ctx.textAlign = 'left'
      ctx.textBaseline = 'middle'
      const hypMidX = (toX(0) + toX(1)) / 2 + 8
      const hypMidY = (axisY + (axisY - hPx(SQRT3, ppu))) / 2
      ctx.fillText('2', hypMidX, hypMidY)

      // Height label: "?"
      ctx.fillStyle = heightCol(isDark)
      ctx.textAlign = 'right'
      ctx.textBaseline = 'middle'
      ctx.fillText('?', toX(0) - 8, axisY - hPx(SQRT3 / 2, ppu))
    }

    // Phase 3: Equation appears (0.50-0.80 of proof)
    const eqP = smoothstep(mapRange(proofP, 0.50, 0.80))
    if (eqP > 0) {
      const fs = Math.max(12, Math.min(16, ppu * 0.14))
      ctx.font = `bold ${fs}px system-ui, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ctx.globalAlpha = opacity * eqP * proofFade

      const eqX = toX(0.5)
      const eqY = axisY + hPx(0.4, ppu)

      // "1² + ?² = 2²"
      ctx.fillStyle = proofCol(isDark)
      ctx.fillText('1² + ?² = 2²', eqX, eqY)
    }

    // Phase 4: Answer reveals (0.75-1.0 of proof)
    const ansP = smoothstep(mapRange(proofP, 0.75, 1.0))
    if (ansP > 0) {
      const fs = Math.max(12, Math.min(16, ppu * 0.14))
      ctx.font = `bold ${fs}px system-ui, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ctx.globalAlpha = opacity * ansP * proofFade

      const eqX = toX(0.5)
      const eqY = axisY + hPx(0.4, ppu) + (Math.max(12, Math.min(16, ppu * 0.14)) + 8)

      // "?² = 3  →  ? = √3"
      ctx.fillStyle = resultCol(isDark)
      ctx.fillText('?² = 3  →  ? = √3', eqX, eqY)

      // Update the "?" label on the height to "√3"
      ctx.fillStyle = resultCol(isDark)
      ctx.textAlign = 'right'
      ctx.textBaseline = 'middle'
      ctx.globalAlpha = opacity * ansP * proofFade
      ctx.fillText('√3', toX(0) - 8, axisY - hPx(SQRT3 / 2, ppu))
    }
  }

  // ── Seg 6: Zoom — irrationality zoom on decimals ──
  // The actual number-line viewport zoom is driven by useConstantDemo.
  // Here we just overlay a floating decimal expansion at the top of the screen.
  if (revealProgress >= PHASE.zoomBegin && revealProgress < PHASE.revealBegin) {
    const zoomP = mapRange(revealProgress, PHASE.zoomBegin, PHASE.zoomEnd)
    const fadeIn = smoothstep(Math.min(1, zoomP * 4))

    // Decimal expansion typing out
    const decimalStr = '1.7320508075\u2026'
    const charsToShow = Math.min(
      decimalStr.length,
      Math.floor(1 + zoomP * (decimalStr.length - 1))
    )
    const displayText = '\u221A3 = ' + decimalStr.substring(0, charsToShow)

    const fs = Math.max(16, Math.min(24, cssWidth * 0.03))
    ctx.font = `bold ${fs}px system-ui, monospace`
    ctx.fillStyle = resultCol(isDark)
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

  // ── Seg 7: Reveal — star, label, formula ──
  if (revealProgress >= PHASE.revealBegin) {
    const revealP = smoothstep(mapRange(revealProgress, PHASE.revealBegin, PHASE.revealEnd))

    // Height line on the number line (horizontal)
    if (revealP > 0) {
      drawRotatingHeight(ctx, toX, axisY, ppu, isDark, opacity * revealP, Math.PI / 2, true)
    }

    // Star at √3
    const sqrt3X = toX(SQRT3)
    const starY = axisY - 20
    const starR = Math.max(6, Math.min(10, ppu * 0.06))
    const starPulse = 1 + 0.1 * Math.sin(revealProgress * Math.PI * 8)
    drawStar(ctx, sqrt3X, starY, starR * starPulse * revealP, resultCol(isDark), opacity * revealP)

    // "√3" label
    if (revealP > 0.3) {
      const labelP = smoothstep(mapRange(revealP, 0.3, 0.7))
      const fs = Math.max(18, Math.min(26, ppu * 0.22))
      ctx.font = `bold ${fs}px system-ui, sans-serif`
      ctx.fillStyle = resultCol(isDark)
      ctx.textAlign = 'center'
      ctx.textBaseline = 'bottom'
      ctx.globalAlpha = opacity * labelP
      ctx.fillText('√3', sqrt3X, starY - starR - 4)
    }

    // "≈ 1.732" value
    if (revealP > 0.5) {
      const valP = smoothstep(mapRange(revealP, 0.5, 0.85))
      const fs = Math.max(14, Math.min(18, ppu * 0.16))
      ctx.font = `bold ${fs}px system-ui, sans-serif`
      ctx.fillStyle = resultCol(isDark)
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ctx.globalAlpha = opacity * valP
      ctx.fillText('≈ 1.732', sqrt3X, axisY + 6)
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
      ctx.fillText('The tallest triangle', sqrt3X, axisY + 26)
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
      ctx.fillText('1² + (√3)² = 2²', sqrt3X, starY - starR - fs - 10)
    }
  }

  ctx.globalAlpha = 1
  ctx.setLineDash([])
  ctx.restore()
}
