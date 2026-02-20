import type { RenderConstant } from '../types'
import type { MathConstant } from './constantsData'
import {
  SYMBOL_GAP_ABOVE_TICKS,
  CONSTANT_COLOR_LIGHT,
  CONSTANT_COLOR_DARK,
} from './renderConstants'

/** Pre-built lookup from constant ID → MathConstant (populated on first call) */
let constantLookup: Map<string, MathConstant> | null = null

function getConstantLookup(allConstants: MathConstant[]): Map<string, MathConstant> {
  if (!constantLookup) {
    constantLookup = new Map(allConstants.map((c) => [c.id, c]))
  }
  return constantLookup
}

/**
 * Sync DOM MathML symbol elements with the current set of visible constants.
 *
 * Called directly from the draw() rAF loop — avoids React re-renders for
 * smooth 60fps position tracking during pan/zoom.
 *
 * Each constant gets an absolutely positioned div containing its MathML markup,
 * placed so the bottom of the symbol sits above the tallest tick.
 */
export function updateConstantMarkerDOM(
  container: HTMLDivElement,
  constants: RenderConstant[],
  allConstants: MathConstant[],
  centerY: number,
  maxTickHeight: number,
  isDark: boolean
): void {
  const lookup = getConstantLookup(allConstants)
  const color = isDark ? CONSTANT_COLOR_DARK : CONSTANT_COLOR_LIGHT
  const symbolBottomY = centerY - maxTickHeight - SYMBOL_GAP_ABOVE_TICKS

  // Build set of IDs that should be present
  const activeIds = new Set<string>()

  // Index existing children by constant ID
  const existing = new Map<string, HTMLElement>()
  for (let i = 0; i < container.children.length; i++) {
    const el = container.children[i] as HTMLElement
    const id = el.dataset.constantId
    if (id) existing.set(id, el)
  }

  for (const rc of constants) {
    if (rc.opacity <= 0) continue
    activeIds.add(rc.id)

    const data = lookup.get(rc.id)
    if (!data) continue

    let el = existing.get(rc.id)
    if (!el) {
      el = document.createElement('div')
      el.dataset.constantId = rc.id
      el.style.position = 'absolute'
      el.style.pointerEvents = 'none'
      el.style.transform = 'translate(-50%, -100%)'
      el.style.fontWeight = '700'
      el.style.lineHeight = '1'
      el.style.whiteSpace = 'nowrap'
      el.innerHTML = data.mathml
      container.appendChild(el)
    }

    // Update position, opacity, and color every frame
    el.style.left = `${rc.screenX}px`
    el.style.top = `${symbolBottomY}px`
    el.style.opacity = String(rc.opacity)
    el.style.color = color
    el.style.fontSize = rc.discovered ? '20px' : '18px'
  }

  // Remove elements for constants no longer visible
  for (const [id, el] of existing) {
    if (!activeIds.has(id)) {
      container.removeChild(el)
    }
  }
}
