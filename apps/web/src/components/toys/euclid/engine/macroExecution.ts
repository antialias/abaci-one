import type { ConstructionElement } from '../types'
import type { MacroResult } from './macros'

export interface MacroAnimation {
  elements: ConstructionElement[]
  startTime: number
  perElementMs: number
  revealedCount: number
}

/** Create a macro animation from a macro result */
export function createMacroAnimation(result: MacroResult): MacroAnimation {
  return {
    elements: result.addedElements,
    startTime: performance.now(),
    perElementMs: 200,
    revealedCount: 0,
  }
}

/**
 * Tick the animation forward. Returns the new number of revealed elements.
 * When revealedCount >= elements.length, animation is complete.
 */
export function tickMacroAnimation(anim: MacroAnimation): number {
  const elapsed = performance.now() - anim.startTime
  const count = Math.min(Math.floor(elapsed / anim.perElementMs) + 1, anim.elements.length)
  return count
}

/** Get the set of element IDs that should be hidden during animation */
export function getHiddenElementIds(anim: MacroAnimation | null): Set<string> {
  const hidden = new Set<string>()
  if (!anim) return hidden
  for (let i = anim.revealedCount; i < anim.elements.length; i++) {
    hidden.add(anim.elements[i].id)
  }
  return hidden
}
