/**
 * Label collision detection and fade logic shared between number line and coordinate plane.
 */

/** Per-label fade state for smooth collision show/hide transitions */
export interface CollisionFadeEntry {
  /** Whether the label is currently visible (not collision-hidden) */
  visible: boolean
  /** performance.now() when visibility last changed */
  startTime: number
  /** Opacity at the moment visibility changed (to animate from) */
  startOpacity: number
}

/** Map from tick value -> fade state, persisted across frames */
export type CollisionFadeMap = Map<number, CollisionFadeEntry>

/**
 * Compute collision opacity for a single label, updating the fade map entry.
 *
 * Returns the current opacity (0-1) and whether the animation is still in progress.
 */
export function computeCollisionOpacity(
  value: number,
  isVisible: boolean,
  fadeMap: CollisionFadeMap,
  now: number,
  fadeDurationMs: number
): { opacity: number; animating: boolean } {
  let entry = fadeMap.get(value)
  if (!entry) {
    entry = { visible: isVisible, startTime: now, startOpacity: isVisible ? 1 : 0 }
    fadeMap.set(value, entry)
  } else if (entry.visible !== isVisible) {
    const elapsed = now - entry.startTime
    const t = Math.min(1, elapsed / fadeDurationMs)
    const prevTarget = entry.visible ? 1 : 0
    const currentOpacity = entry.startOpacity + (prevTarget - entry.startOpacity) * t
    entry.visible = isVisible
    entry.startTime = now
    entry.startOpacity = currentOpacity
  }

  const elapsed = now - entry.startTime
  const t = Math.min(1, elapsed / fadeDurationMs)
  const target = entry.visible ? 1 : 0
  const opacity = entry.startOpacity + (target - entry.startOpacity) * t

  return { opacity, animating: t < 1 }
}
