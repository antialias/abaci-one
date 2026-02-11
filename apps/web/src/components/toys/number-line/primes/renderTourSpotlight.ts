import type { NumberLineState } from '../types'
import { numberToScreenX } from '../numberLineTicks'
import { primeColorRgba } from './primeColors'
import { smallestPrimeFactor } from './sieve'

const TAU = Math.PI * 2
const SPOTLIGHT_RADIUS = 40
const FEATHER_WIDTH = 20

/**
 * Render a dim overlay with spotlight cutouts around highlighted values,
 * plus a pulsing glow on each highlighted number.
 *
 * Called after renderNumberLine() during the prime tour to direct attention
 * to the numbers the narrator is describing.
 */
export function renderTourSpotlight(
  ctx: CanvasRenderingContext2D,
  state: NumberLineState,
  cssWidth: number,
  cssHeight: number,
  isDark: boolean,
  highlightValues: number[],
  dimAmount: number,
  tourOpacity: number
): void {
  if (highlightValues.length === 0 || dimAmount <= 0 || tourOpacity <= 0) return

  const centerY = cssHeight / 2
  const dimAlpha = dimAmount * tourOpacity

  // Compute screen positions for each highlight
  const spots = highlightValues.map(v => ({
    value: v,
    screenX: numberToScreenX(v, state.center, state.pixelsPerUnit, cssWidth),
  }))

  // --- 1. Dim overlay with spotlight cutouts (even-odd fill) ---
  ctx.save()
  ctx.beginPath()
  // Outer rect (clockwise)
  ctx.rect(0, 0, cssWidth, cssHeight)
  // Spotlight holes (counter-clockwise)
  for (const spot of spots) {
    ctx.moveTo(spot.screenX + SPOTLIGHT_RADIUS, centerY)
    ctx.arc(spot.screenX, centerY, SPOTLIGHT_RADIUS, 0, TAU, true)
  }
  ctx.fillStyle = isDark
    ? `rgba(0, 0, 0, ${dimAlpha})`
    : `rgba(0, 0, 0, ${dimAlpha * 0.7})`
  ctx.fill('evenodd')
  ctx.restore()

  // --- 2. Feathered edges around each cutout ---
  for (const spot of spots) {
    const innerR = SPOTLIGHT_RADIUS
    const outerR = SPOTLIGHT_RADIUS + FEATHER_WIDTH
    const gradient = ctx.createRadialGradient(
      spot.screenX, centerY, innerR,
      spot.screenX, centerY, outerR
    )
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0)')
    const featherAlpha = isDark ? dimAlpha : dimAlpha * 0.7
    gradient.addColorStop(1, `rgba(0, 0, 0, ${featherAlpha})`)

    ctx.save()
    ctx.fillStyle = gradient
    ctx.fillRect(
      spot.screenX - outerR, centerY - outerR,
      outerR * 2, outerR * 2
    )
    ctx.restore()
  }

  // --- 3. Pulsing glow at each highlighted position ---
  const pulsePhase = (Date.now() % 2000) / 2000
  const pulseAlpha = 0.15 + 0.1 * Math.sin(pulsePhase * TAU)

  for (const spot of spots) {
    const spf = spot.value >= 2 ? smallestPrimeFactor(spot.value) : spot.value
    const glowRadius = 30
    const glow = ctx.createRadialGradient(
      spot.screenX, centerY, 0,
      spot.screenX, centerY, glowRadius
    )
    glow.addColorStop(0, primeColorRgba(spf, pulseAlpha * tourOpacity, isDark))
    glow.addColorStop(1, 'rgba(0, 0, 0, 0)')

    ctx.save()
    ctx.globalAlpha = 1
    ctx.fillStyle = glow
    ctx.fillRect(
      spot.screenX - glowRadius, centerY - glowRadius,
      glowRadius * 2, glowRadius * 2
    )
    ctx.restore()
  }
}
