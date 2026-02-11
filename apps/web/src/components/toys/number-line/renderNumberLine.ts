import type { NumberLineState, TickThresholds, CollisionFadeMap, RenderConstant, PrimeTickInfo } from './types'
import { DEFAULT_TICK_THRESHOLDS } from './types'
import { computeTickMarks, numberToScreenX } from './numberLineTicks'
import { renderConstantDropLines } from './constants/renderConstants'
import { primeColorRgba } from './primes/primeColors'
import type { PrimePairArc } from './primes/specialPrimes'
import { MERSENNE_PRIMES, ARC_COLORS } from './primes/specialPrimes'
import type { InterestingPrime } from './primes/interestingness'

export interface RenderTarget {
  value: number
  emoji: string
  /** Pre-computed opacity (0-1) from proximity engine */
  opacity: number
}

/** Base RGB components for dynamic alpha composition */
interface RenderColors {
  axisLine: string
  /** RGB for tick marks — alpha computed from prominence */
  tickRgb: string
  /** RGB for labels — alpha computed from prominence */
  labelRgb: string
}

const LIGHT_COLORS: RenderColors = {
  axisLine: 'rgba(55, 65, 81, 0.8)',
  tickRgb: '55, 65, 81',
  labelRgb: '17, 24, 39',
}

const DARK_COLORS: RenderColors = {
  axisLine: 'rgba(209, 213, 219, 0.8)',
  tickRgb: '209, 213, 219',
  labelRgb: '243, 244, 246',
}

// Visual landmarks for prominence-based interpolation
// p=1.0 (anchor), p=0.5 (medium), p=0.0 (fine)
const HEIGHTS = { anchor: 40, medium: 24, fine: 12 } as const
const LINE_WIDTHS = { anchor: 2, medium: 1.5, fine: 1 } as const
const FONT_SIZES = { anchor: 13, medium: 11, fine: 11 } as const
const FONT_WEIGHTS = { anchor: 600, medium: 400, fine: 400 } as const
const TICK_ALPHAS = { anchor: 1.0, medium: 0.5, fine: 0.15 } as const
const COLLISION_FADE_MS = 500

/** Piecewise linear interpolation between three landmarks at p=1, p=0.5, p=0 */
function lerpLandmarks(prominence: number, anchor: number, medium: number, fine: number): number {
  if (prominence >= 0.5) {
    // Interpolate between anchor (p=1) and medium (p=0.5)
    const t = (prominence - 0.5) / 0.5
    return medium + t * (anchor - medium)
  } else {
    // Interpolate between medium (p=0.5) and fine (p=0)
    const t = prominence / 0.5
    return fine + t * (medium - fine)
  }
}

function getTickHeight(prominence: number, canvasHeight: number): number {
  const maxHeight = canvasHeight / 2
  const raw = lerpLandmarks(prominence, HEIGHTS.anchor, HEIGHTS.medium, HEIGHTS.fine)
  const maxForLevel = lerpLandmarks(prominence, maxHeight * 0.6, maxHeight * 0.4, maxHeight * 0.2)
  return Math.min(raw, maxForLevel)
}

function getTickLineWidth(prominence: number): number {
  return lerpLandmarks(prominence, LINE_WIDTHS.anchor, LINE_WIDTHS.medium, LINE_WIDTHS.fine)
}

function getTickAlpha(prominence: number): number {
  return lerpLandmarks(prominence, TICK_ALPHAS.anchor, TICK_ALPHAS.medium, TICK_ALPHAS.fine)
}

function getTickFontSize(prominence: number): number {
  return lerpLandmarks(prominence, FONT_SIZES.anchor, FONT_SIZES.medium, FONT_SIZES.fine)
}

function getTickFontWeight(prominence: number): number {
  return Math.round(
    lerpLandmarks(prominence, FONT_WEIGHTS.anchor, FONT_WEIGHTS.medium, FONT_WEIGHTS.fine)
  )
}

/** Format a number for display as a tick label, using the tick's power for precision */
function formatTickLabel(value: number, power: number): string {
  // Normalize -0 to 0
  if (value === 0) value = 0
  // Use scientific notation for very large or very small numbers
  if (value !== 0 && (Math.abs(value) >= 1e7 || Math.abs(value) < 1e-4)) {
    // Show enough significant digits based on power
    const sigFigs = Math.max(1, Math.min(15, -power + 1))
    return value.toExponential(Math.min(sigFigs, 6))
  }
  // For normal numbers, show enough fraction digits for the tick's power
  const fractionDigits = Math.max(0, -power)
  return value.toLocaleString(undefined, { maximumFractionDigits: Math.min(fractionDigits, 20) })
}

/**
 * Render the number line onto a canvas context.
 * Assumes ctx.scale(dpr, dpr) has already been called.
 */
export function renderNumberLine(
  ctx: CanvasRenderingContext2D,
  state: NumberLineState,
  cssWidth: number,
  cssHeight: number,
  isDark: boolean,
  thresholds: TickThresholds = DEFAULT_TICK_THRESHOLDS,
  zoomVelocity = 0,
  zoomHue = 0,
  zoomFocalX = 0.5,
  target?: RenderTarget,
  collisionFadeMap?: CollisionFadeMap,
  constants?: RenderConstant[],
  primeInfos?: Map<number, PrimeTickInfo>,
  hoveredTick?: number | null,
  interestingPrimes?: InterestingPrime[],
  primePairArcs?: PrimePairArc[],
  highlightedPrimes?: Set<number>
): boolean {
  const colors = isDark ? DARK_COLORS : LIGHT_COLORS
  const centerY = cssHeight / 2

  // Clear
  ctx.clearRect(0, 0, cssWidth, cssHeight)

  // Zoom velocity background wash — hue and focal point are pre-smoothed by caller
  if (Math.abs(zoomVelocity) > 0.001) {
    const intensity = Math.min(Math.abs(zoomVelocity) * 3, 0.35)
    const sat = 80
    const lum = isDark ? 30 : 70
    const focalPx = zoomFocalX * cssWidth
    const gradient = ctx.createRadialGradient(
      focalPx, centerY, 0,
      focalPx, centerY, cssWidth * 0.7
    )
    gradient.addColorStop(0, `hsla(${zoomHue}, ${sat}%, ${lum}%, ${intensity})`)
    gradient.addColorStop(1, `hsla(${zoomHue}, ${sat}%, ${lum}%, 0)`)
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, cssWidth, cssHeight)
  }

  // Draw horizontal axis line
  ctx.beginPath()
  ctx.moveTo(0, centerY)
  ctx.lineTo(cssWidth, centerY)
  ctx.strokeStyle = colors.axisLine
  ctx.lineWidth = 1
  ctx.stroke()

  // Compute ticks
  const ticks = computeTickMarks(state, cssWidth, thresholds)

  // Pre-compute screen positions
  const ticksWithX = ticks.map((tick) => ({
    tick,
    x: numberToScreenX(tick.value, state.center, state.pixelsPerUnit, cssWidth),
  }))

  // Compute per-power label rotation angle.
  // When labels fit horizontally: angle = 0. As they get more crowded the angle
  // increases smoothly.  At angle θ the horizontal footprint is labelWidth·cos(θ),
  // so the exact no-overlap angle is acos(spacing / labelWidth).
  const LABEL_PAD = 6
  const MAX_LABEL_ANGLE = Math.PI / 3 // cap at 60°
  const powerAngle = new Map<number, number>()

  const powerSpacingPx = new Map<number, number>()
  for (const { tick } of ticksWithX) {
    if (!powerSpacingPx.has(tick.power)) {
      const spacing = Math.pow(10, tick.power)
      powerSpacingPx.set(tick.power, spacing * state.pixelsPerUnit)
    }
  }

  // Measure a representative label for each power to compute the needed angle
  const measuredPowers = new Set<number>()
  for (const { tick } of ticksWithX) {
    if (measuredPowers.has(tick.power)) continue
    if (tick.opacity <= 0) continue
    measuredPowers.add(tick.power)

    const fontSize = getTickFontSize(tick.prominence)
    const fontWeight = getTickFontWeight(tick.prominence)
    ctx.font = `${fontWeight} ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`

    const label = formatTickLabel(tick.value, tick.power)
    const labelWidth = ctx.measureText(label).width
    const spacingPx = powerSpacingPx.get(tick.power) ?? Infinity

    // ratio < 1 means labels overlap horizontally
    const ratio = Math.max(0, spacingPx - LABEL_PAD) / labelWidth
    if (ratio >= 1) {
      powerAngle.set(tick.power, 0)
    } else {
      // acos(ratio) gives the exact angle where labels just fit
      powerAngle.set(tick.power, Math.min(Math.acos(ratio), MAX_LABEL_ANGLE))
    }
  }

  // Pre-compute label info for cross-power collision detection.
  // Each label occupies a horizontal extent on the x-axis; when a lower-prominence
  // label overlaps a higher-prominence one, the lower-prominence label is hidden.
  interface LabelInfo {
    tick: typeof ticksWithX[number]['tick']
    x: number
    label: string
    fontSize: number
    fontWeight: number
    labelWidth: number
    angle: number
    height: number
    /** Horizontal extent: [xMin, xMax] on the canvas */
    xMin: number
    xMax: number
  }

  const labelInfos: LabelInfo[] = []
  for (const { tick, x } of ticksWithX) {
    if (x < -50 || x > cssWidth + 50) continue
    if (tick.opacity <= 0) continue

    const label = formatTickLabel(tick.value, tick.power)
    const fontSize = getTickFontSize(tick.prominence)
    const fontWeight = getTickFontWeight(tick.prominence)
    ctx.font = `${fontWeight} ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
    const labelWidth = ctx.measureText(label).width
    const angle = powerAngle.get(tick.power) ?? 0
    const height = getTickHeight(tick.prominence, cssHeight)

    // Compute horizontal footprint of the (possibly rotated) label.
    // The label is drawn at (x, labelY) then rotated by angle.
    // Its horizontal extent is approximately labelWidth·cos(angle) + fontSize·sin(angle).
    const t = MAX_LABEL_ANGLE > 0 ? Math.min(angle / MAX_LABEL_ANGLE, 1) : 0
    const xOffset = -labelWidth / 2 * (1 - t)
    const hFootprint = labelWidth * Math.cos(angle) + fontSize * Math.sin(angle)
    const xMin = x + xOffset * Math.cos(angle)
    const xMax = xMin + hFootprint

    labelInfos.push({ tick, x, label, fontSize, fontWeight, labelWidth, angle, height, xMin, xMax })
  }

  // Sort by prominence descending so higher-prominence labels take priority
  labelInfos.sort((a, b) => b.tick.prominence - a.tick.prominence)

  // Mark which labels survive collision detection
  const labelVisible = new Set<LabelInfo>()
  const occupiedExtents: { xMin: number; xMax: number }[] = []

  for (const info of labelInfos) {
    const pad = LABEL_PAD / 2
    let overlaps = false
    for (const occ of occupiedExtents) {
      if (info.xMin - pad < occ.xMax && info.xMax + pad > occ.xMin) {
        overlaps = true
        break
      }
    }
    if (!overlaps) {
      labelVisible.add(info)
      occupiedExtents.push({ xMin: info.xMin, xMax: info.xMax })
    }
  }

  // Pass 1: tick lines
  let maxTickHeight = 0
  for (const { tick, x } of ticksWithX) {
    if (x < -50 || x > cssWidth + 50) continue

    let height = getTickHeight(tick.prominence, cssHeight)
    if (height > maxTickHeight) maxTickHeight = height
    let lineWidth = getTickLineWidth(tick.prominence)
    const tickAlpha = getTickAlpha(tick.prominence)

    const primeInfo = primeInfos?.get(tick.value)
    const isHovered = hoveredTick != null && tick.value === hoveredTick

    // Prime ticks: slightly taller + thicker
    if (primeInfo?.isPrime) {
      height *= 1.15
      lineWidth += 0.5
    }

    ctx.globalAlpha = tick.opacity
    ctx.beginPath()
    ctx.moveTo(x, centerY - height)
    ctx.lineTo(x, centerY + height)

    if (primeInfo && primeInfo.classification !== 'one') {
      // Color by smallest prime factor
      const alpha = isHovered ? Math.min(1, tickAlpha + 0.3) : tickAlpha
      ctx.strokeStyle = primeColorRgba(primeInfo.smallestPrimeFactor, alpha, isDark)
    } else {
      ctx.strokeStyle = `rgba(${colors.tickRgb}, ${tickAlpha})`
    }

    ctx.lineWidth = lineWidth
    ctx.stroke()

    // Hover highlight: subtle glow ring
    if (isHovered && primeInfo && primeInfo.classification !== 'one') {
      ctx.save()
      ctx.globalAlpha = 0.25 * tick.opacity
      ctx.strokeStyle = primeColorRgba(primeInfo.smallestPrimeFactor, 1, isDark)
      ctx.lineWidth = lineWidth + 3
      ctx.beginPath()
      ctx.moveTo(x, centerY - height)
      ctx.lineTo(x, centerY + height)
      ctx.stroke()
      ctx.restore()
    }

    ctx.globalAlpha = 1
  }

  // Pass 2: labels with smooth collision fade.
  // All labels are rendered (not just visible ones) so that collision-hidden
  // labels can fade out over COLLISION_FADE_MS instead of disappearing instantly.
  const now = performance.now()
  let animating = false
  const seenValues = new Set<number>()

  for (const info of labelInfos) {
    const { tick, x, label, fontSize, fontWeight, labelWidth, angle, height } = info
    const isVisible = labelVisible.has(info)
    seenValues.add(tick.value)

    // Compute collision opacity (1 = fully visible, 0 = collision-hidden)
    let collisionOpacity = isVisible ? 1 : 0

    if (collisionFadeMap) {
      let entry = collisionFadeMap.get(tick.value)
      if (!entry) {
        // First time seeing this label — no fade, just snap to current state
        entry = { visible: isVisible, startTime: now, startOpacity: isVisible ? 1 : 0 }
        collisionFadeMap.set(tick.value, entry)
      } else if (entry.visible !== isVisible) {
        // Visibility changed — start transition from current animated position
        const elapsed = now - entry.startTime
        const t = Math.min(1, elapsed / COLLISION_FADE_MS)
        const prevTarget = entry.visible ? 1 : 0
        const currentOpacity = entry.startOpacity + (prevTarget - entry.startOpacity) * t
        entry.visible = isVisible
        entry.startTime = now
        entry.startOpacity = currentOpacity
      }

      const elapsed = now - entry.startTime
      const t = Math.min(1, elapsed / COLLISION_FADE_MS)
      const target = entry.visible ? 1 : 0
      collisionOpacity = entry.startOpacity + (target - entry.startOpacity) * t

      if (t < 1) animating = true
    }

    // Skip fully hidden labels
    if (collisionOpacity <= 0.01) continue

    const labelAlpha = getTickAlpha(tick.prominence)

    ctx.font = `${fontWeight} ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
    ctx.globalAlpha = tick.opacity * collisionOpacity

    const labelPrimeInfo = primeInfos?.get(tick.value)
    if (labelPrimeInfo && labelPrimeInfo.classification !== 'one') {
      ctx.fillStyle = primeColorRgba(labelPrimeInfo.smallestPrimeFactor, labelAlpha, isDark)
    } else {
      ctx.fillStyle = `rgba(${colors.labelRgb}, ${labelAlpha})`
    }

    const labelY = centerY + height + 4

    // t: 0 = fully horizontal/centered, 1 = fully rotated/left-aligned
    const tAngle = MAX_LABEL_ANGLE > 0 ? Math.min(angle / MAX_LABEL_ANGLE, 1) : 0
    const xOffset = -labelWidth / 2 * (1 - tAngle)

    ctx.save()
    ctx.translate(x, labelY)
    ctx.rotate(angle)
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    ctx.fillText(label, xOffset, 0)
    ctx.restore()

    ctx.globalAlpha = 1
  }

  // Clean up stale entries no longer in the viewport
  if (collisionFadeMap) {
    for (const key of collisionFadeMap.keys()) {
      if (!seenValues.has(key)) {
        collisionFadeMap.delete(key)
      }
    }
  }

  // Pass 2.25: prime markers
  // Two sources of prime dots:
  // (a) Tick-based dots (above prime ticks) — visible when zoomed in enough for integer ticks
  // (b) Axis-level dots from visiblePrimes — visible at any zoom level, independent of ticks
  if (primeInfos) {
    for (const { tick, x } of ticksWithX) {
      if (x < -50 || x > cssWidth + 50) continue
      const pi = primeInfos.get(tick.value)
      if (!pi?.isPrime) continue

      const height = getTickHeight(tick.prominence, cssHeight) * 1.15
      const dotRadius = 2 + tick.prominence * 2
      const dotY = centerY - height - 4

      ctx.globalAlpha = tick.opacity
      ctx.beginPath()
      ctx.arc(x, dotY, dotRadius, 0, Math.PI * 2)
      ctx.fillStyle = primeColorRgba(pi.value, 0.85, isDark)
      ctx.fill()

      // Mersenne prime halo
      if (MERSENNE_PRIMES.has(pi.value)) {
        ctx.beginPath()
        ctx.arc(x, dotY, dotRadius + 3, 0, Math.PI * 2)
        ctx.strokeStyle = isDark ? 'rgba(255, 158, 238, 0.6)' : 'rgba(160, 48, 142, 0.5)'
        ctx.lineWidth = 1.5
        ctx.stroke()
      }

      ctx.globalAlpha = 1
    }
  }

  // Axis-level prime dots (visible when zoomed out) — score-based sizing
  if (interestingPrimes && interestingPrimes.length > 0) {
    const count = interestingPrimes.length
    const baseAlpha = count < 50 ? 0.8 : count < 200 ? 0.65 : count < 800 ? 0.5 : 0.35
    // Offset dots slightly above axis so they don't get hidden by the axis line
    const dotY = centerY - 1

    for (const ip of interestingPrimes) {
      const x = numberToScreenX(ip.value, state.center, state.pixelsPerUnit, cssWidth)
      if (x < -5 || x > cssWidth + 5) continue

      // Skip if this prime already has a visible tick-based dot (avoid double-drawing)
      const tickInfo = primeInfos?.get(ip.value)
      if (tickInfo) continue

      // Score-based dot radius: clamp(2 + score/20, 1.5, 6)
      const dotRadius = Math.max(1.5, Math.min(6, 2 + ip.score / 20))
      // Higher-scoring primes are more opaque
      const alpha = Math.min(baseAlpha + ip.score / 200, 0.95)

      ctx.globalAlpha = alpha
      ctx.beginPath()
      ctx.arc(x, dotY, dotRadius, 0, Math.PI * 2)
      ctx.fillStyle = primeColorRgba(ip.value, 1, isDark)
      ctx.fill()

      // Mersenne prime halo (axis-level)
      if (MERSENNE_PRIMES.has(ip.value)) {
        ctx.globalAlpha = Math.min(alpha + 0.2, 0.9)
        ctx.beginPath()
        ctx.arc(x, dotY, dotRadius + 2.5, 0, Math.PI * 2)
        ctx.strokeStyle = isDark ? 'rgba(255, 158, 238, 0.7)' : 'rgba(160, 48, 142, 0.6)'
        ctx.lineWidth = 1.5
        ctx.stroke()
      }
    }
    ctx.globalAlpha = 1
  }

  // Pass 2.3: prime pair arcs (twin / cousin / sexy) — for hovered or highlighted primes
  const showArcs = hoveredTick != null || (highlightedPrimes && highlightedPrimes.size > 0)
  if (primePairArcs && primePairArcs.length > 0 && showArcs) {
    const arcOrder: Array<'sexy' | 'cousin' | 'twin'> = ['sexy', 'cousin', 'twin']

    for (const arcType of arcOrder) {
      const colorTemplate = isDark ? ARC_COLORS[arcType].dark : ARC_COLORS[arcType].light
      const alpha = arcType === 'twin' ? 0.7 : arcType === 'cousin' ? 0.6 : 0.5
      ctx.strokeStyle = colorTemplate.replace('A', String(alpha))
      ctx.lineWidth = arcType === 'twin' ? 1.5 : 1.2

      for (const arc of primePairArcs) {
        if (arc.type !== arcType) continue
        const matchesHover = arc.p1 === hoveredTick || arc.p2 === hoveredTick
        const matchesHighlight = highlightedPrimes && (highlightedPrimes.has(arc.p1) || highlightedPrimes.has(arc.p2))
        if (!matchesHover && !matchesHighlight) continue

        const x1 = numberToScreenX(arc.p1, state.center, state.pixelsPerUnit, cssWidth)
        const x2 = numberToScreenX(arc.p2, state.center, state.pixelsPerUnit, cssWidth)

        if (x2 < -10 || x1 > cssWidth + 10) continue
        const screenDist = x2 - x1
        if (screenDist < 3) continue

        const midX = (x1 + x2) / 2
        const arcDepth = Math.min(16, Math.max(3, screenDist * 0.3))

        ctx.beginPath()
        ctx.moveTo(x1, centerY + 1)
        ctx.quadraticCurveTo(midX, centerY + 1 + arcDepth, x2, centerY + 1)
        ctx.stroke()
      }
    }
    ctx.globalAlpha = 1
  }

  // Pass 2.5: mathematical constants
  if (constants && constants.length > 0) {
    renderConstantDropLines(ctx, constants, centerY, isDark, maxTickHeight)
  }

  // Pass 3: target emoji (Find the Number game)
  if (target && target.opacity > 0) {
    const tx = numberToScreenX(target.value, state.center, state.pixelsPerUnit, cssWidth)
    // Scale emoji size with opacity: 24px at low opacity, 40px at full
    const emojiSize = 24 + 16 * target.opacity
    // Pulsing glow when nearly found
    if (target.opacity > 0.8) {
      const pulsePhase = (Date.now() % 1500) / 1500
      const pulseAlpha = 0.15 + 0.1 * Math.sin(pulsePhase * Math.PI * 2)
      const glowRadius = emojiSize * 1.2
      const glow = ctx.createRadialGradient(tx, centerY, 0, tx, centerY, glowRadius)
      glow.addColorStop(0, `hsla(45, 100%, 60%, ${pulseAlpha * target.opacity})`)
      glow.addColorStop(1, `hsla(45, 100%, 60%, 0)`)
      ctx.globalAlpha = 1
      ctx.fillStyle = glow
      ctx.fillRect(tx - glowRadius, centerY - glowRadius, glowRadius * 2, glowRadius * 2)
    }

    ctx.globalAlpha = target.opacity
    ctx.font = `${emojiSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = isDark ? '#fff' : '#000'
    ctx.fillText(target.emoji, tx, centerY)
    ctx.globalAlpha = 1
  }

  return animating
}
