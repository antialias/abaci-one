import type { PropositionDef, ConstructionElement } from '../types'
import { BYRNE } from '../types'

// ── Seeded LCG PRNG for reproducible layout ──

const LCG_A = 1664525
const LCG_C = 1013904223
const LCG_M = 2 ** 32

function createLCG(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (LCG_A * state + LCG_C) % LCG_M
    return state / LCG_M // [0, 1)
  }
}

// ── Generate 25 well-separated points ──

const POINT_COUNT = 25
const MIN_SEP = 0.9 // world units (~45px at default zoom)
const X_MIN = -5.5
const X_MAX = 5.5
const Y_MIN = -3.5
const Y_MAX = 3.5

function generatePoints(): ConstructionElement[] {
  const rng = createLCG(42)
  const points: { x: number; y: number }[] = []
  const labels = 'ABCDEFGHIJKLMNOPQRSTUVWXY'
  let attempts = 0

  while (points.length < POINT_COUNT && attempts < 5000) {
    attempts++
    const x = X_MIN + rng() * (X_MAX - X_MIN)
    const y = Y_MIN + rng() * (Y_MAX - Y_MIN)

    // Check minimum separation
    let tooClose = false
    for (const p of points) {
      const dx = p.x - x
      const dy = p.y - y
      if (dx * dx + dy * dy < MIN_SEP * MIN_SEP) {
        tooClose = true
        break
      }
    }
    if (tooClose) continue

    points.push({ x, y })
  }

  return points.map((p, i) => ({
    kind: 'point' as const,
    id: `pt-${labels[i]}`,
    x: Math.round(p.x * 100) / 100,
    y: Math.round(p.y * 100) / 100,
    label: labels[i],
    color: BYRNE.given,
    origin: 'given' as const,
  }))
}

/**
 * Playground "proposition" — free-form construction sandbox.
 * 25 seeded-random given points, no steps, no validation.
 */
const givenElements = generatePoints()

export const PLAYGROUND_PROP: PropositionDef = {
  id: 0,
  title: 'Construction Playground',
  givenElements,
  draggablePointIds: givenElements.map((el) => el.id),
  steps: [],
}
