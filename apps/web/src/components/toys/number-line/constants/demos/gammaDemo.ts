import type { NumberLineState } from '../../types'
import { numberToScreenX } from '../../numberLineTicks'

/**
 * γ Demo: "The Sharing Slide"
 *
 * Visualises the Euler-Mascheroni constant γ ≈ 0.577 as the accumulated
 * overshoot of discrete sharing (harmonic series) over smooth sharing
 * (the 1/x curve).
 *
 * When k friends share one cookie each gets 1/k — a flat, blocky step.
 * But what if we could share with *any* number of friends? That gives
 * the smooth curve y = 1/x. The blocks always poke a little above the
 * curve. Those tiny "extra bits" (crescents) sum to exactly γ.
 *
 * This IS the standard proof of γ's existence, presented visually.
 * The kid sees Riemann-sum overshoot without knowing the name.
 */

// ── Constants ────────────────────────────────────────────────────────

const EULER_MASCHERONI = 0.5772156649
/** Number of discrete sharing steps we animate individually */
const MAX_K = 10

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
  return c < 0.5 ? 2 * c * c : 1 - (-2 * c + 2) ** 2 / 2
}

// ── Crescent math ────────────────────────────────────────────────────

/** Area of the k-th crescent = 1/k - ln((k+1)/k) */
function crescentArea(k: number): number {
  return 1 / k - Math.log((k + 1) / k)
}

/** Cumulative crescent area for k = 1..n */
function cumulativeCrescent(n: number): number {
  let sum = 0
  for (let k = 1; k <= n; k++) sum += crescentArea(k)
  return sum
}

// Precompute crescent data
const CRESCENTS: { k: number; area: number; cumulative: number }[] = []
{
  let cum = 0
  for (let k = 1; k <= MAX_K; k++) {
    const a = crescentArea(k)
    cum += a
    CRESCENTS.push({ k, area: a, cumulative: cum })
  }
}

// ── Colors ───────────────────────────────────────────────────────────

function stepCol(isDark: boolean) {
  return isDark ? '#22d3ee' : '#3b82f6'
} // cyan / blue
function stepColDim(isDark: boolean) {
  return isDark ? '#164e63' : '#bfdbfe'
}
function curveCol(isDark: boolean) {
  return isDark ? '#a78bfa' : '#7c3aed'
} // purple
function crescentCol(isDark: boolean) {
  return isDark ? '#fbbf24' : '#f59e0b'
} // gold
function textColor(isDark: boolean) {
  return isDark ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.8)'
}
function subtextColor(isDark: boolean) {
  return isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)'
}

// ── Phase timing ─────────────────────────────────────────────────────
//
// Segment boundaries must match gammaDemoNarration.ts exactly.
//
// Seg 1: 0.00–0.10  One friend
// Seg 2: 0.10–0.20  Two friends
// Seg 3: 0.20–0.34  Three friends + "what about in-between?"
// Seg 4: 0.34–0.48  The slide emerges
// Seg 5: 0.48–0.57  Highlight the extra bits
// Seg 6: 0.57–0.65  Rapid cascade (k=4..10)
// Seg 7: 0.65–0.86  Collect the crescents
// Seg 8: 0.86–1.00  The reveal

const PHASE = {
  // Steps appear one by one
  step1Start: 0.0,
  step1End: 0.1,
  step2Start: 0.1,
  step2End: 0.2,
  step3Start: 0.2,
  step3End: 0.3,
  // "What about in-between?" question
  questionStart: 0.28,
  questionEnd: 0.34,
  // Curve draws itself
  curveStart: 0.34,
  curveEnd: 0.45,
  // Crescents illuminate
  crescentHighlightStart: 0.45,
  crescentHighlightEnd: 0.57,
  // Rapid cascade k=4..10
  cascadeStart: 0.57,
  cascadeEnd: 0.65,
  // Collection — crescents fly to number line
  collectStart: 0.65,
  collectEnd: 0.86,
  // Final reveal
  revealStart: 0.86,
  revealEnd: 1.0,
} as const

// ── Viewport ─────────────────────────────────────────────────────────

/**
 * Target viewport for the gamma demo.
 *
 * During construction (progress 0–0.65) we want to see the rectangles
 * from x≈0.5 to x≈11.5 with room above for height-1 rectangle.
 * During reveal (progress 0.86–1.0) we zoom to show x≈-0.2 to x≈1.3.
 *
 * Since useConstantDemo only supports one static viewport, we target
 * the construction view and animate the reveal zoom ourselves within
 * the renderer.
 */
export function gammaDemoViewport(cssWidth: number, cssHeight: number) {
  // Center on the rectangle region [1, 11], with some left margin
  const center = 5.5
  // Fit ~12 units horizontally
  const ppu = Math.min((cssWidth * 0.85) / 12, cssHeight * 0.35)
  return { center, pixelsPerUnit: ppu }
}

// ── Drawing helpers ──────────────────────────────────────────────────

/** Height in screen pixels for a number-line value height at given ppu */
function valToScreenHeight(val: number, ppu: number): number {
  return val * ppu
}

/**
 * Draw a sharing step (rectangle) from x=k to x=k+1, height 1/k.
 * The rectangle sits ABOVE the number line axis.
 */
function drawStep(
  ctx: CanvasRenderingContext2D,
  toX: (v: number) => number,
  axisY: number,
  k: number,
  ppu: number,
  isDark: boolean,
  alpha: number,
  dim = false
) {
  const x0 = toX(k)
  const x1 = toX(k + 1)
  const h = valToScreenHeight(1 / k, ppu)
  const y = axisY - h

  ctx.fillStyle = dim ? stepColDim(isDark) : stepCol(isDark)
  ctx.globalAlpha = alpha * (dim ? 0.4 : 0.6)
  ctx.fillRect(x0, y, x1 - x0, h)

  // Border
  ctx.strokeStyle = stepCol(isDark)
  ctx.lineWidth = 1.5
  ctx.globalAlpha = alpha * (dim ? 0.3 : 0.8)
  ctx.strokeRect(x0, y, x1 - x0, h)
}

/**
 * Draw the 1/x curve from x=startVal to x=endVal above the axis.
 * `drawProgress` 0-1 controls how much of the curve is drawn (left to right).
 */
function drawCurve(
  ctx: CanvasRenderingContext2D,
  toX: (v: number) => number,
  axisY: number,
  startVal: number,
  endVal: number,
  ppu: number,
  isDark: boolean,
  alpha: number,
  drawProgress = 1
) {
  if (alpha <= 0 || drawProgress <= 0) return

  const drawnEnd = startVal + (endVal - startVal) * drawProgress
  const segments = Math.ceil((drawnEnd - startVal) * 20)
  if (segments < 1) return

  ctx.beginPath()
  for (let i = 0; i <= segments; i++) {
    const t = i / segments
    const x = startVal + t * (drawnEnd - startVal)
    const y = 1 / x
    const sx = toX(x)
    const sy = axisY - valToScreenHeight(y, ppu)
    if (i === 0) ctx.moveTo(sx, sy)
    else ctx.lineTo(sx, sy)
  }

  ctx.strokeStyle = curveCol(isDark)
  ctx.lineWidth = 2.5
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.globalAlpha = alpha
  ctx.stroke()
}

/**
 * Draw the crescent (area between rectangle top and 1/x curve) for step k.
 * The crescent is filled with gold.
 */
function drawCrescent(
  ctx: CanvasRenderingContext2D,
  toX: (v: number) => number,
  axisY: number,
  k: number,
  ppu: number,
  isDark: boolean,
  alpha: number
) {
  if (alpha <= 0) return

  const x0 = toX(k)
  const x1 = toX(k + 1)
  const rectH = valToScreenHeight(1 / k, ppu)
  const rectTop = axisY - rectH

  // Top edge of rectangle (flat line from left to right)
  ctx.beginPath()
  ctx.moveTo(x0, rectTop)
  ctx.lineTo(x1, rectTop)

  // Bottom edge: the 1/x curve from right to left (reverse direction to close shape)
  const segments = 20
  for (let i = segments; i >= 0; i--) {
    const t = i / segments
    const xVal = k + t * 1
    const yVal = 1 / xVal
    const sx = toX(xVal)
    const sy = axisY - valToScreenHeight(yVal, ppu)
    ctx.lineTo(sx, sy)
  }

  ctx.closePath()
  ctx.fillStyle = crescentCol(isDark)
  ctx.globalAlpha = alpha * 0.7
  ctx.fill()

  // Thin outline
  ctx.strokeStyle = crescentCol(isDark)
  ctx.lineWidth = 1
  ctx.globalAlpha = alpha * 0.9
  ctx.stroke()
}

/**
 * Draw the gamma bar on the number line from x=0 to x=length.
 */
function drawGammaBar(
  ctx: CanvasRenderingContext2D,
  toX: (v: number) => number,
  axisY: number,
  length: number,
  ppu: number,
  isDark: boolean,
  alpha: number
) {
  if (alpha <= 0 || length <= 0) return

  const x0 = toX(0)
  const x1 = toX(length)
  const barH = Math.max(8, Math.min(16, ppu * 0.1))

  // Glow behind
  ctx.fillStyle = crescentCol(isDark)
  ctx.globalAlpha = alpha * 0.2
  ctx.fillRect(x0 - 2, axisY - barH / 2 - 2, x1 - x0 + 4, barH + 4)

  // Main bar
  ctx.fillStyle = crescentCol(isDark)
  ctx.globalAlpha = alpha * 0.85
  ctx.fillRect(x0, axisY - barH / 2, x1 - x0, barH)

  // Crisp border
  ctx.strokeStyle = isDark ? '#fcd34d' : '#d97706'
  ctx.lineWidth = 1.5
  ctx.globalAlpha = alpha
  ctx.strokeRect(x0, axisY - barH / 2, x1 - x0, barH)
}

/** Draw a 5-pointed star. */
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

/**
 * Draw a "question dot" — a glowing dot at a non-integer position showing
 * the in-between share value.
 */
function drawQuestionDot(
  ctx: CanvasRenderingContext2D,
  toX: (v: number) => number,
  axisY: number,
  xVal: number,
  ppu: number,
  isDark: boolean,
  alpha: number
) {
  if (alpha <= 0) return

  const sx = toX(xVal)
  const sy = axisY - valToScreenHeight(1 / xVal, ppu)
  const r = Math.max(3, Math.min(6, ppu * 0.04))

  // Glow
  ctx.beginPath()
  ctx.arc(sx, sy, r * 2, 0, Math.PI * 2)
  ctx.fillStyle = curveCol(isDark)
  ctx.globalAlpha = alpha * 0.2
  ctx.fill()

  // Dot
  ctx.beginPath()
  ctx.arc(sx, sy, r, 0, Math.PI * 2)
  ctx.fillStyle = curveCol(isDark)
  ctx.globalAlpha = alpha * 0.9
  ctx.fill()
}

// ── Main render ──────────────────────────────────────────────────────

export function renderGammaOverlay(
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

  // ── Phase: Build the sharing steps ──

  // Step 1 (k=1): grows in
  if (revealProgress >= PHASE.step1Start) {
    const growP = smoothstep(mapRange(revealProgress, PHASE.step1Start, PHASE.step1Start + 0.06))
    if (growP > 0) {
      // Animate the rectangle growing upward
      const x0 = toX(1)
      const x1 = toX(2)
      const fullH = valToScreenHeight(1, ppu)
      const h = fullH * growP
      const y = axisY - h

      ctx.fillStyle = stepCol(isDark)
      ctx.globalAlpha = opacity * 0.6 * growP
      ctx.fillRect(x0, y, x1 - x0, h)
      ctx.strokeStyle = stepCol(isDark)
      ctx.lineWidth = 1.5
      ctx.globalAlpha = opacity * 0.8 * growP
      ctx.strokeRect(x0, y, x1 - x0, h)
    }

    // Label "1 friend → 1 cookie"
    if (revealProgress < PHASE.step2Start) {
      const labelAlpha =
        smoothstep(mapRange(revealProgress, PHASE.step1Start + 0.03, PHASE.step1Start + 0.06)) *
        (1 - smoothstep(mapRange(revealProgress, PHASE.step1End - 0.02, PHASE.step1End)))
      if (labelAlpha > 0.01) {
        const fs = Math.max(11, Math.min(14, ppu * 0.14))
        ctx.font = `${fs}px system-ui, sans-serif`
        ctx.fillStyle = textColor(isDark)
        ctx.textAlign = 'center'
        ctx.textBaseline = 'bottom'
        ctx.globalAlpha = opacity * labelAlpha
        const labelX = (toX(1) + toX(2)) / 2
        ctx.fillText('1 friend → 1 whole cookie!', labelX, axisY - valToScreenHeight(1, ppu) - 6)
      }
    }
  }

  // Step 2 (k=2): grows in
  if (revealProgress >= PHASE.step2Start) {
    const growP = smoothstep(mapRange(revealProgress, PHASE.step2Start, PHASE.step2Start + 0.05))

    // Dim step 1
    if (growP > 0 && revealProgress < PHASE.curveStart) {
      drawStep(ctx, toX, axisY, 1, ppu, isDark, opacity, true)
    }

    if (growP > 0) {
      const x0 = toX(2)
      const x1 = toX(3)
      const fullH = valToScreenHeight(0.5, ppu)
      const h = fullH * growP
      const y = axisY - h

      ctx.fillStyle = stepCol(isDark)
      ctx.globalAlpha = opacity * 0.6 * growP
      ctx.fillRect(x0, y, x1 - x0, h)
      ctx.strokeStyle = stepCol(isDark)
      ctx.lineWidth = 1.5
      ctx.globalAlpha = opacity * 0.8 * growP
      ctx.strokeRect(x0, y, x1 - x0, h)
    }

    // Label "2 friends → ½ each"
    if (revealProgress < PHASE.step3Start) {
      const labelAlpha =
        smoothstep(mapRange(revealProgress, PHASE.step2Start + 0.03, PHASE.step2Start + 0.06)) *
        (1 - smoothstep(mapRange(revealProgress, PHASE.step2End - 0.02, PHASE.step2End)))
      if (labelAlpha > 0.01) {
        const fs = Math.max(11, Math.min(14, ppu * 0.14))
        ctx.font = `${fs}px system-ui, sans-serif`
        ctx.fillStyle = textColor(isDark)
        ctx.textAlign = 'center'
        ctx.textBaseline = 'bottom'
        ctx.globalAlpha = opacity * labelAlpha
        const labelX = (toX(2) + toX(3)) / 2
        ctx.fillText('2 friends → ½ each', labelX, axisY - valToScreenHeight(0.5, ppu) - 6)
      }
    }
  }

  // Step 3 (k=3): grows in
  if (revealProgress >= PHASE.step3Start) {
    const growP = smoothstep(mapRange(revealProgress, PHASE.step3Start, PHASE.step3Start + 0.04))

    // Dim steps 1 & 2
    if (growP > 0 && revealProgress < PHASE.curveStart) {
      drawStep(ctx, toX, axisY, 1, ppu, isDark, opacity, true)
      drawStep(ctx, toX, axisY, 2, ppu, isDark, opacity, true)
    }

    if (growP > 0) {
      const x0 = toX(3)
      const x1 = toX(4)
      const fullH = valToScreenHeight(1 / 3, ppu)
      const h = fullH * growP
      const y = axisY - h

      ctx.fillStyle = stepCol(isDark)
      ctx.globalAlpha = opacity * 0.6 * growP
      ctx.fillRect(x0, y, x1 - x0, h)
      ctx.strokeStyle = stepCol(isDark)
      ctx.lineWidth = 1.5
      ctx.globalAlpha = opacity * 0.8 * growP
      ctx.strokeRect(x0, y, x1 - x0, h)
    }

    // Label "3 friends → ⅓ each"
    if (revealProgress < PHASE.questionStart) {
      const labelAlpha =
        smoothstep(mapRange(revealProgress, PHASE.step3Start + 0.02, PHASE.step3Start + 0.05)) *
        (1 - smoothstep(mapRange(revealProgress, PHASE.step3End - 0.03, PHASE.step3End)))
      if (labelAlpha > 0.01) {
        const fs = Math.max(11, Math.min(14, ppu * 0.14))
        ctx.font = `${fs}px system-ui, sans-serif`
        ctx.fillStyle = textColor(isDark)
        ctx.textAlign = 'center'
        ctx.textBaseline = 'bottom'
        ctx.globalAlpha = opacity * labelAlpha
        const labelX = (toX(3) + toX(4)) / 2
        ctx.fillText('3 friends → ⅓ each', labelX, axisY - valToScreenHeight(1 / 3, ppu) - 6)
      }
    }
  }

  // ── Phase: "What about in-between?" question dots ──
  if (revealProgress >= PHASE.questionStart && revealProgress < PHASE.curveEnd) {
    const qP = smoothstep(mapRange(revealProgress, PHASE.questionStart, PHASE.questionEnd))
    const qFade = 1 - smoothstep(mapRange(revealProgress, PHASE.curveStart + 0.05, PHASE.curveEnd))
    const qAlpha = qP * qFade

    if (qAlpha > 0.01) {
      drawQuestionDot(ctx, toX, axisY, 1.5, ppu, isDark, opacity * qAlpha)
      drawQuestionDot(
        ctx,
        toX,
        axisY,
        2.5,
        ppu,
        isDark,
        opacity * qAlpha * smoothstep(mapRange(qP, 0.3, 0.7))
      )

      // Label
      const fs = Math.max(10, Math.min(13, ppu * 0.12))
      ctx.font = `italic ${fs}px system-ui, sans-serif`
      ctx.fillStyle = curveCol(isDark)
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ctx.globalAlpha = opacity * qAlpha * 0.9
      ctx.fillText('What about 1½ friends? Or 2½?', (toX(1) + toX(4)) / 2, axisY + 10)
    }
  }

  // ── Phase: Draw all steps (dimmed) once curve begins ──
  if (revealProgress >= PHASE.curveStart) {
    const stepsAlpha = smoothstep(
      mapRange(revealProgress, PHASE.curveStart, PHASE.curveStart + 0.03)
    )
    // During collection/reveal, fade out the construction
    const constructionFade =
      1 - smoothstep(mapRange(revealProgress, PHASE.collectStart + 0.1, PHASE.collectEnd))

    if (stepsAlpha > 0 && constructionFade > 0) {
      const maxK =
        revealProgress >= PHASE.cascadeEnd
          ? MAX_K
          : revealProgress >= PHASE.cascadeStart
            ? 3 +
              Math.floor(
                mapRange(revealProgress, PHASE.cascadeStart, PHASE.cascadeEnd) * (MAX_K - 3)
              )
            : 3

      for (let k = 1; k <= maxK; k++) {
        const dim = revealProgress >= PHASE.crescentHighlightStart
        drawStep(ctx, toX, axisY, k, ppu, isDark, opacity * stepsAlpha * constructionFade, dim)
      }
    }

    // ── Draw the 1/x curve ──
    if (constructionFade > 0) {
      const curveDrawP = mapRange(revealProgress, PHASE.curveStart, PHASE.curveEnd)
      const curveEndVal =
        revealProgress >= PHASE.cascadeEnd
          ? MAX_K + 1
          : revealProgress >= PHASE.cascadeStart
            ? 4 + mapRange(revealProgress, PHASE.cascadeStart, PHASE.cascadeEnd) * (MAX_K - 3)
            : 4
      drawCurve(
        ctx,
        toX,
        axisY,
        1,
        curveEndVal,
        ppu,
        isDark,
        opacity * constructionFade,
        curveDrawP
      )
    }

    // ── Draw crescents ──
    if (revealProgress >= PHASE.crescentHighlightStart && constructionFade > 0) {
      const maxCrescentK =
        revealProgress >= PHASE.cascadeEnd
          ? MAX_K
          : revealProgress >= PHASE.cascadeStart
            ? 3 +
              Math.floor(
                mapRange(revealProgress, PHASE.cascadeStart, PHASE.cascadeEnd) * (MAX_K - 3)
              )
            : 3

      for (let k = 1; k <= maxCrescentK; k++) {
        // Sequential glow: each crescent lights up in turn
        const seqStart = PHASE.crescentHighlightStart + (k - 1) * 0.015
        const seqEnd = seqStart + 0.03
        const glowP = mapRange(revealProgress, seqStart, seqEnd)
        const baseAlpha = revealProgress >= seqEnd ? 1 : smoothstep(glowP)

        // During collection, crescents that have already "flown" should fade
        const collectP = mapRange(revealProgress, PHASE.collectStart, PHASE.collectEnd)
        const flyP = mapRange(collectP, (k - 1) / MAX_K, k / MAX_K)
        const collectionFade = 1 - smoothstep(flyP)

        drawCrescent(
          ctx,
          toX,
          axisY,
          k,
          ppu,
          isDark,
          opacity * baseAlpha * constructionFade * collectionFade
        )
      }
    }
  }

  // ── Phase: Crescents label ──
  if (revealProgress >= PHASE.crescentHighlightStart && revealProgress < PHASE.collectStart) {
    const labelIn = smoothstep(
      mapRange(
        revealProgress,
        PHASE.crescentHighlightStart + 0.02,
        PHASE.crescentHighlightStart + 0.06
      )
    )
    const labelOut =
      1 - smoothstep(mapRange(revealProgress, PHASE.cascadeEnd - 0.02, PHASE.cascadeEnd + 0.02))
    const labelAlpha = labelIn * labelOut

    if (labelAlpha > 0.01) {
      const fs = Math.max(11, Math.min(14, ppu * 0.14))
      ctx.font = `${fs}px system-ui, sans-serif`
      ctx.fillStyle = crescentCol(isDark)
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ctx.globalAlpha = opacity * labelAlpha
      ctx.fillText('The steps always poke above the slide!', (toX(1) + toX(5)) / 2, axisY + 10)
    }
  }

  // ── Phase: Cascade label ──
  if (revealProgress >= PHASE.cascadeStart && revealProgress < PHASE.collectStart) {
    const labelIn = smoothstep(
      mapRange(revealProgress, PHASE.cascadeStart + 0.01, PHASE.cascadeStart + 0.04)
    )
    const labelOut =
      1 - smoothstep(mapRange(revealProgress, PHASE.cascadeEnd - 0.02, PHASE.cascadeEnd))
    const labelAlpha = labelIn * labelOut

    if (labelAlpha > 0.01) {
      const fs = Math.max(11, Math.min(14, ppu * 0.14))
      ctx.font = `${fs}px system-ui, sans-serif`
      ctx.fillStyle = textColor(isDark)
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ctx.globalAlpha = opacity * labelAlpha
      ctx.fillText('Tinier and tinier extras...', (toX(5) + toX(10)) / 2, axisY + 10)
    }
  }

  // ── Phase: Collection — crescents fly to number line ──
  if (revealProgress >= PHASE.collectStart) {
    const collectP = easeInOut(mapRange(revealProgress, PHASE.collectStart, PHASE.collectEnd))

    // The golden bar grows as each crescent arrives
    let barLength = 0
    for (let k = 1; k <= MAX_K; k++) {
      const flyP = mapRange(collectP, (k - 1) / MAX_K, k / MAX_K)
      if (flyP <= 0) break
      const arrived = smoothstep(flyP)
      barLength += CRESCENTS[k - 1].area * arrived
    }

    // After all explicit crescents, dust fills to gamma
    const dustP = mapRange(revealProgress, PHASE.collectEnd - 0.05, PHASE.collectEnd)
    if (dustP > 0) {
      const remaining = EULER_MASCHERONI - cumulativeCrescent(MAX_K)
      barLength += remaining * smoothstep(dustP)
    }

    drawGammaBar(ctx, toX, axisY, barLength, ppu, isDark, opacity)

    // "Collecting..." label during flight
    if (revealProgress < PHASE.revealStart) {
      const labelAlpha =
        smoothstep(mapRange(revealProgress, PHASE.collectStart + 0.02, PHASE.collectStart + 0.06)) *
        (1 - smoothstep(mapRange(revealProgress, PHASE.collectEnd - 0.04, PHASE.collectEnd)))
      if (labelAlpha > 0.01) {
        const fs = Math.max(11, Math.min(14, ppu * 0.14))
        ctx.font = `${fs}px system-ui, sans-serif`
        ctx.fillStyle = crescentCol(isDark)
        ctx.textAlign = 'center'
        ctx.textBaseline = 'top'
        ctx.globalAlpha = opacity * labelAlpha
        ctx.fillText(
          'Lining up the extra bits...',
          toX(barLength / 2),
          axisY + Math.max(8, Math.min(16, ppu * 0.1)) / 2 + 8
        )
      }
    }
  }

  // ── Phase: The Reveal ──
  if (revealProgress >= PHASE.revealStart) {
    const revealP = smoothstep(mapRange(revealProgress, PHASE.revealStart, PHASE.revealEnd))

    // Full gamma bar
    drawGammaBar(ctx, toX, axisY, EULER_MASCHERONI, ppu, isDark, opacity)

    // Star at gamma
    const gammaX = toX(EULER_MASCHERONI)
    const starY = axisY - Math.max(8, Math.min(16, ppu * 0.1)) / 2 - 12
    const starR = Math.max(6, Math.min(10, ppu * 0.06))
    const starPulse = 1 + 0.1 * Math.sin(revealProgress * Math.PI * 8)
    drawStar(
      ctx,
      gammaX,
      starY,
      starR * starPulse * revealP,
      crescentCol(isDark),
      opacity * revealP
    )

    // "γ" label above
    if (revealP > 0.3) {
      const labelP = smoothstep(mapRange(revealP, 0.3, 0.7))
      const fs = Math.max(18, Math.min(26, ppu * 0.22))
      ctx.font = `bold ${fs}px system-ui, sans-serif`
      ctx.fillStyle = crescentCol(isDark)
      ctx.textAlign = 'center'
      ctx.textBaseline = 'bottom'
      ctx.globalAlpha = opacity * labelP
      ctx.fillText('γ', gammaX, starY - starR - 4)
    }

    // "≈ 0.577" label below
    if (revealP > 0.5) {
      const valP = smoothstep(mapRange(revealP, 0.5, 0.85))
      const fs = Math.max(14, Math.min(18, ppu * 0.16))
      ctx.font = `bold ${fs}px system-ui, sans-serif`
      ctx.fillStyle = crescentCol(isDark)
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ctx.globalAlpha = opacity * valP
      ctx.fillText('≈ 0.577', gammaX, axisY + Math.max(8, Math.min(16, ppu * 0.1)) / 2 + 6)
    }

    // Subtitle: "The sharing leftover"
    if (revealP > 0.7) {
      const subP = smoothstep(mapRange(revealP, 0.7, 1.0))
      const fs = Math.max(10, Math.min(13, ppu * 0.11))
      ctx.font = `${fs}px system-ui, sans-serif`
      ctx.fillStyle = subtextColor(isDark)
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ctx.globalAlpha = opacity * subP * 0.7
      ctx.fillText(
        'The sharing leftover',
        gammaX,
        axisY + Math.max(8, Math.min(16, ppu * 0.1)) / 2 + 26
      )
    }

    // Formula for curious kids
    if (revealP > 0.85) {
      const formulaP = smoothstep(mapRange(revealP, 0.85, 1.0))
      const fs = Math.max(9, Math.min(11, ppu * 0.09))
      ctx.font = `${fs}px system-ui, sans-serif`
      ctx.fillStyle = subtextColor(isDark)
      ctx.textAlign = 'center'
      ctx.textBaseline = 'bottom'
      ctx.globalAlpha = opacity * formulaP * 0.5
      ctx.fillText('γ = lim [1 + ½ + ⅓ + … + 1/n − ln n]', gammaX, starY - starR - fs - 10)
    }
  }

  ctx.globalAlpha = 1
  ctx.setLineDash([])
  ctx.restore()
}
