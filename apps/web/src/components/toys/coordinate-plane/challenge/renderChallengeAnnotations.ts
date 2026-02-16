import type { ChallengeState } from './types'
import type { WordProblem, AnnotationTag } from '../wordProblems/types'
import type { CoordinatePlaneState } from '../types'
import { worldToScreen2D } from '../../shared/coordinateConversions'

const SYSTEM_FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'

/** Tag colors matching WordProblemCard */
const TAG_COLORS: Partial<Record<AnnotationTag, string>> = {
  slope: '#f59e0b',
  intercept: '#3b82f6',
  target: '#ef4444',
  answer: '#10b981',
}

/** Format a value with its unit: "$3" or "5 inches" */
function fmtUnit(value: number, unit: string, position: 'prefix' | 'suffix'): string {
  return position === 'prefix' ? `${unit}${value}` : `${value} ${unit}`
}

/** Extract the text of a tagged span from the problem */
function spanText(problem: WordProblem, tag: AnnotationTag): string | undefined {
  return problem.spans.find(s => s.tag === tag)?.text
}

/**
 * Render challenge-related annotations on the canvas.
 * Called from the RAF loop after renderCoordinatePlane and renderRuler.
 *
 * Uses real-world terms from the word problem (e.g., "$3 per slice")
 * to bridge the gap between the story and the geometry.
 */
export function renderChallengeAnnotations(
  ctx: CanvasRenderingContext2D,
  challenge: ChallengeState,
  problem: WordProblem,
  state: CoordinatePlaneState,
  cssWidth: number,
  cssHeight: number,
  isDark: boolean,
) {
  const { phase, revealStep } = challenge

  const toScreen = (wx: number, wy: number) =>
    worldToScreen2D(
      wx, wy,
      state.center.x, state.center.y,
      state.pixelsPerUnit.x, state.pixelsPerUnit.y,
      cssWidth, cssHeight,
    )

  const m = problem.equation.slope.num / problem.equation.slope.den
  const b = problem.equation.intercept.num / problem.equation.intercept.den
  const { unitFormat } = problem

  // ── Constraint line: dashed horizontal at y = target ──
  const showConstraint = phase === 'solving' || phase === 'checking'
    || phase === 'celebrating' || phase === 'revealing' || phase === 'revealed'

  if (showConstraint && problem.answer.solveFor !== 'equation') {
    const yTarget = problem.answer.y
    const screenY = toScreen(0, yTarget).y

    if (screenY >= -20 && screenY <= cssHeight + 20) {
      const color = TAG_COLORS.target!
      const alpha = phase === 'solving' ? 0.5 : 0.7

      const targetText = spanText(problem, 'target')
      const labelText = targetText
        ? `${problem.axisLabels.y}: ${targetText}`
        : fmtUnit(yTarget, unitFormat.y.unit, unitFormat.y.position)

      ctx.save()
      ctx.setLineDash([8, 6])
      ctx.beginPath()
      ctx.moveTo(0, screenY)
      ctx.lineTo(cssWidth, screenY)
      ctx.strokeStyle = color
      ctx.globalAlpha = alpha
      ctx.lineWidth = 1.5
      ctx.stroke()
      ctx.setLineDash([])

      // Label on the right edge
      ctx.font = `500 13px ${SYSTEM_FONT}`
      const textWidth = ctx.measureText(labelText).width
      const labelX = cssWidth - textWidth - 10
      const labelY = screenY - 10

      ctx.globalAlpha = isDark ? 0.85 : 0.9
      ctx.fillStyle = isDark ? 'rgba(30, 41, 59, 0.9)' : 'rgba(255, 255, 255, 0.9)'
      const pillPad = 5
      ctx.beginPath()
      roundRect(ctx, labelX - pillPad, labelY - pillPad, textWidth + pillPad * 2, 16 + pillPad, 4)
      ctx.fill()

      ctx.globalAlpha = alpha + 0.2
      ctx.fillStyle = color
      ctx.textAlign = 'left'
      ctx.textBaseline = 'top'
      ctx.fillText(labelText, labelX, labelY)
      ctx.restore()
    }
  }

  // ── Annotation markers during reveal ──
  if (phase !== 'revealing' && phase !== 'revealed') return

  const annotatedSpans = problem.spans.filter(
    s => s.tag && s.tag !== 'context' && s.tag !== 'question'
      && s.tag !== 'x_unit' && s.tag !== 'y_unit'
  )

  annotatedSpans.forEach((span, index) => {
    if (index >= revealStep) return
    if (!span.tag) return

    switch (span.tag) {
      case 'intercept':
        renderInterceptMarker(ctx, b, problem, toScreen, isDark)
        break
      case 'slope':
        renderSlopeStaircase(ctx, m, b, problem, toScreen, isDark)
        break
      case 'target':
        renderTargetHighlight(ctx, problem.answer.y, toScreen, cssWidth, cssHeight)
        break
      case 'answer':
        renderAnswerMarker(ctx, problem.answer.x, problem.answer.y, problem, toScreen, isDark)
        break
    }
  })
}

/** Colored dot + label at the y-intercept (0, b) */
function renderInterceptMarker(
  ctx: CanvasRenderingContext2D,
  b: number,
  problem: WordProblem,
  toScreen: (wx: number, wy: number) => { x: number; y: number },
  isDark: boolean,
) {
  const color = TAG_COLORS.intercept!
  const pos = toScreen(0, b)

  ctx.save()

  // Glow
  const glowRadius = 18
  const glow = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, glowRadius)
  glow.addColorStop(0, `${color}55`)
  glow.addColorStop(1, `${color}00`)
  ctx.fillStyle = glow
  ctx.fillRect(pos.x - glowRadius, pos.y - glowRadius, glowRadius * 2, glowRadius * 2)

  // Filled circle
  ctx.beginPath()
  ctx.arc(pos.x, pos.y, 6, 0, Math.PI * 2)
  ctx.fillStyle = color
  ctx.globalAlpha = 0.9
  ctx.fill()

  // Outer ring
  ctx.beginPath()
  ctx.arc(pos.x, pos.y, 9, 0, Math.PI * 2)
  ctx.strokeStyle = color
  ctx.globalAlpha = 0.4
  ctx.lineWidth = 1.5
  ctx.stroke()

  // Label: "starts at $80"
  const interceptText = spanText(problem, 'intercept') ?? `${b}`
  const labelText = `starts at ${interceptText}`
  ctx.font = `600 13px ${SYSTEM_FONT}`
  ctx.globalAlpha = 0.9
  const textWidth = ctx.measureText(labelText).width
  const labelX = pos.x + 14
  const labelY = pos.y - 8

  const pillPad = 5
  ctx.fillStyle = isDark ? 'rgba(30, 41, 59, 0.9)' : 'rgba(255, 255, 255, 0.9)'
  ctx.beginPath()
  roundRect(ctx, labelX - pillPad, labelY - pillPad, textWidth + pillPad * 2, 16 + pillPad, 4)
  ctx.fill()

  ctx.fillStyle = color
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.fillText(labelText, labelX, labelY)

  ctx.restore()
}

/**
 * Staircase of rise/run triangles from the intercept to the answer point.
 *
 * Draws every step so kids can see the slope repeating: each step is
 * "1 week → $20", "1 week → $20", "1 week → $20" — the pattern is
 * unmissable. Labels the first step with real-world units and shows
 * a "× N" count on the last step.
 */
function renderSlopeStaircase(
  ctx: CanvasRenderingContext2D,
  m: number,
  b: number,
  problem: WordProblem,
  toScreen: (wx: number, wy: number) => { x: number; y: number },
  isDark: boolean,
) {
  if (m === 0) return

  const color = TAG_COLORS.slope!
  const { unitFormat } = problem
  const xAnswer = problem.answer.x

  // Number of staircase steps = xAnswer (one step per unit of x)
  const steps = Math.min(Math.abs(xAnswer), 12) // cap to avoid visual overload
  if (steps === 0) return

  const stepDir = xAnswer > 0 ? 1 : -1

  ctx.save()

  // ── Draw all staircase triangles ──
  for (let i = 0; i < steps; i++) {
    const x0 = i * stepDir
    const y0 = b + m * x0
    const x1 = (i + 1) * stepDir
    const y1 = b + m * x0     // horizontal run stays at same y
    const y2 = b + m * x1     // rise to next y

    const p0 = toScreen(x0, y0)
    const pRun = toScreen(x1, y1)
    const pRise = toScreen(x1, y2)

    // Fade later triangles slightly
    const fadeAlpha = i === 0 ? 1.0 : Math.max(0.4, 1.0 - i * 0.08)

    // Filled triangle
    ctx.beginPath()
    ctx.moveTo(p0.x, p0.y)
    ctx.lineTo(pRun.x, pRun.y)
    ctx.lineTo(pRise.x, pRise.y)
    ctx.closePath()
    ctx.globalAlpha = fadeAlpha * 0.15
    ctx.fillStyle = color
    ctx.fill()

    // Run edge (horizontal, dashed)
    ctx.beginPath()
    ctx.moveTo(p0.x, p0.y)
    ctx.lineTo(pRun.x, pRun.y)
    ctx.strokeStyle = color
    ctx.globalAlpha = fadeAlpha * 0.5
    ctx.lineWidth = 1.5
    ctx.setLineDash([4, 3])
    ctx.stroke()

    // Rise edge (vertical, solid)
    ctx.beginPath()
    ctx.moveTo(pRun.x, pRun.y)
    ctx.lineTo(pRise.x, pRise.y)
    ctx.strokeStyle = color
    ctx.globalAlpha = fadeAlpha * 0.7
    ctx.lineWidth = 2
    ctx.setLineDash([])
    ctx.stroke()

    // Right-angle indicator on first triangle
    if (i === 0) {
      const cornerSize = 7
      const rise = m * stepDir
      const dirY = rise > 0 ? -1 : 1
      ctx.beginPath()
      ctx.moveTo(pRun.x - cornerSize * stepDir, pRun.y)
      ctx.lineTo(pRun.x - cornerSize * stepDir, pRun.y + dirY * cornerSize)
      ctx.lineTo(pRun.x, pRun.y + dirY * cornerSize)
      ctx.strokeStyle = color
      ctx.globalAlpha = 0.5
      ctx.lineWidth = 1
      ctx.stroke()
    }

    // Emoji at the centroid of each triangle
    const centroidX = (p0.x + pRun.x + pRise.x) / 3
    const centroidY = (p0.y + pRun.y + pRise.y) / 3
    // Size emoji relative to triangle — use the shorter of run/rise screen dimensions
    const triW = Math.abs(pRun.x - p0.x)
    const triH = Math.abs(pRise.y - pRun.y)
    const emojiSize = Math.max(10, Math.min(triW, triH, 28) * 0.6)
    ctx.font = `${emojiSize}px ${SYSTEM_FONT}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.globalAlpha = fadeAlpha * 0.8
    ctx.fillText(problem.emoji, centroidX, centroidY)
  }

  // ── Labels on the FIRST triangle ──
  const first0 = toScreen(0, b)
  const firstRun = toScreen(stepDir, b)
  const firstRise = toScreen(stepDir, b + m * stepDir)

  ctx.font = `600 13px ${SYSTEM_FONT}`
  ctx.globalAlpha = 0.9
  const rise = m * stepDir

  // Run label: "1 week" along the horizontal edge
  const runMidX = (first0.x + firstRun.x) / 2
  const runMidY = first0.y + (rise > 0 ? 18 : -12)
  const runLabel = `1 ${unitFormat.x.singular}`
  drawPillLabel(ctx, runLabel, runMidX, runMidY, color, isDark, 'center', 'top')

  // Rise label: "$20" along the vertical edge
  const riseMidY = (firstRun.y + firstRise.y) / 2
  const slopeText = spanText(problem, 'slope') ?? fmtUnit(Math.abs(rise), unitFormat.y.unit, unitFormat.y.position)
  const riseLabelX = firstRun.x + 12 * stepDir
  drawPillLabel(ctx, slopeText, riseLabelX, riseMidY, color, isDark,
    stepDir > 0 ? 'left' : 'right', 'middle')

  // ── "× N" count badge on the last step ──
  if (steps > 1) {
    const lastRise = toScreen(steps * stepDir, b + m * steps * stepDir)
    const countLabel = `× ${steps}`
    ctx.font = `700 12px ${SYSTEM_FONT}`
    const countX = lastRise.x + 8 * stepDir
    const countY = lastRise.y - 4
    drawPillLabel(ctx, countLabel, countX, countY, color, isDark,
      stepDir > 0 ? 'left' : 'right', 'middle')
  }

  ctx.restore()
}

/** Brightens the constraint line during reveal */
function renderTargetHighlight(
  ctx: CanvasRenderingContext2D,
  yTarget: number,
  toScreen: (wx: number, wy: number) => { x: number; y: number },
  cssWidth: number,
  cssHeight: number,
) {
  const color = TAG_COLORS.target!
  const screenY = toScreen(0, yTarget).y

  if (screenY < -20 || screenY > cssHeight + 20) return

  ctx.save()

  const glowHeight = 10
  const glow = ctx.createLinearGradient(0, screenY - glowHeight, 0, screenY + glowHeight)
  glow.addColorStop(0, `${color}00`)
  glow.addColorStop(0.5, `${color}44`)
  glow.addColorStop(1, `${color}00`)
  ctx.fillStyle = glow
  ctx.fillRect(0, screenY - glowHeight, cssWidth, glowHeight * 2)

  ctx.restore()
}

/** Highlighted dot at the solution point */
function renderAnswerMarker(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  problem: WordProblem,
  toScreen: (wx: number, wy: number) => { x: number; y: number },
  isDark: boolean,
) {
  const color = TAG_COLORS.answer!
  const pos = toScreen(x, y)
  const { unitFormat, axisLabels } = problem

  ctx.save()

  // Glow
  const glowRadius = 22
  const glow = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, glowRadius)
  glow.addColorStop(0, `${color}66`)
  glow.addColorStop(0.5, `${color}22`)
  glow.addColorStop(1, `${color}00`)
  ctx.fillStyle = glow
  ctx.fillRect(pos.x - glowRadius, pos.y - glowRadius, glowRadius * 2, glowRadius * 2)

  // Crosshair lines
  const crossSize = 12
  ctx.beginPath()
  ctx.moveTo(pos.x - crossSize, pos.y)
  ctx.lineTo(pos.x + crossSize, pos.y)
  ctx.moveTo(pos.x, pos.y - crossSize)
  ctx.lineTo(pos.x, pos.y + crossSize)
  ctx.strokeStyle = color
  ctx.globalAlpha = 0.6
  ctx.lineWidth = 1
  ctx.stroke()

  // Filled circle
  ctx.beginPath()
  ctx.arc(pos.x, pos.y, 6, 0, Math.PI * 2)
  ctx.fillStyle = color
  ctx.globalAlpha = 0.9
  ctx.fill()

  // Label: "8 weeks, $240"
  const xFormatted = `${x} ${axisLabels.x}`
  const yFormatted = fmtUnit(y, unitFormat.y.unit, unitFormat.y.position)
  const labelText = `${xFormatted}, ${yFormatted}`
  ctx.font = `600 13px ${SYSTEM_FONT}`
  drawPillLabel(ctx, labelText, pos.x + 14, pos.y - 18, color, isDark, 'left', 'top')

  ctx.restore()
}

// ── Helpers ──────────────────────────────────────────────────────────

/** Draw a text label on a rounded background pill */
function drawPillLabel(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color: string,
  isDark: boolean,
  align: 'left' | 'center' | 'right',
  baseline: 'top' | 'middle',
) {
  const textWidth = ctx.measureText(text).width
  const pillPad = 5
  const pillH = 18
  const pillW = textWidth + pillPad * 2

  // Compute pill position based on alignment
  let pillX: number
  if (align === 'center') pillX = x - pillW / 2
  else if (align === 'right') pillX = x - pillW
  else pillX = x

  let pillY: number
  if (baseline === 'middle') pillY = y - pillH / 2
  else pillY = y - pillPad

  ctx.save()
  ctx.globalAlpha = isDark ? 0.9 : 0.92
  ctx.fillStyle = isDark ? 'rgba(30, 41, 59, 0.92)' : 'rgba(255, 255, 255, 0.92)'
  ctx.beginPath()
  roundRect(ctx, pillX, pillY, pillW, pillH, 4)
  ctx.fill()

  ctx.globalAlpha = 0.9
  ctx.fillStyle = color
  ctx.textAlign = align
  ctx.textBaseline = baseline
  ctx.fillText(text, align === 'center' ? x : align === 'right' ? x : x + pillPad, baseline === 'middle' ? y : y)
  ctx.restore()
}

/** Canvas roundRect helper */
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
) {
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.arcTo(x + w, y, x + w, y + r, r)
  ctx.lineTo(x + w, y + h - r)
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
  ctx.lineTo(x + r, y + h)
  ctx.arcTo(x, y + h, x, y + h - r, r)
  ctx.lineTo(x, y + r)
  ctx.arcTo(x, y, x + r, y, r)
}
