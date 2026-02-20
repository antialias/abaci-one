/**
 * Homepage preview target registry.
 *
 * Each target describes how to produce a preview image for an exploration card.
 * Canvas targets render client-side via an offscreen canvas; AI targets delegate
 * to the existing image generation pipeline.
 */

// ---------------------------------------------------------------------------
// Euclid imports
// ---------------------------------------------------------------------------
import { buildFinalState } from '@/components/toys/euclid/render/buildFinalStates'
import { renderConstruction } from '@/components/toys/euclid/render/renderConstruction'
import {
  getAllPoints,
  getAllCircles,
  getPoint,
  getRadius,
} from '@/components/toys/euclid/engine/constructionState'
import { PROP_1 } from '@/components/toys/euclid/propositions/prop1'
import type { ConstructionState, EuclidViewportState } from '@/components/toys/euclid/types'

// ---------------------------------------------------------------------------
// Number line imports
// ---------------------------------------------------------------------------
import {
  renderPiOverlay,
  piDemoViewport,
} from '@/components/toys/number-line/constants/demos/piDemo'

// ---------------------------------------------------------------------------
// Coordinate plane imports
// ---------------------------------------------------------------------------
import { renderCoordinatePlane } from '@/components/toys/coordinate-plane/renderCoordinatePlane'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CanvasPreviewTarget {
  id: string
  type: 'canvas'
  label: string
  width: number
  height: number
  /** Self-contained recipe: build state, compute viewport, render to ctx. */
  render: (ctx: CanvasRenderingContext2D, w: number, h: number) => void
}

export interface AIPreviewTarget {
  id: string
  type: 'ai'
  label: string
  prompt: string
  width: number
  height: number
}

export type PreviewTarget = CanvasPreviewTarget | AIPreviewTarget

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PADDING_FRACTION = 0.15

/** Compute a viewport that frames all Euclid geometry into the given pixel dims. */
function computeFitViewport(state: ConstructionState, w: number, h: number): EuclidViewportState {
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity

  for (const pt of getAllPoints(state)) {
    minX = Math.min(minX, pt.x)
    maxX = Math.max(maxX, pt.x)
    minY = Math.min(minY, pt.y)
    maxY = Math.max(maxY, pt.y)
  }

  for (const circle of getAllCircles(state)) {
    const center = getPoint(state, circle.centerId)
    if (!center) continue
    const r = getRadius(state, circle.id)
    minX = Math.min(minX, center.x - r)
    maxX = Math.max(maxX, center.x + r)
    minY = Math.min(minY, center.y - r)
    maxY = Math.max(maxY, center.y + r)
  }

  const rangeX = maxX - minX
  const rangeY = maxY - minY
  const padX = rangeX * PADDING_FRACTION
  const padY = rangeY * PADDING_FRACTION
  minX -= padX
  maxX += padX
  minY -= padY
  maxY += padY

  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2
  const scaleX = w / (maxX - minX)
  const scaleY = h / (maxY - minY)
  const pixelsPerUnit = Math.min(scaleX, scaleY)

  return { center: { x: cx, y: cy }, pixelsPerUnit }
}

// ---------------------------------------------------------------------------
// Canvas targets
// ---------------------------------------------------------------------------

const euclidProp1: CanvasPreviewTarget = {
  id: 'euclid-prop1',
  type: 'canvas',
  label: "Euclid's Elements",
  width: 800,
  height: 500,
  render(ctx, w, h) {
    const finalState = buildFinalState(1)
    if (!finalState) return
    const viewport = computeFitViewport(finalState, w, h)
    const idle = { tag: 'idle' as const }

    renderConstruction(
      ctx,
      finalState,
      viewport,
      w,
      h,
      idle, // compassPhase
      idle, // straightedgePhase
      null, // pointerWorld
      null, // snappedPointId
      [], // candidates
      0, // nextColorIndex
      null, // candidateFilter
      true, // isComplete
      PROP_1.resultSegments,
      undefined, // hiddenElementIds
      false // transparentBg (white bg for preview)
    )
  },
}

const numberlinePi: CanvasPreviewTarget = {
  id: 'numberline-pi',
  type: 'canvas',
  label: 'Constant Demos',
  width: 800,
  height: 500,
  render(ctx, w, h) {
    const vp = piDemoViewport(w, h)
    const state = { center: vp.center, pixelsPerUnit: vp.pixelsPerUnit }
    renderPiOverlay(ctx, state, w, h, true, 0.6, 1)
  },
}

const coordinatePlane: CanvasPreviewTarget = {
  id: 'coordinate-plane',
  type: 'canvas',
  label: 'Coordinate Plane',
  width: 800,
  height: 500,
  render(ctx, w, h) {
    const state = { center: { x: 0, y: 0 }, pixelsPerUnit: { x: 50, y: 50 } }
    renderCoordinatePlane(ctx, state, w, h, true)
  },
}

// ---------------------------------------------------------------------------
// AI targets
// ---------------------------------------------------------------------------

const numberlineCall: AIPreviewTarget = {
  id: 'numberline-call',
  type: 'ai',
  label: 'Talk to a Number',
  width: 800,
  height: 500,
  prompt:
    'A whimsical illustration of a phone call interface floating above a number line. ' +
    'A child is talking on the phone to the number 7, which has a friendly face and is waving. ' +
    'The number line stretches horizontally with tick marks and numbers. ' +
    'Warm, playful art style with a dark background. Educational math app UI.',
}

const diceTray: AIPreviewTarget = {
  id: 'dice-tray',
  type: 'ai',
  label: 'Dice Tray',
  width: 800,
  height: 500,
  prompt:
    'Colorful 3D dice mid-roll on a dark felt surface, viewed from slightly above. ' +
    'Multiple dice in bright primary colors (red, blue, green, yellow) with white pips, ' +
    'some still spinning. Dramatic lighting with soft shadows. ' +
    'Clean, modern illustration style suitable for a math education app.',
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const PREVIEW_TARGETS: PreviewTarget[] = [
  euclidProp1,
  numberlinePi,
  numberlineCall,
  coordinatePlane,
  diceTray,
]

export const CANVAS_TARGETS = PREVIEW_TARGETS.filter(
  (t): t is CanvasPreviewTarget => t.type === 'canvas'
)

export const AI_TARGETS = PREVIEW_TARGETS.filter((t): t is AIPreviewTarget => t.type === 'ai')

/** Look up a target by id. */
export function getPreviewTarget(id: string): PreviewTarget | undefined {
  return PREVIEW_TARGETS.find((t) => t.id === id)
}
