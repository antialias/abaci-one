/**
 * Render Post.2 production segments — visual extensions of existing segments
 * to intersection points that lie beyond a given endpoint.
 *
 * These are computed at render time from the construction state and step
 * definitions, so they require no additional state management.
 *
 * Styled thinner (1px) and at reduced opacity (50%) to distinguish from
 * Post.1 segments (which are full-weight solid lines).
 */
import type { ConstructionState, PropositionStep, EuclidViewportState } from '../types'
import { getPoint } from '../engine/constructionState'
import { resolveSelector } from '../engine/selectors'
import { worldToScreen2D } from '../../shared/coordinateConversions'

function toScreen(
  wx: number,
  wy: number,
  viewport: EuclidViewportState,
  w: number,
  h: number,
) {
  return worldToScreen2D(
    wx, wy,
    viewport.center.x, viewport.center.y,
    viewport.pixelsPerUnit, viewport.pixelsPerUnit,
    w, h,
  )
}

export function renderProductionSegments(
  ctx: CanvasRenderingContext2D,
  state: ConstructionState,
  steps: readonly PropositionStep[],
  completedUpTo: number,
  viewport: EuclidViewportState,
  w: number,
  h: number,
) {
  for (let i = 0; i < completedUpTo; i++) {
    const step = steps[i]
    if (step.expected.type !== 'intersection' || !step.expected.beyondId || !step.expected.label) continue

    const beyondPt = getPoint(state, step.expected.beyondId)
    const intPt = getPoint(state, `pt-${step.expected.label}`)
    if (!beyondPt || !intPt) continue

    // Find the parent segment's color
    let segColor = '#888'
    const resolvedA = step.expected.ofA != null ? resolveSelector(step.expected.ofA, state) : null
    const resolvedB = step.expected.ofB != null ? resolveSelector(step.expected.ofB, state) : null
    for (const id of [resolvedA, resolvedB]) {
      if (id) {
        const el = state.elements.find(e => e.id === id)
        if (el && el.kind === 'segment') {
          segColor = el.color
          break
        }
      }
    }

    const from = toScreen(beyondPt.x, beyondPt.y, viewport, w, h)
    const to = toScreen(intPt.x, intPt.y, viewport, w, h)

    ctx.save()
    ctx.beginPath()
    ctx.moveTo(from.x, from.y)
    ctx.lineTo(to.x, to.y)
    ctx.strokeStyle = segColor
    ctx.globalAlpha = 0.5
    ctx.lineWidth = 1
    ctx.setLineDash([6, 4])
    ctx.stroke()
    ctx.setLineDash([])
    ctx.restore()
  }
}
